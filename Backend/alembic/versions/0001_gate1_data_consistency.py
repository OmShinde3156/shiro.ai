"""0001_gate1_data_consistency

Revision ID: 0001_gate1
Revises: 
Create Date: 2026-08-24 03:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_gate1'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create flashcard_reviews table
    op.create_table(
        'flashcard_reviews',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('flashcard_id', sa.String(), sa.ForeignKey('flashcards.id'), nullable=False),
        sa.Column('idempotency_key', sa.String(), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('review_duration_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('fsrs_state_before', sa.Integer(), server_default='0', nullable=False),
        sa.Column('fsrs_state_after', sa.Integer(), server_default='0', nullable=False),
        sa.Column('stability_after', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('difficulty_after', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('reviewed_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_flashcard_reviews_id', 'flashcard_reviews', ['id'])
    op.create_index('ix_flashcard_reviews_user_id', 'flashcard_reviews', ['user_id'])
    op.create_index('ix_flashcard_reviews_flashcard_id', 'flashcard_reviews', ['flashcard_id'])
    op.create_index('ix_flashcard_reviews_idempotency_key', 'flashcard_reviews', ['idempotency_key'])
    op.create_index('ix_flashcard_reviews_reviewed_at', 'flashcard_reviews', ['reviewed_at'])

    # 2. Create document_ingestion_jobs table
    op.create_table(
        'document_ingestion_jobs',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(), server_default='QUEUED', nullable=False),
        sa.Column('current_step', sa.String(), server_default='INITIALIZED', nullable=False),
        sa.Column('progress', sa.Integer(), server_default='0', nullable=False),
        sa.Column('attempt', sa.Integer(), server_default='1', nullable=False),
        sa.Column('max_attempts', sa.Integer(), server_default='3', nullable=False),
        sa.Column('error_code', sa.String(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('celery_task_id', sa.String(), nullable=True),
        sa.Column('queued_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_document_ingestion_jobs_document_id', 'document_ingestion_jobs', ['document_id'])
    op.create_index('ix_document_ingestion_jobs_user_id', 'document_ingestion_jobs', ['user_id'])
    op.create_index('ix_document_ingestion_jobs_status', 'document_ingestion_jobs', ['status'])


def downgrade() -> None:
    op.drop_table('document_ingestion_jobs')
    op.drop_table('flashcard_reviews')
