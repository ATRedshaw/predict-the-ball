from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.actual_standing import ActualStanding
from models.points_deduction import PointsDeduction
from models.user import User
from services.epl import get_latest_epl_season, has_season_kicked_off, get_first_kickoff, get_season_teams

standings_bp = Blueprint("standings", __name__, url_prefix="/api/standings")


# ---------------------------------------------------------------------------
# Season helpers
# ---------------------------------------------------------------------------

@standings_bp.get("/current-season")
def current_season():
    """Return the latest EPL season derived from saved CSV files."""
    try:
        season = get_latest_epl_season()
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify({"season": season})


# ---------------------------------------------------------------------------
# Actual standings
# ---------------------------------------------------------------------------

@standings_bp.get("/<string:season>/actual/latest")
def get_latest_actual(season: str):
    """Return the most recent actual Premier League table snapshot for the given season."""
    snapshot = (
        ActualStanding.query
        .filter_by(season=season)
        .order_by(ActualStanding.updated_at.desc())
        .first()
    )
    if snapshot is None:
        return jsonify({"error": "No standings found for this season"}), 404

    return jsonify({
        "season": snapshot.season,
        "updated_at": snapshot.updated_at.isoformat() + "Z",
        "standings": snapshot.standings,
    })


@standings_bp.get("/<string:season>/actual/history")
def get_actual_history(season: str):
    """Return all actual table snapshots for the given season, newest first."""
    snapshots = (
        ActualStanding.query
        .filter_by(season=season)
        .order_by(ActualStanding.updated_at.desc())
        .all()
    )
    return jsonify([
        {
            "id": s.id,
            "season": s.season,
            "updated_at": s.updated_at.isoformat(),
            "standings": s.standings,
        }
        for s in snapshots
    ])


# ---------------------------------------------------------------------------
# Points deductions (admin only)
# ---------------------------------------------------------------------------

def _require_admin():
    """Return the current user if they are an admin, else abort with 403.

    Returns:
        Tuple of (user, None) on success, or (None, error_response) on failure.
    """
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if user is None or not user.is_admin:
        return None, (jsonify({"error": "Admin access required"}), 403)
    return user, None


@standings_bp.get("/<string:season>/deductions")
def get_deductions(season: str):
    """Return all points deductions for the given season."""
    deductions = PointsDeduction.query.filter_by(season=season).order_by(
        PointsDeduction.applied_at.desc()
    ).all()
    return jsonify([
        {
            "id": d.id,
            "season": d.season,
            "team": d.team,
            "points": d.points,
            "reason": d.reason,
            "applied_at": d.applied_at.isoformat(),
        }
        for d in deductions
    ])


@standings_bp.post("/<string:season>/deductions")
@jwt_required()
def add_deduction(season: str):
    """Add a points deduction for a team. Admin only.

    Request body (JSON):
        team (str): Team name, must match the name used in CSV data.
        points (int): Positive integer — number of points to deduct.
        reason (str, optional): Human-readable explanation.
    """
    _, err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    team = data.get("team", "").strip()
    points = data.get("points")
    reason = data.get("reason", "").strip() or None

    if not team:
        return jsonify({"error": "team is required"}), 400
    if not isinstance(points, int) or points <= 0:
        return jsonify({"error": "points must be a positive integer"}), 400

    deduction = PointsDeduction(season=season, team=team, points=points, reason=reason)
    db.session.add(deduction)
    db.session.commit()

    return jsonify({
        "id": deduction.id,
        "season": deduction.season,
        "team": deduction.team,
        "points": deduction.points,
        "reason": deduction.reason,
        "applied_at": deduction.applied_at.isoformat(),
    }), 201


@standings_bp.delete("/<string:season>/deductions/<int:deduction_id>")
@jwt_required()
def delete_deduction(season: str, deduction_id: int):
    """Remove a specific points deduction. Admin only."""
    _, err = _require_admin()
    if err:
        return err

    deduction = db.session.get(PointsDeduction, deduction_id)
    if deduction is None or deduction.season != season:
        return jsonify({"error": "Deduction not found"}), 404

    db.session.delete(deduction)
    db.session.commit()
    return jsonify({"message": "Deduction removed"}), 200


# ---------------------------------------------------------------------------
# Deadline / kicked-off
# ---------------------------------------------------------------------------

@standings_bp.get("/<string:season>/deadline")
def get_deadline(season: str):
    """Return the first kick-off time for the season and whether it has passed."""
    kicked_off = has_season_kicked_off(season)
    first_kickoff = get_first_kickoff(season)
    return jsonify({
        "season": season,
        "kicked_off": kicked_off,
        "deadline": first_kickoff.isoformat() if first_kickoff else None,
    })


@standings_bp.get("/<string:season>/teams")
def get_season_team_list(season: str):
    """Return the alphabetically sorted list of teams for the given season.

    Reads directly from the season CSV — does not require a DB snapshot.
    Useful for building prediction forms before any actual standings exist.

    Args:
        season: Season string in ``'20xx-xx'`` format.
    """
    teams = get_season_teams(season)
    if not teams:
        return jsonify({"error": "No team data found for this season"}), 404
    return jsonify({"season": season, "teams": teams})


# ---------------------------------------------------------------------------
# ELO projections (stubs — to be implemented)
# ---------------------------------------------------------------------------

@standings_bp.get("/<string:season>/elo/latest")
def get_latest_elo(season: str):
    """Return the most recent ELO-projected final standings for the given season."""
    pass


@standings_bp.get("/<string:season>/elo/<int:gameweek>")
def get_elo_by_gameweek(season: str, gameweek: int):
    """Return the ELO projection snapshot for a specific gameweek."""
    pass


@standings_bp.get("/<string:season>/compare")
def compare_elo_vs_actual(season: str):
    """
    Return a side-by-side comparison of the current actual table and the
    pre-deadline ELO projection (gameweek 0 snapshot) for the given season.
    """
    pass
