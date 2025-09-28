const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Service data for each user
const userServices = [
  {
    username: 'akua_ghana',
    services: [
      {
        title: 'Premium Long Term Escort Service',
        description: 'Exclusive long-term escort services in Accra. Professional, discreet, and satisfying. Available for extended arrangements with maximum discretion and luxury experience.',
        price: 250.00,
        duration_minutes: 120,
        category: 'Long Term',
        tags: ['Premium Escort', 'Long Term', 'Luxury', 'Maximum Discretion']
      },
      {
        title: 'Intimate Special Event Services',
        description: 'Premium escort services for special events, business functions, and celebrations. Complete satisfaction guaranteed with maximum discretion.',
        price: 400.00,
        duration_minutes: 240,
        category: 'Special Services',
        tags: ['Premium Escort', 'Events', 'Business', 'Complete Satisfaction']
      }
    ]
  },
  {
    username: 'kwame_ghana',
    services: [
      {
        title: 'Intimate Short Term Escort Service',
        description: 'Professional short-term escort service with massage and relaxation. Complete satisfaction guaranteed with maximum discretion.',
        price: 180.00,
        duration_minutes: 90,
        category: 'Short Term',
        tags: ['Intimate Escort', 'Short Term', 'Massage', 'Complete Satisfaction']
      },
      {
        title: 'Intimate Wellness & Relaxation',
        description: 'Oral services and intimate wellness treatments for stress relief and complete satisfaction. Professional and discreet.',
        price: 120.00,
        duration_minutes: 60,
        category: 'Oral Services',
        tags: ['Intimate Wellness', 'Complete Satisfaction', 'Stress Relief', 'Professional']
      }
    ]
  },
  {
    username: 'efua_ghana',
    services: [
      {
        title: 'Premium Long Term Escort Service',
        description: 'Exclusive long-term escort services for special events and celebrations in Cape Coast. Maximum satisfaction with luxury experience.',
        price: 350.00,
        duration_minutes: 180,
        category: 'Long Term',
        tags: ['Premium Escort', 'Long Term', 'Luxury', 'Complete Satisfaction']
      },
      {
        title: 'Intimate Premium Event Services',
        description: 'Exclusive escort services for high-profile events and business functions. Complete satisfaction guaranteed with maximum discretion.',
        price: 500.00,
        duration_minutes: 300,
        category: 'Special Services',
        tags: ['Premium Escort', 'Exclusive', 'High Profile', 'Complete Satisfaction']
      }
    ]
  },
  {
    username: 'kofi_ghana',
    services: [
      {
        title: 'Short Term Wellness',
        description: 'Short-term companionship with wellness and relaxation services in Tamale.',
        price: 120.00,
        duration_minutes: 75,
        category: 'Short Term',
        tags: ['Wellness', 'Short Term', 'Relaxation', 'Tamale']
      },
      {
        title: 'Cultural Wellness Services',
        description: 'Oral services with cultural sensitivity and traditional wellness approaches.',
        price: 80.00,
        duration_minutes: 45,
        category: 'Oral Services',
        tags: ['Cultural', 'Traditional', 'Wellness', 'Oral']
      }
    ]
  },
  {
    username: 'ama_ghana',
    services: [
      {
        title: 'Fitness Companionship',
        description: 'Short-term companionship with fitness training and wellness coaching.',
        price: 180.00,
        duration_minutes: 90,
        category: 'Short Term',
        tags: ['Fitness', 'Short Term', 'Wellness', 'Training']
      },
      {
        title: 'Wellness & Energy Services',
        description: 'Oral services focused on energy and vitality enhancement.',
        price: 120.00,
        duration_minutes: 60,
        category: 'Oral Services',
        tags: ['Energy', 'Vitality', 'Wellness', 'Oral']
      }
    ]
  },
  {
    username: 'chioma_nigeria',
    services: [
      {
        title: 'Long Term Elegant Companionship',
        description: 'Premium long-term companionship services in Lagos with Nigerian elegance.',
        price: 300.00,
        duration_minutes: 180,
        category: 'Long Term',
        tags: ['Premium', 'Long Term', 'Elegant', 'Lagos']
      },
      {
        title: 'Exclusive Special Services',
        description: 'High-end special services for discerning clients seeking premium experiences.',
        price: 500.00,
        duration_minutes: 240,
        category: 'Special Services',
        tags: ['Exclusive', 'High End', 'Premium', 'Special']
      }
    ]
  },
  {
    username: 'adebayo_nigeria',
    services: [
      {
        title: 'Long Term Companionship',
        description: 'Professional long-term companionship with massage and relaxation in Abuja.',
        price: 200.00,
        duration_minutes: 120,
        category: 'Long Term',
        tags: ['Companionship', 'Long Term', 'Massage', 'Abuja']
      },
      {
        title: 'Relaxation & Wellness',
        description: 'Oral services focused on deep relaxation and stress relief.',
        price: 150.00,
        duration_minutes: 90,
        category: 'Oral Services',
        tags: ['Relaxation', 'Stress Relief', 'Wellness', 'Oral']
      }
    ]
  },
  {
    username: 'fatima_nigeria',
    services: [
      {
        title: 'Short Term Cultural Companionship',
        description: 'Short-term companionship with cultural respect and Northern Nigerian hospitality.',
        price: 150.00,
        duration_minutes: 90,
        category: 'Short Term',
        tags: ['Cultural', 'Short Term', 'Hospitality', 'Northern']
      },
      {
        title: 'Traditional Wellness Services',
        description: 'Oral services with traditional Northern Nigerian wellness approaches.',
        price: 100.00,
        duration_minutes: 60,
        category: 'Oral Services',
        tags: ['Traditional', 'Wellness', 'Northern', 'Oral']
      }
    ]
  },
  {
    username: 'emeka_nigeria',
    services: [
      {
        title: 'Long Term Business Companionship',
        description: 'Long-term companionship with business networking and professional support.',
        price: 250.00,
        duration_minutes: 150,
        category: 'Long Term',
        tags: ['Business', 'Long Term', 'Networking', 'Professional']
      },
      {
        title: 'Premium Business Services',
        description: 'Special services for business clients and networking events.',
        price: 400.00,
        duration_minutes: 180,
        category: 'Special Services',
        tags: ['Business', 'Premium', 'Networking', 'Special']
      }
    ]
  },
  {
    username: 'blessing_nigeria',
    services: [
      {
        title: 'Short Term Educational Companionship',
        description: 'Short-term companionship with cultural education and warm Nigerian hospitality.',
        price: 160.00,
        duration_minutes: 90,
        category: 'Short Term',
        tags: ['Educational', 'Short Term', 'Cultural', 'Hospitality']
      },
      {
        title: 'Cultural Wellness Services',
        description: 'Oral services with cultural sensitivity and educational elements.',
        price: 110.00,
        duration_minutes: 60,
        category: 'Oral Services',
        tags: ['Cultural', 'Educational', 'Wellness', 'Oral']
      }
    ]
  }
];

async function createTestServices() {
  console.log('🚀 Creating test services for all users...\n');
  
  try {
    // First, create service categories
    const categories = ['Long Term', 'Short Term', 'Oral Services', 'Special Services'];
    const categoryMap = {};
    
    for (const category of categories) {
      const result = await pool.query(`
        INSERT INTO service_categories (name, display_name, description, base_price, verification_required)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id, name
      `, [
        category.replace(/\s+/g, '_').toLowerCase(),
        category,
        `${category} services for adult companionship`,
        0,
        1
      ]);
      
      categoryMap[category] = result.rows[0].id;
      console.log(`   ✅ Category created: ${category}`);
    }
    
    console.log('\n👥 Creating services for users...\n');
    
    // Create services for each user
    for (const userService of userServices) {
      const { username, services } = userService;
      
      // Get user ID
      const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
      if (userResult.rows.length === 0) {
        console.log(`   ❌ User not found: ${username}`);
        continue;
      }
      
      const userId = userResult.rows[0].id;
      console.log(`👤 Creating services for: ${username}`);
      
      for (const service of services) {
        const result = await pool.query(`
          INSERT INTO services (provider_id, category_id, title, description, price, duration_minutes, location_type, location_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, title
        `, [
          userId,
          categoryMap[service.category],
          service.title,
          service.description,
          service.price,
          service.duration_minutes,
          'flexible',
          JSON.stringify({ city: 'Various', country: username.includes('ghana') ? 'Ghana' : 'Nigeria' })
        ]);
        
        console.log(`   ✅ Service created: ${result.rows[0].title} ($${service.price})`);
      }
      console.log('');
    }
    
    console.log('🎉 All test services created successfully!');
    console.log('\n📊 Summary:');
    console.log(`   👥 Users: ${userServices.length}`);
    console.log(`   🛠️  Total Services: ${userServices.reduce((sum, us) => sum + us.services.length, 0)}`);
    console.log(`   📍 Categories: ${categories.join(', ')}`);
    console.log(`   💰 Price Range: $80 - $500`);
    
  } catch (error) {
    console.error('❌ Error creating services:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createTestServices();
}
