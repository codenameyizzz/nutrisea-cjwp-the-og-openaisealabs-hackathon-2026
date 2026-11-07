from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from ..services.fatsecret_service import FatSecretService

router = APIRouter(prefix="/api/nutrition", tags=["FatSecret Food Nutrition"])
service = FatSecretService()

@router.get("/status")
def get_service_status():
    """
    Checks if FatSecret API OAuth 2.0 credentials are configured.
    """
    return {
        "provider": "FatSecret Platform API",
        "is_configured": service.is_configured(),
        "mode": "OAuth 2.0 Live" if service.is_configured() else "Verified Indonesian Reference Dataset"
    }

@router.get("/search")
def search_food_nutrition(
    query: str = Query(..., min_length=2, description="Food name in Indonesian (e.g. 'ayam bakar', 'soto')"),
    max_results: int = Query(10, ge=1, le=50),
    region: str = Query("ID", description="FatSecret country code ('ID' for Indonesia)")
):
    """
    Searches FatSecret food database for authentic Indonesian food calories, macros, and sodium.
    """
    results = service.search_foods(query=query, max_results=max_results, region=region)
    return {
        "status": "success",
        "query": query,
        "region": region,
        "count": len(results),
        "results": results
    }

@router.get("/food/{food_id}")
def get_food_nutrition_detail(
    food_id: int,
    region: str = Query("ID")
):
    """
    Returns full nutritional serving breakdown from FatSecret by food ID.
    """
    detail = service.get_food_detail(food_id=food_id, region=region)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Food ID {food_id} not found in FatSecret database")
    return {
        "status": "success",
        "data": detail
    }
