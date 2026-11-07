import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..db import crud

router = APIRouter(prefix="/api/actions", tags=["Short-Term Memory & User Actions"])
logger = logging.getLogger(__name__)

class UserActionPayload(BaseModel):
    user_id: str = Field(..., description="Clerk User ID or Demo Persona ID")
    action_type: str = Field(..., description="e.g. CLICK_MENU_ITEM, SEARCH_QUERY, ADD_TO_CART, VIEW_DETAILS")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Metadata including dish personas, price, query")

@router.post("/log")
def log_action(req: UserActionPayload, db: Session = Depends(get_db)):
    """
    Persists immediate user interaction (click, search, add-to-cart)
    with dish personas into Short-Term Memory (PostgreSQL).
    """
    try:
        action = crud.log_user_action(
            db=db,
            user_id=req.user_id,
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
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}")
def get_user_actions(user_id: str, limit: int = Query(15, ge=1, le=50), db: Session = Depends(get_db)):
    """
    Returns recent short-term user actions for a specific user.
    """
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
