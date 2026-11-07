#!/usr/bin/env python3
"""
Database Migration: Add Restaurant Table and Links
Creates 'restaurant' table and adds 'restaurant_id' to 'menu_item' and 'orders'.
"""
import sys
import os

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import text
from app.core.database import engine

MIGRATION_SQL = """
-- 1. Create restaurant table
CREATE TABLE IF NOT EXISTS restaurant (
    id                  VARCHAR(32) PRIMARY KEY,
    merchant_id         VARCHAR(32) NOT NULL REFERENCES merchant(id) ON DELETE CASCADE,
    name                VARCHAR(150) NOT NULL,
    brand_name          VARCHAR(100) NOT NULL,
    cuisine_type        VARCHAR(80) NOT NULL DEFAULT 'Indonesian',
    area                VARCHAR(80) NOT NULL,
    address             VARCHAR(255) NULL,
    lat                 NUMERIC(9,6) NULL,
    lng                 NUMERIC(9,6) NULL,
    distance_km         NUMERIC(4,1) NOT NULL DEFAULT 1.0,
    delivery_radius_km  NUMERIC(4,1) NOT NULL DEFAULT 3.0,
    rating              NUMERIC(3,2) NOT NULL DEFAULT 4.8,
    rating_count        INTEGER NOT NULL DEFAULT 350,
    is_verified_hygiene BOOLEAN NOT NULL DEFAULT TRUE,
    is_open             BOOLEAN NOT NULL DEFAULT TRUE,
    image_url           VARCHAR(500) NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_merchant ON restaurant(merchant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_area ON restaurant(area);

-- 2. Add restaurant_id to menu_item
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'menu_item' AND column_name = 'restaurant_id'
    ) THEN
        ALTER TABLE menu_item ADD COLUMN restaurant_id VARCHAR(32) REFERENCES restaurant(id) ON DELETE CASCADE;
        CREATE INDEX idx_menu_item_restaurant ON menu_item(restaurant_id);
    END IF;
END $$;

-- 3. Add restaurant_id to orders
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'restaurant_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN restaurant_id VARCHAR(32) REFERENCES restaurant(id);
    END IF;
END $$;

-- 4. Add optional business partner fields to merchant
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'merchant' AND column_name = 'owner_name'
    ) THEN
        ALTER TABLE merchant ADD COLUMN owner_name VARCHAR(100) NULL;
        ALTER TABLE merchant ADD COLUMN contact_email VARCHAR(150) NULL;
        ALTER TABLE merchant ADD COLUMN contact_phone VARCHAR(30) NULL;
        ALTER TABLE merchant ADD COLUMN seabank_account_no VARCHAR(30) NULL;
    END IF;
END $$;
"""

def run_migration():
    print("[*] Connecting to database to apply restaurant table migration...")
    with engine.begin() as conn:
        conn.execute(text(MIGRATION_SQL))
    print("[+] Migration successfully applied! 'restaurant' table and linkages are active in PostgreSQL.")

if __name__ == "__main__":
    run_migration()
