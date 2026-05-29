"""Service helpers for reading EPL CSV data and deriving season/table state.

All functions are pure data operations with no Flask or DB dependencies,
so they can be called from both CLI commands and HTTP route handlers.
"""

import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

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
