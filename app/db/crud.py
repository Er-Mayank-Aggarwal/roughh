import json
import os
from datetime import date

from app.utils.helpers import get_ist_date_str

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

def delete_today_intake_item(email, food_id):
    today = get_ist_date_str()
    key = (email, today)

    if key not in DAILY_INTAKE:
        return None

    data = DAILY_INTAKE[key]
    items = data["items"]

    new_items = [i for i in items if i["food_id"] != food_id]

    if len(new_items) == len(items):
        return "not_found"

    totals = {
        "protein": 0,
        "carbs": 0,
        "fat": 0,
        "calories": 0
    }

    for item in new_items:
        totals["protein"] += item["protein"]
        totals["carbs"] += item["carbs"]
        totals["fat"] += item["fat"]
        totals["calories"] += item["calories"]

    DAILY_INTAKE[key] = {
        "items": new_items,
        "totals": totals
    }

    return DAILY_INTAKE[key]

def get_user_setup_status(email):
    return {
        "profile_completed": email in USERS,
        "journey_completed": email in JOURNEY
    }

def get_favorites(email):
    food_ids = FAVORITES.get(email, [])
    result = []

    for food in FOODS:
        if food["id"] in food_ids:
            result.append({
                "food_id": food["id"],
                "name": food["name"],
                "meal": food["meal"]
            })

    return result
