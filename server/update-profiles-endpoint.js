const fs = require('fs');
const path = require('path');

// Read the current users.js file
const usersPath = path.join(__dirname, 'routes', 'users.js');
let content = fs.readFileSync(usersPath, 'utf8');

// Find the profiles endpoint and replace it
const oldEndpoint = `router.get('/profiles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await query(\`
      SELECT COUNT(*) FROM users WHERE profile_data IS NOT NULL
    \`);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Get paginated results
    const result = await query(\`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.profile_data,
        u.verification_tier,
        u.reputation_score,
        u.is_subscribed,
        u.subscription_tier,
        u.created_at,
        COALESCE(u.last_active, u.created_at) as last_active
      FROM users u
      WHERE u.profile_data IS NOT NULL
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    \`, [limit, offset]);

    res.json({
      success: true,
      users: result.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profiles',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});`;

const newEndpoint = `router.get('/profiles', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      country,
      city,
      minAge,
      maxAge,
      verificationTier,
      minTrustScore,
      maxTrustScore,
      category,
      minPrice,
      maxPrice,
      availability
    } = req.query;

    let whereClause = 'WHERE u.profile_data IS NOT NULL';
    const params = [];
    let paramIndex = 1;

    // Build dynamic filters
    if (country) {
      whereClause += \` AND u.profile_data->>'country' = $\${paramIndex++}\`;
      params.push(country);
    }

    if (city) {
      whereClause += \` AND u.profile_data->>'city' ILIKE $\${paramIndex++}\`;
      params.push(\`%\${city}%\`);
    }

    if (minAge || maxAge) {
      if (minAge && maxAge) {
        whereClause += \` AND (u.profile_data->>'age')::int BETWEEN $\${paramIndex++} AND $\${paramIndex++}\`;
        params.push(minAge, maxAge);
      } else if (minAge) {
        whereClause += \` AND (u.profile_data->>'age')::int >= $\${paramIndex++}\`;
        params.push(minAge);
      } else if (maxAge) {
        whereClause += \` AND (u.profile_data->>'age')::int <= $\${paramIndex++}\`;
        params.push(maxAge);
      }
    }

    if (verificationTier) {
      whereClause += \` AND u.verification_tier = $\${paramIndex++}\`;
      params.push(verificationTier);
    }

    if (minTrustScore || maxTrustScore) {
      if (minTrustScore && maxTrustScore) {
        whereClause += \` AND u.reputation_score BETWEEN $\${paramIndex++} AND $\${paramIndex++}\`;
        params.push(minTrustScore, maxTrustScore);
      } else if (minTrustScore) {
        whereClause += \` AND u.reputation_score >= $\${paramIndex++}\`;
        params.push(minTrustScore);
      } else if (maxTrustScore) {
        whereClause += \` AND u.reputation_score <= $\${paramIndex++}\`;
        params.push(maxTrustScore);
      }
    }

    if (category) {
      whereClause += \` AND u.profile_data->'serviceCategories' ? $\${paramIndex++}\`;
      params.push(category);
    }

    if (minPrice || maxPrice) {
      if (minPrice && maxPrice) {
        whereClause += \` AND (u.profile_data->>'basePrice')::numeric BETWEEN $\${paramIndex++} AND $\${paramIndex++}\`;
        params.push(minPrice, maxPrice);
      } else if (minPrice) {
        whereClause += \` AND (u.profile_data->>'basePrice')::numeric >= $\${paramIndex++}\`;
        params.push(minPrice);
      } else if (maxPrice) {
        whereClause += \` AND (u.profile_data->>'basePrice')::numeric <= $\${paramIndex++}\`;
        params.push(maxPrice);
      }
    }

    if (availability) {
      whereClause += \` AND u.profile_data->'availability' ? $\${paramIndex++}\`;
      params.push(availability);
    }

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    // Get total count with filters
    const countResult = await query(\`
      SELECT COUNT(*) FROM users u \${whereClause}
    \`, params.slice(0, -2));
    
    const totalCount = parseInt(countResult.rows[0].count);

    // Get filtered results
    const result = await query(\`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.profile_data,
        u.verification_tier,
        u.reputation_score,
        u.is_subscribed,
        u.subscription_tier,
        u.created_at,
        COALESCE(u.last_active, u.created_at) as last_active
      FROM users u
      \${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $\${paramIndex++} OFFSET $\${paramIndex++}
    \`, params);

    res.json({
      success: true,
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      filters: {
        country, city, minAge, maxAge, verificationTier,
        minTrustScore, maxTrustScore, category, minPrice, maxPrice, availability
      }
    });
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profiles',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});`;

// Replace the old endpoint with the new one
content = content.replace(oldEndpoint, newEndpoint);

// Write the updated content back to the file
fs.writeFileSync(usersPath, content, 'utf8');

console.log('✅ Profiles endpoint updated with advanced filtering and pagination!');
console.log('📋 Added features:');
console.log('   - Country filtering');
console.log('   - City filtering');
console.log('   - Age range filtering');
console.log('   - Verification tier filtering');
console.log('   - Trust score range filtering');
console.log('   - Service category filtering');
console.log('   - Price range filtering');
console.log('   - Availability filtering');
console.log('   - Enhanced pagination with filter support');
