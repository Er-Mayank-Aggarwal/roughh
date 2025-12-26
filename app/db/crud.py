from datetime import date

USERS = {}
JOURNEY = {}
DAILY_INTAKE = {}
FAVORITES = {}
FOODS = [
    {"id": 1, "name": "Idli", "p": 4, "c": 30, "f": 1, "cal": 150, "type": "solid", "category": "veg", "meal": "breakfast"},
    {"id": 2, "name": "Dal", "p": 9, "c": 18, "f": 2, "cal": 120, "type": "liquid", "category": "veg", "meal": "lunch"},
]

# USER
def save_user(email, data): USERS[email] = data
def save_journey(email, data): JOURNEY[email] = data

# INTAKE
def save_intake(email, date, totals): DAILY_INTAKE[(email, date)] = totals
def get_intake(email, date): return DAILY_INTAKE.get((email, date))

def last_7_days(email):
    return [v["calories"] for (e, _), v in DAILY_INTAKE.items() if e == email][-7:]

# FAVORITES
def add_fav(email, food):
    FAVORITES.setdefault(email, [])
    if len(FAVORITES[email]) < 10:
        FAVORITES[email].append(food)

# FOODS
def get_foods(pref):
    return FOODS
