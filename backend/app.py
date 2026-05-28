from flask import Flask

from config import Config
from extensions import db, migrate, jwt, mail, bcrypt
from routes import auth_bp, leagues_bp, predictions_bp, standings_bp, users_bp


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
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    bcrypt.init_app(app)

    # Import models so Flask-Migrate can detect them
    with app.app_context():
        import models  # noqa: F401

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(leagues_bp)
    app.register_blueprint(predictions_bp)
    app.register_blueprint(standings_bp)
    app.register_blueprint(users_bp)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
