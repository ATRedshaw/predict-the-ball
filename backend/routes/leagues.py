from flask import Blueprint, request, jsonify

leagues_bp = Blueprint("leagues", __name__, url_prefix="/api/leagues")


@leagues_bp.post("/")
def create_league():
    """
    Create a new league for the authenticated user.
    Automatically assigns them the "owner" role and generates a unique invite code.
    Body: { name, season }
    """
    pass


@leagues_bp.get("/")
def get_my_leagues():
    """
    Return all leagues the authenticated user belongs to.
    """
    pass


@leagues_bp.get("/<int:league_id>")
def get_league(league_id: int):
    """
    Return details for a specific league, including its members and their predictions.
    Accessible only to league members.
    """
    pass


@leagues_bp.post("/join")
def join_league():
    """
    Join a league via its invite code.
    Body: { code }
    """
    pass


@leagues_bp.delete("/<int:league_id>/leave")
def leave_league(league_id: int):
    """
    Remove the authenticated user from a league.
    Owners must transfer ownership or delete the league before leaving.
    """
    pass


@leagues_bp.delete("/<int:league_id>")
def delete_league(league_id: int):
    """
    Delete a league entirely. Owner only.
    """
    pass


@leagues_bp.get("/<int:league_id>/members")
def get_members(league_id: int):
    """
    Return all members of a league with their usernames and prediction status.
    Accessible only to league members.
    """
    pass


@leagues_bp.delete("/<int:league_id>/members/<int:user_id>")
def remove_member(league_id: int, user_id: int):
    """
    Remove a member from a league. Owner only.
    """
    pass


@leagues_bp.post("/<int:league_id>/transfer-ownership")
def transfer_ownership(league_id: int):
    """
    Transfer league ownership to another member. Owner only.
    Body: { new_owner_id }
    """
    pass
