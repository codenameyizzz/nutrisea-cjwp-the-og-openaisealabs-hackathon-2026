-- SOURCE ONLY. Requires explicit approval before running against any connected DB.
-- Existing project migration convention: reviewed PostgreSQL SQL files, not Alembic.
-- Additive: no existing table or record is altered; no inferred recipe backfill.
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE ingredients (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    normalized_name VARCHAR(150) NOT NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'Lainnya',
    default_unit VARCHAR(10) NOT NULL DEFAULT 'gram',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ingredients_normalized_name UNIQUE (normalized_name),
    CONSTRAINT ck_ingredients_name CHECK (length(trim(name)) > 0 AND length(trim(normalized_name)) > 0),
    CONSTRAINT ck_ingredients_unit CHECK (default_unit IN ('gram','kg','ml','liter','pcs','tsp','tbsp'))
);
CREATE INDEX ix_ingredients_name_prefix ON ingredients (normalized_name varchar_pattern_ops);

CREATE TABLE ingredient_aliases (
    id VARCHAR(36) PRIMARY KEY,
    ingredient_id VARCHAR(36) NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    alias VARCHAR(150) NOT NULL,
    normalized_alias VARCHAR(150) NOT NULL,
    CONSTRAINT uq_ingredient_alias UNIQUE (ingredient_id, normalized_alias),
    CONSTRAINT ck_ingredient_alias_name CHECK (length(trim(alias)) > 0 AND length(trim(normalized_alias)) > 0)
);
CREATE INDEX ix_ingredient_aliases_ingredient_id ON ingredient_aliases (ingredient_id);
CREATE INDEX ix_ingredient_alias_prefix ON ingredient_aliases (normalized_alias varchar_pattern_ops);

CREATE TABLE menu_ingredients (
    menu_item_id VARCHAR(32) NOT NULL REFERENCES menu_item(id) ON DELETE CASCADE,
    ingredient_id VARCHAR(36) NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,3) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (menu_item_id, ingredient_id),
    CONSTRAINT ck_menu_ingredients_quantity CHECK (quantity > 0 AND quantity <= 999999.999),
    CONSTRAINT ck_menu_ingredients_unit CHECK (unit IN ('gram','kg','ml','liter','pcs','tsp','tbsp'))
);
CREATE INDEX ix_menu_ingredients_ingredient ON menu_ingredients (ingredient_id, menu_item_id);
COMMIT;
