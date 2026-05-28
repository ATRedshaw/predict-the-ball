from routes.auth import auth_bp
from routes.leagues import leagues_bp
from routes.predictions import predictions_bp
from routes.standings import standings_bp
from routes.users import users_bp

__all__ = ["auth_bp", "leagues_bp", "predictions_bp", "standings_bp", "users_bp"]
