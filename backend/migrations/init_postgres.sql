-- =====================================================================
-- NutriSea: PostgreSQL Schema (Aiven Cloud Production / Hackathon)
-- Fully covers 100% of frontend fields, forms, and financial logic
-- Connect: psql "postgresql://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require"
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('CONSUMER', 'MERCHANT_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_sex_enum AS ENUM ('M', 'F');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE activity_level_enum AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE health_goal_enum AS ENUM ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_MUSCLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE meal_slot_enum AS ENUM ('LUNCH', 'DINNER', 'SNACK', 'ANY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE nutrition_source_enum AS ENUM ('TKPI', 'ESTIMATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tag_author_enum AS ENUM ('SYSTEM', 'MERCHANT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reco_meal_type_enum AS ENUM ('LUNCH', 'DINNER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reco_source_enum AS ENUM ('LIVE', 'CACHED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reco_status_enum AS ENUM ('SHOWN', 'ACCEPTED', 'SWAPPED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM ('CART_INJECTED', 'CONFIRMED', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE meal_source_enum AS ENUM ('ORDER', 'PHOTO', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE meal_type_enum AS ENUM ('BREAKFAST', 'LUNCH', 'SNACK', 'DINNER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ---------------------------------------------------------------------
-- 1. USER + HEALTH PROFILE (Long-Term Memory)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_user (
    id                  VARCHAR(64) PRIMARY KEY, -- Clerk user ID (e.g. user_2...) or seeded demo ID
    name                VARCHAR(100) NOT NULL,
    email               VARCHAR(150) NULL,
    role                user_role_enum NOT NULL DEFAULT 'CONSUMER',
    is_demo             BOOLEAN NOT NULL DEFAULT FALSE,
    consent_health_data BOOLEAN NOT NULL DEFAULT FALSE, -- Indonesian PDP law: explicit consent
    streak_days         INTEGER NOT NULL DEFAULT 5,     -- SeaBank gamification habit streak tracker
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_profile (
    user_id               VARCHAR(64) PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    age                   INTEGER NOT NULL CHECK (age BETWEEN 18 AND 100),
    sex                   user_sex_enum NOT NULL,
    height_cm             NUMERIC(5,1) NOT NULL CHECK (height_cm BETWEEN 120 AND 230),
    weight_kg             NUMERIC(5,1) NOT NULL CHECK (weight_kg BETWEEN 30 AND 250),
    occupation            VARCHAR(100) NULL,              -- e.g. 'Mahasiswa, desainer', 'Corporate Desk Worker'
    activity_level        activity_level_enum NOT NULL DEFAULT 'LIGHT',
    goal                  health_goal_enum NOT NULL DEFAULT 'MAINTAIN',
    allergies             JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["kacang", "seafood"]
    meal_budget_idr       INTEGER NOT NULL DEFAULT 35000 CHECK (meal_budget_idr > 0),
    has_medical_condition BOOLEAN NOT NULL DEFAULT FALSE,
    bmr_kcal              INTEGER NOT NULL,                   -- Mifflin-St Jeor baseline
    tdee_kcal             INTEGER NOT NULL,
    kcal_target           INTEGER NOT NULL,                   -- daily target after goal adjustment
    kcal_floor            INTEGER NOT NULL,                   -- hard metabolic safety floor
    target_protein_g      INTEGER NOT NULL DEFAULT 75,        -- daily protein requirement
    target_carbs_g        INTEGER NOT NULL DEFAULT 200,       -- daily carbs allowance
    sodium_cap_mg         INTEGER NOT NULL DEFAULT 2000,      -- sodium limit cap
    max_dinner_cut_pct    INTEGER NOT NULL DEFAULT 25 CHECK (max_dinner_cut_pct BETWEEN 0 AND 40),
    learned_palate        JSONB NOT NULL DEFAULT '{}'::jsonb, -- liked/disliked items, spice preference
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_profile_floor CHECK (kcal_target >= kcal_floor)
);

-- Trigger for auto-updating health_profile.updated_at timestamp
CREATE OR REPLACE FUNCTION update_health_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_health_profile_updated ON health_profile;
CREATE TRIGGER trg_health_profile_updated
BEFORE UPDATE ON health_profile
FOR EACH ROW EXECUTE FUNCTION update_health_profile_timestamp();


-- ---------------------------------------------------------------------
-- 2. MERCHANT + MENU CATALOG
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchant (
    id                  VARCHAR(32) PRIMARY KEY, -- e.g. 'MTR-WBM-01'
    name                VARCHAR(150) NOT NULL,
    area                VARCHAR(80) NOT NULL,    -- e.g. 'Kuningan', 'SCBD'
    lat                 NUMERIC(9,6) NULL,
    lng                 NUMERIC(9,6) NULL,
    distance_km         NUMERIC(4,1) NOT NULL DEFAULT 1.0 CHECK (distance_km >= 0),
    delivery_radius_km  NUMERIC(4,1) NOT NULL DEFAULT 2.5,
    rating              NUMERIC(3,2) NOT NULL DEFAULT 4.8,
    rating_count        INTEGER NOT NULL DEFAULT 420,
    is_verified_hygiene BOOLEAN NOT NULL DEFAULT TRUE,
    commission_rate     NUMERIC(4,2) NOT NULL DEFAULT 0.05,
    image_url           VARCHAR(500) NULL,
    is_open             BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS menu_item (
    id                   VARCHAR(32) PRIMARY KEY, -- e.g. 'DISH-01'
    merchant_id          VARCHAR(32) NOT NULL REFERENCES merchant(id) ON DELETE CASCADE,
    name                 VARCHAR(200) NOT NULL,
    description          VARCHAR(500) NULL,
    meal_slot            meal_slot_enum NOT NULL DEFAULT 'ANY',
    category             VARCHAR(30) NOT NULL DEFAULT 'protein', -- 'hemat', 'protein', 'rendah-kalori', 'bebas-santan', 'lambung'
    base_price_idr       INTEGER NOT NULL CHECK (base_price_idr > 0),
    discounted_price_idr INTEGER NOT NULL CHECK (discounted_price_idr > 0 AND discounted_price_idr <= base_price_idr),
    has_promo            BOOLEAN NOT NULL DEFAULT FALSE,
    rating               NUMERIC(3,2) NOT NULL DEFAULT 4.8,
    sold_count           VARCHAR(20) NOT NULL DEFAULT '1.8rb+',
    kcal                 INTEGER NOT NULL CHECK (kcal > 0),
    protein_g            NUMERIC(5,1) NOT NULL DEFAULT 0.0 CHECK (protein_g >= 0),
    carbs_g              NUMERIC(5,1) NOT NULL DEFAULT 0.0 CHECK (carbs_g >= 0),
    fat_g                NUMERIC(5,1) NOT NULL DEFAULT 0.0 CHECK (fat_g >= 0),
    sodium_mg            INTEGER NOT NULL DEFAULT 0 CHECK (sodium_mg >= 0),
    image_url            VARCHAR(500) NULL,
    allergens            JSONB NOT NULL DEFAULT '[]'::jsonb,
    hygiene_badges       JSONB NOT NULL DEFAULT '["Minyak Baru Terverifikasi"]'::jsonb,
    default_notes        VARCHAR(255) NULL,
    nutrition_source     nutrition_source_enum NOT NULL DEFAULT 'ESTIMATE',
    is_available         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_menu_item_merchant ON menu_item(merchant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_slot ON menu_item(meal_slot, is_available);
CREATE INDEX IF NOT EXISTS idx_menu_item_category ON menu_item(category);

CREATE TABLE IF NOT EXISTS menu_item_tag (
    item_id   VARCHAR(32) NOT NULL REFERENCES menu_item(id) ON DELETE CASCADE,
    tag       VARCHAR(50) NOT NULL, -- 'MINYAK_BARU', 'TANPA_SANTAN', 'SAYUR_BENING', etc.
    tagged_by tag_author_enum NOT NULL DEFAULT 'SYSTEM',
    verified  BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (item_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tag_lookup ON menu_item_tag(tag);


-- ---------------------------------------------------------------------
-- 3. RECOMMENDATION (AI output & Recalibration Cache)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendation (
    id               VARCHAR(40) PRIMARY KEY, -- e.g. 'REC-20261107-001'
    user_id          VARCHAR(64) NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    meal_type        reco_meal_type_enum NOT NULL,
    item_id          VARCHAR(32) NOT NULL REFERENCES menu_item(id),
    chips            JSONB NOT NULL DEFAULT '[]'::jsonb,
    payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
    source           reco_source_enum NOT NULL DEFAULT 'LIVE',
    is_recalibration BOOLEAN NOT NULL DEFAULT FALSE,
    status           reco_status_enum NOT NULL DEFAULT 'SHOWN',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reco_user_time ON recommendation(user_id, created_at DESC);


-- ---------------------------------------------------------------------
-- 4. ORDERS & ORDER ITEMS (ShopeeFood 1-Click Cart Injection)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id                         SERIAL PRIMARY KEY,
    user_id                    VARCHAR(64) NOT NULL REFERENCES app_user(id),
    merchant_id                VARCHAR(32) NOT NULL REFERENCES merchant(id),
    recommendation_id          VARCHAR(40) NULL REFERENCES recommendation(id),
    status                     order_status_enum NOT NULL DEFAULT 'CART_INJECTED',
    is_healthy_pick            BOOLEAN NOT NULL DEFAULT TRUE,
    total_idr                  INTEGER NOT NULL CHECK (total_idr >= 0),
    delivery_fee_idr           INTEGER NOT NULL DEFAULT 10000,
    delivery_discount_idr      INTEGER NOT NULL DEFAULT 10000,
    voucher_code               VARCHAR(50) NULL,
    discount_idr               INTEGER NOT NULL DEFAULT 10000,
    payment_method             VARCHAR(30) NOT NULL DEFAULT 'seabank',
    delivery_address           VARCHAR(255) NULL DEFAULT 'Gedung Equity Tower, SCBD / Kuningan, Jakarta Selatan',
    estimated_delivery_minutes INTEGER NOT NULL DEFAULT 25,
    kitchen_notes              VARCHAR(255) NULL,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at               TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user_time ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_item (
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id    VARCHAR(32) NOT NULL REFERENCES menu_item(id),
    qty        INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    price_idr  INTEGER NOT NULL CHECK (price_idr >= 0),
    PRIMARY KEY (order_id, item_id)
);


-- ---------------------------------------------------------------------
-- 5. MEAL LOG (Short-Term Memory: everything eaten via order or photo scan)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_log (
    id             SERIAL PRIMARY KEY,
    user_id        VARCHAR(64) NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    source         meal_source_enum NOT NULL,
    meal_type      meal_type_enum NOT NULL,
    order_id       INTEGER NULL REFERENCES orders(id),
    label          VARCHAR(200) NOT NULL,
    food_category  VARCHAR(60) NULL,
    cooking_style  VARCHAR(60) NULL,
    nutri_grade    VARCHAR(5) NULL DEFAULT 'C',
    density_flags  JSONB NOT NULL DEFAULT '[]'::jsonb,
    rebalance_note TEXT NULL,
    image_url      VARCHAR(500) NULL,
    portion_factor NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (portion_factor BETWEEN 0.25 AND 3.00),
    confidence     NUMERIC(3,2) NULL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    kcal           INTEGER NOT NULL CHECK (kcal >= 0),
    protein_g      NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    carbs_g        NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    fat_g          NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    sodium_mg      INTEGER NOT NULL DEFAULT 0,
    logged_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meal_log_user_day ON meal_log(user_id, logged_at DESC);


-- ---------------------------------------------------------------------
-- 6. SEABANK WELLNESS SAVER (Append-Only Reward Ledger)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_ledger (
    id                    SERIAL PRIMARY KEY,
    user_id               VARCHAR(64) NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    order_id              INTEGER NOT NULL UNIQUE REFERENCES orders(id),
    amount_idr            INTEGER NOT NULL CHECK (amount_idr > 0),
    reason                VARCHAR(60) NOT NULL DEFAULT 'HEALTHY_ORDER_DELIVERED',
    interest_bonus_pct    NUMERIC(3,2) NOT NULL DEFAULT 0.50,
    streak_bonus_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reward_user ON reward_ledger(user_id, created_at DESC);


-- ---------------------------------------------------------------------
-- 7. MERCHANT DEMAND GAP INSIGHTS (AI Merchant Co-Pilot)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchant_demand_insight (
    id                        SERIAL PRIMARY KEY,
    merchant_id               VARCHAR(32) NOT NULL REFERENCES merchant(id) ON DELETE CASCADE,
    district                  VARCHAR(80) NOT NULL,
    radius_km                 NUMERIC(3,1) NOT NULL DEFAULT 2.0,
    unmet_demand_count        INTEGER NOT NULL DEFAULT 65,
    opportunity_detected      VARCHAR(100) NOT NULL,
    actionable_suggestion     TEXT NOT NULL,
    suggested_healthy_tags    JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_order_boost_pct INTEGER NOT NULL DEFAULT 20,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demand_district ON merchant_demand_insight(district);


-- ---------------------------------------------------------------------
-- 8. CHAT MESSAGES (Odysseus AI Nutritionist Conversation Memory)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_message (
    id           SERIAL PRIMARY KEY,
    user_id      VARCHAR(64) NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role         VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content      TEXT NOT NULL,
    dish_context VARCHAR(255) NULL,
    model_used   VARCHAR(50) NOT NULL DEFAULT 'gemini-3.1-flash-lite',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_user_time ON chat_message(user_id, created_at ASC);
