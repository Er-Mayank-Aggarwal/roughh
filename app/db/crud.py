import json
import os
from datetime import date

# =========================
# In-memory DBs
# =========================
USERS = {}
JOURNEY = {}
DAILY_INTAKE = {}   # (email, date) -> { items, totals }
FAVORITES = {}

# =========================
# Load foods from diets.json
# =========================
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "diets.json")

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)
    FOODS = data["dishes"] if "dishes" in data else data


# =========================
# USER
# =========================
def save_user(email, data):
    USERS[email] = data


def save_journey(email, data):
    JOURNEY[email] = data


# =========================
# INTAKE (UPDATED)
# =========================
def save_intake(email, intake_date, items, totals):
    """
    items  -> list of food-level intake
    totals -> aggregated macros
    """
    DAILY_INTAKE[(email, intake_date)] = {
        "items": items,
        "totals": totals
    }


def get_intake(email, intake_date):
    return DAILY_INTAKE.get((email, intake_date))


from datetime import datetime

def last_7_days(email):
    records = []

    for (e, d), v in DAILY_INTAKE.items():
        if e == email:
            day_name = datetime.fromisoformat(d).strftime("%A")
            records.append({
                "date": d,
                "day": day_name,
                "calories": v["totals"]["calories"]
            })

    # Sort by date (ascending)
    records.sort(key=lambda x: x["date"])

    # Return only last 7 entries
    return records[-7:]



# =========================
# FAVORITES
# =========================
def add_fav(email, food):
    FAVORITES.setdefault(email, [])

    if food not in FAVORITES[email] and len(FAVORITES[email]) < 10:
        FAVORITES[email].append(food)

    return FAVORITES[email]


# =========================
# FOODS
# =========================
def get_foods(food_preference: str):
    """
    food_preference: veg | nonveg | both | egg_only
    """
    if food_preference == "veg":
        return [f for f in FOODS if f["category"] == "veg"]

    if food_preference == "nonveg":
        return [f for f in FOODS if f["category"] == "nonveg"]

    if food_preference == "egg_only":
        return [f for f in FOODS if f["category"] == "egg"]

    return FOODS


def get_food_by_id(food_id: int):
    for food in FOODS:
        if food["id"] == food_id:
            return food
    return None
