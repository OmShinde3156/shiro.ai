"""0003_gate4_room_messages

Revision ID: 0003_gate4
Revises: 0002_gate2
Create Date: 2026-08-24 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003_gate4'
down_revision = '0002_gate2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add client_message_id and sequence columns to room_messages table
    with op.batch_alter_table('room_messages') as batch_op:
        batch_op.add_column(sa.Column('client_message_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('sequence', sa.Integer(), server_default='1', nullable=False))
        batch_op.create_index('ix_room_messages_client_message_id', ['client_message_id'])
        batch_op.create_index('ix_room_messages_sequence', ['sequence'])


def downgrade() -> None:
    with op.batch_alter_table('room_messages') as batch_op:
        batch_op.drop_index('ix_room_messages_sequence')
        batch_op.drop_index('ix_room_messages_client_message_id')
        batch_op.drop_column('sequence')
        batch_op.drop_column('client_message_id')
