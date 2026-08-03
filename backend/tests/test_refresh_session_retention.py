import unittest
from datetime import timedelta

from app import create_app
from extensions import db, limiter
from models.refresh_session import RefreshSession
from models.user import User


class TestConfig:
    TESTING = True
    SECRET_KEY = "test-secret-key-that-is-at-least-32-bytes"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = []
    JWT_SECRET_KEY = "test-jwt-secret-that-is-at-least-32-bytes"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=60)
    REFRESH_COOKIE_NAME = "ptb_refresh_token"
    REFRESH_COOKIE_PATH = "/api/auth"
    REFRESH_COOKIE_SECURE = False
    REFRESH_COOKIE_SAMESITE = "Lax"
    MAIL_SERVER = "localhost"
    MAIL_PORT = 25
    MAIL_USE_TLS = False
    MAIL_USERNAME = None
    MAIL_PASSWORD = None
    MAIL_DEFAULT_SENDER = "test@example.com"
    RATELIMIT_STORAGE_URI = "memory://"


class RefreshSessionRetentionTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        limiter.reset()

        user = User(
            first_name="Test",
            last_name="User",
            email="test@example.com",
            is_verified=True,
        )
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        self.user_id = user.id

        self.client = self.app.test_client()
        response = self.client.post(
            "/api/auth/login",
            json={"email": user.email, "password": "password123"},
        )
        self.assertEqual(response.status_code, 200)
        self.access_token = response.get_json()["access_token"]

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_rotation_keeps_only_active_session_and_immediate_predecessor(self):
        for _ in range(10):
            response = self.client.post("/api/auth/refresh")
            self.assertEqual(response.status_code, 200)

        sessions = RefreshSession.query.filter_by(user_id=self.user_id).all()
        self.assertEqual(len(sessions), 2)
        self.assertEqual(sum(session.revoked_at is None for session in sessions), 1)
        self.assertEqual(sum(session.revoked_at is not None for session in sessions), 1)

    def test_immediate_predecessor_still_triggers_replay_protection(self):
        old_cookie = self.client.get_cookie(
            TestConfig.REFRESH_COOKIE_NAME,
            path=TestConfig.REFRESH_COOKIE_PATH,
        ).value
        response = self.client.post("/api/auth/refresh")
        self.assertEqual(response.status_code, 200)

        self.client.set_cookie(
            TestConfig.REFRESH_COOKIE_NAME,
            old_cookie,
            path=TestConfig.REFRESH_COOKIE_PATH,
        )
        response = self.client.post("/api/auth/refresh")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            RefreshSession.query.filter_by(user_id=self.user_id).count(),
            0,
        )
        self.assertEqual(db.session.get(User, self.user_id).token_version, 1)

    def test_refresh_is_limited_per_account(self):
        for _ in range(30):
            response = self.client.post("/api/auth/refresh")
            self.assertEqual(response.status_code, 200)

        response = self.client.post("/api/auth/refresh")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(
            RefreshSession.query.filter_by(user_id=self.user_id).count(),
            2,
        )

    def test_logout_removes_the_revoked_session_family(self):
        response = self.client.post("/api/auth/refresh")
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {self.access_token}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            RefreshSession.query.filter_by(user_id=self.user_id).count(),
            0,
        )


if __name__ == "__main__":
    unittest.main()
