from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.league import League
from models.league_member import LeagueMember
from models.user import User
from models.user_prediction import UserPrediction
from services.epl import get_latest_epl_season, has_season_kicked_off, get_first_kickoff

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


def _global_rank(season: str, user_id: int) -> dict | None:
    """Return the user's rank among all predictors for a given season.

    Rank is computed as position in ascending ``current_points`` order (lowest
    score wins). Only counts users who have a numeric points value — i.e. the
    season has kicked off and points have been calculated.

    Args:
        season: Season string in ``'20xx-xx'`` format.
        user_id: ID of the user to rank.

    Returns:
        Dict with ``rank`` and ``total`` keys, or ``None`` if points are not
        yet available for this user.
    """
    predictions = (
        UserPrediction.query
        .filter(UserPrediction.season == season, UserPrediction.current_points.isnot(None))
        .order_by(UserPrediction.current_points.asc())
        .all()
    )
    if not predictions:
        return None

    for i, p in enumerate(predictions, start=1):
        if p.user_id == user_id:
            return {"rank": i, "total": len(predictions)}

    return None


def _league_rank(league_id: int, user_id: int, season: str) -> dict | None:
    """Return the user's rank within a specific league.

    Args:
        league_id: ID of the league.
        user_id: ID of the user to rank.
        season: Season string used to fetch predictions.

    Returns:
        Dict with ``rank`` and ``total`` keys, or ``None`` if points are unavailable.
    """
    members = LeagueMember.query.filter_by(league_id=league_id).all()
    scored = []
    for m in members:
        pred = UserPrediction.query.filter_by(user_id=m.user_id, season=season).first()
        if pred and pred.current_points is not None:
            scored.append((m.user_id, pred.current_points))

    if not scored:
        return None

    scored.sort(key=lambda x: x[1])
    total = len(members)
    for i, (uid, _) in enumerate(scored, start=1):
        if uid == user_id:
            return {"rank": i, "total": total}

    return None


def _season_summary(season: str, user_id: int, kicked_off: bool) -> dict:
    """Build the prediction + leagues summary dict for one season.

    Args:
        season: Season string in ``'20xx-xx'`` format.
        user_id: ID of the authenticated user.
        kicked_off: Whether the season deadline has passed.

    Returns:
        Dict with ``prediction``, ``leagues``, and ``global_rank`` keys.
    """
    prediction = UserPrediction.query.filter_by(user_id=user_id, season=season).first()
    prediction_payload = None
    if prediction:
        prediction_payload = {
            "standings": prediction.standings if kicked_off else None,
            "points": prediction.current_points,
            "submitted_at": prediction.submitted_at.isoformat(),
            "updated_at": prediction.updated_at.isoformat() if prediction.updated_at else None,
        }

    memberships = (
        LeagueMember.query
        .join(League, League.id == LeagueMember.league_id)
        .filter(LeagueMember.user_id == user_id, League.season == season)
        .all()
    )
    leagues_payload = []
    for m in memberships:
        league = m.league
        member_count = LeagueMember.query.filter_by(league_id=league.id).count()
        rank_info = _league_rank(league.id, user_id, season)
        leagues_payload.append({
            "id": league.id,
            "name": league.name,
            "code": league.code,
            "role": m.role,
            "member_count": member_count,
            "rank": rank_info,
        })

    global_rank = _global_rank(season, user_id)

    return {
        "prediction": prediction_payload,
        "leagues": leagues_payload,
        "global_rank": global_rank,
    }


@users_bp.get("/me/dashboard")
@jwt_required()
def get_dashboard():
    """Return a full dashboard summary for the authenticated user.

    Includes current season info, prediction state, per-league ranks, global
    rank, and a history entry for every past season the user has a prediction
    or league membership in.

    Returns:
        200 with the dashboard payload, or 404 if the user does not exist.
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    try:
        current_season = get_latest_epl_season()
    except FileNotFoundError:
        current_season = None

    kicked_off = has_season_kicked_off(current_season) if current_season else False
    first_kickoff = get_first_kickoff(current_season) if current_season else None

    current_payload = _season_summary(current_season, user_id, kicked_off) if current_season else None

    # Average score across all scored predictions for the current season.
    if current_season:
        scored = [
            p.current_points for p in
            UserPrediction.query
            .filter(UserPrediction.season == current_season, UserPrediction.current_points.isnot(None))
            .all()
        ]
        avg_score = round(sum(scored) / len(scored), 1) if scored else None
    else:
        avg_score = None

    # Collect all seasons this user has touched, excluding the current one.
    prediction_seasons = {
        p.season for p in UserPrediction.query.filter_by(user_id=user_id).all()
    }
    league_seasons = {
        m.league.season
        for m in LeagueMember.query.filter_by(user_id=user_id).all()
    }
    past_seasons = sorted(
        (prediction_seasons | league_seasons) - ({current_season} if current_season else set()),
        reverse=True,
    )

    history = []
    for season in past_seasons:
        summary = _season_summary(season, user_id, has_season_kicked_off(season))
        history.append({"season": season, **summary})

    return jsonify({
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
        },
        "current_season": current_season,
        "kicked_off": kicked_off,
        "deadline": first_kickoff.isoformat() if first_kickoff else None,
        "avg_score": avg_score,
        "current": current_payload,
        "history": history,
    }), 200


@users_bp.get("/stats")
def get_stats():
    """Return public platform statistics.

    No authentication required. Stats are computed on the fly from live data.

    Returns:
        200 with ``total_predicted_positions``, ``total_leagues``,
        ``total_users``, and ``total_predictions`` keys.
    """
    total_predictions = UserPrediction.query.count()
    total_leagues     = League.query.count()
    total_users       = User.query.count()

    return jsonify({
        "total_predicted_positions": total_predictions * 20,
        "total_predictions":         total_predictions,
        "total_leagues":             total_leagues,
        "total_users":               total_users,
    }), 200


@users_bp.get("/<int:user_id>")
def get_user(user_id: int):
    """Return the public profile for the given user.

    Args:
        user_id: Primary key of the user to fetch.

    Returns:
        200 with id, first_name, last_name and created_at, or 404 if not found.
    """
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    return jsonify({
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "created_at": user.created_at.isoformat(),
    }), 200


@users_bp.get("/<int:user_id>/profile")
@jwt_required()
def get_user_profile(user_id: int):
    """Return the public stats profile for a given user.

    Includes the current season score, global rank, and prediction standings
    (only if the deadline has passed), plus a history of past seasons with
    scores and global ranks. League membership is excluded entirely.

    Args:
        user_id: Primary key of the target user.

    Returns:
        200 with profile payload, or 404 if the user does not exist.
    """
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    try:
        current_season = get_latest_epl_season()
    except FileNotFoundError:
        current_season = None

    kicked_off = has_season_kicked_off(current_season) if current_season else False

    def _build_season(season: str, ko: bool) -> dict:
        prediction = UserPrediction.query.filter_by(user_id=user_id, season=season).first()
        global_rank = _global_rank(season, user_id)
        return {
            "season": season,
            "score": prediction.current_points if prediction else None,
            "global_rank": global_rank,
            "has_prediction": prediction is not None,
            "prediction_standings": prediction.standings if (prediction and ko) else None,
        }

    current = _build_season(current_season, kicked_off) if current_season else None

    prediction_seasons = {
        p.season for p in UserPrediction.query.filter_by(user_id=user_id).all()
    }
    past_seasons = sorted(
        prediction_seasons - ({current_season} if current_season else set()),
        reverse=True,
    )

    history = [_build_season(s, True) for s in past_seasons]

    return jsonify({
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "current_season": current,
        "history": history,
    }), 200



