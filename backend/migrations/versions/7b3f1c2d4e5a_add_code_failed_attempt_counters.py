"""Add code failed attempt counters

Revision ID: 7b3f1c2d4e5a
Revises: a3d3a3a0361c
Create Date: 2026-06-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '7b3f1c2d4e5a'
down_revision = 'a3d3a3a0361c'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column(
            'verification_code_failed_attempts',
            sa.Integer(),
            server_default='0',
            nullable=False,
        ))
        batch_op.add_column(sa.Column(
            'password_reset_code_failed_attempts',
            sa.Integer(),
            server_default='0',
            nullable=False,
        ))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('password_reset_code_failed_attempts')
        batch_op.drop_column('verification_code_failed_attempts')
