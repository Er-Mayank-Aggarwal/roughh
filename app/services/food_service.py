from app.db.crud import FOODS

def get_food_by_id(food_id: int):
    for food in FOODS:
        if food["id"] == food_id:
            return food
    return None


def calculate_item_macros(food, quantity):
    factor = quantity

    return {
        "food_id": food["id"],
        "food_name": food["name"],
        "quantity": quantity,
        "protein": food["p"] * factor,
        "carbs": food["c"] * factor,
        "fat": food["f"] * factor,
        "calories": food["cal"] * factor,
        "meal" : food["meal"],
    }
