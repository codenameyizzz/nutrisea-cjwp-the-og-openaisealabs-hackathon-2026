-- Additive source storage. Run explicitly inside a transaction, never at startup.
-- No existing table, recipe, ingredient, menu value, or account is modified.
CREATE TABLE IF NOT EXISTS ingredient_source_foods (
    source_key VARCHAR(100) PRIMARY KEY,
    ingredient_id VARCHAR(36) REFERENCES ingredients(id) ON DELETE RESTRICT,
    source_name VARCHAR(300) NOT NULL,
    source_url VARCHAR(1000),
    link_status VARCHAR(20) NOT NULL,
    review_reason VARCHAR(300),
    raw_food JSONB NOT NULL,
    content_sha256 VARCHAR(64) NOT NULL,
    batch_sha256 VARCHAR(64) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_source_food_link_status CHECK (link_status IN ('linked','needs_review'))
);
CREATE INDEX IF NOT EXISTS ix_ingredient_source_foods_ingredient_id ON ingredient_source_foods (ingredient_id);

CREATE TABLE IF NOT EXISTS ingredient_source_servings (
    source_key VARCHAR(100) PRIMARY KEY,
    food_source_key VARCHAR(100) NOT NULL REFERENCES ingredient_source_foods(source_key) ON DELETE RESTRICT,
    raw_serving JSONB NOT NULL,
    nutrients JSONB NOT NULL,
    content_sha256 VARCHAR(64) NOT NULL,
    batch_sha256 VARCHAR(64) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_ingredient_source_servings_food_source_key ON ingredient_source_servings (food_source_key);
