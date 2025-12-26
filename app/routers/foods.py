from fastapi import APIRouter, Request
from app.db.crud import get_foods

router = APIRouter()

@router.get("/")
def foods(request: Request):
    return get_foods("both")
