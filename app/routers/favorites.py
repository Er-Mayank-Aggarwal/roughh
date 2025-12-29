from fastapi import APIRouter, Request
from app.db.crud import get_favorites, add_fav

router = APIRouter()

@router.post("/")
def add_favorite(payload: dict, request: Request):
    email = request.state.user_email
    # accept either {"food_id": <id>} or just an int in payload['id']
    food_id = payload.get("food_id") or payload.get("id") or payload.get("food")

    if food_id is None:
        return {"message": "missing food_id"}

    updated = add_fav(email, food_id)

    return {
        "message": "Added to favorites",
        "favorites": updated
    }

@router.get("/")
def list_favorites(request: Request):
    email = request.state.user_email
    favorites = get_favorites(email)

    return {
        "count": len(favorites),
        "favorites": favorites
    }