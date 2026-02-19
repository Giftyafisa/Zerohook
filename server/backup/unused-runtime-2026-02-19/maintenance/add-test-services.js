/**
 * Add Test Adult Services to Zerohook Database
 * Creates sample services for testing the marketplace
 */

require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addTestServices() {
  console.log('🚀 Adding test adult services to Zerohook database...\n');

  try {
    // Get existing users to assign services
    const usersResult = await pool.query(`
      SELECT id, username, profile_data->>'location' as location 
      FROM users 
      ORDER BY created_at 
      LIMIT 8
    `);

    if (usersResult.rows.length === 0) {
      console.log('❌ No users found. Please run add-test-users.js first.');
      return;
    }

    const users = usersResult.rows;
    console.log(`📋 Found ${users.length} users to assign services to\n`);

    const serviceTemplates = [
      {
        title: 'Premium Long-Term Companionship',
        description: 'Professional companionship services for ongoing arrangements. Regular meetings, emotional connection, and trust building.',
        category: 'long-term',
        subcategory: 'relationship',
        price: 50000,
        duration_minutes: 120
      },
      {
        title: 'VIP Short-Term Service',
        description: 'High-end short-term services for quick meetings and casual encounters. No strings attached.',
        category: 'short-term',
        subcategory: 'casual',
        price: 100000,
        duration_minutes: 180
      },
      {
        title: 'Premium Oral Experience',
        description: 'Professional oral services with focus on hygiene and satisfaction. Discrete and professional.',
        category: 'oral-services',
        subcategory: 'standard',
        price: 25000,
        duration_minutes: 60
      },
      {
        title: 'Special VIP Treatment',
        description: 'Premium and exclusive intimate offerings. VIP treatment with custom experiences.',
        category: 'special-services',
        subcategory: 'premium',
        price: 75000,
        duration_minutes: 90
      },
      {
        title: 'Long-Term Overnight Package',
        description: 'Complete overnight companionship package for ongoing arrangements. Includes dinner and quality time.',
        category: 'long-term',
        subcategory: 'overnight',
        price: 200000,
        duration_minutes: 480
      },
      {
        title: 'Quick Short-Term Session',
        description: 'Fast and discrete short-term session. Flexible scheduling available.',
        category: 'short-term',
        subcategory: 'quick',
        price: 15000,
        duration_minutes: 30
      },
      {
        title: 'Special Dinner Date',
        description: 'Elegant dinner date experience with exclusive premium service. Charming company for a memorable evening.',
        category: 'special-services',
        subcategory: 'dining',
        price: 60000,
        duration_minutes: 150
      },
      {
        title: 'Extended Oral Services',
        description: 'Extended oral experience package with professional approach. Satisfaction guaranteed.',
        category: 'oral-services',
        subcategory: 'extended',
        price: 500000,
        duration_minutes: 2880
      }
    ];

    let servicesAdded = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      // Each user gets 1-2 services
      const numServices = Math.min(2, serviceTemplates.length - i);
      
      for (let j = 0; j < numServices; j++) {
        const template = serviceTemplates[(i + j) % serviceTemplates.length];
        const serviceId = crypto.randomUUID();
        
        // Parse user location or use default
        let locationData = { city: 'Lagos', country: 'Nigeria', coordinates: { lat: 6.5244, lng: 3.3792 } };
        try {
          if (user.location) {
            const loc = JSON.parse(user.location);
            locationData = loc;
          }
        } catch (e) {
          // Use default
        }

        const availability = {
          monday: { available: true, hours: '10:00-22:00' },
          tuesday: { available: true, hours: '10:00-22:00' },
          wednesday: { available: true, hours: '10:00-22:00' },
          thursday: { available: true, hours: '10:00-22:00' },
          friday: { available: true, hours: '10:00-23:00' },
          saturday: { available: true, hours: '12:00-23:00' },
          sunday: { available: false, hours: null }
        };

        const requirements = {
          minAge: 21,
          verification: true,
          advanceBooking: '2 hours',
          cancellationPolicy: '50% refund if cancelled 24h before'
        };

        await pool.query(`
          INSERT INTO adult_services (
            id, provider_id, title, description, category, subcategory,
            price, currency, duration_minutes, location_type, location_data,
            requirements, availability, is_active, is_verified, rating_average
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          serviceId,
          user.id,
          template.title,
          template.description,
          template.category,
          template.subcategory,
          template.price,
          'NGN',
          template.duration_minutes,
          'flexible',
          JSON.stringify(locationData),
          JSON.stringify(requirements),
          JSON.stringify(availability),
          true,
          true,
          (Math.random() * 2 + 3).toFixed(1) // Random rating 3.0-5.0
        ]);

        servicesAdded++;
        console.log(`✅ Added service: "${template.title}" by ${user.username}`);
      }
    }

    // Verify services
    const countResult = await pool.query('SELECT COUNT(*) as count FROM adult_services');
    console.log(`\n📊 Total adult services in database: ${countResult.rows[0].count}`);

    console.log('\n🎉 Test adult services added successfully!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

addTestServices();
