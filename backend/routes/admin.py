from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.user import User

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _require_admin():
    """Return the current user if they are an admin, else abort with 403.

    Returns:
        Tuple of (user, None) on success, or (None, error_response) on failure.
    """
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if user is None or not user.is_admin:
        return None, (jsonify({"error": "Admin access required"}), 403)
    return user, None


@admin_bp.get("/users")
@jwt_required()
def list_users():
    """Return all registered users, ordered newest first.

    Admin only. Safe to expose since user predictions are not included.

    Returns:
        200 with a list of user objects.
    """
    _, err = _require_admin()
    if err:
        return err

    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([
        {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email": u.email,
            "is_admin": u.is_admin,
            "is_verified": u.is_verified,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ])


@admin_bp.post("/standings/refresh")
@jwt_required()
def refresh_standings():
    """Trigger a standings + ELO snapshot for the current season.

    Runs the same logic as the ``commands.py`` CLI script. Useful for
    triggering a refresh without SSH access to the server.

    Returns:
        200 on success, 500 if the snapshot fails.
    """
    _, err = _require_admin()
    if err:
        return err

    try:
        from commands import save_actual_standings_snapshot
        from services.epl import get_latest_epl_season

        season = get_latest_epl_season()
        save_actual_standings_snapshot(season, force=True)
        return jsonify({"message": f"Standings refreshed for {season}"}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
