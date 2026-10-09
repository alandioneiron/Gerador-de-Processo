from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.schemas import SaudeOut

router = APIRouter(tags=["saúde"])


@router.get("/saude", response_model=SaudeOut)
def saude(db: Session = Depends(get_db)):
    versao = get_settings().git_sha
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            {"ok": False, "versao": versao, "detail": "Banco de dados indisponível."}, status_code=503
        )
    return SaudeOut(ok=True, versao=versao)
