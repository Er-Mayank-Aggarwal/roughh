from app.db.crud import get_favorites

def fetch_user_favorites(email):
    return get_favorites(email)
