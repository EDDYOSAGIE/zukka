-- ============================================================
-- ZUKKA DATABASE SCHEMA
-- Orders + Paystack + Chowdeck Relay Delivery Integration
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. MERCHANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    business_name VARCHAR(180) NOT NULL,

    contact_phone VARCHAR(32) NOT NULL UNIQUE,

    email VARCHAR(254) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    -- Meta integrations
    meta_page_id VARCHAR(128),
    meta_page_access_token TEXT,

    instagram_business_id VARCHAR(128),

    -- Business information
    business_address TEXT,

    business_latitude NUMERIC(10, 7),

    business_longitude NUMERIC(10, 7),

    sector VARCHAR(80) NOT NULL DEFAULT 'general',

    -- Zukka trust score
    zuka_trust_score INT NOT NULL DEFAULT 500
        CHECK (zuka_trust_score BETWEEN 300 AND 850),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 2. INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    merchant_id UUID NOT NULL
        REFERENCES merchants(id)
        ON DELETE CASCADE,

    item_name VARCHAR(180) NOT NULL,

    base_price_naira NUMERIC(12, 2) NOT NULL
        CHECK (base_price_naira >= 0),

    minimum_margin_naira NUMERIC(12, 2) NOT NULL
        CHECK (minimum_margin_naira >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 3. CHAT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    merchant_id UUID NOT NULL
        REFERENCES merchants(id)
        ON DELETE CASCADE,

    platform VARCHAR(20) NOT NULL
        CHECK (
            platform IN (
                'instagram',
                'whatsapp'
            )
        ),

    external_user_id VARCHAR(128) NOT NULL,

    user_handle VARCHAR(180),

    message_text TEXT NOT NULL,

    direction VARCHAR(20) NOT NULL
        CHECK (
            direction IN (
                'inbound',
                'outbound'
            )
        ),

    sentiment_flag VARCHAR(64),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 4. ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    merchant_id UUID NOT NULL
        REFERENCES merchants(id)
        ON DELETE CASCADE,

    item_id UUID
        REFERENCES inventory(id)
        ON DELETE SET NULL,


    -- --------------------------------------------------------
    -- CUSTOMER INFORMATION
    -- --------------------------------------------------------

    customer_name VARCHAR(180),

    customer_phone VARCHAR(32) NOT NULL,

    customer_email VARCHAR(254),


    -- --------------------------------------------------------
    -- ORDER INFORMATION
    -- --------------------------------------------------------

    quantity INT NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    amount_naira NUMERIC(12, 2) NOT NULL
        CHECK (amount_naira >= 0),


    -- --------------------------------------------------------
    -- PAYMENT INFORMATION
    -- --------------------------------------------------------

    payment_method VARCHAR(20) NOT NULL
        CHECK (
            payment_method IN (
                'transfer',
                'bnpl'
            )
        ),

    payment_status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (
            payment_status IN (
                'pending',
                'paid',
                'failed',
                'failed_requires_refund',
                'refunded'
            )
        ),

    paystack_reference VARCHAR(128),

    paystack_transaction_id VARCHAR(128),

    payment_verified_at TIMESTAMPTZ,

    checkout_url TEXT,


    -- --------------------------------------------------------
    -- ORDER STATUS
    -- --------------------------------------------------------

    order_status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (
            order_status IN (
                'pending',
                'confirmed',
                'processing',
                'ready_for_delivery',
                'out_for_delivery',
                'delivered',
                'cancelled',
                'failed'
            )
        ),


    -- --------------------------------------------------------
    -- DELIVERY INFORMATION
    -- --------------------------------------------------------

    delivery_method VARCHAR(20) NOT NULL
        CHECK (
            delivery_method IN (
                'express',
                'eco_pool'
            )
        ),

    delivery_lga VARCHAR(120) NOT NULL,

    delivery_address TEXT NOT NULL,

    delivery_latitude NUMERIC(10, 7),

    delivery_longitude NUMERIC(10, 7),

    delivery_fee_naira NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (delivery_fee_naira >= 0),


    -- --------------------------------------------------------
    -- DELIVERY QUOTE
    -- --------------------------------------------------------

    delivery_fee_id VARCHAR(128),

    delivery_fee_quoted_at TIMESTAMPTZ,


    -- --------------------------------------------------------
    -- TIMESTAMPS
    -- --------------------------------------------------------

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 5. DELIVERIES
-- ============================================================
--
-- This table stores the actual logistics/delivery information.
--
-- One order can have one active delivery record.
--
-- Chowdeck is the provider in the current implementation,
-- but the provider field allows Zukka to support other
-- logistics providers later.
-- ============================================================

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    order_id UUID NOT NULL UNIQUE
        REFERENCES orders(id)
        ON DELETE CASCADE,


    -- --------------------------------------------------------
    -- DELIVERY PROVIDER
    -- --------------------------------------------------------

    provider VARCHAR(30) NOT NULL DEFAULT 'chowdeck'
        CHECK (
            provider IN (
                'chowdeck',
                'zukka',
                'other'
            )
        ),


    -- --------------------------------------------------------
    -- CHOWDECK INFORMATION
    -- --------------------------------------------------------

    provider_delivery_id VARCHAR(128),

    provider_reference VARCHAR(180) UNIQUE,

    fee_id VARCHAR(128),


    -- --------------------------------------------------------
    -- DELIVERY FINANCIAL INFORMATION
    -- --------------------------------------------------------

    delivery_fee_naira NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (delivery_fee_naira >= 0),

    estimated_order_amount_naira NUMERIC(12, 2)
        CHECK (
            estimated_order_amount_naira IS NULL
            OR estimated_order_amount_naira >= 0
        ),


    -- --------------------------------------------------------
    -- DELIVERY STATUS
    -- --------------------------------------------------------

    status VARCHAR(40) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'quoted',
                'preparing',
                'awaiting_pickup',
                'in_transit',
                'delivered',
                'failed',
                'cancelled'
            )
        ),


    -- --------------------------------------------------------
    -- TRACKING
    -- --------------------------------------------------------

    tracking_url TEXT,

    delivery_pin VARCHAR(20),


    -- --------------------------------------------------------
    -- SOURCE / PICKUP INFORMATION
    -- --------------------------------------------------------

    source_name VARCHAR(180),

    source_phone VARCHAR(32),

    source_address TEXT,

    source_latitude NUMERIC(10, 7),

    source_longitude NUMERIC(10, 7),


    -- --------------------------------------------------------
    -- DESTINATION INFORMATION
    -- --------------------------------------------------------

    destination_name VARCHAR(180),

    destination_phone VARCHAR(32),

    destination_address TEXT,

    destination_latitude NUMERIC(10, 7),

    destination_longitude NUMERIC(10, 7),


    -- --------------------------------------------------------
    -- DELIVERY NOTES
    -- --------------------------------------------------------

    customer_delivery_note TEXT,

    vendor_delivery_note TEXT,


    -- --------------------------------------------------------
    -- TIMESTAMPS
    -- --------------------------------------------------------

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    delivered_at TIMESTAMPTZ
);


-- ============================================================
-- 6. PAYMENT WEBHOOK EVENTS
-- ============================================================
--
-- Used to make Paystack webhook processing idempotent.
--
-- If Paystack sends the same webhook more than once,
-- Zukka can detect that the event/reference has already
-- been processed.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    provider VARCHAR(30) NOT NULL DEFAULT 'paystack',

    event_id VARCHAR(180),

    event_type VARCHAR(100) NOT NULL,

    reference VARCHAR(128),

    payload JSONB NOT NULL,

    processed BOOLEAN NOT NULL DEFAULT FALSE,

    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 7. DELIVERY WEBHOOK EVENTS
-- ============================================================
--
-- Stores incoming Chowdeck delivery events.
-- This prevents duplicate webhook processing and gives Zukka
-- an audit trail of delivery updates.
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    provider VARCHAR(30) NOT NULL DEFAULT 'chowdeck',

    event_id VARCHAR(180),

    event_type VARCHAR(100),

    provider_reference VARCHAR(180),

    payload JSONB NOT NULL,

    processed BOOLEAN NOT NULL DEFAULT FALSE,

    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 8. SCHEDULED DROPS
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_drops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    merchant_id UUID NOT NULL
        REFERENCES merchants(id)
        ON DELETE CASCADE,

    caption TEXT NOT NULL,

    target_hashtag VARCHAR(120),

    media_url TEXT NOT NULL,

    channel VARCHAR(20) NOT NULL DEFAULT 'instagram',

    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (
            status IN (
                'queued',
                'published',
                'failed'
            )
        ),

    published_at TIMESTAMPTZ
);


-- ============================================================
-- 9. RIDERS
-- ============================================================
--
-- Kept because Zukka may support its own rider network later.
-- Chowdeck deliveries will not necessarily use this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    full_name VARCHAR(180) NOT NULL,

    phone VARCHAR(32) NOT NULL UNIQUE,

    service_lga VARCHAR(120) NOT NULL,

    vehicle_type VARCHAR(20) NOT NULL DEFAULT 'bike'
        CHECK (
            vehicle_type IN (
                'bike',
                'car',
                'van'
            )
        ),

    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 10. INDEXES
-- ============================================================

-- Merchant
CREATE INDEX IF NOT EXISTS idx_inventory_merchant_id
ON inventory (merchant_id);


-- Chat logs
CREATE INDEX IF NOT EXISTS idx_chat_logs_merchant_created_at
ON chat_logs (merchant_id, created_at DESC);


-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_merchant_created_at
ON orders (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
ON orders (payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_order_status
ON orders (order_status);

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone
ON orders (customer_phone);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_lga
ON orders (delivery_lga);


-- Deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id
ON deliveries (order_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_status
ON deliveries (status);

CREATE INDEX IF NOT EXISTS idx_deliveries_provider_reference
ON deliveries (provider_reference);

CREATE INDEX IF NOT EXISTS idx_deliveries_provider_delivery_id
ON deliveries (provider_delivery_id);


-- Scheduled drops
CREATE INDEX IF NOT EXISTS idx_scheduled_drops_merchant_status
ON scheduled_drops (merchant_id, status);


-- Riders
CREATE INDEX IF NOT EXISTS idx_riders_service_lga_available
ON riders (service_lga, is_available);


-- Payment webhooks
CREATE INDEX IF NOT EXISTS idx_payment_webhook_reference
ON payment_webhook_events (reference);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_created_at
ON payment_webhook_events (created_at DESC);


-- Delivery webhooks
CREATE INDEX IF NOT EXISTS idx_delivery_webhook_reference
ON delivery_webhook_events (provider_reference);

CREATE INDEX IF NOT EXISTS idx_delivery_webhook_created_at
ON delivery_webhook_events (created_at DESC);


-- ============================================================
-- 11. UNIQUE CONSTRAINTS / IDEMPOTENCY
-- ============================================================

-- Paystack references must be unique when they exist.
CREATE UNIQUE INDEX IF NOT EXISTS
idx_orders_paystack_reference_unique
ON orders (paystack_reference)
WHERE paystack_reference IS NOT NULL;


-- Paystack transaction IDs should also be unique.
CREATE UNIQUE INDEX IF NOT EXISTS
idx_orders_paystack_transaction_unique
ON orders (paystack_transaction_id)
WHERE paystack_transaction_id IS NOT NULL;


-- Prevent duplicate Paystack event IDs.
CREATE UNIQUE INDEX IF NOT EXISTS
idx_payment_webhook_event_unique
ON payment_webhook_events (event_id)
WHERE event_id IS NOT NULL;


-- Prevent duplicate Chowdeck event IDs.
CREATE UNIQUE INDEX IF NOT EXISTS
idx_delivery_webhook_event_unique
ON delivery_webhook_events (event_id)
WHERE event_id IS NOT NULL;


-- ============================================================
-- 12. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS update_merchants_updated_at
ON merchants;

CREATE TRIGGER update_merchants_updated_at
BEFORE UPDATE ON merchants
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_inventory_updated_at
ON inventory;

CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_orders_updated_at
ON orders;

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_deliveries_updated_at
ON deliveries;

CREATE TRIGGER update_deliveries_updated_at
BEFORE UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();