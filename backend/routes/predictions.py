from flask import Blueprint, request, jsonify

predictions_bp = Blueprint("predictions", __name__, url_prefix="/api/predictions")


@predictions_bp.post("/<string:season>")
def submit_prediction(season: str):
    """
    Submit a predicted final standings for the given season.
    Only allowed before the season deadline.
    One prediction per user per season — applies to all leagues the user is in.
    Body: { standings: ["Team A", "Team B", ..., "Team T"] }  (ordered list of 20 teams)
    """
    pass


@predictions_bp.put("/<string:season>")
def update_prediction(season: str):
    """
    Update an existing prediction. Only allowed before the season deadline.
    Body: { standings: ["Team A", ..., "Team T"] }
    """
    pass


@predictions_bp.get("/<string:season>")
def get_my_prediction(season: str):
    """
    Return the authenticated user's prediction for the given season.
    """
    pass


@predictions_bp.get("/<string:season>/user/<int:user_id>")
def get_user_prediction(season: str, user_id: int):
    """
    Return a specific user's prediction for the given season.
    Only accessible to users sharing at least one league with them,
    and only after the deadline has passed.
    """
    pass
