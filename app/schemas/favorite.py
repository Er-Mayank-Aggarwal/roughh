from pydantic import BaseModel


class Favorite(BaseModel):
    food_id: int
    name: str
    meal: str