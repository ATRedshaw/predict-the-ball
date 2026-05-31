from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

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


@users_bp.put("/me")
@jwt_required()
def update_profile():
    """Update the authenticated user's first and/or last name.

    Requires: Authorization header with Bearer token.
    Body: { first_name, last_name }

    Returns:
        200 with updated profile, 400 on validation failure, 404 if user not found.
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json(silent=True) or {}
    first_name = (data.get("first_name") or "").strip()
    last_name  = (data.get("last_name")  or "").strip()

    if not first_name or not last_name:
        return jsonify({"error": "first_name and last_name are required"}), 400
    if len(first_name) > 35 or len(last_name) > 35:
        return jsonify({"error": "first_name and last_name must be 35 characters or fewer"}), 400

    first_name = " ".join(word.capitalize() for word in first_name.split())
    last_name  = " ".join(word.capitalize() for word in last_name.split())

    user.first_name = first_name
    user.last_name  = last_name
    db.session.commit()

    return jsonify({
        "id":         user.id,
        "first_name": user.first_name,
        "last_name":  user.last_name,
        "email":      user.email,
    }), 200


@users_bp.delete("/me")
@jwt_required()
def delete_account():
    """Permanently delete the authenticated user's account and all associated data.

    Requires: Authorization header with Bearer token.

    Returns:
        200 on success, 404 if user not found.
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "account deleted"}), 200
