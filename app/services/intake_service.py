from app.services.food_service import get_food_by_id, calculate_item_macros

def process_intake_items(items):
    processed_items = []
    totals = {
        "protein": 0,
        "carbs": 0,
        "fat": 0,
        "calories": 0
    }

    for item in items:
        food = get_food_by_id(item.food_id)
        if not food:
            raise ValueError(f"Invalid food_id: {item.food_id}")

        calculated = calculate_item_macros(food, item.quantity)
        processed_items.append(calculated)

        for k in totals:
            totals[k] += calculated[k]

    return processed_items, totals
