"""Versioned proposals and additive training continuity fields.

Revision ID: f01_training_continuity
Revises: ed2fe05e9dea
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "f01_training_continuity"
down_revision = "ed2fe05e9dea"
branch_labels = depends_on = None


def upgrade():
    op.add_column("users", sa.Column("weekly_session_goal", sa.Integer(), nullable=True))
    for column in [
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("source", sa.String(), nullable=False, server_default="generated"),
        sa.Column("base_plan_id", sa.UUID(), sa.ForeignKey("workout_plans.id"), nullable=True),
        sa.Column("lineage_id", sa.UUID(), nullable=True),
    ]:
        op.add_column("workout_plans", column)
    # Preserve all plans; only repair ambiguous active flags, choosing the newest.
    op.execute("""WITH ranked AS (
        SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS version,
        first_value(id) OVER (PARTITION BY user_id ORDER BY created_at, id) AS root
        FROM workout_plans)
        UPDATE workout_plans p SET version = r.version, lineage_id = r.root
        FROM ranked r WHERE p.id = r.id""")
    op.execute("""WITH ranked AS (
        SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS n
        FROM workout_plans WHERE is_active = true)
        UPDATE workout_plans SET is_active = false WHERE id IN (SELECT id FROM ranked WHERE n > 1)""")
    op.create_index("uq_active_plan_user", "workout_plans", ["user_id"], unique=True,
                    postgresql_where=sa.text("is_active = true"))
    op.create_table("plan_proposals",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("request_id", sa.UUID(), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("base_plan_id", sa.UUID(), sa.ForeignKey("workout_plans.id")),
        sa.Column("applied_plan_id", sa.UUID(), sa.ForeignKey("workout_plans.id")),
        sa.Column("source_message_ids", JSONB, nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("keep_exercises", JSONB, nullable=False),
        sa.Column("plan_data", JSONB),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "request_id", name="uq_proposal_request"))
    for column in [
        sa.Column("occurrence_id", sa.UUID()), sa.Column("completion_hash", sa.String(64)),
        sa.Column("status", sa.String(), nullable=False, server_default="legacy"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("day_id", sa.String()), sa.Column("workout_snapshot", JSONB),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    ]:
        op.add_column("workout_sessions", column)
    op.create_unique_constraint("uq_session_occurrence", "workout_sessions", ["user_id", "occurrence_id"])
    for column in [
        sa.Column("exercise_id", sa.String()), sa.Column("slot_id", sa.String()),
        sa.Column("measurement", sa.String(), nullable=False, server_default="reps"),
        sa.Column("load_basis", sa.String(), nullable=False, server_default="unspecified"),
        sa.Column("target_data", JSONB), sa.Column("notes", sa.Text()),
    ]:
        op.add_column("exercise_logs", column)
    op.create_index("ix_exercise_logs_exercise_id", "exercise_logs", ["exercise_id"])


def downgrade():
    op.drop_index("ix_exercise_logs_exercise_id", table_name="exercise_logs")
    for name in ["notes", "target_data", "load_basis", "measurement", "slot_id", "exercise_id"]:
        op.drop_column("exercise_logs", name)
    op.drop_constraint("uq_session_occurrence", "workout_sessions", type_="unique")
    for name in ["completed_at", "workout_snapshot", "day_id", "revision", "status", "completion_hash", "occurrence_id"]:
        op.drop_column("workout_sessions", name)
    op.drop_table("plan_proposals")
    op.drop_index("uq_active_plan_user", table_name="workout_plans")
    for name in ["lineage_id", "base_plan_id", "source", "version"]:
        op.drop_column("workout_plans", name)
    op.drop_column("users", "weekly_session_goal")
