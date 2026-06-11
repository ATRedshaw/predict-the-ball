import click
from flask.cli import with_appcontext

from extensions import db
from models.user import User


def _format_name(value: str) -> str:
    return " ".join(word.capitalize() for word in value.strip().split())


@click.command("create-admin")
@click.option("--email", prompt=True, help="Email address for the admin account.")
@click.option("--first-name", prompt=True, help="First name for the admin account.")
@click.option("--last-name", prompt=True, help="Last name for the admin account.")
@click.password_option("--password", confirmation_prompt=True, help="Password for the admin account.")
@with_appcontext
def create_admin_command(email: str, first_name: str, last_name: str, password: str) -> None:
    email = email.strip().lower()
    first_name = _format_name(first_name)
    last_name = _format_name(last_name)

    if not first_name or not last_name or not email or not password:
        raise click.ClickException("first name, last name, email and password are required")
    if len(first_name) > 35 or len(last_name) > 35:
        raise click.ClickException("first name and last name must be 35 characters or fewer")
    if len(password) < 8:
        raise click.ClickException("password must be at least 8 characters")
    if User.query.filter_by(email=email).first() is not None:
        raise click.ClickException("a user with that email already exists")

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        is_admin=True,
        is_verified=True,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    click.echo(f"Created admin user {email}.")
