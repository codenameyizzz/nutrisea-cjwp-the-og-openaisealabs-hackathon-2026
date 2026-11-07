# Legacy Data Archive

This directory stores the original hardcoded / seed mock data preserved for backup, archive, and offline reference:

1. **`hardcoded_menu.ts`**: The original 32 hardcoded ShopeeFood dishes in TypeScript format from the frontend.
2. **`seed_catalog.json`**: The original JSON food and merchant catalog used for initial mock seeding.
3. **`sql_example.txt`**: The original draft MySQL schema specification.

Live data is now managed and served entirely through **Aiven Cloud PostgreSQL** via the NutriSea FastAPI backend (`/api/dishes`, `/api/users`, `/api/merchant`, etc.).
