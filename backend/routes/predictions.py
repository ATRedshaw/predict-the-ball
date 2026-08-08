from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.user_prediction import UserPrediction
from services.epl import has_season_kicked_off, get_season_teams

predictions_bp = Blueprint("predictions", __name__, url_prefix="/api/predictions")


def _validate_standings(standings: list, season: str) -> str | None:
    """Check that a submitted standings list is valid for the given season.

    Args:
        standings: The candidate list of team name strings.
        season: Season string in ``'20xx-xx'`` format.

    Returns:
        An error message string if invalid, or ``None`` if the list is fine.
    """
    if not isinstance(standings, list):
        return "standings must be a list"

    valid_teams = set(get_season_teams(season))
    if not valid_teams:
        return "Could not load team list for this season"

    submitted = [str(t).strip() for t in standings]

    if len(submitted) != len(valid_teams):
        return f"standings must contain exactly {len(valid_teams)} teams"

    if len(set(submitted)) != len(submitted):
        return "standings contains duplicate teams"

    unknown = set(submitted) - valid_teams
    if unknown:
        return f"Unknown teams: {', '.join(sorted(unknown))}"

    return None


@predictions_bp.post("/<string:season>")
@jwt_required()
def submit_prediction(season: str):
    """Submit a predicted final standings for the given season.

    Only allowed before the season deadline (90 minutes before the opening fixture). One prediction
    per user per season — applies to all leagues the user is in.

    Args:
        season: Season string in ``'20xx-xx'`` format.

    Request body:
        standings (list[str]): Ordered list of team names, index 0 = champions.

    Returns:
        201 on success, 400 on validation failure, 409 if prediction already exists,
        403 if the deadline has passed.
    """
    if has_season_kicked_off(season):
        return jsonify({"error": "The prediction deadline has passed for this season"}), 403

    data = request.get_json(silent=True) or {}
    standings = data.get("standings")

    err = _validate_standings(standings, season)
    if err:
        return jsonify({"error": err}), 400

    user_id = get_jwt_identity()

    existing = UserPrediction.query.filter_by(user_id=user_id, season=season).first()
    if existing:
        return jsonify({"error": "Prediction already exists for this season — use PUT to update"}), 409

    prediction = UserPrediction(user_id=user_id, season=season, standings=standings)
    db.session.add(prediction)
    db.session.commit()

    return jsonify({
        "season": prediction.season,
        "standings": prediction.standings,
        "submitted_at": prediction.submitted_at.isoformat(),
    }), 201


@predictions_bp.put("/<string:season>")
@jwt_required()
def update_prediction(season: str):
    """Update an existing prediction before the season deadline.

    Args:
        season: Season string in ``'20xx-xx'`` format.

    Request body:
        standings (list[str]): Revised ordered list of team names.

    Returns:
        200 on success, 400 on validation failure, 404 if no prediction exists yet,
        403 if the deadline has passed.
    """
    if has_season_kicked_off(season):
        return jsonify({"error": "The prediction deadline has passed for this season"}), 403

    data = request.get_json(silent=True) or {}
    standings = data.get("standings")

    err = _validate_standings(standings, season)
    if err:
        return jsonify({"error": err}), 400

    user_id = get_jwt_identity()

    prediction = UserPrediction.query.filter_by(user_id=user_id, season=season).first()
    if prediction is None:
        return jsonify({"error": "No existing prediction found — use POST to create one"}), 404

    prediction.standings = standings
    prediction.current_points = None
    prediction.exact_predictions = None

    db.session.commit()

    return jsonify({
        "season": prediction.season,
        "standings": prediction.standings,
        "submitted_at": prediction.submitted_at.isoformat(),
        "updated_at": prediction.updated_at.isoformat() if prediction.updated_at else None,
        "current_points": prediction.current_points,
    })


@predictions_bp.get("/<string:season>")
@jwt_required()
def get_my_prediction(season: str):
    """Return the authenticated user's prediction for the given season.

    Args:
        season: Season string in ``'20xx-xx'`` format.

    Returns:
        The prediction object, or 404 if none exists.
    """
    user_id = get_jwt_identity()
    prediction = UserPrediction.query.filter_by(user_id=user_id, season=season).first()

    if prediction is None:
        return jsonify({"error": "No prediction found for this season"}), 404

    return jsonify({
        "season": prediction.season,
        "standings": prediction.standings,
        "submitted_at": prediction.submitted_at.isoformat(),
        "updated_at": prediction.updated_at.isoformat() if prediction.updated_at else None,
    })


@predictions_bp.get("/<string:season>/user/<int:user_id>")
@jwt_required()
def get_user_prediction(season: str, user_id: int):
    """Return a specific user's prediction for the given season.

    Only accessible after the deadline has passed.

    Args:
        season: Season string in ``'20xx-xx'`` format.
        user_id: ID of the user whose prediction is requested.

    Returns:
        The prediction object, or 404/403 as appropriate.
    """
    if not has_season_kicked_off(season):
        return jsonify({"error": "Predictions are hidden until the season has started"}), 403

    prediction = UserPrediction.query.filter_by(user_id=user_id, season=season).first()
    if prediction is None:
        return jsonify({"error": "No prediction found"}), 404

    return jsonify({
        "season": prediction.season,
        "standings": prediction.standings,
        "submitted_at": prediction.submitted_at.isoformat(),
        "updated_at": prediction.updated_at.isoformat() if prediction.updated_at else None,
    })
