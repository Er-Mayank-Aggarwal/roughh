from pydantic import BaseModel
from typing import List

class IntakeItem(BaseModel):
    food_id: int
    quantity: float   # number of units (piece / bowl / 100g)

class IntakeRequest(BaseModel):
    date: str
    items: List[IntakeItem]

class IntakeTotals(BaseModel):
    protein: float
    carbs: float
    fat: float
    calories: float
