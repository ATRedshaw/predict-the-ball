from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from flask_mail import Message
from datetime import datetime

from extensions import db, mail, limiter
from models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


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


def _send_reset_code_email(user: User, code: str) -> None:
    """Send a 6-digit password-reset code email to the given user.

    Args:
        user: The User instance requesting a reset.
        code: The plaintext 6-digit code to include in the email.
    """
    msg = Message(
        subject="Your Predict the Ball password-reset code",
        recipients=[user.email],
        body=(
            f"Hi {user.first_name},\n\n"
            f"Your password-reset code is: {code}\n\n"
            f"It expires in 15 minutes. Do not share it with anyone.\n\n"
            "If you didn't request a reset, you can ignore this email."
        ),
    )
    mail.send(msg)


@auth_bp.post("/register")
@limiter.limit("5 per hour")
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

    # Convert first name and last name to Title case
    first_name = " ".join([word.capitalize() for word in first_name.split()])
    last_name = " ".join([word.capitalize() for word in last_name.split()])

    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "first_name, last_name, email and password are required"}), 400
    if len(first_name) > 35 or len(last_name) > 35:
        return jsonify({"error": "first_name and last_name must be 35 characters or fewer"}), 400
    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email already registered"}), 409

    is_first_user = User.query.count() == 0

    user = User(first_name=first_name, last_name=last_name, email=email, is_admin=is_first_user)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # get user.id without committing

    code = user.generate_verification_code()
    db.session.commit()

    _send_verification_email(user, code)

    return jsonify({"message": "Account created. Enter the 6-digit code sent to your email."}), 201


@auth_bp.post("/verify-email")
@limiter.limit("20 per hour")
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
    if user.verification_code_expires_at < datetime.utcnow():
        return jsonify({"error": "verification code has expired — request a new one"}), 400

    user.is_verified = True
    user.verification_code = None
    user.verification_code_expires_at = None
    db.session.commit()
    return jsonify({"message": "email verified successfully"}), 200


@auth_bp.post("/resend-verification")
@limiter.limit("5 per hour")
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
@limiter.limit("20 per minute")
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
@limiter.limit("5 per hour")
def forgot_password():
    """Send a 6-digit password-reset code to the given address.

    Body: { email }

    Returns:
        200 always (avoids user enumeration).
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if email:
        user = User.query.filter_by(email=email).first()
        if user and user.is_verified:
            if user.can_resend_password_reset_code():
                code = user.generate_password_reset_code()
                db.session.commit()
                _send_reset_code_email(user, code)

    return jsonify({"message": "If that address is registered, a reset code is on its way."}), 200


@auth_bp.post("/resend-reset-code")
@limiter.limit("5 per hour")
def resend_reset_code():
    """Resend a password-reset code to the given email address.

    Body: { email }
    Subject to a 60-second cooldown between sends.

    Returns:
        200 on success, 400 if on cooldown, 404 if not found.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.is_verified:
        # Return 200 to avoid enumeration — same as forgot_password.
        return jsonify({"message": "If that address is registered, a reset code is on its way."}), 200
    if not user.can_resend_password_reset_code():
        return jsonify({"error": "please wait before requesting another code"}), 429

    code = user.generate_password_reset_code()
    db.session.commit()
    _send_reset_code_email(user, code)

    return jsonify({"message": "A new reset code has been sent."}), 200


@auth_bp.post("/reset-forgotten-password")
@limiter.limit("5 per hour")
def reset_forgotten_password():
    """Reset a user's password using a 6-digit code from the forgot-password flow.

    Body: { email, code, new_password }

    Returns:
        200 on success, 400 on invalid/expired code, 404 if user not found.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    new_password = data.get("new_password") or ""

    if not email or not code or not new_password:
        return jsonify({"error": "email, code and new_password are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "user not found"}), 404
    if not user.password_reset_code or user.password_reset_code != code:
        return jsonify({"error": "invalid reset code"}), 400
    if user.password_reset_code_expires_at < datetime.utcnow():
        return jsonify({"error": "reset code has expired — request a new one"}), 400

    user.set_password(new_password)
    user.password_reset_code = None
    user.password_reset_code_expires_at = None
    user.password_reset_code_sent_at = None
    db.session.commit()
    return jsonify({"message": "password reset successfully"}), 200


@auth_bp.post("/reset-password")
@jwt_required()
@limiter.limit("10 per hour")
def reset_password():
    """Reset the current user's password after verifying their existing one.

    Requires: Authorization header with Bearer token.
    Body: { current_password, new_password }

    Returns:
        200 on success, 400 on validation failure, 401 if current password is wrong.
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password or not new_password:
        return jsonify({"error": "current_password and new_password are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "new password must be at least 8 characters"}), 400
    if not user.check_password(current_password):
        return jsonify({"error": "current password is incorrect"}), 401

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "password updated successfully"}), 200

