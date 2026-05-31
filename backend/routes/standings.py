from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from datetime import date, datetime, timezone

from extensions import db
from models.actual_standing import ActualStanding
from models.elo_projection import EloProjection
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
@jwt_required()
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
# ELO projections
# ---------------------------------------------------------------------------

def _serialize_projection(snapshot: EloProjection) -> dict:
    """Serialise an EloProjection row to a JSON-safe dict.

    Args:
        snapshot: ORM instance to serialise.

    Returns:
        Dict with ``id``, ``season``, ``updated_at``, and ``projections``.
    """
    return {
        "id": snapshot.id,
        "season": snapshot.season,
        "updated_at": snapshot.updated_at.isoformat() + "Z",
        "projections": snapshot.projections,
    }


@standings_bp.get("/<string:season>/elo/latest")
@jwt_required()
def get_latest_elo(season: str):
    """Return the most recent ELO projection snapshot for the given season."""
    snapshot = (
        EloProjection.query
        .filter_by(season=season)
        .order_by(EloProjection.updated_at.desc())
        .first()
    )
    if snapshot is None:
        return jsonify({"error": "No ELO projection found for this season"}), 404

    return jsonify(_serialize_projection(snapshot))


@standings_bp.get("/<string:season>/elo/on")
@jwt_required()
def get_elo_on_date(season: str):
    """Return the most recent ELO projection snapshot produced on or before a given date.

    The date is supplied as the ``date`` query parameter in ``YYYY-MM-DD`` format.
    When multiple snapshots exist on the same day the latest one (by time) is used.

    Query parameters:
        date (str): Target date in ``YYYY-MM-DD`` format.

    Returns:
        404 if no snapshot exists on or before the given date.
        400 if the date parameter is missing or unparseable.
    """
    raw = request.args.get("date", "").strip()
    if not raw:
        return jsonify({"error": "'date' query parameter is required (YYYY-MM-DD)"}), 400

    try:
        target = datetime(
            *[int(p) for p in raw.split("-")],
            hour=23, minute=59, second=59,
            tzinfo=timezone.utc,
        )
    except (ValueError, TypeError):
        return jsonify({"error": f"Invalid date '{raw}' — expected YYYY-MM-DD"}), 400

    snapshot = (
        EloProjection.query
        .filter(EloProjection.season == season, EloProjection.updated_at <= target)
        .order_by(EloProjection.updated_at.desc())
        .first()
    )
    if snapshot is None:
        return jsonify({"error": f"No ELO projection found for {season} on or before {raw}"}), 404

    return jsonify(_serialize_projection(snapshot))


@standings_bp.get("/<string:season>/elo/history")
@jwt_required()
def get_elo_history(season: str):
    """Return all ELO projection snapshots for the season, newest first."""
    snapshots = (
        EloProjection.query
        .filter_by(season=season)
        .order_by(EloProjection.updated_at.desc())
        .all()
    )
    return jsonify([_serialize_projection(s) for s in snapshots])


@standings_bp.get("/<string:season>/elo/compare")
@jwt_required()
def compare_elo_vs_actual(season: str):
    """Compare the current actual table against ELO projections.

    By default compares the latest actual standings against the very first
    ELO projection ever produced for the season (i.e. what the model thought
    before any results came in).  Pass a ``date`` query parameter
    (``YYYY-MM-DD``) to instead use the most recent projection on or before
    that date alongside the most recent actual standings on or before that date.

    Query parameters:
        date (str, optional): ``YYYY-MM-DD`` — pin both snapshots to a
            specific point in time.  Defaults to the current moment.

    Response shape:

    .. code-block:: json

        {
            "season": "2026-27",
            "actual": { "updated_at": "...", "standings": [...] },
            "projection": { "updated_at": "...", "projections": [...] },
            "comparison": [
                {
                    "team": "Arsenal",
                    "actual_position": 2,
                    "projected_mean_position": 1.8,
                    "position_delta": -0.2
                },
                ...
            ]
        }
    """
    raw_date = request.args.get("date", "").strip()

    if raw_date:
        try:
            cutoff = datetime(
                *[int(p) for p in raw_date.split("-")],
                hour=23, minute=59, second=59,
                tzinfo=timezone.utc,
            )
        except (ValueError, TypeError):
            return jsonify({"error": f"Invalid date '{raw_date}' — expected YYYY-MM-DD"}), 400

        actual_snap = (
            ActualStanding.query
            .filter(ActualStanding.season == season, ActualStanding.updated_at <= cutoff)
            .order_by(ActualStanding.updated_at.desc())
            .first()
        )
        proj_snap = (
            EloProjection.query
            .filter(EloProjection.season == season, EloProjection.updated_at <= cutoff)
            .order_by(EloProjection.updated_at.desc())
            .first()
        )
    else:
        actual_snap = (
            ActualStanding.query
            .filter_by(season=season)
            .order_by(ActualStanding.updated_at.desc())
            .first()
        )
        # First-ever projection for the season — baseline before any results.
        proj_snap = (
            EloProjection.query
            .filter_by(season=season)
            .order_by(EloProjection.updated_at.asc())
            .first()
        )

    if actual_snap is None:
        return jsonify({"error": "No actual standings found for this season"}), 404
    if proj_snap is None:
        return jsonify({"error": "No ELO projection found for this season"}), 404

    actual_pos = {row["team"]: row["position"] for row in actual_snap.standings}
    # Projected rank = 1-based position in the mean_position-sorted projections list.
    # Using rank rather than the raw mean avoids nonsensical deltas (e.g. actual 3rd
    # vs mean 5.0 when that mean corresponds to 3rd place in the model's ordering).
    proj_rank = {row["team"]: i + 1 for i, row in enumerate(proj_snap.projections)}
    proj_mean = {row["team"]: row["mean_position"] for row in proj_snap.projections}

    comparison = []
    for team, actual_position in sorted(actual_pos.items(), key=lambda x: x[1]):
        rank = proj_rank.get(team)
        mean_pos = proj_mean.get(team)
        comparison.append({
            "team": team,
            "actual_position": actual_position,
            "projected_rank": rank,
            "projected_mean_position": mean_pos,
            "position_delta": (
                actual_position - rank if rank is not None else None
            ),
        })

    return jsonify({
        "season": season,
        "actual": {
            "updated_at": actual_snap.updated_at.isoformat() + "Z",
            "standings": actual_snap.standings,
        },
        "projection": {
            "updated_at": proj_snap.updated_at.isoformat() + "Z",
            "projections": proj_snap.projections,
        },
        "comparison": comparison,
    })
