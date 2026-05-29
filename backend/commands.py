"""
CLI commands for backend data management.

Run from the backend/ directory with the venv active, e.g.:
    python commands.py

Available actions (determined by __main__ block below):
  - Calculates the current EPL table and saves a snapshot to the database.
    If the season has not kicked off yet, saves an alphabetical shell with
    all stats at zero (and any pre-applied deductions reflected in points).
"""

import sys
from datetime import datetime, timezone

sys.path.insert(0, __file__.rsplit("/", 1)[0])  # ensure backend/ is on the path

from app import create_app
from extensions import db
from models.actual_standing import ActualStanding
from models.points_deduction import PointsDeduction
from services.epl import (
    calculate_epl_table,
    get_latest_epl_season,
    has_season_kicked_off,
)


def save_actual_standings_snapshot(season: str) -> None:
    """Calculate the current EPL table and persist a new snapshot.

    Pulls any active points deductions from the database for the season,
    calculates the table via the CSV data, then writes a new ``ActualStanding``
    row. If the season has not yet kicked off, the snapshot contains all teams
    in alphabetical order with zero stats.

    Args:
        season: Season string in ``'20xx-xx'`` format, e.g. ``'2025-26'``.
    """
    kicked_off = has_season_kicked_off(season)

    deductions = PointsDeduction.query.filter_by(season=season).all()
    deduction_dicts = [{"team": d.team, "points": d.points} for d in deductions]

    table = calculate_epl_table(season, kicked_off, deduction_dicts)

    if not table:
        print(f"No table data for season {season} — skipping snapshot.")
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


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        season = get_latest_epl_season()
        print(f"Processing season: {season}")
        save_actual_standings_snapshot(season)


# Handles standard scores ("1–2"), penalty shootouts ("(4) 1–1 (3)"), and plain hyphens.
