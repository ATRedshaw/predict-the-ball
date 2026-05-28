from flask import Blueprint, request, jsonify

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/register")
def register():
    """
    Register a new user.
    Body: { username, email, password }
    Sends a verification email on success.
    """
    pass


@auth_bp.post("/login")
def login():
    """
    Authenticate a user and return a JWT access token.
    Body: { email, password }
    """
    pass


@auth_bp.post("/logout")
def logout():
    """
    Invalidate the current JWT (blocklist approach).
    Requires: Authorization header with Bearer token.
    """
    pass


@auth_bp.get("/me")
def me():
    """
    Return the profile of the currently authenticated user.
    Requires: Authorization header with Bearer token.
    """
    pass


@auth_bp.post("/forgot-password")
def forgot_password():
    """
    Send a password-reset email to the given address.
    Body: { email }
    """
    pass


@auth_bp.post("/reset-password")
def reset_password():
    """
    Reset a user's password using a token from the reset email.
    Body: { token, new_password }
    """
    pass
