from flask import Flask
from flask_cors import CORS
from pathlib import Path

from config import Config
from extensions import db, jwt, mail, bcrypt
from routes import auth_bp, leagues_bp, predictions_bp, standings_bp, users_bp

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

    CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"]}}, supports_credentials=True)

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
