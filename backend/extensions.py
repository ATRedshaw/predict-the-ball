import smtplib
import ssl

from flask import current_app
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_mail import Connection, Mail
from flask_bcrypt import Bcrypt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate


class CertificateVerifyingConnection(Connection):
    def configure_host(self) -> smtplib.SMTP | smtplib.SMTP_SSL:
        context = ssl.create_default_context()

        if self.mail.use_ssl:
            host = smtplib.SMTP_SSL(
                self.mail.server,
                self.mail.port,
                context=context,
            )
        else:
            host = smtplib.SMTP(self.mail.server, self.mail.port)

        host.set_debuglevel(int(self.mail.debug))

        try:
            if self.mail.use_tls:
                host.starttls(context=context)

            if self.mail.username and self.mail.password:
                host.login(self.mail.username, self.mail.password)
        except Exception:
            host.close()
            raise

        return host


class CertificateVerifyingMail(Mail):
    def connect(self) -> CertificateVerifyingConnection:
        app = self.app or current_app

        try:
            return CertificateVerifyingConnection(app.extensions["mail"])
        except KeyError as exc:
            raise RuntimeError(
                "The current application was not configured with Flask-Mail"
            ) from exc


db = SQLAlchemy()
jwt = JWTManager()
mail = CertificateVerifyingMail()
bcrypt = Bcrypt()
limiter = Limiter(key_func=get_remote_address, default_limits=[])
migrate = Migrate()
