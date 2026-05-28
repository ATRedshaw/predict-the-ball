"""Retrieve Premier League, Championship, FA Cup and EFL Cup fixture/result
data from FBref.

Fetches the game schedule (fixtures and results) per league per season as
defined in modelling/config/retrieve.yaml.  Each combination is saved as an
individual CSV, e.g. EPL_2016_2017.csv.  Files that already exist are skipped,
so the script is safe to re-run after interruption.

Run from the backend/ directory:
    python modelling/retrieve.py
"""

import logging
from pathlib import Path

import pandas as pd
import yaml

# utils must be imported (and ensure_custom_leagues called) before soccerdata
# is first imported — the library reads league_dict.json at import time.
from utils.utils import ensure_custom_leagues

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
log = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config/retrieve.yaml"

# Script is run from backend/, so paths in config are relative to that.
BACKEND_DIR = Path(__file__).parent.parent


def load_config(path: Path) -> dict:
    """Load and return the YAML config file.

    Args:
        path: Path to the YAML config file.

    Returns:
        Parsed config as a dict.

    Raises:
        FileNotFoundError: If the config file does not exist.
    """
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with path.open() as f:
        return yaml.safe_load(f)


def season_str(start_year: int) -> str:
    """Return a human-readable season label, e.g. ``'2016-2017'``.

    Args:
        start_year: The calendar year the season starts in.

    Returns:
        A string in ``'YYYY-YYYY'`` format.
    """
    return f"{start_year}-{start_year + 1}"


def season_filename(alias: str, start_year: int) -> str:
    """Return the output filename for a given league alias and season.

    Args:
        alias: Short league name, e.g. ``'EPL'``.
        start_year: The calendar year the season starts in.

    Returns:
        Filename string, e.g. ``'EPL_2016_2017.csv'``.
    """
    return f"{alias}_{start_year}_{start_year + 1}.csv"


def is_valid_season(df: pd.DataFrame, start_year: int) -> bool:
    """Check that the schedule's dates fall within the expected season years.

    A 2016-17 season should contain dates in 2016 or 2017.  If none do, the
    fetch has returned data for a different (likely historical) season.

    Args:
        df: Schedule DataFrame with a ``date`` column.
        start_year: The calendar year the season starts in.

    Returns:
        True if at least one date falls in ``start_year`` or ``start_year + 1``.
    """
    if df.empty:
        return False
    date_col = next((c for c in df.columns if c.lower() == "date"), None)
    if date_col is None:
        return True  # no date column to validate against; assume fine
    dates = pd.to_datetime(df[date_col], errors="coerce").dropna()
    if dates.empty:
        return True
    return bool(set(dates.dt.year.unique()) & {start_year, start_year + 1})


def last_saved_year(league_dir: Path, alias: str) -> int | None:
    """Return the highest season start_year already saved in ``league_dir``.

    Args:
        league_dir: Directory containing CSV files for the league.
        alias: League alias used in filenames, e.g. ``'EPL'``.

    Returns:
        The highest start_year found, or ``None`` if no files exist.
    """
    years = []
    for f in league_dir.glob(f"{alias}_*_*.csv"):
        parts = f.stem.split("_")
        try:
            years.append(int(parts[-2]))
        except (ValueError, IndexError):
            pass
    return max(years) if years else None


def fetch_season(league: str, start_year: int):
    """Fetch the schedule for a single league and season from FBref.

    Passes the start-year as an integer; soccerdata treats an integer as the
    season start year (e.g. 2016 → 2016-17).

    Args:
        league: FBref league ID, e.g. ``'ENG-Premier League'``.
        start_year: The calendar year the season starts in (e.g. 2016 for 2016-17).

    Returns:
        DataFrame with the MultiIndex flattened to plain columns.
    """
    import soccerdata as sd  # imported here so league_dict.json is already written

    fbref = sd.FBref(leagues=league, seasons=start_year)
    df = fbref.read_schedule().reset_index()
    return df


def save(df, path: Path) -> None:
    """Write a DataFrame to CSV, creating parent directories as needed.

    Args:
        df: DataFrame to persist.
        path: Destination file path.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    log.info("Saved %s  (%d rows)", path.name, len(df))


if __name__ == "__main__":
    config = load_config(CONFIG_PATH)
    cfg = config["data"]

    # Register any custom leagues before soccerdata is imported.
    ensure_custom_leagues(config.get("custom_leagues", {}))

    leagues = cfg["leagues"]
    aliases = cfg["league_aliases"]
    output_dir = BACKEND_DIR / cfg["output_dir"]
    season_start = cfg["season_start"]
    anchor_league = cfg["anchor_league"]

    # Phase 1: probe the anchor league season by season, validating dates, to
    # find the latest season with real data.  This becomes the cap for all leagues.
    log.info("Probing %s to determine latest available season ...", anchor_league)
    anchor_alias = aliases[anchor_league]
    latest_start_year = season_start - 1
    probe_year = season_start

    while True:
        probe_path = output_dir / anchor_alias / season_filename(anchor_alias, probe_year)
        season = season_str(probe_year)
        if probe_path.exists():
            latest_start_year = probe_year
            probe_year += 1
            continue
        log.info("Probing %s %s ...", anchor_alias, season)
        try:
            df = fetch_season(anchor_league, probe_year)
            if not is_valid_season(df, probe_year):
                log.info(
                    "%s %s dates outside %d–%d — latest season is %s",
                    anchor_alias, season, probe_year, probe_year + 1,
                    season_str(latest_start_year),
                )
                break
            latest_start_year = probe_year
            save(df, probe_path)
        except Exception as exc:
            log.info("No data for %s %s (%s) — latest season is %s",
                     anchor_alias, season, exc, season_str(latest_start_year))
            break
        probe_year += 1

    log.info("Latest available season: %s", season_str(latest_start_year))

    # Phase 2: fetch all leagues up to the confirmed cap.
    # The most recent file per league is always re-fetched in case the season
    # is still in progress and new results have been added.
    for league in leagues:
        alias = aliases[league]
        league_dir = output_dir / alias
        last_year = last_saved_year(league_dir, alias)
        start_year = season_start

        while start_year <= latest_start_year:
            season = season_str(start_year)
            out_path = league_dir / season_filename(alias, start_year)

            if out_path.exists() and start_year != last_year:
                log.info("Skipping %s %s — already saved", alias, season)
                start_year += 1
                continue

            log.info("Fetching %s %s ...", alias, season)
            try:
                df = fetch_season(league, start_year)
                if df.empty:
                    log.info("Empty result for %s %s — skipping", alias, season)
                    start_year += 1
                    continue
                save(df, out_path)
            except Exception as exc:
                log.error("Failed %s %s: %s", alias, season, exc)

            start_year += 1
