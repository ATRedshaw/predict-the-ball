from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.league import League
from models.league_member import LeagueMember
from models.user import User
from models.user_prediction import UserPrediction
from services.epl import has_season_kicked_off

leagues_bp = Blueprint("leagues", __name__, url_prefix="/api/leagues")


def _get_membership(league_id: int, user_id: int) -> LeagueMember | None:
    """Fetch a single LeagueMember row, or None if the user isn't in the league.

    Args:
        league_id: ID of the league to check.
        user_id: ID of the user to look up.

    Returns:
        The ``LeagueMember`` row, or ``None``.
    """
    return LeagueMember.query.filter_by(league_id=league_id, user_id=user_id).first()


def _member_payload(member: LeagueMember, season: str, kicked_off: bool) -> dict:
    """Serialise a league member with prediction info.

    Args:
        member: The ``LeagueMember`` row.
        season: Season string used to look up the prediction.
        kicked_off: Whether the season deadline has passed.

    Returns:
        Dict with user details, role, and prediction state.
    """
    user = db.session.get(User, member.user_id)
    prediction = UserPrediction.query.filter_by(user_id=member.user_id, season=season).first()
    return {
        "user_id": member.user_id,
        "name": f"{user.first_name} {user.last_name}" if user else "Unknown",
        "role": member.role,
        "joined_at": member.joined_at.isoformat(),
        "has_prediction": prediction is not None,
        "current_points": prediction.current_points if (prediction and kicked_off) else None,
        "standings": prediction.standings if (prediction and kicked_off) else None,
    }


@leagues_bp.post("/")
@jwt_required()
def create_league():
    """Create a new league for the authenticated user.

    Automatically assigns the creator the ``'owner'`` role and generates a
    unique 6-character invite code.

    Request body (JSON):
        name (str): Display name for the league.
        season (str): Season string in ``'20xx-xx'`` format.

    Returns:
        201 with the new league object, or 400 on missing fields.
    """
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    season = (data.get("season") or "").strip()

    if not name:
        return jsonify({"error": "name is required"}), 400
    if not season:
        return jsonify({"error": "season is required"}), 400

    league = League(name=name, season=season, created_by=user_id)
    db.session.add(league)
    db.session.flush()  # populate league.id before creating the membership row

    member = LeagueMember(league_id=league.id, user_id=user_id, role="owner")
    db.session.add(member)
    db.session.commit()

    return jsonify({
        "id": league.id,
        "name": league.name,
        "code": league.code,
        "season": league.season,
        "created_by": league.created_by,
        "created_at": league.created_at.isoformat(),
    }), 201


@leagues_bp.get("/")
@jwt_required()
def get_my_leagues():
    """Return all leagues the authenticated user belongs to.

    Returns:
        List of league summaries, each including the user's role and member count.
    """
    user_id = get_jwt_identity()
    memberships = LeagueMember.query.filter_by(user_id=user_id).all()

    result = []
    for m in memberships:
        league = m.league
        count = LeagueMember.query.filter_by(league_id=league.id).count()
        result.append({
            "id": league.id,
            "name": league.name,
            "code": league.code,
            "season": league.season,
            "role": m.role,
            "member_count": count,
            "created_at": league.created_at.isoformat(),
        })

    return jsonify(result)


@leagues_bp.get("/<int:league_id>")
@jwt_required()
def get_league(league_id: int):
    """Return full league details including a ranked member leaderboard.

    After the deadline the member list is sorted by ``current_points`` ascending
    (lowest score wins). Before kick-off, predictions and points are withheld.
    Only league members can access this endpoint.

    Args:
        league_id: ID of the league to fetch.

    Returns:
        League object with members array, or 403/404 as appropriate.
    """
    user_id = get_jwt_identity()
    league = db.session.get(League, league_id)
    if league is None:
        return jsonify({"error": "League not found"}), 404

    if _get_membership(league_id, user_id) is None:
        return jsonify({"error": "You are not a member of this league"}), 403

    kicked_off = has_season_kicked_off(league.season)
    members = LeagueMember.query.filter_by(league_id=league_id).all()
    member_list = [_member_payload(m, league.season, kicked_off) for m in members]

    if kicked_off:
        member_list.sort(key=lambda x: (x["current_points"] is None, x["current_points"] or 0))

    return jsonify({
        "id": league.id,
        "name": league.name,
        "code": league.code,
        "season": league.season,
        "created_by": league.created_by,
        "created_at": league.created_at.isoformat(),
        "kicked_off": kicked_off,
        "members": member_list,
    })


@leagues_bp.post("/join")
@jwt_required()
def join_league():
    """Join a league using its invite code.

    Request body (JSON):
        code (str): The 6-character league invite code.

    Returns:
        201 with basic league info, 404 for an invalid code, 409 if already a member.
    """
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip().upper()

    if not code:
        return jsonify({"error": "code is required"}), 400

    league = League.query.filter_by(code=code).first()
    if league is None:
        return jsonify({"error": "Invalid invite code"}), 404

    if _get_membership(league.id, user_id) is not None:
        return jsonify({"error": "You are already a member of this league"}), 409

    member = LeagueMember(league_id=league.id, user_id=user_id, role="member")
    db.session.add(member)
    db.session.commit()

    return jsonify({
        "id": league.id,
        "name": league.name,
        "code": league.code,
        "season": league.season,
    }), 201


@leagues_bp.delete("/<int:league_id>/leave")
@jwt_required()
def leave_league(league_id: int):
    """Remove the authenticated user from a league.

    If the user is the owner and there are other members, they must transfer
    ownership or delete the league first. If they are the sole member, the
    league is deleted automatically.

    Args:
        league_id: ID of the league to leave.

    Returns:
        200 on success, 400 if an owner tries to leave with remaining members.
    """
    user_id = get_jwt_identity()
    league = db.session.get(League, league_id)
    if league is None:
        return jsonify({"error": "League not found"}), 404

    membership = _get_membership(league_id, user_id)
    if membership is None:
        return jsonify({"error": "You are not a member of this league"}), 403

    if membership.role == "owner":
        count = LeagueMember.query.filter_by(league_id=league_id).count()
        if count > 1:
            return jsonify({"error": "Transfer ownership or delete the league before leaving"}), 400
        # Sole member — tidy up the whole league
        db.session.delete(league)
        db.session.commit()
        return jsonify({"message": "League deleted as you were the sole member"}), 200

    db.session.delete(membership)
    db.session.commit()
    return jsonify({"message": "You have left the league"}), 200


@leagues_bp.delete("/<int:league_id>")
@jwt_required()
def delete_league(league_id: int):
    """Delete a league entirely. Owner only.

    Args:
        league_id: ID of the league to delete.

    Returns:
        200 on success, 403 if not the owner.
    """
    user_id = get_jwt_identity()
    league = db.session.get(League, league_id)
    if league is None:
        return jsonify({"error": "League not found"}), 404

    membership = _get_membership(league_id, user_id)
    if membership is None or membership.role != "owner":
        return jsonify({"error": "Owner access required"}), 403

    db.session.delete(league)
    db.session.commit()
    return jsonify({"message": "League deleted"}), 200


@leagues_bp.get("/<int:league_id>/members")
@jwt_required()
def get_members(league_id: int):
    """Return all members of a league with their prediction status.

    Accessible only to existing league members. Points are omitted before
    the season deadline.

    Args:
        league_id: ID of the league.

    Returns:
        List of member objects, or 403/404.
    """
    user_id = get_jwt_identity()
    league = db.session.get(League, league_id)
    if league is None:
        return jsonify({"error": "League not found"}), 404

    if _get_membership(league_id, user_id) is None:
        return jsonify({"error": "You are not a member of this league"}), 403

    kicked_off = has_season_kicked_off(league.season)
    members = LeagueMember.query.filter_by(league_id=league_id).all()
    return jsonify([_member_payload(m, league.season, kicked_off) for m in members])


@leagues_bp.delete("/<int:league_id>/members/<int:target_user_id>")
@jwt_required()
def remove_member(league_id: int, target_user_id: int):
    """Remove a specific member from a league. Owner only.

    Args:
        league_id: ID of the league.
        target_user_id: ID of the user to remove.

    Returns:
        200 on success, 400 if trying to remove yourself, 403/404 otherwise.
    """
    user_id = get_jwt_identity()
    league = db.session.get(League, league_id)
    if league is None:
        return jsonify({"error": "League not found"}), 404

    membership = _get_membership(league_id, user_id)
    if membership is None or membership.role != "owner":
        return jsonify({"error": "Owner access required"}), 403

    if target_user_id == user_id:
        return jsonify({"error": "Cannot remove yourself — use the leave endpoint instead"}), 400

    target = _get_membership(league_id, target_user_id)
    if target is None:
        return jsonify({"error": "User is not a member of this league"}), 404

    db.session.delete(target)
    db.session.commit()
    return jsonify({"message": "Member removed"}), 200


@leagues_bp.post("/<int:league_id>/transfer-ownership")
@jwt_required()
def transfer_ownership(league_id: int):
    """Transfer league ownership to another existing member. Owner only.

    Request body (JSON):
        new_owner_id (int): User ID of the member to promote.

    Args:
        league_id: ID of the league.

    Returns:
        200 on success, 400/403/404 as appropriate.
    """
    user_id = get_jwt_identity()
    league = db.session.get(League, league_id)
    if league is None:
        return jsonify({"error": "League not found"}), 404

    membership = _get_membership(league_id, user_id)
    if membership is None or membership.role != "owner":
        return jsonify({"error": "Owner access required"}), 403

    data = request.get_json(silent=True) or {}
    new_owner_id = data.get("new_owner_id")
    if not isinstance(new_owner_id, int):
        return jsonify({"error": "new_owner_id must be an integer"}), 400
    if new_owner_id == user_id:
        return jsonify({"error": "You are already the owner"}), 400

    new_membership = _get_membership(league_id, new_owner_id)
    if new_membership is None:
        return jsonify({"error": "Target user is not a member of this league"}), 404

    membership.role = "member"
    new_membership.role = "owner"
    league.created_by = new_owner_id
    db.session.commit()

    return jsonify({"message": "Ownership transferred"}), 200
