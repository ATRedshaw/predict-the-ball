"""Preprocess raw fixture/result CSVs into a single, clean results dataset.

Reads every CSV under data/raw/<league>/, extracts date, season, home_team, away_team,
home_score, and away_score, then writes the combined output to
data/preprocessed/results.csv sorted chronologically.

Score parsing rules:
- Standard result:       "1–2"        → home 1, away 2
- Penalty shootout:      "(4) 1–1 (3)" → home 1, away 1  (treated as a draw)
- No score (unplayed):   row is dropped

Run from the backend/ directory:
    python modelling/preprocessing.py
"""

import logging
import re
from pathlib import Path

import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
log = logging.getLogger(__name__)

_HERE = Path(__file__).resolve().parent
RAW_DIR = _HERE / "data" / "raw"
OUTPUT_PATH = _HERE / "data" / "preprocessed" / "results.csv"

# Matches optional penalty prefix/suffix, e.g. "(4) 1–1 (3)" or plain "2–1".
# The en-dash (–) and plain hyphen (-) are both handled.
_SCORE_RE = re.compile(
    r"(?:\(\d+\)\s*)?(\d+)\s*[–\-]\s*(\d+)(?:\s*\(\d+\))?"
)


def parse_score(raw: str) -> tuple[int, int] | None:
    """Extract the 90-minute (or extra-time) score from a raw score string.

    Penalty shootout scores like ``"(4) 1–1 (3)"`` return the match score
    only (``1, 1``); the shootout result is discarded.

    Args:
        raw: Raw score string from the CSV, e.g. ``"1–2"`` or ``"(5) 1–1 (4)"``.

    Returns:
        A ``(home_score, away_score)`` tuple of ints, or ``None`` if the string
        cannot be parsed (e.g. an unplayed fixture with an empty score cell).
    """
    if not isinstance(raw, str) or not raw.strip():
        return None
    match = _SCORE_RE.search(raw.strip())
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def load_league_csv(path: Path) -> pd.DataFrame:
    """Load a single raw league CSV and return a cleaned DataFrame.

    Rows without a parseable score (unplayed fixtures) are dropped.  Only the
    columns date, home_team, away_team, home_score, and away_score are kept.

    Args:
        path: Path to the raw CSV file.

    Returns:
        DataFrame with columns ``[date, season, home_team, away_team, home_score, away_score]``,
        or an empty DataFrame if no valid rows exist.
    """
    try:
        df = pd.read_csv(path)
    except Exception as exc:
        log.warning("Could not read %s: %s", path, exc)
        return pd.DataFrame()

    required = {"date", "season", "home_team", "away_team", "score"}
    missing = required - set(df.columns.str.lower())
    if missing:
        log.warning("Skipping %s — missing columns: %s", path.name, missing)
        return pd.DataFrame()

    # Normalise column names to lowercase for consistent access.
    df.columns = df.columns.str.lower()

    df = df[["date", "season", "home_team", "away_team", "score"]].copy()

    scores = df["score"].apply(parse_score)
    valid = scores.notna()
    if not valid.any():
        return pd.DataFrame()

    df = df[valid].copy()
    parsed = scores[valid].apply(pd.Series)
    df["home_score"] = parsed[0].astype(int)
    df["away_score"] = parsed[1].astype(int)
    df = df.drop(columns=["score"])

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])

    return df


def build_dataset(raw_dir: Path) -> pd.DataFrame:
    """Walk the raw directory tree and combine all valid results.

    Args:
        raw_dir: Root directory containing per-league sub-directories of CSVs.

    Returns:
        A single DataFrame sorted by date with columns
        ``[date, season, home_team, away_team, home_score, away_score]``.
    """
    frames = []
    csv_files = sorted(raw_dir.rglob("*.csv"))
    log.info("Found %d CSV files under %s", len(csv_files), raw_dir)

    for path in csv_files:
        df = load_league_csv(path)
        if not df.empty:
            frames.append(df)
            log.info("Loaded %s — %d rows", path.name, len(df))
        else:
            log.debug("No valid rows in %s", path.name)

    if not frames:
        log.warning("No data loaded — output will be empty.")
        return pd.DataFrame(columns=["date", "season", "home_team", "away_team", "home_score", "away_score"])

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values("date").reset_index(drop=True)
    return combined


if __name__ == "__main__":
    dataset = build_dataset(RAW_DIR)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(OUTPUT_PATH, index=False)
    log.info("Wrote %d rows to %s", len(dataset), OUTPUT_PATH)
