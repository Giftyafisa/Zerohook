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
        title: 'Premium Companionship',
        description: 'Professional companionship services for social events, dinners, and quality time. Discrete and elegant service.',
        category: 'companionship',
        subcategory: 'social',
        price: 50000,
        duration_minutes: 120
      },
      {
        title: 'VIP Escort Service',
        description: 'High-end escort services for business events, parties, and exclusive gatherings. Professional and sophisticated.',
        category: 'escort',
        subcategory: 'vip',
        price: 100000,
        duration_minutes: 180
      },
      {
        title: 'Relaxation Massage',
        description: 'Professional relaxation and therapeutic massage services. Full body treatment in a comfortable setting.',
        category: 'massage',
        subcategory: 'relaxation',
        price: 25000,
        duration_minutes: 60
      },
      {
        title: 'Intimate Companionship',
        description: 'Private and intimate companionship experience. Discrete, safe, and professional service.',
        category: 'companionship',
        subcategory: 'intimate',
        price: 75000,
        duration_minutes: 90
      },
      {
        title: 'Overnight Experience',
        description: 'Complete overnight companionship package. Includes dinner, entertainment, and quality time.',
        category: 'companionship',
        subcategory: 'overnight',
        price: 200000,
        duration_minutes: 480
      },
      {
        title: 'Video Call Session',
        description: 'Private video call session for remote companionship. Engaging conversation and entertainment.',
        category: 'virtual',
        subcategory: 'video',
        price: 15000,
        duration_minutes: 30
      },
      {
        title: 'Dinner Date',
        description: 'Elegant dinner date experience at premium restaurants. Charming company for a memorable evening.',
        category: 'companionship',
        subcategory: 'dining',
        price: 60000,
        duration_minutes: 150
      },
      {
        title: 'Weekend Getaway',
        description: 'Full weekend companionship package. Travel together to exciting destinations.',
        category: 'companionship',
        subcategory: 'travel',
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
