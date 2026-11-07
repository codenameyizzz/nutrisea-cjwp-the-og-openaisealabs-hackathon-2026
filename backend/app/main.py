from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import create_all_tables
from .api import profile, recommend, scan, recalibrate, merchant, chat, users, dishes, nutrition, admin, personas, actions, graph
from .api import ingredients, ingredient_sources, merchant_applications, preferences

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Explicit opt-in for legacy local development; migrations never run here.
    if settings.AUTO_CREATE_TABLES:
        create_all_tables()
    yield

app = FastAPI(
    title="NutriSea AI Engine & Execution API",
    description="Autonomous Adaptive Nutritional Co-Pilot for ShopeeFood & SeaBank",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup for seamless communication with Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development/hackathon, allow all local origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Modular Routers
app.include_router(users.router)
app.include_router(preferences.router)
app.include_router(personas.router)
app.include_router(dishes.router)
app.include_router(ingredients.router)
app.include_router(ingredients.menu_router)
app.include_router(ingredient_sources.router)
app.include_router(merchant_applications.router)
app.include_router(merchant_applications.admin_router)
app.include_router(nutrition.router)
app.include_router(profile.router)
app.include_router(recommend.router)
app.include_router(scan.router)
app.include_router(recalibrate.router)
app.include_router(merchant.router)
app.include_router(admin.router)
app.include_router(chat.router)
app.include_router(actions.router)
app.include_router(graph.router)

@app.get("/")
def root():
    return {
        "service": "NutriSea AI Core",
        "status": "online",
        "database": "PostgreSQL (Aiven Cloud ready)",
        "total_personas": 120,
        "knowledge_graph": "NutriGraph Active",
        "docs_url": "/docs"
    }
