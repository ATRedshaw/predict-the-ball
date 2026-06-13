"""Add refresh sessions

Revision ID: b4f1a2c3d4e5
Revises: 7b3f1c2d4e5a
Create Date: 2026-06-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b4f1a2c3d4e5'
down_revision = '7b3f1c2d4e5a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column(
            'token_version',
            sa.Integer(),
            server_default='0',
            nullable=False,
        ))

    op.create_table('refresh_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('replaced_by_session_id', sa.Integer(), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['replaced_by_session_id'], ['refresh_sessions.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash')
    )
    with op.batch_alter_table('refresh_sessions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_refresh_sessions_expires_at'), ['expires_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_refresh_sessions_user_id'), ['user_id'], unique=False)

    op.create_table('revoked_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('jti_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('jti_hash')
    )
    with op.batch_alter_table('revoked_tokens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_revoked_tokens_expires_at'), ['expires_at'], unique=False)


def downgrade():
    with op.batch_alter_table('revoked_tokens', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_revoked_tokens_expires_at'))
    op.drop_table('revoked_tokens')

    with op.batch_alter_table('refresh_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_refresh_sessions_user_id'))
        batch_op.drop_index(batch_op.f('ix_refresh_sessions_expires_at'))
    op.drop_table('refresh_sessions')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('token_version')
