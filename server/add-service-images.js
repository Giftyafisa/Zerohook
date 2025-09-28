const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Service images for different categories
const serviceImages = {
  'Long Term': [
    'https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop'
  ],
  'Short Term': [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&h=400&fit=crop'
  ],
  'Oral Services': [
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&h=400&fit=crop'
  ],
  'Special Services': [
    'https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop'
  ]
};

async function addServiceImages() {
  console.log('🖼️ Adding Service Images...\n');
  
  try {
    // Get all services with category info
    const servicesResult = await pool.query(`
      SELECT s.id, s.title, sc.display_name as category_name, s.provider_id 
      FROM services s
      JOIN service_categories sc ON s.category_id = sc.id
      ORDER BY s.created_at DESC
    `);
    
    console.log(`📸 Found ${servicesResult.rows.length} services to update`);
    
    for (const service of servicesResult.rows) {
      const category = service.category_name;
      const images = serviceImages[category] || serviceImages['Long Term'];
      
      // Select 2-3 random images for each service
      const selectedImages = images
        .sort(() => 0.5 - Math.random())
        .slice(0, 2 + Math.floor(Math.random() * 2));
      
      console.log(`🖼️ Adding ${selectedImages.length} images to: ${service.title}`);
      
      // Update service with images
      await pool.query(`
        UPDATE services 
        SET media_urls = $1::jsonb
        WHERE id = $2
      `, [JSON.stringify(selectedImages), service.id]);
      
      console.log(`   ✅ Images added: ${selectedImages.length} images`);
    }
    
    console.log('\n🎉 Service images added successfully!');
    console.log('\n📊 Service Images Summary:');
    console.log('   Long Term Services: Professional business/companionship images');
    console.log('   Short Term Services: Casual/relaxation focused images');
    console.log('   Oral Services: Wellness and relaxation images');
    console.log('   Special Services: Premium and exclusive images');
    console.log(`   Total Services Updated: ${servicesResult.rows.length}`);
    
  } catch (error) {
    console.error('❌ Error adding service images:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addServiceImages();
}
