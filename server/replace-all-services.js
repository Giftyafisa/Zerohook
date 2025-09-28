const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Real adult services data
const realAdultServices = [
  {
    title: "Premium Long Term Escort Service",
    description: "Exclusive long-term escort services in Accra. Professional, discreet, and satisfying. Available for extended arrangements with maximum discretion and luxury experience.",
    price: 250.00,
    duration_minutes: 120,
    category: "Long Term",
    tags: ["Premium Escort", "Long Term", "Luxury", "Maximum Discretion"]
  },
  {
    title: "Intimate Special Event Services",
    description: "Premium escort services for special events, business functions, and celebrations. Complete satisfaction guaranteed with maximum discretion.",
    price: 400.00,
    duration_minutes: 240,
    category: "Special Services",
    tags: ["Premium Escort", "Events", "Business", "Complete Satisfaction"]
  },
  {
    title: "Intimate Short Term Escort Service",
    description: "Professional short-term escort service with massage and relaxation. Complete satisfaction guaranteed with maximum discretion.",
    price: 180.00,
    duration_minutes: 90,
    category: "Short Term",
    tags: ["Professional Escort", "Short Term", "Massage", "Complete Satisfaction"]
  },
  {
    title: "Intimate Wellness & Relaxation",
    description: "Oral services and intimate wellness treatments for stress relief and complete satisfaction. Professional and discreet.",
    price: 120.00,
    duration_minutes: 60,
    category: "Oral Services",
    tags: ["Oral Services", "Wellness", "Relaxation", "Professional"]
  },
  {
    title: "Premium Long Term Escort Service",
    description: "Exclusive long-term escort services for special events and celebrations in Cape Coast. Maximum satisfaction with luxury experience.",
    price: 350.00,
    duration_minutes: 180,
    category: "Long Term",
    tags: ["Premium Escort", "Long Term", "Luxury", "Maximum Satisfaction"]
  },
  {
    title: "Intimate Premium Event Services",
    description: "Exclusive escort services for high-profile events and business functions. Complete satisfaction guaranteed with maximum discretion.",
    price: 500.00,
    duration_minutes: 300,
    category: "Special Services",
    tags: ["Exclusive Escort", "High Profile", "Business", "Maximum Discretion"]
  },
  {
    title: "Short Term Wellness",
    description: "Short-term companionship with wellness and relaxation services in Tamale. Professional and satisfying experience.",
    price: 120.00,
    duration_minutes: 75,
    category: "Short Term",
    tags: ["Short Term", "Wellness", "Relaxation", "Professional"]
  },
  {
    title: "Cultural Wellness Services",
    description: "Oral services with cultural sensitivity and traditional wellness approaches. Professional and discreet.",
    price: 80.00,
    duration_minutes: 45,
    category: "Oral Services",
    tags: ["Oral Services", "Cultural", "Traditional", "Professional"]
  },
  {
    title: "Fitness Companionship",
    description: "Short-term companionship with fitness training and wellness coaching. Professional and motivating experience.",
    price: 180.00,
    duration_minutes: 90,
    category: "Short Term",
    tags: ["Short Term", "Fitness", "Training", "Professional"]
  },
  {
    title: "Wellness & Energy Services",
    description: "Oral services focused on energy and vitality enhancement. Professional and rejuvenating experience.",
    price: 120.00,
    duration_minutes: 60,
    category: "Oral Services",
    tags: ["Oral Services", "Energy", "Vitality", "Professional"]
  },
  {
    title: "Long Term Elegant Companionship",
    description: "Premium long-term companionship services in Lagos with Nigerian elegance. Professional and sophisticated experience.",
    price: 300.00,
    duration_minutes: 180,
    category: "Long Term",
    tags: ["Long Term", "Elegant", "Premium", "Professional"]
  },
  {
    title: "Exclusive Special Services",
    description: "High-end special services for discerning clients seeking premium experiences. Maximum satisfaction guaranteed.",
    price: 500.00,
    duration_minutes: 240,
    category: "Special Services",
    tags: ["Exclusive", "High End", "Premium", "Maximum Satisfaction"]
  },
  {
    title: "Long Term Companionship",
    description: "Professional long-term companionship with massage and relaxation in Abuja. Complete satisfaction guaranteed.",
    price: 200.00,
    duration_minutes: 120,
    category: "Long Term",
    tags: ["Long Term", "Companionship", "Massage", "Complete Satisfaction"]
  },
  {
    title: "Relaxation & Wellness",
    description: "Oral services focused on deep relaxation and stress relief. Professional and therapeutic experience.",
    price: 150.00,
    duration_minutes: 90,
    category: "Oral Services",
    tags: ["Oral Services", "Relaxation", "Stress Relief", "Professional"]
  },
  {
    title: "Short Term Cultural Companionship",
    description: "Short-term companionship with cultural respect and Northern Nigerian hospitality. Professional and respectful experience.",
    price: 150.00,
    duration_minutes: 90,
    category: "Short Term",
    tags: ["Short Term", "Cultural", "Respectful", "Professional"]
  },
  {
    title: "Traditional Wellness Services",
    description: "Oral services with traditional Northern Nigerian wellness approaches. Professional and authentic experience.",
    price: 100.00,
    duration_minutes: 60,
    category: "Oral Services",
    tags: ["Oral Services", "Traditional", "Authentic", "Professional"]
  },
  {
    title: "Long Term Business Companionship",
    description: "Long-term companionship with business networking and professional support. Professional and strategic experience.",
    price: 250.00,
    duration_minutes: 150,
    category: "Long Term",
    tags: ["Long Term", "Business", "Networking", "Professional"]
  },
  {
    title: "Premium Business Services",
    description: "Special services for business clients and networking events. Professional and strategic experience.",
    price: 400.00,
    duration_minutes: 180,
    category: "Special Services",
    tags: ["Premium", "Business", "Strategic", "Professional"]
  },
  {
    title: "Short Term Educational Companionship",
    description: "Short-term companionship with cultural education and warm Nigerian hospitality. Professional and educational experience.",
    price: 160.00,
    duration_minutes: 90,
    category: "Short Term",
    tags: ["Short Term", "Educational", "Cultural", "Professional"]
  },
  {
    title: "Cultural Wellness Services",
    description: "Oral services with cultural sensitivity and educational elements. Professional and enlightening experience.",
    price: 110.00,
    duration_minutes: 60,
    category: "Oral Services",
    tags: ["Oral Services", "Cultural", "Educational", "Professional"]
  }
];

async function replaceAllServices() {
  console.log('🔄 Replacing all services with real adult services...\n');
  
  try {
    // First, delete all existing services
    await pool.query('DELETE FROM services');
    console.log('🗑️ Deleted all existing services');
    
    // Get category IDs
    const categoriesResult = await pool.query('SELECT id, display_name FROM service_categories');
    const categories = {};
    categoriesResult.rows.forEach(cat => {
      categories[cat.display_name] = cat.id;
    });
    
    // Get user IDs
    const usersResult = await pool.query('SELECT id, username FROM users ORDER BY created_at DESC LIMIT 10');
    const users = usersResult.rows;
    
    console.log(`📊 Found ${categoriesResult.rows.length} categories and ${users.length} users`);
    
    // Create new services
    for (let i = 0; i < realAdultServices.length; i++) {
      const service = realAdultServices[i];
      const user = users[i % users.length]; // Distribute services among users
      const categoryId = categories[service.category];
      
      if (!categoryId) {
        console.log(`⚠️ Category not found: ${service.category}`);
        continue;
      }
      
      const result = await pool.query(`
        INSERT INTO services (
          title, description, price, duration_minutes, category_id, 
          provider_id, location_type, location_data, requirements, 
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id, title
      `, [
        service.title,
        service.description,
        service.price,
        service.duration_minutes,
        categoryId,
        user.id,
        'flexible',
        JSON.stringify({ city: 'Various', country: user.username.includes('ghana') ? 'Ghana' : 'Nigeria' }),
        JSON.stringify(service.tags),
        'active'
      ]);
      
      console.log(`✅ Created: ${result.rows[0].title} - $${service.price} (${service.category})`);
    }
    
    // Verify the creation
    const finalCount = await pool.query('SELECT COUNT(*) as total FROM services');
    console.log(`\n🎉 Service replacement complete! Final service count: ${finalCount.rows[0].total}`);
    
    // Show what we created
    const remainingServices = await pool.query(`
      SELECT s.title, s.price, sc.display_name as category, u.username as provider
      FROM services s
      JOIN service_categories sc ON s.category_id = sc.id
      JOIN users u ON s.provider_id = u.id
      ORDER BY s.created_at DESC
    `);
    
    console.log('\n📋 New Adult Services:');
    remainingServices.rows.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service.title} - $${service.price} (${service.category}) - ${service.provider}`);
    });
    
  } catch (error) {
    console.error('❌ Error replacing services:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  replaceAllServices();
}
