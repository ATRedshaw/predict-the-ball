"""Retrieve historical English football results from football-data.co.uk.

The upper historical season is determined from the FPL API:
gameweek 1's deadline identifies the current FPL season, and this script only
downloads completed historical seasons before it. For example, a GW1 deadline
in August 2025 means the current FPL season is 2025-26, so historical data is
downloaded through 2024-25.

Raw CSVs are saved under ``data/raw/<league>/`` with five columns:
``day``, ``date``, ``home_team``, ``away_team``, and ``score``.

    data/raw/EPL/EPL_2016_2017.csv
    data/raw/Championship/Championship_2016_2017.csv

Run from the backend/ directory:

    python modelling/historical.py
"""

from __future__ import annotations

import argparse
import io
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pandas as pd
import yaml

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
log = logging.getLogger(__name__)

_HERE = Path(__file__).resolve().parent
BACKEND_DIR = _HERE.parent
CONFIG_PATH = _HERE / "config" / "historical.yaml"

USER_AGENT = (
    "predict-the-ball/1.0 "
    "(historical-results retriever; https://www.football-data.co.uk/)"
)


def load_config(path: Path) -> dict[str, Any]:
    """Load the historical YAML config."""
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with path.open() as f:
        config = yaml.safe_load(f)
    if not isinstance(config, dict):
        raise ValueError(f"Config file is empty or invalid: {path}")
    return config


def season_code(start_year: int) -> str:
    """Return football-data's compact season code, e.g. ``2425``."""
    return f"{start_year % 100:02d}{(start_year + 1) % 100:02d}"


def season_label(start_year: int) -> str:
    """Return a human-readable season label, e.g. ``2016-2017``."""
    return f"{start_year}-{start_year + 1}"


def season_filename(alias: str, start_year: int) -> str:
    """Return the raw output filename for a league and season."""
    return f"{alias}_{start_year}_{start_year + 1}.csv"


def fetch_bytes(url: str, timeout: int = 30) -> bytes:
    """Fetch URL content with a user agent."""
    request = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.read()
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code} for {url}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not fetch {url}: {exc.reason}") from exc


def fetch_json(url: str) -> dict[str, Any]:
    """Fetch and decode a JSON object."""
    payload = fetch_bytes(url)
    try:
        parsed = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON from {url}") from exc
    if not isinstance(parsed, dict):
        raise ValueError(f"Expected JSON object from {url}")
    return parsed


def parse_deadline(value: str) -> datetime:
    """Parse an FPL ISO deadline string into a datetime."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError("FPL gameweek 1 deadline is missing")
    return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))


def is_gameweek_1(event: dict[str, Any]) -> bool:
    """Return whether an event-like object appears to describe gameweek 1."""
    numeric_keys = ("id", "event", "gameweek", "gw", "round")
    for key in numeric_keys:
        try:
            if int(event.get(key)) == 1:
                return True
        except (TypeError, ValueError):
            pass

    text = " ".join(
        str(event.get(key, ""))
        for key in ("name", "event_name", "gameweek_name")
    ).lower()
    return "gameweek 1" in text or text.strip() in {"gw1", "gw 1"}


def find_gameweek_1_deadline(bootstrap: dict[str, Any]) -> datetime:
    """Extract gameweek 1's deadline from FPL bootstrap data."""
    event_lists = [
        value for value in bootstrap.values()
        if isinstance(value, list) and value and all(isinstance(x, dict) for x in value)
    ]

    for events in event_lists:
        for event in events:
            if is_gameweek_1(event) and event.get("deadline_time"):
                return parse_deadline(event["deadline_time"])

    for events in event_lists:
        for event in events:
            if event.get("deadline_time"):
                return parse_deadline(event["deadline_time"])

    raise ValueError("Could not find a deadline_time in the FPL bootstrap data")


def current_fpl_season_start_year(deadline: datetime) -> int:
    """Infer the FPL season start year from gameweek 1's deadline."""
    return deadline.year if deadline.month >= 6 else deadline.year - 1


def latest_historical_start_year(fpl_bootstrap_url: str) -> int:
    """Return the last completed season start year allowed by the FPL API."""
    bootstrap = fetch_json(fpl_bootstrap_url)
    deadline = find_gameweek_1_deadline(bootstrap)
    current_start_year = current_fpl_season_start_year(deadline)
    latest = current_start_year - 1
    log.info(
        "FPL gameweek 1 deadline is %s; current FPL season is %s; "
        "fetching history through %s",
        deadline.isoformat(),
        season_label(current_start_year),
        season_label(latest),
    )
    return latest


def football_data_url(base_url: str, division_code: str, start_year: int) -> str:
    """Build a football-data CSV URL."""
    return f"{base_url.rstrip('/')}/{season_code(start_year)}/{division_code}.csv"


def parse_football_data_dates(values: pd.Series) -> pd.Series:
    """Parse football-data date strings without relying on pandas inference."""
    text = values.fillna("").astype(str).str.strip()
    parsed = pd.Series(pd.NaT, index=text.index, dtype="datetime64[ns]")

    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
        missing = parsed.isna()
        if not missing.any():
            break
        parsed.loc[missing] = pd.to_datetime(
            text.loc[missing],
            format=fmt,
            errors="coerce",
        )

    return parsed


def normalize_football_data(
    df: pd.DataFrame,
    *,
    start_year: int,
) -> pd.DataFrame:
    """Normalize football-data columns to the minimal raw modelling contract."""
    required = {"Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"football-data CSV missing columns: {sorted(missing)}")

    normalized = pd.DataFrame(index=df.index)
    normalized["date"] = parse_football_data_dates(df["Date"])

    if "Time" in df.columns:
        sort_time = df["Time"].fillna("").astype(str).str.strip()
    else:
        sort_time = pd.Series("", index=df.index)

    normalized["home_team"] = df["HomeTeam"].fillna("").astype(str).str.strip()
    normalized["away_team"] = df["AwayTeam"].fillna("").astype(str).str.strip()

    home_score = pd.to_numeric(df["FTHG"], errors="coerce")
    away_score = pd.to_numeric(df["FTAG"], errors="coerce")
    normalized["home_score"] = home_score
    normalized["away_score"] = away_score
    normalized["score"] = [
        "" if pd.isna(h) or pd.isna(a) else f"{int(h)}-{int(a)}"
        for h, a in zip(home_score, away_score, strict=False)
    ]
    normalized["_sort_time"] = sort_time

    normalized = normalized.dropna(subset=["date"])
    normalized = normalized[
        (normalized["home_team"] != "")
        & (normalized["away_team"] != "")
        & (normalized["score"] != "")
    ].copy()

    if normalized.empty:
        return normalized

    years = set(normalized["date"].dt.year.unique())
    expected_years = {start_year, start_year + 1}
    if not years & expected_years:
        raise ValueError(
            f"football-data dates do not match {season_label(start_year)}: "
            f"found years {sorted(years)}"
        )

    normalized = normalized.sort_values(["date", "_sort_time", "home_team", "away_team"])
    normalized["day"] = normalized["date"].dt.day_name().str[:3]
    normalized["date"] = normalized["date"].dt.strftime("%Y-%m-%d")

    return normalized[["day", "date", "home_team", "away_team", "score"]]


def fetch_season(
    *,
    base_url: str,
    division_code: str,
    start_year: int,
) -> pd.DataFrame:
    """Fetch and normalize one football-data division season."""
    url = football_data_url(base_url, division_code, start_year)
    payload = fetch_bytes(url)
    df = pd.read_csv(io.BytesIO(payload))
    return normalize_football_data(
        df,
        start_year=start_year,
    )


def save(df: pd.DataFrame, path: Path) -> None:
    """Write a normalized raw CSV."""
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    log.info("Saved %s (%d rows)", path, len(df))


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        type=Path,
        default=CONFIG_PATH,
        help="Path to retrieve.yaml",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-fetch and overwrite files that already exist.",
    )
    parser.add_argument(
        "--max-season-start-year",
        type=int,
        default=None,
        help=(
            "Override the FPL-derived historical cap. Useful for deterministic "
            "local runs and tests."
        ),
    )
    return parser.parse_args()


def main() -> None:
    """Download all configured historical football-data seasons."""
    args = parse_args()
    config = load_config(args.config)
    data_cfg = config["data"]
    source_cfg = config["sources"]

    season_start = int(data_cfg["season_start"])
    output_dir = BACKEND_DIR / data_cfg["output_dir"]
    max_start_year = (
        args.max_season_start_year
        if args.max_season_start_year is not None
        else latest_historical_start_year(source_cfg["fpl_bootstrap_url"])
    )

    if max_start_year < season_start:
        log.warning(
            "No seasons to fetch: start is %s but historical cap is %s",
            season_label(season_start),
            season_label(max_start_year),
        )
        return

    for league in data_cfg["leagues"]:
        alias = league["alias"]
        division_code = league["division_code"]
        league_dir = output_dir / alias

        for start_year in range(season_start, max_start_year + 1):
            out_path = league_dir / season_filename(alias, start_year)
            if out_path.exists() and not args.force:
                log.info("Skipping %s %s; already saved", alias, season_label(start_year))
                continue

            log.info("Fetching %s %s ...", alias, season_label(start_year))
            try:
                df = fetch_season(
                    base_url=source_cfg["football_data_base_url"],
                    division_code=division_code,
                    start_year=start_year,
                )
            except Exception as exc:
                log.error("Failed %s %s: %s", alias, season_label(start_year), exc)
                continue

            if df.empty:
                log.warning("No completed rows for %s %s", alias, season_label(start_year))
                continue

            save(df, out_path)


if __name__ == "__main__":
    main()
