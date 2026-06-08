"""Preprocess historical and current-season results for modelling.

Historical CSVs under ``data/raw/<league>/`` are aggregated into the same
model-facing shape as the existing modelling pipeline:

    date,season,home_team,away_team,home_score,away_score

Current-season completed Premier League fixtures are read from the FPL API,
mapped onto the historical team-name vocabulary, then appended before writing
``data/preprocessed/results.csv``.

Run from the backend/ directory:

    python modelling/preprocessing.py
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import pandas as pd
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils.team_mapping import ensure_team_name_mapping

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
log = logging.getLogger(__name__)

_HERE = Path(__file__).resolve().parent
BACKEND_DIR = _HERE.parent
CONFIG_PATH = _HERE / "config" / "preprocessing.yaml"
ENV_PATH = BACKEND_DIR / ".env"
UK_TZ = ZoneInfo("Europe/London")
USER_AGENT = "predict-the-ball/1.0"

OUTPUT_COLUMNS = [
    "date",
    "season",
    "home_team",
    "away_team",
    "home_score",
    "away_score",
]

RAW_COLUMNS = {"day", "date", "home_team", "away_team", "score"}
SCORE_RE = re.compile(r"(?:\(\d+\)\s*)?(\d+)\s*[–\-]\s*(\d+)(?:\s*\(\d+\))?")
SEASON_RE = re.compile(r"_(\d{4})_(\d{4})$")


def load_config(path: Path) -> dict[str, Any]:
    """Load preprocessing YAML config."""
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with path.open() as f:
        config = yaml.safe_load(f)
    if not isinstance(config, dict):
        raise ValueError(f"Config file is empty or invalid: {path}")
    return config


def season_code(start_year: int) -> str:
    """Return compact season code, e.g. ``2025`` -> ``2526``."""
    return f"{start_year % 100:02d}{(start_year + 1) % 100:02d}"


def season_from_filename(path: Path) -> str:
    """Extract compact season code from ``Alias_YYYY_YYYY.csv``."""
    match = SEASON_RE.search(path.stem)
    if not match:
        raise ValueError(f"Could not infer season from filename: {path.name}")
    start_year = int(match.group(1))
    return season_code(start_year)


def parse_score(raw: str) -> tuple[int, int] | None:
    """Parse a raw score string into home and away goals."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    match = SCORE_RE.search(raw.strip())
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def load_historical_csv(path: Path) -> pd.DataFrame:
    """Load one minimal raw historical CSV."""
    try:
        df = pd.read_csv(path)
    except Exception as exc:
        log.warning("Could not read %s: %s", path, exc)
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    df.columns = df.columns.str.strip().str.lower()
    missing = RAW_COLUMNS - set(df.columns)
    if missing:
        log.warning("Skipping %s; missing columns: %s", path.name, sorted(missing))
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    df = df[["date", "home_team", "away_team", "score"]].copy()
    df["season"] = season_from_filename(path)

    scores = df["score"].apply(parse_score)
    valid = scores.notna()
    if not valid.any():
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    df = df[valid].copy()
    parsed = scores[valid].apply(pd.Series)
    df["home_score"] = parsed[0].astype(int)
    df["away_score"] = parsed[1].astype(int)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    df["home_team"] = df["home_team"].astype(str).str.strip()
    df["away_team"] = df["away_team"].astype(str).str.strip()
    df = df.dropna(subset=["date"])
    df = df[(df["home_team"] != "") & (df["away_team"] != "")]

    return df[OUTPUT_COLUMNS]


def load_historical_results(raw_dir: Path) -> pd.DataFrame:
    """Aggregate all historical raw CSVs."""
    frames = []
    csv_files = sorted(raw_dir.rglob("*.csv"))
    log.info("Found %d historical CSV files under %s", len(csv_files), raw_dir)

    for path in csv_files:
        df = load_historical_csv(path)
        if not df.empty:
            frames.append(df)
            log.info("Loaded %s (%d rows)", path.name, len(df))

    if not frames:
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    combined = pd.concat(frames, ignore_index=True)
    return combined.sort_values("date").reset_index(drop=True)


def unique_team_names(results: pd.DataFrame) -> list[str]:
    """Return all unique historical team names."""
    teams = set(results["home_team"].dropna().astype(str).str.strip())
    teams.update(results["away_team"].dropna().astype(str).str.strip())
    teams.discard("")
    return sorted(teams)


def fetch_json(url: str, timeout: int = 30) -> Any:
    """Fetch and decode JSON from an API URL."""
    request = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {detail[:300]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not fetch {url}: {exc.reason}") from exc


def parse_deadline(value: str) -> datetime:
    """Parse an FPL ISO deadline string into a datetime."""
    return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))


def is_gameweek_1(event: dict[str, Any]) -> bool:
    """Return whether an FPL event describes gameweek 1."""
    try:
        if int(event.get("id")) == 1:
            return True
    except (TypeError, ValueError):
        pass
    return str(event.get("name", "")).strip().lower() == "gameweek 1"


def find_gameweek_1_deadline(bootstrap: dict[str, Any]) -> datetime:
    """Extract gameweek 1 deadline from FPL bootstrap data."""
    events = bootstrap.get("events", [])
    if not isinstance(events, list):
        raise ValueError("FPL bootstrap events must be a list")

    for event in events:
        if isinstance(event, dict) and is_gameweek_1(event) and event.get("deadline_time"):
            return parse_deadline(event["deadline_time"])

    raise ValueError("Could not find FPL gameweek 1 deadline")


def current_fpl_season_start_year(bootstrap: dict[str, Any]) -> int:
    """Infer current FPL season start year from gameweek 1 deadline."""
    deadline = find_gameweek_1_deadline(bootstrap)
    return deadline.year if deadline.month >= 6 else deadline.year - 1


def fpl_team_lookup(bootstrap: dict[str, Any]) -> dict[int, str]:
    """Build a team-id to team-name lookup from FPL bootstrap data."""
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


def is_completed_fixture(fixture: dict[str, Any]) -> bool:
    """Return whether an FPL fixture has a completed score."""
    if fixture.get("team_h_score") is None or fixture.get("team_a_score") is None:
        return False
    if fixture.get("finished") is True or fixture.get("finished_provisional") is True:
        return True
    try:
        return int(fixture.get("minutes", 0)) >= 90
    except (TypeError, ValueError):
        return False


def parse_kickoff(value: str) -> datetime | None:
    """Parse an FPL kickoff into UK local time."""
    if not isinstance(value, str) or not value.strip():
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UK_TZ)


def fpl_completed_results(
    *,
    bootstrap: dict[str, Any],
    fixtures: list[dict[str, Any]],
    team_mapping: dict[str, str],
) -> pd.DataFrame:
    """Convert completed FPL fixtures into the model-facing format."""
    team_by_id = fpl_team_lookup(bootstrap)
    season = season_code(current_fpl_season_start_year(bootstrap))

    rows = []
    for fixture in fixtures:
        if not isinstance(fixture, dict) or not is_completed_fixture(fixture):
            continue

        kickoff = parse_kickoff(fixture.get("kickoff_time", ""))
        if kickoff is None:
            continue

        try:
            fpl_home = team_by_id[int(fixture["team_h"])]
            fpl_away = team_by_id[int(fixture["team_a"])]
            home_score = int(fixture["team_h_score"])
            away_score = int(fixture["team_a_score"])
        except (KeyError, TypeError, ValueError) as exc:
            log.warning("Skipping malformed FPL fixture %s: %s", fixture.get("id"), exc)
            continue

        try:
            home_team = team_mapping[fpl_home]
            away_team = team_mapping[fpl_away]
        except KeyError as exc:
            raise KeyError(
                f"FPL team {exc.args[0]!r} is missing from the team-name mapping"
            ) from exc

        rows.append({
            "date": pd.Timestamp(kickoff.date()),
            "season": season,
            "home_team": home_team,
            "away_team": away_team,
            "home_score": home_score,
            "away_score": away_score,
        })

    if not rows:
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    return pd.DataFrame(rows, columns=OUTPUT_COLUMNS)


def fetch_current_fpl_results(
    *,
    bootstrap_url: str,
    fixtures_url: str,
    historical_team_names: list[str],
    mapping_path: Path,
    groq_config: dict[str, Any],
) -> pd.DataFrame:
    """Fetch, map, and normalize current-season FPL results."""
    bootstrap = fetch_json(bootstrap_url)
    fixtures = fetch_json(fixtures_url)
    if not isinstance(bootstrap, dict):
        raise ValueError("FPL bootstrap response must be a JSON object")
    if not isinstance(fixtures, list):
        raise ValueError("FPL fixtures response must be a JSON list")

    fpl_names = sorted(fpl_team_lookup(bootstrap).values())
    team_mapping = ensure_team_name_mapping(
        fpl_team_names=fpl_names,
        historical_team_names=historical_team_names,
        mapping_path=mapping_path,
        groq_config=groq_config,
        env_path=ENV_PATH,
    )
    results = fpl_completed_results(
        bootstrap=bootstrap,
        fixtures=fixtures,
        team_mapping=team_mapping,
    )
    log.info("Loaded %d completed current-season FPL fixtures", len(results))
    return results


def combine_results(historical: pd.DataFrame, current: pd.DataFrame) -> pd.DataFrame:
    """Combine historical and current results, sorted chronologically."""
    frames = [df for df in (historical, current) if not df.empty]
    if not frames:
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    combined = pd.concat(frames, ignore_index=True)
    combined["date"] = pd.to_datetime(combined["date"], errors="coerce")
    combined = combined.dropna(subset=["date"])
    combined["home_score"] = combined["home_score"].astype(int)
    combined["away_score"] = combined["away_score"].astype(int)
    combined = combined.drop_duplicates(
        subset=["date", "home_team", "away_team"],
        keep="last",
    )
    combined = combined.sort_values(
        ["date", "season", "home_team", "away_team"],
    ).reset_index(drop=True)
    combined["date"] = combined["date"].dt.strftime("%Y-%m-%d")
    return combined[OUTPUT_COLUMNS]


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        type=Path,
        default=CONFIG_PATH,
        help="Path to preprocessing.yaml",
    )
    parser.add_argument(
        "--skip-current",
        action="store_true",
        help="Only preprocess historical raw CSVs; do not fetch FPL results.",
    )
    return parser.parse_args()


def main() -> None:
    """Build and write the modelling preprocessed results dataset."""
    args = parse_args()
    config = load_config(args.config)
    data_cfg = config["data"]
    source_cfg = config["sources"]

    raw_dir = BACKEND_DIR / data_cfg["raw_dir"]
    output_path = BACKEND_DIR / data_cfg["output_path"]
    mapping_path = BACKEND_DIR / data_cfg["mapping_path"]

    historical = load_historical_results(raw_dir)
    historical_team_names = unique_team_names(historical)
    log.info("Found %d unique historical team names", len(historical_team_names))

    if args.skip_current:
        current = pd.DataFrame(columns=OUTPUT_COLUMNS)
    else:
        current = fetch_current_fpl_results(
            bootstrap_url=source_cfg["fpl_bootstrap_url"],
            fixtures_url=source_cfg["fpl_fixtures_url"],
            historical_team_names=historical_team_names,
            mapping_path=mapping_path,
            groq_config=config["groq"],
        )

    dataset = combine_results(historical, current)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(output_path, index=False)
    log.info("Wrote %d rows to %s", len(dataset), output_path)


if __name__ == "__main__":
    main()
