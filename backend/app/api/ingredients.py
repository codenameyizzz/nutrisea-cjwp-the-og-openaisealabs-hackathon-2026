from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.ingredient_auth import current_principal, require_admin, require_merchant, assert_menu_owner, IngredientPrincipal
from ..schemas.ingredients import IngredientWrite, MenuIngredientsWrite
from ..services import ingredients as service

router = APIRouter(prefix="/api/ingredients", tags=["Ingredients"])
menu_router = APIRouter(tags=["Menu ingredients"])


def ingredient_db(db: Session = Depends(get_db)):
    service.ensure_schema(db)
    return db


@router.get("/access")
def ingredient_access(principal: IngredientPrincipal = Depends(current_principal)):
    return {"role": principal.role, "is_admin": principal.is_admin, "can_edit_menus": principal.is_admin or (
        principal.role == "MERCHANT_ADMIN" and bool(principal.merchant_ids)), "merchant_ids": principal.merchant_ids}


@router.get("")
def list_ingredients(search: str = Query("", max_length=80), limit: int = Query(8, ge=1, le=50),
                     page: int = Query(1, ge=1, le=10000), db: Session = Depends(ingredient_db)):
    return service.search_ingredients(db, search, limit, page)


@router.get("/manage")
def manage_ingredients(search: str = Query("", max_length=80), limit: int = Query(20, ge=1, le=50),
                       page: int = Query(1, ge=1, le=10000), principal=Depends(require_admin),
                       db: Session = Depends(ingredient_db)):
    return service.search_ingredients(db, search, limit, page, include_inactive=True)


@router.get("/{ingredient_id}")
def ingredient_detail(ingredient_id: UUID, db: Session = Depends(ingredient_db)):
    return service.serialize_ingredient(service.get_ingredient(db, str(ingredient_id)))


@router.post("", status_code=201)
def create_ingredient(data: IngredientWrite, principal=Depends(require_admin), db: Session = Depends(ingredient_db)):
    return service.write_ingredient(db, data)


@router.put("/{ingredient_id}")
def update_ingredient(ingredient_id: UUID, data: IngredientWrite, principal=Depends(require_admin), db: Session = Depends(ingredient_db)):
    return service.write_ingredient(db, data, str(ingredient_id))


@router.delete("/{ingredient_id}")
def deactivate_ingredient(ingredient_id: UUID, principal=Depends(require_admin), db: Session = Depends(ingredient_db)):
    item = service.get_ingredient(db, str(ingredient_id), lock=True)
    item.is_active = False
    db.commit()
    return {"status": "success", "id": item.id, "is_active": False}


@menu_router.get("/api/dishes/{dish_id}/ingredients")
def dish_ingredients(dish_id: str, db: Session = Depends(ingredient_db)):
    service.get_menu(db, dish_id)
    return service.serialize_recipe(db, dish_id)


@menu_router.put("/api/merchant/dishes/{dish_id}/ingredients")
def update_dish_ingredients(dish_id: str, data: MenuIngredientsWrite,
                            principal=Depends(require_merchant), db: Session = Depends(ingredient_db)):
    menu = service.get_menu(db, dish_id, lock=True)
    assert_menu_owner(principal, menu.merchant_id)
    service.replace_recipe(db, dish_id, data.items, data.version)
    db.commit()
    return service.serialize_recipe(db, dish_id)
