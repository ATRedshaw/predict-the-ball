import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask
from flask_cors import CORS
from sqlalchemy import event
from sqlalchemy.engine import Engine

from admin_cli import create_admin_command
from config import Config
from extensions import bcrypt, db, jwt, limiter, mail, migrate
from routes import admin_bp, auth_bp, leagues_bp, predictions_bp, standings_bp, users_bp


@event.listens_for(Engine, "connect")
def _set_sqlite_fk_pragma(dbapi_connection, _connection_record) -> None:
    """Enable FK enforcement for every SQLite connection."""
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def _prepare_sqlite_database_directory(db_url: str) -> None:
    if db_url.startswith("sqlite:///"):
        db_path = Path(db_url[len("sqlite:///"):])
        db_path.parent.mkdir(parents=True, exist_ok=True)


def _jwt_timestamp_to_utc(timestamp: int) -> datetime:
    return datetime.fromtimestamp(timestamp, timezone.utc).replace(tzinfo=None)


def create_app(config_class: type = Config) -> Flask:
    """
    Application factory. Creates and configures the Flask app.

    Args:
        config_class: Configuration class to load. Defaults to Config.

    Returns:
        Configured Flask application instance.
    """
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialise extensions
    db.init_app(app)
    migrate.init_app(app, db, compare_type=True, render_as_batch=True)
    jwt.init_app(app)
    mail.init_app(app)
    bcrypt.init_app(app)
    limiter.init_app(app)
    app.cli.add_command(create_admin_command)

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(_jwt_header, jwt_payload) -> bool:
        from models.revoked_token import RevokedToken
        from models.user import User

        now = datetime.utcnow()
        jti = jwt_payload["jti"]
        revoked = RevokedToken.query.filter(
            RevokedToken.jti == jti,
            RevokedToken.expires_at > now,
        ).first()
        if revoked is not None:
            return True

        token_version = jwt_payload.get("token_version")
        if token_version is None:
            return True

        try:
            user_id = int(jwt_payload.get("sub"))
        except (TypeError, ValueError):
            return True

        user = db.session.get(User, user_id)
        if user is None:
            return True

        return token_version != user.token_version

    _prepare_sqlite_database_directory(app.config.get("SQLALCHEMY_DATABASE_URI", ""))
    import models  # noqa: F401

    # Register blueprints
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(leagues_bp)
    app.register_blueprint(predictions_bp)
    app.register_blueprint(standings_bp)
    app.register_blueprint(users_bp)

    return app


def revoke_jwt(jwt_payload: dict) -> None:
    from models.revoked_token import RevokedToken

    jti = jwt_payload["jti"]
    if db.session.get(RevokedToken, jti) is None:
        db.session.add(RevokedToken(
            jti=jti,
            expires_at=_jwt_timestamp_to_utc(jwt_payload["exp"]),
        ))


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
