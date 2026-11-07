import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..db import crud
from ..core.ingredient_auth import current_principal
from typing import Literal

router = APIRouter(prefix="/api/actions", tags=["Short-Term Memory & User Actions"])
logger = logging.getLogger(__name__)

class UserActionPayload(BaseModel):
    user_id: Optional[str] = None
    action_type: Literal["CLICK_MENU_ITEM", "SEARCH_QUERY", "ADD_TO_CART", "VIEW_DETAILS", "DISMISS_SUGGESTION", "REMOVE_FROM_CART", "FEEDBACK"]
    payload: Dict[str, Any] = Field(default_factory=dict, description="Metadata including dish personas, price, query")

@router.post("/log")
def log_action(req: UserActionPayload, principal=Depends(current_principal), db: Session = Depends(get_db)):
    if req.user_id and req.user_id != principal.user_id:
        raise HTTPException(403, "Account mismatch")
    """
    Persists immediate user interaction (click, search, add-to-cart)
    with dish personas into Short-Term Memory (PostgreSQL).
    """
    try:
        action = crud.log_user_action(
            db=db,
            user_id=principal.user_id,
            action_type=req.action_type,
            payload=req.payload
        )
        return {
            "status": "success",
            "action_id": action.id,
            "user_id": action.user_id,
            "action_type": action.action_type,
            "created_at": action.created_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to log user action: {e}")
        raise HTTPException(status_code=500, detail="Action could not be saved")

@router.get("/{user_id}")
def get_user_actions(user_id: str, limit: int = Query(15, ge=1, le=50), principal=Depends(current_principal), db: Session = Depends(get_db)):
    """
    Returns recent short-term user actions for a specific user.
    """
    if user_id != principal.user_id:
        raise HTTPException(403, "Account mismatch")
    actions = crud.get_user_recent_actions(db=db, user_id=user_id, limit=limit)
    return {
        "status": "success",
        "user_id": user_id,
        "count": len(actions),
        "actions": [
            {
                "id": a.id,
                "action_type": a.action_type,
                "payload": a.payload,
                "created_at": a.created_at.isoformat()
            }
            for a in actions
        ]
    }
