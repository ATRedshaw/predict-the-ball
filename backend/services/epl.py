"""Service helpers for EPL season state, tables, and projections.

Current-season Premier League data is read from the FPL API. Historical local
data and trained ELO inputs come from ``backend/modelling-new``.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

_BACKEND_DIR = Path(__file__).parent.parent
_MODELLING_NEW_DIR = _BACKEND_DIR / "modelling-new"
_EPL_RAW_DIR = _MODELLING_NEW_DIR / "data" / "raw" / "EPL"
_PREPROCESSED_RESULTS = _MODELLING_NEW_DIR / "data" / "preprocessed" / "results.csv"
_ELO_PARAMS = _MODELLING_NEW_DIR / "data" / "params" / "elo.json"
_TEAM_MAPPING_PATH = _MODELLING_NEW_DIR / "data" / "mapping" / "team_name_mapping.json"

_FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
_FPL_FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/"
_USER_AGENT = "predict-the-ball/1.0"

# Handles standard scores ("1-2"), penalty shootouts ("(4) 1-1 (3)"), and en dashes.
_SCORE_RE = re.compile(r"(?:\(\d+\)\s*)?(\d+)\s*[–\-]\s*(\d+)(?:\s*\(\d+\))?")

_UK_TZ = ZoneInfo("Europe/London")


def _fetch_json(url: str, timeout: int = 30):
    """Fetch a JSON response from an API URL."""
    request = Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {detail[:300]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not fetch {url}: {exc.reason}") from exc


@lru_cache(maxsize=1)
def _fetch_fpl_bootstrap() -> dict:
    """Fetch FPL bootstrap data.

    Bootstrap data contains stable current-season metadata and team names, so
    this is cached for the process lifetime. Fixture scores are intentionally
    fetched fresh.
    """
    data = _fetch_json(_FPL_BOOTSTRAP_URL)
    if not isinstance(data, dict):
        raise ValueError("FPL bootstrap response must be a JSON object")
    return data


def _fetch_fpl_fixtures() -> list[dict]:
    """Fetch current-season FPL fixtures."""
    data = _fetch_json(_FPL_FIXTURES_URL)
    if not isinstance(data, list):
        raise ValueError("FPL fixtures response must be a JSON list")
    return [row for row in data if isinstance(row, dict)]


def _season_code(start_year: int) -> str:
    """Return compact season code, e.g. 2025 -> 2526."""
    return f"{start_year % 100:02d}{(start_year + 1) % 100:02d}"


def _display_season(start_year: int) -> str:
    """Return display season label, e.g. 2025 -> 2025-26."""
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def _start_year_from_display(season: str) -> int:
    """Extract the start year from a display season label."""
    return int(season[:4])


def _parse_fpl_datetime(value: str) -> datetime | None:
    """Parse an FPL ISO datetime into UK local time."""
    if not isinstance(value, str) or not value.strip():
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(_UK_TZ)


def _is_gameweek_1(event: dict) -> bool:
    """Return whether an FPL event object is gameweek 1."""
    try:
        if int(event.get("id")) == 1:
            return True
    except (TypeError, ValueError):
        pass
    return str(event.get("name", "")).strip().lower() == "gameweek 1"


def _gameweek_1_deadline(bootstrap: dict | None = None) -> datetime:
    """Extract gameweek 1 deadline from FPL bootstrap data."""
    bootstrap = bootstrap or _fetch_fpl_bootstrap()
    events = bootstrap.get("events", [])
    if not isinstance(events, list):
        raise ValueError("FPL bootstrap events must be a list")

    for event in events:
        if isinstance(event, dict) and _is_gameweek_1(event):
            parsed = _parse_fpl_datetime(event.get("deadline_time", ""))
            if parsed is not None:
                return parsed

    raise ValueError("Could not find FPL gameweek 1 deadline")


def _current_fpl_start_year(bootstrap: dict | None = None) -> int:
    """Infer the current FPL season start year from GW1's deadline."""
    deadline = _gameweek_1_deadline(bootstrap)
    return deadline.year if deadline.month >= 6 else deadline.year - 1


def _is_current_fpl_season(season: str, bootstrap: dict | None = None) -> bool:
    """Return whether the given display season is the active FPL season."""
    return _start_year_from_display(season) == _current_fpl_start_year(bootstrap)


def _load_team_name_mapping() -> dict[str, str]:
    """Load FPL-name to modelling-new team-name mapping."""
    if not _TEAM_MAPPING_PATH.exists():
        return {}
    with _TEAM_MAPPING_PATH.open() as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Team mapping must be a JSON object: {_TEAM_MAPPING_PATH}")
    return {
        str(key).strip(): str(value).strip()
        for key, value in data.items()
        if str(key).strip() and str(value).strip()
    }


def _map_fpl_team_name(name: str, mapping: dict[str, str]) -> str:
    """Map an FPL team name to the modelling-new historical name."""
    return mapping.get(name, name)


def _fpl_team_by_id(bootstrap: dict | None = None) -> dict[int, str]:
    """Build team-id to FPL team-name lookup."""
    bootstrap = bootstrap or _fetch_fpl_bootstrap()
    teams = bootstrap.get("teams", [])
    if not isinstance(teams, list):
        raise ValueError("FPL bootstrap teams must be a list")

    lookup: dict[int, str] = {}
    for team in teams:
        if not isinstance(team, dict):
            continue
        try:
            team_id = int(team["id"])
        except (KeyError, TypeError, ValueError):
            continue
        name = str(team.get("name", "")).strip()
        if name:
            lookup[team_id] = name

    if not lookup:
        raise ValueError("FPL bootstrap did not include team names")
    return lookup


def _mapped_current_fpl_teams(bootstrap: dict | None = None) -> list[str]:
    """Return current EPL teams using modelling-new names."""
    bootstrap = bootstrap or _fetch_fpl_bootstrap()
    mapping = _load_team_name_mapping()
    teams = {
        _map_fpl_team_name(name, mapping)
        for name in _fpl_team_by_id(bootstrap).values()
    }
    return sorted(teams)


def _is_completed_fixture(fixture: dict) -> bool:
    """Return whether an FPL fixture has a completed score."""
    if fixture.get("team_h_score") is None or fixture.get("team_a_score") is None:
        return False
    if fixture.get("finished") is True or fixture.get("finished_provisional") is True:
        return True
    try:
        return int(fixture.get("minutes", 0)) >= 90
    except (TypeError, ValueError):
        return False


def _current_fpl_fixture_data() -> tuple[list[str], list[dict], list[dict]]:
    """Return current EPL teams, completed results, and remaining fixtures.

    Team names are mapped from FPL names to modelling-new historical names.
    """
    bootstrap = _fetch_fpl_bootstrap()
    fixtures = _fetch_fpl_fixtures()
    mapping = _load_team_name_mapping()
    team_by_id = _fpl_team_by_id(bootstrap)
    season = _season_code(_current_fpl_start_year(bootstrap))
    teams = _mapped_current_fpl_teams(bootstrap)

    completed: list[dict] = []
    remaining: list[dict] = []

    for fixture in fixtures:
        try:
            home_fpl = team_by_id[int(fixture["team_h"])]
            away_fpl = team_by_id[int(fixture["team_a"])]
        except (KeyError, TypeError, ValueError):
            continue

        home = _map_fpl_team_name(home_fpl, mapping)
        away = _map_fpl_team_name(away_fpl, mapping)
        kickoff = _parse_fpl_datetime(fixture.get("kickoff_time", ""))

        if _is_completed_fixture(fixture):
            if kickoff is None:
                continue
            try:
                home_score = int(fixture["team_h_score"])
                away_score = int(fixture["team_a_score"])
            except (KeyError, TypeError, ValueError):
                continue

            completed.append({
                "date": pd.Timestamp(kickoff.date()),
                "season": season,
                "home_team": home,
                "away_team": away,
                "home_score": home_score,
                "away_score": away_score,
            })
        else:
            remaining.append({
                "home_team": home,
                "away_team": away,
            })

    completed.sort(key=lambda row: (row["date"], row["home_team"], row["away_team"]))
    return teams, completed, remaining


def _historical_epl_csv_path(season: str) -> Path:
    """Return the modelling-new raw EPL CSV path for a historical season."""
    start_year = _start_year_from_display(season)
    return _EPL_RAW_DIR / f"EPL_{start_year}_{start_year + 1}.csv"


def _historical_epl_raw(season: str) -> pd.DataFrame:
    """Load a historical modelling-new EPL raw CSV."""
    csv_path = _historical_epl_csv_path(season)
    if not csv_path.exists():
        return pd.DataFrame()
    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()
    return df


def _historical_epl_completed_rows(season: str) -> list[dict]:
    """Convert historical raw EPL rows into completed-result dicts."""
    df = _historical_epl_raw(season)
    required = {"date", "home_team", "away_team", "score"}
    if df.empty or not required.issubset(df.columns):
        return []

    rows: list[dict] = []
    season_label = _season_code(_start_year_from_display(season))
    for _, row in df.iterrows():
        parsed = _parse_score(row.get("score", ""))
        if parsed is None:
            continue
        date = pd.to_datetime(str(row.get("date", "")).strip(), errors="coerce")
        if pd.isna(date):
            continue
        home = str(row.get("home_team", "")).strip()
        away = str(row.get("away_team", "")).strip()
        if not home or not away:
            continue
        rows.append({
            "date": date,
            "season": season_label,
            "home_team": home,
            "away_team": away,
            "home_score": parsed[0],
            "away_score": parsed[1],
        })
    return rows


def _parse_score(raw: str) -> tuple[int, int] | None:
    """Parse a score string into home and away goals."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    match = _SCORE_RE.search(raw.strip())
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def get_latest_epl_season() -> str:
    """Return the current FPL season string, e.g. ``2025-26``."""
    return _display_season(_current_fpl_start_year())


def has_season_kicked_off(season: str) -> bool:
    """Check whether the first fixture of the given EPL season has kicked off."""
    start_year = _start_year_from_display(season)
    current_start_year = _current_fpl_start_year()

    if start_year < current_start_year:
        return True
    if start_year > current_start_year:
        return False

    first_kickoff = get_first_kickoff(season)
    return first_kickoff is not None and datetime.now(_UK_TZ) >= first_kickoff


def get_first_kickoff(season: str) -> datetime | None:
    """Return the prediction deadline for current season, else first raw date.

    The function name is legacy. For the active FPL season, the authoritative
    deadline is FPL gameweek 1's deadline from bootstrap-static.
    """
    if _is_current_fpl_season(season):
        return _gameweek_1_deadline()

    df = _historical_epl_raw(season)
    if df.empty or "date" not in df.columns:
        return None
    dates = pd.to_datetime(df["date"], errors="coerce").dropna()
    if dates.empty:
        return None
    return dates.min().to_pydatetime().replace(tzinfo=_UK_TZ)


def get_season_teams(season: str) -> list[str]:
    """Return all EPL team names for a season using modelling-new names."""
    if _is_current_fpl_season(season):
        return _mapped_current_fpl_teams()

    df = _historical_epl_raw(season)
    if df.empty:
        return []

    teams: set[str] = set()
    if "home_team" in df.columns:
        teams.update(df["home_team"].dropna().astype(str).str.strip())
    if "away_team" in df.columns:
        teams.update(df["away_team"].dropna().astype(str).str.strip())
    teams.discard("")
    return sorted(teams)


def compute_prediction_score(predicted: list[str], actual_standings: list[dict]) -> int:
    """Calculate prediction score as total absolute position error."""
    actual_pos = {row["team"]: row["position"] for row in actual_standings}
    total = 0
    for i, team in enumerate(predicted):
        actual = actual_pos.get(team)
        if actual is not None:
            total += abs((i + 1) - actual)
    return total


def compute_exact_predictions(predicted: list[str], actual_standings: list[dict]) -> int:
    """Count teams placed at exactly the correct position."""
    actual_pos = {row["team"]: row["position"] for row in actual_standings}
    return sum(
        1 for i, team in enumerate(predicted)
        if actual_pos.get(team) == i + 1
    )


def _deduction_map(deductions: list[dict] | None) -> dict[str, int]:
    """Collapse point-deduction rows into a team to points map."""
    mapping: dict[str, int] = {}
    for deduction in deductions or []:
        team = deduction["team"]
        mapping[team] = mapping.get(team, 0) + deduction["points"]
    return mapping


def _build_table(
    *,
    teams: list[str],
    completed_rows: list[dict],
    deductions: list[dict] | None,
) -> list[dict]:
    """Build an EPL table from completed result rows."""
    deductions_by_team = _deduction_map(deductions)
    stats: dict[str, dict] = defaultdict(lambda: {
        "played": 0,
        "won": 0,
        "drawn": 0,
        "lost": 0,
        "goals_for": 0,
        "goals_against": 0,
    })

    for team in teams:
        stats[team]

    for row in completed_rows:
        home = row["home_team"]
        away = row["away_team"]
        home_goals = int(row["home_score"])
        away_goals = int(row["away_score"])

        stats[home]["played"] += 1
        stats[away]["played"] += 1
        stats[home]["goals_for"] += home_goals
        stats[home]["goals_against"] += away_goals
        stats[away]["goals_for"] += away_goals
        stats[away]["goals_against"] += home_goals

        if home_goals > away_goals:
            stats[home]["won"] += 1
            stats[away]["lost"] += 1
        elif away_goals > home_goals:
            stats[away]["won"] += 1
            stats[home]["lost"] += 1
        else:
            stats[home]["drawn"] += 1
            stats[away]["drawn"] += 1

    table = []
    for team, team_stats in stats.items():
        gd = team_stats["goals_for"] - team_stats["goals_against"]
        raw_points = team_stats["won"] * 3 + team_stats["drawn"]
        deducted = deductions_by_team.get(team, 0)
        table.append({
            "team": team,
            "played": team_stats["played"],
            "won": team_stats["won"],
            "drawn": team_stats["drawn"],
            "lost": team_stats["lost"],
            "goals_for": team_stats["goals_for"],
            "goals_against": team_stats["goals_against"],
            "goal_difference": gd,
            "points": raw_points - deducted,
            "points_deducted": deducted,
        })

    table.sort(key=lambda r: (-r["points"], -r["goal_difference"], -r["goals_for"], r["team"]))
    for i, row in enumerate(table, start=1):
        row["position"] = i
    return table


def calculate_epl_table(
    season: str,
    kicked_off: bool,
    deductions: list[dict] | None = None,
) -> list[dict]:
    """Calculate the EPL table for the current FPL season or a historical CSV."""
    if _is_current_fpl_season(season):
        teams, completed_rows, _ = _current_fpl_fixture_data()
        rows = completed_rows if kicked_off else []
        return _build_table(teams=teams, completed_rows=rows, deductions=deductions)

    teams = get_season_teams(season)
    if not teams:
        return []
    rows = _historical_epl_completed_rows(season) if kicked_off else []
    return _build_table(teams=teams, completed_rows=rows, deductions=deductions)


# ---------------------------------------------------------------------------
# ELO season simulation
# ---------------------------------------------------------------------------

# Maximum draw probability, applied when the two teams are perfectly matched.
_D_MAX = 0.28


def _expected_score(rating_home: float, rating_away: float, home_advantage: float) -> float:
    """Compute the binary ELO expected score for the home team."""
    return 1.0 / (1.0 + 10.0 ** ((rating_away - (rating_home + home_advantage)) / 400.0))


def _mov_multiplier(goal_diff: int, mov_weight: float) -> float:
    """Compute the margin-of-victory K-factor multiplier."""
    raw = np.log(abs(goal_diff) + 1)
    return 1.0 + mov_weight * (raw - 1.0) if raw > 1.0 else 1.0


def _compute_ratings(
    matches: pd.DataFrame,
    k_base: float,
    home_advantage: float,
    mov_weight: float,
    reversion: float,
    initial_rating: float = 1500.0,
) -> dict[str, float]:
    """Run the ELO simulation over match history and return final ratings."""
    ratings: dict[str, float] = {}
    current_season = None

    for row in matches.itertuples(index=False):
        if row.season != current_season:
            if current_season is not None and reversion > 0.0:
                for team in ratings:
                    ratings[team] += reversion * (initial_rating - ratings[team])
            current_season = row.season

        home = row.home_team
        away = row.away_team
        r_home = ratings.get(home, initial_rating)
        r_away = ratings.get(away, initial_rating)
        e_home = _expected_score(r_home, r_away, home_advantage)

        if row.home_score > row.away_score:
            s_home = 1.0
        elif row.home_score < row.away_score:
            s_home = 0.0
        else:
            s_home = 0.5

        goal_diff = abs(row.home_score - row.away_score)
        k = k_base * _mov_multiplier(goal_diff, mov_weight)
        delta = k * (s_home - e_home)
        ratings[home] = r_home + delta
        ratings[away] = r_away - delta

    return ratings


def _elo_three_way(e_home: float) -> tuple[float, float, float]:
    """Convert a binary ELO expected score into three-way probabilities."""
    p_draw = _D_MAX * (1.0 - 2.0 * abs(e_home - 0.5))
    p_home = max(0.0, e_home - p_draw / 2.0)
    p_away = max(0.0, (1.0 - e_home) - p_draw / 2.0)
    total = p_home + p_draw + p_away
    return p_home / total, p_draw / total, p_away / total


def simulate_elo_projection(
    season: str,
    n_simulations: int = 10_000,
    deductions: list[dict] | None = None,
) -> list[dict]:
    """Monte Carlo simulation of the remainder of the EPL season using ELO ratings."""
    with open(_ELO_PARAMS) as fh:
        params = json.load(fh)

    k_base: float = params["k_base"]
    home_advantage: float = params["home_advantage"]
    mov_weight: float = params["mov_weight"]
    reversion: float = params["reversion"]
    initial_rating: float = params["initial_rating"]

    start_year = _start_year_from_display(season)
    season_label = _season_code(start_year)

    history = pd.read_csv(_PREPROCESSED_RESULTS, parse_dates=["date"])
    history["season"] = history["season"].astype(str)
    history = history[history["season"] != season_label].copy()

    if _is_current_fpl_season(season):
        teams, completed_rows, remaining_fixtures = _current_fpl_fixture_data()
    else:
        teams = get_season_teams(season)
        completed_rows = _historical_epl_completed_rows(season)
        remaining_fixtures = []

    if completed_rows:
        current_df = pd.DataFrame(completed_rows)
        all_matches = pd.concat([history, current_df], ignore_index=True)
    else:
        all_matches = history

    all_matches = all_matches.sort_values("date").reset_index(drop=True)

    ratings = _compute_ratings(
        all_matches,
        k_base=k_base,
        home_advantage=home_advantage,
        mov_weight=mov_weight,
        reversion=reversion,
        initial_rating=initial_rating,
    )

    current_table = calculate_epl_table(season, bool(completed_rows), deductions)
    if not current_table:
        return []

    teams = [row["team"] for row in current_table]
    n_teams = len(teams)
    team_index = {team: i for i, team in enumerate(teams)}

    for team in teams:
        ratings.setdefault(team, initial_rating)

    fixture_probs: list[dict] = []
    for fixture in remaining_fixtures:
        home = fixture["home_team"]
        away = fixture["away_team"]
        if home not in team_index or away not in team_index:
            continue
        e_home = _expected_score(ratings[home], ratings[away], home_advantage)
        ph, pd_, pa = _elo_three_way(e_home)
        fixture_probs.append({
            "hi": team_index[home],
            "ai": team_index[away],
            "p": np.array([ph, pd_, pa], dtype=np.float64),
        })

    base_points = np.array([row["points"] for row in current_table], dtype=np.float64)
    base_gd = np.array([row["goal_difference"] for row in current_table], dtype=np.float64)

    rng = np.random.default_rng()
    sim_pts = np.tile(base_points, (n_simulations, 1))
    sim_gd = np.tile(base_gd, (n_simulations, 1))

    for fixture in fixture_probs:
        hi = fixture["hi"]
        ai = fixture["ai"]
        outcomes = rng.choice(3, size=n_simulations, p=fixture["p"])
        margins = rng.geometric(0.5, size=n_simulations).astype(np.float64)

        home_wins = outcomes == 0
        sim_pts[home_wins, hi] += 3
        sim_gd[home_wins, hi] += margins[home_wins]
        sim_gd[home_wins, ai] -= margins[home_wins]

        draws = outcomes == 1
        sim_pts[draws, hi] += 1
        sim_pts[draws, ai] += 1

        away_wins = outcomes == 2
        sim_pts[away_wins, ai] += 3
        sim_gd[away_wins, ai] += margins[away_wins]
        sim_gd[away_wins, hi] -= margins[away_wins]

    noise = rng.random((n_simulations, n_teams))
    sort_key = -sim_pts * 1e6 - sim_gd * 1e3 - noise
    ranked = np.argsort(sort_key, axis=1)

    position_counts = np.zeros((n_teams, n_teams), dtype=np.int32)
    for pos in range(n_teams):
        counts = np.bincount(ranked[:, pos], minlength=n_teams)
        position_counts[:, pos] = counts

    positions_arr = np.arange(1, n_teams + 1, dtype=np.float64)
    results: list[dict] = []
    for i, team in enumerate(teams):
        mean_pos = float(np.dot(position_counts[i], positions_arr) / n_simulations)
        finish_probs = {
            str(pos): round(float(position_counts[i, pos - 1]) / n_simulations * 100.0, 2)
            for pos in range(1, n_teams + 1)
        }
        results.append({
            "team": team,
            "mean_position": round(mean_pos, 2),
            "finish_probabilities": finish_probs,
        })

    def sort_key(row: dict) -> tuple:
        finish_probs = row["finish_probabilities"]
        return (row["mean_position"],) + tuple(
            -finish_probs.get(str(pos), 0.0)
            for pos in range(1, n_teams + 1)
        )

    results.sort(key=sort_key)
    return results
