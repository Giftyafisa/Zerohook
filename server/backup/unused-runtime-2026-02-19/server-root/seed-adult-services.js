/**
 * Seed Adult Services Data
 * Run this script to add test adult services to the database
 * 
 * Usage: node server/seed-adult-services.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const serviceCategories = ['long-term', 'short-term', 'oral-services', 'special-services'];

const serviceTitles = {
  'long-term': [
    'Premium Companion Experience',
    'Exclusive Dating Partner',
    'Committed Relationship Package',
    'VIP Long-term Arrangement'
  ],
  'short-term': [
    'Casual Evening Companion',
    'Weekend Getaway Partner',
    'Dinner Date Experience',
    'Night Out Companion'
  ],
  'oral-services': [
    'Intimate Experience Package',
    'Premium Oral Session',
    'Sensual Massage & More',
    'Ultimate Pleasure Service'
  ],
  'special-services': [
    'Fantasy Fulfillment',
    'Custom VIP Experience',
    'Exclusive Private Session',
    'Premium Specialty Service'
  ]
};

const locations = [
  { city: 'Lagos', country: 'Nigeria', coordinates: { lat: 6.5244, lng: 3.3792 } },
  { city: 'Abuja', country: 'Nigeria', coordinates: { lat: 9.0579, lng: 7.4951 } },
  { city: 'Port Harcourt', country: 'Nigeria', coordinates: { lat: 4.8156, lng: 7.0498 } },
  { city: 'Accra', country: 'Ghana', coordinates: { lat: 5.6037, lng: -0.1870 } },
  { city: 'Nairobi', country: 'Kenya', coordinates: { lat: -1.2921, lng: 36.8219 } },
  { city: 'Johannesburg', country: 'South Africa', coordinates: { lat: -26.2041, lng: 28.0473 } }
];

async function seedServices() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking for existing users...');
    
    // Get existing users to use as providers
    const usersResult = await client.query(`
      SELECT id, username, verification_tier 
      FROM users 
      WHERE verification_tier >= 1
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    if (usersResult.rows.length === 0) {
      console.log('❌ No verified users found. Please create some users first.');
      return;
    }
    
    console.log(`✅ Found ${usersResult.rows.length} verified users`);
    
    // Check if adult_services table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'adult_services'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ adult_services table does not exist. Creating it...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS adult_services (
          id SERIAL PRIMARY KEY,
          provider_id INTEGER REFERENCES users(id),
          category VARCHAR(50) NOT NULL,
          subcategory VARCHAR(50),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          duration_minutes INTEGER,
          location_type VARCHAR(20) DEFAULT 'flexible',
          location_data JSONB,
          availability JSONB,
          requirements JSONB,
          images TEXT[],
          is_active BOOLEAN DEFAULT true,
          is_verified BOOLEAN DEFAULT false,
          views_count INTEGER DEFAULT 0,
          bookings_count INTEGER DEFAULT 0,
          rating DECIMAL(3,2),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('✅ adult_services table created');
    }
    
    // Check existing services
    const existingServices = await client.query('SELECT COUNT(*) FROM adult_services');
    console.log(`📊 Existing services: ${existingServices.rows[0].count}`);
    
    // Generate services for each user
    let servicesCreated = 0;
    
    for (const user of usersResult.rows) {
      // Each user gets 1-3 services
      const numServices = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < numServices; i++) {
        const category = serviceCategories[Math.floor(Math.random() * serviceCategories.length)];
        const titles = serviceTitles[category];
        const title = titles[Math.floor(Math.random() * titles.length)];
        const location = locations[Math.floor(Math.random() * locations.length)];
        
        // Generate price based on category
        let basePrice;
        switch (category) {
          case 'long-term': basePrice = 200 + Math.floor(Math.random() * 300); break;
          case 'short-term': basePrice = 100 + Math.floor(Math.random() * 200); break;
          case 'oral-services': basePrice = 80 + Math.floor(Math.random() * 150); break;
          case 'special-services': basePrice = 300 + Math.floor(Math.random() * 500); break;
          default: basePrice = 150;
        }
        
        const description = `Professional ${category.replace('-', ' ')} service in ${location.city}. Discrete, safe, and satisfaction guaranteed. Contact for availability and special requests.`;
        
        await client.query(`
          INSERT INTO adult_services (
            provider_id, category, title, description, price, 
            duration_minutes, location_type, location_data, 
            availability, is_active, is_verified, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, NOW())
          ON CONFLICT DO NOTHING
        `, [
          user.id,
          category,
          title,
          description,
          basePrice,
          category === 'long-term' ? 180 : 60,
          'flexible',
          JSON.stringify(location),
          JSON.stringify({ weekdays: true, weekends: true, evenings: true }),
          user.verification_tier >= 2
        ]);
        
        servicesCreated++;
      }
    }
    
    console.log(`✅ Created ${servicesCreated} new service listings`);
    
    // Verify
    const finalCount = await client.query('SELECT COUNT(*) FROM adult_services WHERE is_active = true');
    console.log(`📊 Total active services: ${finalCount.rows[0].count}`);
    
    // Show sample
    const sample = await client.query(`
      SELECT s.id, s.title, s.category, s.price, u.username
      FROM adult_services s
      JOIN users u ON s.provider_id = u.id
      WHERE s.is_active = true
      LIMIT 5
    `);
    
    console.log('\n📝 Sample services:');
    sample.rows.forEach(s => {
      console.log(`  - [${s.category}] ${s.title} by ${s.username} - $${s.price}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding services:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedServices();
