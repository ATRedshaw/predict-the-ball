"""Add ELO simulation statistics

Revision ID: c5d6e7f8a9b0
Revises: b4f1a2c3d4e5
Create Date: 2026-08-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "c5d6e7f8a9b0"
down_revision = "b4f1a2c3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("elo_projections", schema=None) as batch_op:
        batch_op.add_column(sa.Column(
            "simulation_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ))
        batch_op.add_column(sa.Column(
            "fixtures_simulated",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ))
        batch_op.add_column(sa.Column(
            "match_outcomes_simulated",
            sa.BigInteger(),
            server_default="0",
            nullable=False,
        ))


def downgrade():
    with op.batch_alter_table("elo_projections", schema=None) as batch_op:
        batch_op.drop_column("match_outcomes_simulated")
        batch_op.drop_column("fixtures_simulated")
        batch_op.drop_column("simulation_count")
