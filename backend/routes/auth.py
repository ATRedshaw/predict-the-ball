from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from flask_mail import Message
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from datetime import datetime, timezone

from extensions import db, mail
from models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

_PASSWORD_RESET_SALT = "password-reset"
_TOKEN_MAX_AGE = 3600  # seconds (1 hour)


def _serialiser() -> URLSafeTimedSerializer:
    """Return a serialiser bound to the current app's secret key."""
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])


def _send_verification_email(user: User, code: str) -> None:
    """Send a 6-digit verification code email to the given user.

    Args:
        user: The User instance to verify.
        code: The plaintext 6-digit code to include in the email.
    """
    msg = Message(
        subject="Your Predict the Ball verification code",
        recipients=[user.email],
        body=(
            f"Hi {user.first_name},\n\n"
            f"Your verification code is: {code}\n\n"
            f"It expires in 15 minutes. Do not share it with anyone.\n\n"
            "If you didn't create an account, you can ignore this email."
        ),
    )
    mail.send(msg)


def _send_reset_email(user: User) -> None:
    """Send a password-reset email to the given user.

    Args:
        user: The User instance requesting a password reset.
    """
    token = _serialiser().dumps(user.email, salt=_PASSWORD_RESET_SALT)
    reset_url = f"{current_app.config.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={token}"
    msg = Message(
        subject="Reset your Predict the Ball password",
        recipients=[user.email],
        body=(
            f"Hi {user.first_name},\n\n"
            f"Click the link below to reset your password. "
            f"It expires in 1 hour.\n\n{reset_url}\n\n"
            "If you didn't request a reset, you can ignore this email."
        ),
    )
    mail.send(msg)


@auth_bp.post("/register")
def register():
    """Register a new user.

    Body: { username, email, password }
    Sends a 6-digit verification code email on success.

    Returns:
        201 with a success message, or 400/409 on validation failure.
    """
    data = request.get_json(silent=True) or {}
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "first_name, last_name, email and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email already registered"}), 409

    user = User(first_name=first_name, last_name=last_name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # get user.id without committing

    code = user.generate_verification_code()
    db.session.commit()

    _send_verification_email(user, code)

    return jsonify({"message": "Account created. Enter the 6-digit code sent to your email."}), 201


@auth_bp.post("/verify-email")
def verify_email():
    """Verify an email address using a 6-digit code.

    Body: { email, code }

    Returns:
        200 on success, 400 on invalid/expired code, 404 if user not found.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()

    if not email or not code:
        return jsonify({"error": "email and code are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "user not found"}), 404
    if user.is_verified:
        return jsonify({"message": "email already verified"}), 200
    if not user.verification_code or user.verification_code != code:
        return jsonify({"error": "invalid verification code"}), 400
    if user.verification_code_expires_at < datetime.now(timezone.utc):
        return jsonify({"error": "verification code has expired — request a new one"}), 400

    user.is_verified = True
    user.verification_code = None
    user.verification_code_expires_at = None
    db.session.commit()
    return jsonify({"message": "email verified successfully"}), 200


@auth_bp.post("/resend-verification")
def resend_verification():
    """Resend a verification code to the given email address.

    Body: { email }
    Subject to a 60-second cooldown between sends.

    Returns:
        200 on success, 400 if already verified or on cooldown, 404 if not found.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "user not found"}), 404
    if user.is_verified:
        return jsonify({"error": "email is already verified"}), 400
    if not user.can_resend_verification_code():
        return jsonify({"error": "please wait before requesting another code"}), 429

    code = user.generate_verification_code()
    db.session.commit()
    _send_verification_email(user, code)

    return jsonify({"message": "A new verification code has been sent."}), 200


@auth_bp.post("/login")
def login():
    """Authenticate a user and return a JWT access token.

    Body: { email, password }

    Returns:
        200 with access_token, or 400/401/403 on failure.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "invalid credentials"}), 401
    if not user.is_verified:
        return jsonify({"error": "email address not verified"}), 403

    access_token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": access_token}), 200


@auth_bp.post("/logout")
@jwt_required()
def logout():
    """Invalidate the current JWT by adding its JTI to the blocklist.

    Requires: Authorization header with Bearer token.

    Returns:
        200 on success.
    """
    from app import get_jwt_blocklist

    jti = get_jwt()["jti"]
    get_jwt_blocklist().add(jti)
    return jsonify({"message": "logged out successfully"}), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    """Return the profile of the currently authenticated user.

    Requires: Authorization header with Bearer token.

    Returns:
        200 with user data, or 404 if the user no longer exists.
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    return jsonify({
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat(),
    }), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    """Send a password-reset email to the given address.

    Body: { email }

    Returns:
        200 always (avoids user enumeration).
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    # Always return 200 to prevent user enumeration.
    if email:
        user = User.query.filter_by(email=email).first()
        if user:
            _send_reset_email(user)

    return jsonify({"message": "If that address is registered, a reset email is on its way."}), 200


@auth_bp.post("/reset-password")
def reset_password():
    """Reset a user's password using a token from the reset email.

    Body: { token, new_password }

    Returns:
        200 on success, or 400 on invalid/expired token.
    """
    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    new_password = data.get("new_password") or ""

    if not token or not new_password:
        return jsonify({"error": "token and new_password are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400

    try:
        email = _serialiser().loads(token, salt=_PASSWORD_RESET_SALT, max_age=_TOKEN_MAX_AGE)
    except SignatureExpired:
        return jsonify({"error": "reset link has expired"}), 400
    except BadSignature:
        return jsonify({"error": "invalid reset token"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "user not found"}), 404

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "password reset successfully"}), 200

