"""Service helpers for reading EPL CSV data and deriving season/table state.

All functions are pure data operations with no Flask or DB dependencies,
so they can be called from both CLI commands and HTTP route handlers.
"""

import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

_EPL_RAW_DIR = Path(__file__).parent.parent / "modelling/data/raw/EPL"

# Handles standard scores ("1–2"), penalty shootouts ("(4) 1–1 (3)"), and plain hyphens.
_SCORE_RE = re.compile(r"(?:\(\d+\)\s*)?(\d+)\s*[–\-]\s*(\d+)(?:\s*\(\d+\))?")

_UK_TZ = ZoneInfo("Europe/London")


def get_latest_epl_season() -> str:
    """Return the latest EPL season string derived from saved CSV filenames.

    Scans ``modelling/data/raw/EPL/`` for files matching ``EPL_YYYY_YYYY.csv``
    and returns the season label for the highest start year found.

    Returns:
        Season string in ``'20xx-xx'`` format, e.g. ``'2026-27'``.

    Raises:
        FileNotFoundError: If no EPL CSV files exist in the expected directory.
    """
    years = []
    for f in _EPL_RAW_DIR.glob("EPL_*_*.csv"):
        parts = f.stem.split("_")
        try:
            years.append(int(parts[1]))
        except (ValueError, IndexError):
            pass

    if not years:
        raise FileNotFoundError(f"No EPL CSV files found in {_EPL_RAW_DIR}")

    latest = max(years)
    end_short = str(latest + 1)[-2:]
    return f"{latest}-{end_short}"


def has_season_kicked_off(season: str) -> bool:
    """Check whether the first fixture of the given EPL season has already kicked off.

    Parses the ``date`` and ``time`` columns from the season CSV as UK local time
    and compares the earliest kick-off against the current moment.

    Args:
        season: Season string in ``'20xx-xx'`` format, e.g. ``'2026-27'``.

    Returns:
        ``True`` if the first fixture has already kicked off, ``False`` if not
        (including when the CSV cannot be found or contains no parseable kick-offs).
    """
    start_year = int(season[:4])
    csv_path = _EPL_RAW_DIR / f"EPL_{start_year}_{start_year + 1}.csv"

    if not csv_path.exists():
        return False

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()

    if "date" not in df.columns or "time" not in df.columns:
        return False

    df = df[["date", "time"]].dropna()
    df = df[df["date"].str.strip() != ""]
    df["kickoff"] = pd.to_datetime(
        df["date"].str.strip() + " " + df["time"].str.strip(),
        errors="coerce",
    )
    df = df.dropna(subset=["kickoff"])

    if df.empty:
        return False

    first_kickoff = df["kickoff"].min().replace(tzinfo=_UK_TZ)
    return datetime.now(_UK_TZ) >= first_kickoff


def get_first_kickoff(season: str) -> datetime | None:
    """Return the datetime of the first fixture in the season (UK time).

    Args:
        season: Season string in ``'20xx-xx'`` format.

    Returns:
        A timezone-aware datetime in ``Europe/London``, or ``None`` if
        the CSV cannot be read or contains no parseable kick-offs.
    """
    start_year = int(season[:4])
    csv_path = _EPL_RAW_DIR / f"EPL_{start_year}_{start_year + 1}.csv"

    if not csv_path.exists():
        return None

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()

    if "date" not in df.columns or "time" not in df.columns:
        return None

    df = df[["date", "time"]].dropna()
    df["kickoff"] = pd.to_datetime(
        df["date"].str.strip() + " " + df["time"].str.strip(),
        errors="coerce",
    )
    df = df.dropna(subset=["kickoff"])

    if df.empty:
        return None

    return df["kickoff"].min().replace(tzinfo=_UK_TZ)


def get_season_teams(season: str) -> list[str]:
    """Return all team names for the given season, sorted alphabetically.

    Derives the list from home_team and away_team columns in the season CSV.
    Used when the season hasn't kicked off yet and there are no results to process.

    Args:
        season: Season string in ``'20xx-xx'`` format.

    Returns:
        Sorted list of team name strings. Empty list if the CSV cannot be read.
    """
    start_year = int(season[:4])
    csv_path = _EPL_RAW_DIR / f"EPL_{start_year}_{start_year + 1}.csv"

    if not csv_path.exists():
        return []

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()

    teams: set[str] = set()
    if "home_team" in df.columns:
        teams.update(df["home_team"].dropna().str.strip().tolist())
    if "away_team" in df.columns:
        teams.update(df["away_team"].dropna().str.strip().tolist())

    return sorted(teams)


def compute_prediction_score(predicted: list[str], actual_standings: list[dict]) -> int:
    """Calculate a prediction score against the current actual standings.

    Score is the sum of ``|predicted_position - actual_position|`` for every
    team. Lower is better; a perfect prediction scores 0.

    Args:
        predicted: Ordered list of team names, index 0 = predicted champions.
        actual_standings: List of standing dicts, each containing at minimum
            ``'team'`` and ``'position'`` keys.

    Returns:
        Total error score as a non-negative integer.
    """
    actual_pos = {row["team"]: row["position"] for row in actual_standings}
    total = 0
    for i, team in enumerate(predicted):
        actual = actual_pos.get(team)
        if actual is not None:
            total += abs((i + 1) - actual)
    return total


def calculate_epl_table(
    season: str,
    kicked_off: bool,
    deductions: list[dict] | None = None,
) -> list[dict]:
    """Calculate the current Premier League table from raw CSV data.

    If the season has not kicked off, returns an alphabetical shell of teams
    with all stats at zero (and any deductions already applied to points).
    Otherwise reads all completed fixtures and builds the table proper.

    Sorted by Premier League tiebreaker rules:
    points → goal difference → goals scored → team name (alphabetical).

    Args:
        season: Season string in ``'20xx-xx'`` format, e.g. ``'2025-26'``.
        kicked_off: Whether the season has already started.
        deductions: Optional list of deduction dicts, each with at least
            ``team`` (str) and ``points`` (int, positive = points removed).

    Returns:
        Ordered list of team dicts, each containing ``position``, ``team``,
        ``played``, ``won``, ``drawn``, ``lost``, ``goals_for``,
        ``goals_against``, ``goal_difference``, and ``points``.
    """
    deduction_map: dict[str, int] = {}
    for d in (deductions or []):
        deduction_map[d["team"]] = deduction_map.get(d["team"], 0) + d["points"]

    if not kicked_off:
        teams = get_season_teams(season)
        table = []
        for team in teams:
            deducted = deduction_map.get(team, 0)
            table.append({
                "team": team,
                "played": 0,
                "won": 0,
                "drawn": 0,
                "lost": 0,
                "goals_for": 0,
                "goals_against": 0,
                "goal_difference": 0,
                "points": -deducted,
                "points_deducted": deducted,
            })
        for i, row in enumerate(table, start=1):
            row["position"] = i
        return table

    start_year = int(season[:4])
    csv_path = _EPL_RAW_DIR / f"EPL_{start_year}_{start_year + 1}.csv"

    if not csv_path.exists():
        return []

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()

    required = {"home_team", "away_team", "score"}
    if not required.issubset(df.columns):
        return []

    stats: dict[str, dict] = defaultdict(lambda: {
        "played": 0, "won": 0, "drawn": 0, "lost": 0,
        "goals_for": 0, "goals_against": 0,
    })

    for _, row in df.iterrows():
        raw_score = row.get("score", "")
        if not isinstance(raw_score, str) or not raw_score.strip():
            continue

        m = _SCORE_RE.search(raw_score.strip())
        if not m:
            continue

        home_goals = int(m.group(1))
        away_goals = int(m.group(2))
        home = str(row["home_team"]).strip()
        away = str(row["away_team"]).strip()

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

    # Ensure every team in the season appears, even those yet to play.
    for team in get_season_teams(season):
        if team not in stats:
            stats[team]  # defaultdict initialises with zeroed stats

    table = []
    for team, s in stats.items():
        gd = s["goals_for"] - s["goals_against"]
        raw_points = s["won"] * 3 + s["drawn"]
        deducted = deduction_map.get(team, 0)
        table.append({
            "team": team,
            "played": s["played"],
            "won": s["won"],
            "drawn": s["drawn"],
            "lost": s["lost"],
            "goals_for": s["goals_for"],
            "goals_against": s["goals_against"],
            "goal_difference": gd,
            "points": raw_points - deducted,
            "points_deducted": deducted,
        })

    table.sort(key=lambda r: (-r["points"], -r["goal_difference"], -r["goals_for"], r["team"]))

    for i, row in enumerate(table, start=1):
        row["position"] = i

    return table


# ---------------------------------------------------------------------------
# ELO season simulation
# ---------------------------------------------------------------------------

_MODELLING_DIR = Path(__file__).parent.parent / "modelling"
_PREPROCESSED_RESULTS = _MODELLING_DIR / "data" / "preprocessed" / "results.csv"
_ELO_PARAMS = _MODELLING_DIR / "data" / "params" / "elo.json"

# Maximum draw probability, applied when the two teams are perfectly matched
# (ELO expected score = 0.5).  Scales linearly to zero as the match becomes
# more one-sided.  28% is consistent with the historical EPL draw rate.
_D_MAX = 0.28


def _elo_three_way(e_home: float) -> tuple[float, float, float]:
    """Convert a binary ELO expected score into three-way match probabilities.

    Args:
        e_home: ELO expected score for the home side (0–1).

    Returns:
        Tuple of (p_home_win, p_draw, p_away_win), summing to 1.
    """
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
    """Monte Carlo simulation of the remainder of the EPL season using ELO ratings.

    Builds team ratings from the full preprocessed match history plus any
    completed fixtures in the current season's raw CSV, then simulates every
    remaining fixture ``n_simulations`` times to produce a finish-position
    probability distribution for each team.

    Each remaining fixture's outcome (home win / draw / away win) is sampled
    from three-way probabilities derived from the ELO expected score.  Goal
    margins are sampled from a Geometric(0.5) distribution and used solely
    for resolving points tiebreakers within each simulation run.

    Args:
        season: Season string in ``'20xx-xx'`` format, e.g. ``'2026-27'``.
        n_simulations: Number of Monte Carlo iterations.  10 000 gives stable
            estimates; reduce for speed during development.
        deductions: Optional list of point deduction dicts, each with ``team``
            (str) and ``points`` (int).

    Returns:
        List of dicts sorted by ``mean_position`` ascending, each containing:

        - ``team`` (str)
        - ``mean_position`` (float) – average simulated finish across all runs
        - ``finish_probabilities`` (dict[str, float]) – keys ``"1"`` through
          ``"20"``, values are percentage chances (0–100, two decimal places)

    Raises:
        FileNotFoundError: If the season CSV or ELO params file is missing.
    """
    from modelling.elo import compute_ratings, _expected_score  # local import avoids circular deps

    # Load trained ELO parameters.
    with open(_ELO_PARAMS) as fh:
        params = json.load(fh)

    k_base: float = params["k_base"]
    home_advantage: float = params["home_advantage"]
    mov_weight: float = params["mov_weight"]
    reversion: float = params["reversion"]
    initial_rating: float = params["initial_rating"]

    # Build the season label used in the raw CSV (e.g. "2026-27" → "2627").
    start_year = int(season[:4])
    season_label = f"{str(start_year)[2:]}{str(start_year + 1)[2:]}"

    # Load full preprocessed history, removing any rows already labelled with
    # the current season to prevent double-counting when we re-add them below.
    history = pd.read_csv(_PREPROCESSED_RESULTS, parse_dates=["date"])
    history["season"] = history["season"].astype(str)
    history = history[history["season"] != season_label].copy()

    # Parse the current season raw CSV into completed and remaining fixtures.
    csv_path = _EPL_RAW_DIR / f"EPL_{start_year}_{start_year + 1}.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"Season CSV not found: {csv_path}")

    raw = pd.read_csv(csv_path)
    raw.columns = raw.columns.str.strip().str.lower()

    completed_rows: list[dict] = []
    remaining_fixtures: list[dict] = []

    for _, row in raw.iterrows():
        home = str(row.get("home_team", "")).strip()
        away = str(row.get("away_team", "")).strip()
        if not home or not away:
            continue

        raw_score = row.get("score", "")
        if isinstance(raw_score, str) and raw_score.strip():
            m = _SCORE_RE.search(raw_score.strip())
            if m:
                completed_rows.append({
                    "date": pd.to_datetime(str(row.get("date", "")).strip(), errors="coerce"),
                    "season": season_label,
                    "home_team": home,
                    "away_team": away,
                    "home_score": int(m.group(1)),
                    "away_score": int(m.group(2)),
                })
                continue

        remaining_fixtures.append({"home_team": home, "away_team": away})

    # Build the combined match history for rating computation.
    if completed_rows:
        current_df = pd.DataFrame(completed_rows)
        all_matches = pd.concat([history, current_df], ignore_index=True)
    else:
        all_matches = history

    all_matches = all_matches.sort_values("date").reset_index(drop=True)

    # Compute ELO ratings through the full history.
    ratings = compute_ratings(
        all_matches,
        k_base=k_base,
        home_advantage=home_advantage,
        mov_weight=mov_weight,
        reversion=reversion,
        initial_rating=initial_rating,
    )

    # Get the current table (actual results so far this season).
    kicked_off = bool(completed_rows)
    current_table = calculate_epl_table(season, kicked_off, deductions)
    if not current_table:
        return []

    teams = [row["team"] for row in current_table]
    n_teams = len(teams)
    team_index = {team: i for i, team in enumerate(teams)}

    # Ensure every team has a rating.
    for team in teams:
        ratings.setdefault(team, initial_rating)

    # Pre-compute three-way probabilities for every remaining fixture.
    # Fixtures involving teams not in the current season are silently dropped.
    fixture_probs: list[dict] = []
    for fix in remaining_fixtures:
        home, away = fix["home_team"], fix["away_team"]
        if home not in team_index or away not in team_index:
            continue
        e = _expected_score(ratings[home], ratings[away], home_advantage)
        ph, pd_, pa = _elo_three_way(e)
        fixture_probs.append({
            "hi": team_index[home],
            "ai": team_index[away],
            "p": np.array([ph, pd_, pa], dtype=np.float64),
        })

    # Seed the simulation arrays from the current table.
    base_points = np.array([row["points"] for row in current_table], dtype=np.float64)
    base_gd = np.array([row["goal_difference"] for row in current_table], dtype=np.float64)

    # Allocate simulation matrices: rows = simulations, cols = teams.
    rng = np.random.default_rng()
    sim_pts = np.tile(base_points, (n_simulations, 1))   # (N, T)
    sim_gd = np.tile(base_gd, (n_simulations, 1))        # (N, T)

    # Vectorised simulation: process all N simulations per fixture in one pass.
    for fp in fixture_probs:
        hi, ai = fp["hi"], fp["ai"]
        outcomes = rng.choice(3, size=n_simulations, p=fp["p"])  # 0=H, 1=D, 2=A
        margins = rng.geometric(0.5, size=n_simulations).astype(np.float64)

        hw = outcomes == 0
        sim_pts[hw, hi] += 3
        sim_gd[hw, hi] += margins[hw]
        sim_gd[hw, ai] -= margins[hw]

        dw = outcomes == 1
        sim_pts[dw, hi] += 1
        sim_pts[dw, ai] += 1

        aw = outcomes == 2
        sim_pts[aw, ai] += 3
        sim_gd[aw, ai] += margins[aw]
        sim_gd[aw, hi] -= margins[aw]

    # Sort each simulation: descending points, descending GD, random noise for ties.
    noise = rng.random((n_simulations, n_teams))
    sort_key = -sim_pts * 1e6 - sim_gd * 1e3 - noise
    ranked = np.argsort(sort_key, axis=1)  # (N, T); ranked[:, 0] = champion in each sim

    # Tally position counts: position_counts[team_idx, pos_idx].
    position_counts = np.zeros((n_teams, n_teams), dtype=np.int32)
    for pos in range(n_teams):
        counts = np.bincount(ranked[:, pos], minlength=n_teams)
        position_counts[:, pos] = counts

    # Build the output list sorted by mean projected position.
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

    def _sort_key(r: dict) -> tuple:
        fp = r["finish_probabilities"]
        # Primary: mean position ascending.
        # Tiebreaker: probability of 1st descending, then 2nd descending, etc.
        # Negating each probability makes higher values sort first.
        return (r["mean_position"],) + tuple(-fp.get(str(p), 0.0) for p in range(1, n_teams + 1))

    results.sort(key=_sort_key)
    return results
