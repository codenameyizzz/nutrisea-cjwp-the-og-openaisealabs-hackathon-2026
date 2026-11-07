#!/usr/bin/env python3
"""
Migration & Seeding Script: Persona Master Table and Dual-Tier Memory (LTM)
Creates 'persona' and 'user_memory_item' tables, adds columns to 'app_user',
and seeds all 120 personas from data/personas/processed/personas_master.csv into PostgreSQL.
"""
import sys
import os
import csv

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import text
from app.core.database import SessionLocal, engine
from app.models.persona import Persona

MIGRATION_SQL = """
-- 1. Create persona table
CREATE TABLE IF NOT EXISTS persona (
    id                              VARCHAR(64) PRIMARY KEY,
    full_name                       VARCHAR(100) NOT NULL,
    archetype_code                  VARCHAR(50) NOT NULL,
    archetype_name                  VARCHAR(100) NOT NULL,
    age                             INTEGER NOT NULL,
    gender                          VARCHAR(20) NOT NULL,
    occupation                      VARCHAR(100) NOT NULL,
    work_district                   VARCHAR(50) NOT NULL,
    monthly_income_idr              INTEGER NOT NULL,
    activity_level                  VARCHAR(30) NOT NULL,
    height_cm                       NUMERIC(5,1) NOT NULL,
    weight_kg                       NUMERIC(5,1) NOT NULL,
    bmi_value                       NUMERIC(4,1) NOT NULL,
    bmi_category                    VARCHAR(30) NOT NULL,
    bmr_kcal                        INTEGER NOT NULL,
    tdee_kcal                       INTEGER NOT NULL,
    daily_caloric_target_kcal       INTEGER NOT NULL,
    target_lunch_kcal               INTEGER NOT NULL,
    target_lunch_budget_idr         INTEGER NOT NULL,
    health_goal                     VARCHAR(50) NOT NULL,
    medical_conditions              VARCHAR(100) NOT NULL DEFAULT 'NONE',
    allergens                       VARCHAR(100) NOT NULL DEFAULT 'NONE',
    preferred_tags                  VARCHAR(255) NOT NULL DEFAULT '',
    preferred_cuisines              VARCHAR(255) NOT NULL DEFAULT '',
    order_time_lunch                VARCHAR(20) NOT NULL DEFAULT '12:00',
    weekly_order_frequency          INTEGER NOT NULL DEFAULT 5,
    avg_scroll_duration_minutes     INTEGER NOT NULL DEFAULT 20,
    target_decision_seconds         INTEGER NOT NULL DEFAULT 90,
    primary_functional_job          TEXT NULL,
    primary_emotional_job           TEXT NULL,
    biggest_pain_point              TEXT NULL,
    seabank_wellness_affinity       VARCHAR(30) NOT NULL DEFAULT 'MEDIUM',
    streak_loyalty_potential_days   INTEGER NOT NULL DEFAULT 21,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_persona_archetype ON persona(archetype_code);
CREATE INDEX IF NOT EXISTS idx_persona_district ON persona(work_district);

-- 2. Add main_persona_id and side_persona_ids to app_user
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_user' AND column_name = 'main_persona_id'
    ) THEN
        ALTER TABLE app_user ADD COLUMN main_persona_id VARCHAR(64) NULL REFERENCES persona(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_user' AND column_name = 'side_persona_ids'
    ) THEN
        ALTER TABLE app_user ADD COLUMN side_persona_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 3. Create user_memory_item table for Odysseus Long-Term Memory (LTM)
CREATE TABLE IF NOT EXISTS user_memory_item (
    id          VARCHAR(36) PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    category    VARCHAR(50) NOT NULL,
    fact_text   VARCHAR(255) NOT NULL,
    confidence  NUMERIC(3,2) NOT NULL DEFAULT 0.90,
    source      VARCHAR(50) NOT NULL DEFAULT 'onboarding_persona',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_memory_user ON user_memory_item(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_category ON user_memory_item(category);
"""

def seed_personas():
    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "personas", "processed", "personas_master.csv")
    if not os.path.exists(csv_path):
        print(f"[!] File not found: {csv_path}")
        return

    print(f"[*] Reading personas from {csv_path}...")
    db = SessionLocal()
    count = 0
    try:
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                persona = Persona(
                    id=row["persona_id"].strip(),
                    full_name=row["full_name"].strip(),
                    archetype_code=row["archetype_code"].strip(),
                    archetype_name=row["archetype_name"].strip(),
                    age=int(row["age"]),
                    gender=row["gender"].strip(),
                    occupation=row["occupation"].strip(),
                    work_district=row["work_district"].strip(),
                    monthly_income_idr=int(row["monthly_income_idr"]),
                    activity_level=row["activity_level"].strip(),
                    height_cm=float(row["height_cm"]),
                    weight_kg=float(row["weight_kg"]),
                    bmi_value=float(row["bmi_value"]),
                    bmi_category=row["bmi_category"].strip(),
                    bmr_kcal=int(row["bmr_kcal"]),
                    tdee_kcal=int(row["tdee_kcal"]),
                    daily_caloric_target_kcal=int(row["daily_caloric_target_kcal"]),
                    target_lunch_kcal=int(row["target_lunch_kcal"]),
                    target_lunch_budget_idr=int(row["target_lunch_budget_idr"]),
                    health_goal=row["health_goal"].strip(),
                    medical_conditions=row["medical_conditions"].strip(),
                    allergens=row["allergens"].strip(),
                    preferred_tags=row["preferred_tags"].strip(),
                    preferred_cuisines=row["preferred_cuisines"].strip(),
                    order_time_lunch=row["order_time_lunch"].strip(),
                    weekly_order_frequency=int(row["weekly_order_frequency"]),
                    avg_scroll_duration_minutes=int(row["avg_scroll_duration_minutes"]),
                    target_decision_seconds=int(row["target_decision_seconds"]),
                    primary_functional_job=row.get("primary_functional_job", ""),
                    primary_emotional_job=row.get("primary_emotional_job", ""),
                    biggest_pain_point=row.get("biggest_pain_point", ""),
                    seabank_wellness_affinity=row["seabank_wellness_affinity"].strip(),
                    streak_loyalty_potential_days=int(row["streak_loyalty_potential_days"])
                )
                db.merge(persona)
                count += 1
        db.commit()
        print(f"[+] Successfully seeded {count} personas into Aiven PostgreSQL 'persona' table!")
    except Exception as e:
        db.rollback()
        print(f"[!] Error seeding personas: {e}")
        raise
    finally:
        db.close()

def run_migration():
    print("[*] Running migration SQL on PostgreSQL...")
    with engine.begin() as conn:
        conn.execute(text(MIGRATION_SQL))
    print("[+] Migration successful: 'persona' and 'user_memory_item' tables active, 'app_user' columns updated.")
    seed_personas()

if __name__ == "__main__":
    run_migration()
