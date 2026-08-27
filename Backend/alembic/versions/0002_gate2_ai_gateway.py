"""0002_gate2_ai_gateway

Revision ID: 0002_gate2
Revises: 0001_gate1
Create Date: 2026-08-24 04:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_gate2'
down_revision = '0001_gate1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create ai_request_logs table
    op.create_table(
        'ai_request_logs',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('request_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('feature', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('model', sa.String(), nullable=False),
        sa.Column('rate_card_version', sa.String(), server_default='2026-Q3', nullable=False),
        sa.Column('prompt_version', sa.String(), server_default='v1.0', nullable=False),
        sa.Column('input_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('output_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('latency_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('cost_usd', sa.Numeric(precision=12, scale=8), server_default='0.0', nullable=False),
        sa.Column('fallback_used', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('success', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('error_code', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_ai_request_logs_id', 'ai_request_logs', ['id'])
    op.create_index('ix_ai_request_logs_request_id', 'ai_request_logs', ['request_id'], unique=True)
    op.create_index('ix_ai_request_logs_user_id', 'ai_request_logs', ['user_id'])
    op.create_index('ix_ai_request_logs_feature', 'ai_request_logs', ['feature'])
    op.create_index('ix_ai_request_logs_created_at', 'ai_request_logs', ['created_at'])


def downgrade() -> None:
    op.drop_table('ai_request_logs')
