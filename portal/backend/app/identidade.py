"""Ponto único da identidade de quem está escrevendo.

Fase 1 (sem login): confia no nome e e-mail que o navegador informou no corpo da requisição.
Fase 2: esta função passa a ler a identidade da sessão do AD (LDAPS) e ignora o corpo.
Todas as rotas de escrita passam por aqui.
"""

from app.schemas import Autor


def autor_da_requisicao(autor_informado: Autor) -> Autor:
    return autor_informado
