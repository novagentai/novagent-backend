-- Novagent Realty Backend Schema
-- Run this once to initialize the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  property_type TEXT,
  status TEXT DEFAULT 'active',
  bedrooms INTEGER,
  bathrooms INTEGER,
  square_feet INTEGER,
  address TEXT,
  city TEXT,
  country TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  images TEXT[] DEFAULT '{}',
  video_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  agent_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contact inquiries
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  listing_id UUID REFERENCES listings(id),
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Video projects / AI generation jobs
CREATE TABLE IF NOT EXISTS video_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  prompt TEXT NOT NULL,
  style TEXT,
  status TEXT DEFAULT 'pending',
  video_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Subscribers / leads
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  source TEXT DEFAULT 'website',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent TEXT DEFAULT 'novagent',
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_country ON listings(country);
CREATE INDEX IF NOT EXISTS idx_listings_featured ON listings(is_featured);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- Insert sample listings
INSERT INTO listings (title, description, price, property_type, status, bedrooms, bathrooms, square_feet, city, country, images, is_featured) VALUES
  ('Modern Cliffside Villa', 'Breathtaking ocean views with modern architecture. Private infinity pool, smart home systems, and sustainable energy.', 4500000, 'villa', 'active', 5, 4, 4800, 'Malibu', 'USA', ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80'], true),
  ('Downtown Penthouse', 'Luxury high-rise living in the heart of the city. Floor-to-ceiling windows, private elevator, rooftop access.', 2800000, 'apartment', 'active', 3, 3, 3200, 'Manhattan', 'USA', ARRAY['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80'], true),
  ('Coastal Estate', 'Historic charm meets modern luxury. Beachfront property with private dock and guest house.', 5200000, 'estate', 'active', 6, 5, 6200, 'Hamptons', 'USA', ARRAY['https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80'], true),
  ('Mountain Retreat', 'Secluded luxury cabin with panoramic mountain views. Hot tub, sauna, and hiking trails.', 1800000, 'cabin', 'active', 4, 3, 2800, 'Aspen', 'USA', ARRAY['https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80'], false),
  ('Urban Loft', 'Converted warehouse loft in arts district. Exposed brick, high ceilings, modern finishes.', 950000, 'apartment', 'active', 2, 2, 1800, 'Brooklyn', 'USA', ARRAY['https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80'], false),
  ('Tuscan Villa', 'Restored 16th-century villa with vineyard. Chianti region, Italy. Agriturismo potential.', 3200000, 'villa', 'active', 4, 4, 3800, 'Tuscany', 'Italy', ARRAY['https://images.unsplash.com/photo-1600573472591-ee6981cf81f0?w=800&q=80'], false)
ON CONFLICT DO NOTHING;
