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
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#D1E0DD;border-radius:8px;overflow:hidden;border:1px solid #8DAA9D">
      <div style="background:#2A2D34;padding:24px 32px">
        <h1 style="margin:0;color:#D1E0DD;font-size:20px;font-weight:600;letter-spacing:0.5px">Predict the Ball</h1>
      </div>
      <div style="padding:32px">
        <p style="margin:0 0 8px;color:#2A2D34;font-size:15px">Hi {user.first_name},</p>
        <p style="margin:0 0 24px;color:#4A6D65;font-size:14px">Use the code below to confirm your account. It expires in 15 minutes.</p>
        <div style="background:#2A2D34;border-radius:6px;padding:18px;text-align:center;margin-bottom:24px">
          <span style="font-size:32px;font-weight:700;letter-spacing:10px;color:#8DAA9D;font-family:monospace">{code}</span>
        </div>
        <p style="margin:0;color:#4A6D65;font-size:12px">Don't share this code with anyone. If you didn't create an account, you can safely ignore this email.</p>
      </div>
    </div>
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
        html=html_body,
    )
    mail.send(msg)


def _send_reset_code_email(user: User, code: str) -> None:
    """Send a 6-digit password-reset code email to the given user.

    Args:
        user: The User instance requesting a reset.
        code: The plaintext 6-digit code to include in the email.
    """
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#D1E0DD;border-radius:8px;overflow:hidden;border:1px solid #8DAA9D">
      <div style="background:#2A2D34;padding:24px 32px">
        <h1 style="margin:0;color:#D1E0DD;font-size:20px;font-weight:600;letter-spacing:0.5px">Predict the Ball</h1>
      </div>
      <div style="padding:32px">
        <p style="margin:0 0 8px;color:#2A2D34;font-size:15px">Hi {user.first_name},</p>
        <p style="margin:0 0 24px;color:#4A6D65;font-size:14px">Use the code below to reset your password. It expires in 15 minutes.</p>
        <div style="background:#2A2D34;border-radius:6px;padding:18px;text-align:center;margin-bottom:24px">
          <span style="font-size:32px;font-weight:700;letter-spacing:10px;color:#8DAA9D;font-family:monospace">{code}</span>
        </div>
        <p style="margin:0;color:#4A6D65;font-size:12px">Don't share this code with anyone. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    </div>
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
        html=html_body,
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

    user = User(first_name=first_name, last_name=last_name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # get user.id without committing

    code = user.generate_verification_code()
    db.session.commit()

    _send_verification_email(user, code)

    return jsonify({"message": "Account created. Enter the 6-digit code sent to your email."}), 201


@auth_bp.post("/verify-email")
@limiter.limit("10 per hour")
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
@limiter.limit("10 per minute")
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
        code_valid = (
            user.verification_code is not None
            and user.verification_code_expires_at is not None
            and user.verification_code_expires_at > datetime.utcnow()
        )
        if not code_valid:
            code = user.generate_verification_code()
            db.session.commit()
            _send_verification_email(user, code)
        return jsonify({"error": "email_not_verified", "code_valid": code_valid}), 403

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
        "is_admin": user.is_admin,
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
@limiter.limit("10 per hour")
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


@auth_bp.put("/me")
@jwt_required()
@limiter.limit("20 per hour")
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


@auth_bp.get("/me/owned-leagues")
@jwt_required()
def owned_leagues():
    """Return leagues owned by the authenticated user, with their other members.

    Each other member includes their current owned-league count for the league's
    season, so the client can indicate when a member is at the ownership cap.

    Requires: Authorization header with Bearer token.

    Returns:
        200 with a list of owned leagues, each containing an ``other_members``
        array of ``{ user_id, name, owned_count }`` objects.
    """
    from models.league import League
    from models.league_member import LeagueMember

    user_id = int(get_jwt_identity())
    owned = (
        League.query
        .join(LeagueMember, LeagueMember.league_id == League.id)
        .filter(LeagueMember.user_id == user_id, LeagueMember.role == "owner")
        .all()
    )

    def _owned_count(uid: int, season: str) -> int:
        return (
            LeagueMember.query
            .join(League, League.id == LeagueMember.league_id)
            .filter(
                LeagueMember.user_id == uid,
                LeagueMember.role == "owner",
                League.season == season,
            )
            .count()
        )

    result = []
    for league in owned:
        other_members = [
            {
                "user_id": m.user_id,
                "name": f"{m.user.first_name} {m.user.last_name}" if m.user else "Unknown",
                "owned_count": _owned_count(m.user_id, league.season),
            }
            for m in LeagueMember.query.filter_by(league_id=league.id).all()
            if m.user_id != user_id
        ]
        result.append({
            "id": league.id,
            "name": league.name,
            "season": league.season,
            "other_members": other_members,
        })

    return jsonify(result), 200


@auth_bp.delete("/me")
@jwt_required()
def delete_account():
    """Permanently delete the authenticated user's account and all associated data.

    For each league the user owns, they may optionally transfer ownership to an
    existing member. Leagues without a specified transfer target are deleted in
    full (all member rows are removed via the League cascade).

    Transfer targets are validated against the 10-leagues-per-season ownership cap
    before any mutations are applied. Multiple transfers to the same recipient in
    the same request are counted together during validation.

    Requires: Authorization header with Bearer token.
    Body (optional): { transfers: { "<league_id>": <new_owner_user_id> | null } }

    Returns:
        200 on success, 400 on invalid/cap-exceeding transfer target, 404 if user not found.
    """
    from app import get_jwt_blocklist
    from models.league import League
    from models.league_member import LeagueMember

    _MAX_OWNED = 10

    def _owned_count(uid: int, season: str) -> int:
        return (
            LeagueMember.query
            .join(League, League.id == LeagueMember.league_id)
            .filter(
                LeagueMember.user_id == uid,
                LeagueMember.role == "owner",
                League.season == season,
            )
            .count()
        )

    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json(silent=True) or {}
    transfers = data.get("transfers") or {}

    # Resolve all leagues this user owns.
    owned = (
        League.query
        .join(LeagueMember, LeagueMember.league_id == League.id)
        .filter(LeagueMember.user_id == user_id, LeagueMember.role == "owner")
        .all()
    )

    # ── Validation pass (no mutations yet) ────────────────────────────────────
    # Track how many additional leagues each recipient would gain from this
    # single request, so multiple transfers to the same person are counted together.
    pending: dict[tuple[int, str], int] = {}

    for league in owned:
        raw = transfers.get(str(league.id))
        if raw is None:
            continue  # league will be deleted — no cap concern

        try:
            new_owner_id = int(raw)
        except (TypeError, ValueError):
            return jsonify({"error": f"Invalid transfer target for league '{league.name}'"}), 400

        if new_owner_id == user_id:
            return jsonify({"error": f"Cannot transfer '{league.name}' to yourself"}), 400

        membership = LeagueMember.query.filter_by(
            league_id=league.id, user_id=new_owner_id,
        ).first()
        if membership is None:
            return jsonify({"error": f"Transfer target is not a member of '{league.name}'"}), 400

        key = (new_owner_id, league.season)
        committed = _owned_count(new_owner_id, league.season)
        in_flight = pending.get(key, 0)
        if committed + in_flight >= _MAX_OWNED:
            recipient = membership.user
            name = f"{recipient.first_name} {recipient.last_name}" if recipient else "That user"
            return jsonify({
                "error": (
                    f"{name} already owns {committed + in_flight} league(s) in the "
                    f"{league.season} season and cannot receive ownership of '{league.name}'."
                )
            }), 400

        pending[key] = in_flight + 1

    # ── Mutation pass ──────────────────────────────────────────────────────────
    for league in owned:
        raw = transfers.get(str(league.id))
        new_owner_id = int(raw) if raw is not None else None

        if new_owner_id is not None:
            new_membership = LeagueMember.query.filter_by(
                league_id=league.id, user_id=new_owner_id,
            ).first()
            owner_membership = LeagueMember.query.filter_by(
                league_id=league.id, user_id=user_id,
            ).first()

            new_membership.role = "owner"
            league.created_by = new_owner_id
            if owner_membership:
                db.session.delete(owner_membership)
        else:
            db.session.delete(league)

    # Flush ownership/deletion changes before removing the user so FK
    # constraints on leagues.created_by are satisfied.
    # Also nullify created_by on any leagues the user originally created but
    # later transferred away — those won't appear in the owned query above
    # since they're no longer the LeagueMember owner.
    League.query.filter_by(created_by=user_id).update({"created_by": None})
    db.session.flush()

    # Delete the user. ORM cascades on User.league_memberships and
    # User.predictions handle the remaining child rows.
    db.session.delete(user)
    db.session.commit()

    # Blocklist the current token so it cannot be reused.
    jti = get_jwt()["jti"]
    get_jwt_blocklist().add(jti)

    return jsonify({"message": "account deleted"}), 200


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
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password or not new_password:
        return jsonify({"error": "current_password and new_password are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400
    if not user.check_password(current_password):
        return jsonify({"error": "Current password is incorrect"}), 401

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password updated successfully"}), 200
