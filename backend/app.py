import sqlite3

from flask import Flask
from flask_cors import CORS
from pathlib import Path
from sqlalchemy import event, text
from sqlalchemy.engine import Engine

from admin_cli import create_admin_command
from config import Config
from extensions import db, jwt, mail, bcrypt, limiter
from routes import admin_bp, auth_bp, leagues_bp, predictions_bp, standings_bp, users_bp


@event.listens_for(Engine, "connect")
def _set_sqlite_fk_pragma(dbapi_connection, _connection_record) -> None:
    """Enable FK enforcement for every SQLite connection."""
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# In-memory JWT blocklist. Replace with a persistent store (Redis, DB) in production.
_jwt_blocklist: set[str] = set()


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
    def check_if_token_revoked(jwt_header, jwt_payload) -> bool:
        return jwt_payload["jti"] in _jwt_blocklist

    with app.app_context():
        import models  # noqa: F401

        # Ensure the directory for the SQLite file exists before create_all.
        db_url = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        if db_url.startswith("sqlite:///"):
            db_path = Path(db_url[len("sqlite:///"):])
            db_path.parent.mkdir(parents=True, exist_ok=True)

        db.create_all()

    # Register blueprints
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(leagues_bp)
    app.register_blueprint(predictions_bp)
    app.register_blueprint(standings_bp)
    app.register_blueprint(users_bp)

    return app


def get_jwt_blocklist() -> set[str]:
    """Return the application-level JWT blocklist set.

    Returns:
        The set of revoked JWT IDs.
    """
    return _jwt_blocklist


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
