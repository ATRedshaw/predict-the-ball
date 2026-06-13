"""Initial schema

Revision ID: a3d3a3a0361c
Revises: 
Create Date: 2026-06-11 21:25:29.551419

"""
from alembic import op
import sqlalchemy as sa


revision = 'a3d3a3a0361c'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('actual_standings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('season', sa.String(length=9), nullable=False),
    sa.Column('standings', sa.JSON(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('elo_projections',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('season', sa.String(length=9), nullable=False),
    sa.Column('projections', sa.JSON(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('elo_projections', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_elo_projections_season'), ['season'], unique=False)

    op.create_table('points_deductions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('season', sa.String(length=9), nullable=False),
    sa.Column('team', sa.String(length=100), nullable=False),
    sa.Column('points', sa.Integer(), nullable=False),
    sa.Column('reason', sa.String(length=255), nullable=True),
    sa.Column('applied_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('first_name', sa.String(length=64), nullable=False),
    sa.Column('last_name', sa.String(length=64), nullable=False),
    sa.Column('email', sa.String(length=120), nullable=False),
    sa.Column('password_hash', sa.String(length=256), nullable=False),
    sa.Column('is_verified', sa.Boolean(), nullable=False),
    sa.Column('is_admin', sa.Boolean(), nullable=False),
    sa.Column('verification_code', sa.String(length=6), nullable=True),
    sa.Column('verification_code_expires_at', sa.DateTime(), nullable=True),
    sa.Column('verification_code_sent_at', sa.DateTime(), nullable=True),
    sa.Column('password_reset_code', sa.String(length=6), nullable=True),
    sa.Column('password_reset_code_expires_at', sa.DateTime(), nullable=True),
    sa.Column('password_reset_code_sent_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('leagues',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('code', sa.String(length=10), nullable=False),
    sa.Column('season', sa.String(length=9), nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code')
    )
    op.create_table('user_predictions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('season', sa.String(length=9), nullable=False),
    sa.Column('standings', sa.JSON(), nullable=False),
    sa.Column('current_points', sa.Integer(), nullable=True),
    sa.Column('exact_predictions', sa.Integer(), nullable=True),
    sa.Column('submitted_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'season', name='uq_user_prediction_season')
    )
    op.create_table('league_members',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('league_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('role', sa.String(length=10), nullable=False),
    sa.Column('joined_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('league_id', 'user_id', name='uq_league_member')
    )


def downgrade():
    op.drop_table('league_members')
    op.drop_table('user_predictions')
    op.drop_table('leagues')
    op.drop_table('users')
    op.drop_table('points_deductions')
    with op.batch_alter_table('elo_projections', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_elo_projections_season'))

    op.drop_table('elo_projections')
    op.drop_table('actual_standings')
