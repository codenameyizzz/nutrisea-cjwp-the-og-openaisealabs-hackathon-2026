"""Read-only nutrition references and graph evidence from imported ingredients."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..services import ingredient_knowledge as service

router = APIRouter(tags=["Ingredient sources"])


def source_db(db: Session = Depends(get_db)):
    service.ensure_source_schema(db)
    return db


@router.get("/api/ingredients/{ingredient_id}/nutrition")
def ingredient_nutrition(ingredient_id: UUID, db: Session = Depends(source_db)):
    return service.ingredient_nutrition(db, str(ingredient_id))


@router.get("/api/graph/catalog/stats")
def catalog_stats(db: Session = Depends(source_db)):
    return service.catalog_stats(db)


@router.get("/api/graph/catalog/ingredients/{ingredient_id}")
def ingredient_evidence(ingredient_id: UUID, db: Session = Depends(source_db)):
    return service.evidence_graph(db, ingredient_id=str(ingredient_id))


@router.get("/api/graph/catalog/menus/{menu_id}")
def menu_evidence(menu_id: str, db: Session = Depends(source_db)):
    return service.evidence_graph(db, menu_id=menu_id)
