"""Add league public IDs

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-08-12 00:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa


revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def _set_sqlite_foreign_keys(enabled: bool):
    connection = op.get_bind()
    if connection.dialect.name != "sqlite":
        return

    value = "ON" if enabled else "OFF"
    with op.get_context().autocommit_block():
        connection.exec_driver_sql(f"PRAGMA foreign_keys={value}")


def upgrade():
    connection = op.get_bind()
    columns = {column["name"]: column for column in sa.inspect(connection).get_columns("leagues")}

    if "public_id" not in columns:
        with op.batch_alter_table("leagues", schema=None) as batch_op:
            batch_op.add_column(sa.Column("public_id", sa.String(length=36), nullable=True))

    league_ids = connection.execute(
        sa.text("SELECT id FROM leagues WHERE public_id IS NULL")
    ).scalars().all()
    for league_id in league_ids:
        connection.execute(
            sa.text("UPDATE leagues SET public_id = :public_id WHERE id = :league_id"),
            {"public_id": str(uuid.uuid4()), "league_id": league_id},
        )

    public_id_column = next(
        column for column in sa.inspect(connection).get_columns("leagues")
        if column["name"] == "public_id"
    )
    if public_id_column["nullable"]:
        _set_sqlite_foreign_keys(False)
        try:
            with op.batch_alter_table("leagues", schema=None) as batch_op:
                batch_op.alter_column(
                    "public_id",
                    existing_type=sa.String(length=36),
                    nullable=False,
                )
        finally:
            _set_sqlite_foreign_keys(True)

    indexes = {index["name"] for index in sa.inspect(connection).get_indexes("leagues")}
    if "ix_leagues_public_id" not in indexes:
        op.create_index("ix_leagues_public_id", "leagues", ["public_id"], unique=True)


def downgrade():
    op.drop_index("ix_leagues_public_id", table_name="leagues")
    _set_sqlite_foreign_keys(False)
    try:
        with op.batch_alter_table("leagues", schema=None) as batch_op:
            batch_op.drop_column("public_id")
    finally:
        _set_sqlite_foreign_keys(True)
