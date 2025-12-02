const { Pool } = require('pg');

class AdultServiceManager {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  // Service Categories
  getServiceCategories() {
    return [
      {
        id: 'long-term',
        name: 'Long Term',
        displayName: 'Long Term Relationships',
        description: 'Serious relationships and ongoing arrangements',
        icon: '💕',
        startingPrice: 100,
        maxPrice: 1000,
        duration: 'Ongoing',
        features: ['Regular meetings', 'Emotional connection', 'Trust building', 'Long-term commitment']
      },
      {
        id: 'short-term',
        name: 'Short Term',
        displayName: 'Casual Encounters',
        description: 'Casual dating and one-time services',
        icon: '🔥',
        startingPrice: 150,
        maxPrice: 500,
        duration: 'One-time to few weeks',
        features: ['Quick meetings', 'No strings attached', 'Flexible scheduling', 'Variety of experiences']
      },
      {
        id: 'oral-services',
        name: 'Oral Services',
        displayName: 'Intimate Oral Experiences',
        description: 'Oral services and intimate experiences',
        icon: '💋',
        startingPrice: 80,
        maxPrice: 300,
        duration: 'Per session',
        features: ['Discrete service', 'Professional approach', 'Hygiene focused', 'Satisfaction guaranteed']
      },
      {
        id: 'special-services',
        name: 'Special Services',
        displayName: 'Premium & Exclusive',
        description: 'Premium and exclusive intimate offerings',
        icon: '⭐',
        startingPrice: 200,
        maxPrice: 2000,
        duration: 'Custom',
        features: ['VIP treatment', 'Custom experiences', 'Premium locations', 'Exclusive access']
      }
    ];
  }

  // Create a new service listing
  async createServiceListing(userId, serviceData) {
    const {
      category,
      subcategory,
      title,
      description,
      price,
      duration,
      location,
      availability,
      photos,
      specialRequirements
    } = serviceData;

    try {
      const query = `
        INSERT INTO adult_services (
          provider_id, category, subcategory, title, description, price, 
          duration_minutes, location_type, location_data, availability, 
          requirements, images, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW())
        RETURNING *
      `;

      const values = [
        userId, 
        category, 
        subcategory || null,
        title, 
        description, 
        price, 
        duration,
        'flexible',
        JSON.stringify(location || {}),
        JSON.stringify(availability || {}),
        JSON.stringify(specialRequirements || {}),
        photos || []
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating service listing:', error);
      throw new Error('Failed to create service listing');
    }
  }

  // Get service listings with filters
  async getServiceListings(filters = {}) {
    try {
      let query = `
        SELECT 
          s.*,
          u.username,
          u.verification_tier,
          u.trust_score,
          u.profile_data->>'avatar' as avatar,
          u.profile_data->>'profilePicture' as profile_picture,
          s.is_verified as service_verified
        FROM adult_services s
        JOIN users u ON s.provider_id = u.id
        WHERE s.is_active = true
      `;

      const values = [];
      let valueIndex = 1;

      // Add category filter
      if (filters.category) {
        query += ` AND s.category = $${valueIndex}`;
        values.push(filters.category);
        valueIndex++;
      }

      // Add price range filter
      if (filters.minPrice || filters.maxPrice) {
        if (filters.minPrice) {
          query += ` AND s.price >= $${valueIndex}`;
          values.push(filters.minPrice);
          valueIndex++;
        }
        if (filters.maxPrice) {
          query += ` AND s.price <= $${valueIndex}`;
          values.push(filters.maxPrice);
          valueIndex++;
        }
      }

      // Add location filter
      if (filters.location) {
        query += ` AND (s.location_data->>'city' ILIKE $${valueIndex} OR s.location_data->>'country' ILIKE $${valueIndex})`;
        values.push(`%${filters.location}%`);
        valueIndex++;
      }

      // Add verification tier filter
      if (filters.verificationTier) {
        query += ` AND u.verification_tier >= $${valueIndex}`;
        values.push(filters.verificationTier);
        valueIndex++;
      }

      // Add trust score filter
      if (filters.minTrustScore) {
        query += ` AND u.trust_score >= $${valueIndex}`;
        values.push(filters.minTrustScore);
        valueIndex++;
      }

      // Add sorting
      query += ` ORDER BY u.trust_score DESC, u.verification_tier DESC, s.created_at DESC`;

      // Add pagination
      if (filters.limit) {
        query += ` LIMIT $${valueIndex}`;
        values.push(filters.limit);
        valueIndex++;
      }

      if (filters.offset) {
        query += ` OFFSET $${valueIndex}`;
        values.push(filters.offset);
      }

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting service listings:', error);
      throw new Error('Failed to get service listings');
    }
  }

  // Get service by ID
  async getServiceById(serviceId) {
    try {
      const query = `
        SELECT 
          s.*,
          u.username,
          u.verification_tier,
          u.trust_score,
          u.profile_data->>'avatar' as avatar,
          u.profile_data->>'profilePicture' as profile_picture,
          s.is_verified as service_verified,
          u.created_at as user_joined
        FROM adult_services s
        JOIN users u ON s.provider_id = u.id
        WHERE s.id = $1 AND s.is_active = true
      `;

      const result = await this.pool.query(query, [serviceId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting service by ID:', error);
      throw new Error('Failed to get service');
    }
  }

  // Update service listing
  async updateServiceListing(serviceId, userId, updateData) {
    try {
      const allowedFields = [
        'title', 'description', 'price', 'duration_minutes', 'category',
        'subcategory', 'location_data', 'availability', 'requirements', 'images'
      ];

      const updates = [];
      const values = [];
      let valueIndex = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = $${valueIndex}`);
          values.push(typeof value === 'object' ? JSON.stringify(value) : value);
          valueIndex++;
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(serviceId, userId);
      const query = `
        UPDATE adult_services 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${valueIndex} AND provider_id = $${valueIndex + 1}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating service listing:', error);
      throw new Error('Failed to update service listing');
    }
  }

  // Delete service listing
  async deleteServiceListing(serviceId, userId) {
    try {
      const query = `
        UPDATE adult_services 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND provider_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [serviceId, userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting service listing:', error);
      throw new Error('Failed to delete service listing');
    }
  }

  // Get user's service listings
  async getUserServices(userId) {
    try {
      const query = `
        SELECT * FROM adult_services 
        WHERE provider_id = $1 AND is_active = true
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user services:', error);
      throw new Error('Failed to get user services');
    }
  }

  // Search services
  async searchServices(searchTerm, filters = {}) {
    try {
      let query = `
        SELECT 
          s.*,
          u.username,
          u.verification_tier,
          u.trust_score,
          u.profile_data->>'avatar' as avatar,
          u.profile_data->>'profilePicture' as profile_picture,
          s.is_verified as service_verified
        FROM adult_services s
        JOIN users u ON s.provider_id = u.id
        WHERE s.is_active = true
        AND (
          s.title ILIKE $1 
          OR s.description ILIKE $1 
          OR s.location_data->>'city' ILIKE $1
          OR s.location_data->>'country' ILIKE $1
        )
      `;

      const values = [`%${searchTerm}%`];
      let valueIndex = 2;

      // Add additional filters
      if (filters.category) {
        query += ` AND s.category = $${valueIndex}`;
        values.push(filters.category);
        valueIndex++;
      }

      if (filters.minPrice) {
        query += ` AND s.price >= $${valueIndex}`;
        values.push(filters.minPrice);
        valueIndex++;
      }

      if (filters.maxPrice) {
        query += ` AND s.price <= $${valueIndex}`;
        values.push(filters.maxPrice);
        valueIndex++;
      }

      query += ` ORDER BY u.trust_score DESC, u.verification_tier DESC`;

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error searching services:', error);
      throw new Error('Failed to search services');
    }
  }

  // Get service statistics
  async getServiceStats() {
    try {
      const query = `
        SELECT 
          category,
          COUNT(*) as total_services,
          AVG(price) as avg_price,
          MIN(price) as min_price,
          MAX(price) as max_price
        FROM adult_services 
        WHERE is_active = true
        GROUP BY category
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting service stats:', error);
      throw new Error('Failed to get service statistics');
    }
  }
}

module.exports = AdultServiceManager;
