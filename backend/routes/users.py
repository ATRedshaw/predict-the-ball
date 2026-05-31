from flask import Blueprint, jsonify

from extensions import db
from models.user import User

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


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



