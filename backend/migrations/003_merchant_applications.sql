-- Customer merchant applications and approved account-to-merchant assignment.
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE merchant_application (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    business_name VARCHAR(100) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    area VARCHAR(80) NOT NULL,
    address VARCHAR(255) NOT NULL,
    cuisine_type VARCHAR(80) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    merchant_id VARCHAR(32) UNIQUE REFERENCES merchant(id) ON DELETE RESTRICT,
    review_reason TEXT,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_merchant_application_status CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    CONSTRAINT ck_merchant_application_assignment CHECK (status != 'APPROVED' OR merchant_id IS NOT NULL)
);
CREATE INDEX ix_merchant_application_status ON merchant_application(status);
COMMIT;
