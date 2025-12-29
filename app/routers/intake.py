from fastapi import APIRouter, Request
from app.schemas.intake import IntakeRequest
from app.services.intake_service import process_intake_items
from app.db.crud import save_intake, get_intake, last_7_days
from app.utils.helpers import get_ist_date_str

router = APIRouter()

@router.post("/update")
def update_intake(data: IntakeRequest, request: Request):
    email = request.state.user_email

    items, totals = process_intake_items(data.items)
    save_intake(email, data.date, items, totals)

    return {
        "msg": "Intake saved",
        "totals": totals
    }


@router.get("/day")
def day_intake(date: str, request: Request):
    data = get_intake(request.state.user_email, date)
    return data or {"msg": "no data"}


@router.get("/today")
def today_intake(request: Request):
    today = get_ist_date_str()
    data = get_intake(request.state.user_email, today)

    return data or {"date": today, "msg": "no data"}


@router.get("/last-7-days")
def seven_days(request: Request):
    return {"calories": last_7_days(request.state.user_email)}
