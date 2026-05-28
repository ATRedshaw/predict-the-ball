"""Retrieve Premier League and Championship fixture/result data from FBref.

Fetches the game schedule (fixtures and results) for the leagues and seasons
defined in modelling/modelling_config.yaml, then writes the combined results
to the configured output path as a CSV.

Run from the backend/ directory:
    python modelling/retrieve.py
"""

import logging
from pathlib import Path

import pandas as pd
import soccerdata as sd
import yaml

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
log = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "modelling_config.yaml"

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


def fetch_schedules(leagues: list[str], seasons: list[int]) -> pd.DataFrame:
    """Fetch game schedules for the given leagues and seasons from FBref.

    Args:
        leagues: List of FBref league IDs.
        seasons: List of season end-years (e.g. 2017 for 2016-17).

    Returns:
        Combined DataFrame of all fixtures and results, with the
        MultiIndex reset to plain columns.
    """
    log.info("Initialising FBref scraper — %d leagues, %d seasons", len(leagues), len(seasons))
    fbref = sd.FBref(leagues=leagues, seasons=seasons)
    schedule = fbref.read_schedule()

    # read_schedule returns a MultiIndex DataFrame; flatten it.
    schedule = schedule.reset_index()
    log.info("Fetched %d rows across all leagues and seasons", len(schedule))
    return schedule


def save(df: pd.DataFrame, path: Path) -> None:
    """Write a DataFrame to CSV, creating parent directories as needed.

    Args:
        df: DataFrame to persist.
        path: Destination file path.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    log.info("Saved to %s  (%d rows, %d columns)", path, len(df), len(df.columns))


if __name__ == "__main__":
    cfg = load_config(CONFIG_PATH)["data"]

    leagues = cfg["leagues"]
    seasons = list(range(cfg["season_start"], cfg["season_end"] + 1))
    output_path = BACKEND_DIR / cfg["output_dir"] / cfg["output_filename"]

    df = fetch_schedules(leagues, seasons)
    save(df, output_path)
