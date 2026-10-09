"""Fichas, histórico e contador de números

Revision ID: 0001
Revises:
Create Date: 2026-10-09
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contadores",
        sa.Column("nome", sa.String(length=40), primary_key=True),
        sa.Column("valor", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "fichas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("versao", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("instalacao_concluida", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cliente", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("vendedor", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("data_prevista", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("cpf_cnpj", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("dados", sa.JSON().with_variant(postgresql.JSONB(), "postgresql"), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("numero", name="uq_fichas_numero"),
        sa.UniqueConstraint("codigo", name="uq_fichas_codigo"),
    )
    op.create_index("ix_fichas_status", "fichas", ["status"])

    op.create_table(
        "ficha_eventos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ficha_id", sa.Integer(), sa.ForeignKey("fichas.id"), nullable=False),
        sa.Column("em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("autor_nome", sa.String(length=120), nullable=False),
        sa.Column("autor_email", sa.String(length=254), nullable=False),
        sa.Column("acao", sa.String(length=40), nullable=False),
        sa.Column("status_de", sa.String(length=40), nullable=True),
        sa.Column("status_para", sa.String(length=40), nullable=True),
        sa.Column("resumo", sa.Text(), nullable=False, server_default=""),
    )
    op.create_index("ix_ficha_eventos_ficha_id", "ficha_eventos", ["ficha_id"])

    # O contador começa em 0: a primeira ficha é a de número 1.
    op.execute("INSERT INTO contadores (nome, valor) VALUES ('ficha', 0)")


def downgrade() -> None:
    op.drop_index("ix_ficha_eventos_ficha_id", table_name="ficha_eventos")
    op.drop_table("ficha_eventos")
    op.drop_index("ix_fichas_status", table_name="fichas")
    op.drop_table("fichas")
    op.drop_table("contadores")
