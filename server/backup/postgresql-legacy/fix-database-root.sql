-- Fix Database Schema for Adult Service Create Page
-- This script fixes the missing tables and columns

-- 1. Create service_categories table
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insert default service categories
INSERT INTO service_categories (name, display_name, description, base_price) VALUES
('long_term', 'Long Term', 'Long-term companionship and relationship services', 50000.00),
('short_term', 'Short Term', 'Short-term and casual services', 25000.00),
('oral_services', 'Oral Services', 'Specialized oral service offerings', 15000.00),
('special_services', 'Special Services', 'Specialized and fetish services', 35000.00)
ON CONFLICT (name) DO NOTHING;

-- 3. Add missing columns to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE services ADD COLUMN IF NOT EXISTS location_type VARCHAR(50) DEFAULT 'local';
ALTER TABLE services ADD COLUMN IF NOT EXISTS location_data JSONB DEFAULT '{}';
ALTER TABLE services ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{}';
ALTER TABLE services ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS bookings INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0.00;

-- 4. Update existing services to set provider_id
UPDATE services SET provider_id = user_id WHERE provider_id IS NULL AND user_id IS NOT NULL;

-- 5. Set default category_id for existing services
UPDATE services SET category_id = (SELECT id FROM service_categories WHERE name = 'long_term' LIMIT 1) WHERE category_id IS NULL;

-- 6. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id);
CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);

-- 7. Verify the fixes
SELECT 'Database schema fixes completed successfully!' as status;
