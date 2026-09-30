CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name VARCHAR(180) NOT NULL,
  contact_phone VARCHAR(32) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  meta_page_id VARCHAR(128),
  meta_page_access_token TEXT,
  instagram_business_id VARCHAR(128),
  sector VARCHAR(80) NOT NULL DEFAULT 'general',
  zuka_trust_score INT NOT NULL DEFAULT 500 CHECK (zuka_trust_score BETWEEN 300 AND 850),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS business_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS business_longitude NUMERIC(10, 7);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  item_name VARCHAR(180) NOT NULL,
  base_price_naira NUMERIC(12, 2) NOT NULL CHECK (base_price_naira >= 0),
  minimum_margin_naira NUMERIC(12, 2) NOT NULL CHECK (minimum_margin_naira >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'whatsapp')),
  external_user_id VARCHAR(128) NOT NULL,
  user_handle VARCHAR(180),
  message_text TEXT NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sentiment_flag VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  customer_phone VARCHAR(32) NOT NULL,
  amount_naira NUMERIC(12, 2) NOT NULL CHECK (amount_naira >= 0),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('transfer', 'bnpl')),
  payment_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed_requires_refund')),
  paystack_reference VARCHAR(128),
  checkout_url TEXT,
  delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('express', 'eco_pool')),
  delivery_lga VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(180),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS delivery_fee_naira NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS delivery_fee_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS delivery_fee_quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS order_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL DEFAULT 'chowdeck',
  provider_delivery_id VARCHAR(180),
  provider_reference VARCHAR(180),
  fee_id VARCHAR(128),
  delivery_fee_naira NUMERIC(12, 2),
  estimated_order_amount_naira NUMERIC(12, 2),
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  tracking_url TEXT,
  delivery_pin VARCHAR(40),
  source_name VARCHAR(180),
  source_phone VARCHAR(32),
  source_address TEXT,
  source_latitude NUMERIC(10, 7),
  source_longitude NUMERIC(10, 7),
  destination_name VARCHAR(180),
  destination_phone VARCHAR(32),
  destination_address TEXT,
  destination_latitude NUMERIC(10, 7),
  destination_longitude NUMERIC(10, 7),
  customer_delivery_note TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_created_at
  ON public.deliveries (created_at DESC);

NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS scheduled_drops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  target_hashtag VARCHAR(120),
  media_url TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'instagram',
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'published', 'failed')),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(180) NOT NULL,
  phone VARCHAR(32) NOT NULL UNIQUE,
  service_lga VARCHAR(120) NOT NULL,
  vehicle_type VARCHAR(20) NOT NULL DEFAULT 'bike' CHECK (vehicle_type IN ('bike', 'car', 'van')),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paystack_reference_unique
  ON orders (paystack_reference)
  WHERE paystack_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_merchant_id ON inventory (merchant_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_merchant_created_at ON chat_logs (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_created_at ON orders (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_drops_merchant_status ON scheduled_drops (merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_riders_service_lga_available ON riders (service_lga, is_available);
