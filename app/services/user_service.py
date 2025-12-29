from app.db.crud import get_user_setup_status

def check_user_setup(email):
    return get_user_setup_status(email)