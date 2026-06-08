"""Backend data management command.

Run from the backend/ directory with the venv active, e.g.:
    python commands.py
"""

import importlib.util
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import create_app
from extensions import db
from models.actual_standing import ActualStanding
from models.elo_projection import EloProjection
from models.points_deduction import PointsDeduction
from models.user_prediction import UserPrediction
from services.epl import (
    calculate_epl_table,
    compute_exact_predictions,
    compute_prediction_score,
    get_latest_epl_season,
    has_season_kicked_off,
    simulate_elo_projection,
)


_BACKEND_DIR = Path(__file__).resolve().parent
_MODELLING_DIR = _BACKEND_DIR / "modelling"
_ELO_PARAMS_PATH = _MODELLING_DIR / "data" / "params" / "elo.json"


def _load_module_from_path(module_name: str, path: Path):
    """Load a Python module from a file path."""
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _run_module_main(module, script_path: Path) -> None:
    """Run a loaded script module's main function with isolated CLI args."""
    original_argv = sys.argv[:]
    try:
        sys.argv = [str(script_path)]
        module.main()
    finally:
        sys.argv = original_argv


def fetch_data_files() -> None:
    """Fetch latest modelling raw data and rebuild preprocessed results."""
    historical_path = _MODELLING_DIR / "historical.py"
    preprocessing_path = _MODELLING_DIR / "preprocessing.py"
    historical = _load_module_from_path(
        "modelling_new_historical",
        historical_path,
    )
    preprocessing = _load_module_from_path(
        "modelling_new_preprocessing",
        preprocessing_path,
    )

    print("Step 1/2: Fetching historical fixture and result data...")
    _run_module_main(historical, historical_path)

    print("Step 2/2: Preprocessing historical data plus current FPL results...")
    _run_module_main(preprocessing, preprocessing_path)


def create_elo_params_if_missing() -> None:
    """Run ELO tuning when the parameter file has not been generated."""
    if _ELO_PARAMS_PATH.is_file():
        return

    tuning_path = _MODELLING_DIR / "tuning.py"
    print(f"ELO parameters not found at {_ELO_PARAMS_PATH}; running tuning...")
    tuning = _load_module_from_path("modelling_new_tuning", tuning_path)
    tuning.tune(output_path=_ELO_PARAMS_PATH)

    if not _ELO_PARAMS_PATH.is_file():
        raise FileNotFoundError(f"ELO tuning did not create {_ELO_PARAMS_PATH}")


def process_existing_data() -> None:
    """Update DB-derived data from modelling data and the FPL API."""
    create_elo_params_if_missing()
    print("Processing modelling data and current FPL data...")
    app = create_app()
    with app.app_context():
        season = get_latest_epl_season()
        print(f"Processing season: {season}")
        save_actual_standings_snapshot(season)


def save_actual_standings_snapshot(season: str, force: bool = False) -> None:
    """Calculate the current EPL table and persist a new snapshot.

    Pulls any active points deductions from the database for the season,
    calculates the table via the CSV data, then writes a new ``ActualStanding``
    row. If the season has not yet kicked off, the snapshot contains all teams
    in alphabetical order with zero stats.

    Args:
        season: Season string in ``'20xx-xx'`` format, e.g. ``'2025-26'``.
        force: Save a fresh snapshot even when the calculated table matches the latest row.
    """
    kicked_off = has_season_kicked_off(season)

    deductions = PointsDeduction.query.filter_by(season=season).all()
    deduction_dicts = [{"team": d.team, "points": d.points} for d in deductions]

    table = calculate_epl_table(season, kicked_off, deduction_dicts)

    if not table:
        print(f"No table data for season {season} — skipping snapshot.")
        return

    latest = (
        ActualStanding.query
        .filter_by(season=season)
        .order_by(ActualStanding.updated_at.desc())
        .first()
    )
    if latest is not None and latest.standings == table and not force:
        print(f"Table unchanged for {season} — skipping snapshot.")
        return

    snapshot = ActualStanding(
        season=season,
        standings=table,
        updated_at=datetime.now(timezone.utc),
    )
    db.session.add(snapshot)
    db.session.commit()

    status = "live" if kicked_off else "pre-season (alphabetical)"
    print(f"Saved {status} standings snapshot for {season} ({len(table)} teams).")

    if kicked_off:
        recalculate_prediction_scores(season, table)
    else:
        reset_prediction_scores(season)

    save_elo_projection_snapshot(season, deduction_dicts)


def save_elo_projection_snapshot(season: str, deductions: list[dict]) -> None:
    """Run the ELO Monte Carlo simulation and persist a projection snapshot.

    Skipped when the season has not yet kicked off (no completed results means
    there is nothing meaningful to project from).  Called automatically after
    a new actual standings snapshot is committed.

    Args:
        season: Season string in ``'20xx-xx'`` format.
        deductions: Active point deduction dicts for the season.
    """
    if not has_season_kicked_off(season):
        print(f"Season {season} hasn't kicked off — running pre-season ELO projection.")

    create_elo_params_if_missing()
    print(f"Running ELO simulation for {season}...")
    projections = simulate_elo_projection(season, n_simulations=10_000, deductions=deductions)

    if not projections:
        print(f"ELO simulation returned no data for {season} — skipping.")
        return

    snapshot = EloProjection(
        season=season,
        projections=projections,
        updated_at=datetime.now(timezone.utc),
    )
    db.session.add(snapshot)
    db.session.commit()
    print(f"Saved ELO projection snapshot for {season} ({len(projections)} teams).")


def reset_prediction_scores(season: str) -> None:
    """Set ``current_points`` to ``None`` for every prediction in a season.

    Called when the season has not yet kicked off, ensuring no stale scores
    carry over if predictions are re-submitted or deductions change pre-season.

    Args:
        season: Season string in ``'20xx-xx'`` format.
    """
    predictions = UserPrediction.query.filter_by(season=season).all()
    for prediction in predictions:
        prediction.current_points = None
        prediction.exact_predictions = None
    db.session.commit()
    print(f"Reset points to null for {len(predictions)} prediction(s) in {season}.")


def recalculate_prediction_scores(season: str, actual_table: list[dict]) -> None:
    """Recompute and persist ``current_points`` for every prediction in a season.

    Called automatically after a new standings snapshot is saved. Iterates over
    all ``UserPrediction`` rows for the season and updates ``current_points``
    in place using the supplied actual table.

    Args:
        season: Season string in ``'20xx-xx'`` format.
        actual_table: Current standings as returned by ``calculate_epl_table``.
    """
    predictions = UserPrediction.query.filter_by(season=season).all()
    for prediction in predictions:
        prediction.current_points = compute_prediction_score(prediction.standings, actual_table)
        prediction.exact_predictions = compute_exact_predictions(prediction.standings, actual_table)
    db.session.commit()
    print(f"Recalculated points for {len(predictions)} prediction(s) in {season}.")


def main() -> None:
    fetch_data_files()
    process_existing_data()

if __name__ == "__main__":
    main()
