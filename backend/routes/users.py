from flask import Blueprint, request, jsonify

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.get("/<int:user_id>")
def get_user(user_id: int):
    """
    Return a public profile for the given user (username, joined date).
    """
    pass


@users_bp.put("/me")
def update_profile():
    """
    Update the authenticated user's profile (username).
    Body: { username }
    """
    pass


@users_bp.put("/me/password")
def change_password():
    """
    Change the authenticated user's password.
    Body: { current_password, new_password }
    """
    pass


@users_bp.delete("/me")
def delete_account():
    """
    Permanently delete the authenticated user's account and all associated data.
    """
    pass
