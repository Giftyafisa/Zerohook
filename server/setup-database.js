require('dotenv').config({ path: './env.local' });
const { query } = require('./config/database');

async function setupDatabase() {
  try {
    console.log('🚀 Setting up database...');

    // Create users table with country fields
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        phone VARCHAR(20),
        country_preference VARCHAR(2),
        detected_country VARCHAR(2),
        profile_picture VARCHAR(255),
        profile_data JSONB DEFAULT '{}',
        bio TEXT,
        date_of_birth DATE,
        gender VARCHAR(10),
        location VARCHAR(100),
        is_verified BOOLEAN DEFAULT false,
        verification_tier INTEGER DEFAULT 0,
        trust_score DECIMAL(3,2) DEFAULT 0.00,
        reputation_score INTEGER DEFAULT 0,
        total_transactions INTEGER DEFAULT 0,
        total_earnings DECIMAL(10,2) DEFAULT 0.00,
        is_subscribed BOOLEAN DEFAULT false,
        subscription_tier VARCHAR(50) DEFAULT 'free',
        subscription_expires_at TIMESTAMP,
        subscription_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created/updated');

    // Create countries table
    await query(`
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        code VARCHAR(2) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        flag VARCHAR(10),
        currency VARCHAR(3) NOT NULL,
        currency_symbol VARCHAR(5),
        timezone VARCHAR(50),
        phone_code VARCHAR(10),
        paystack_support BOOLEAN DEFAULT false,
        crypto_platforms JSONB,
        local_banks BOOLEAN DEFAULT false,
        mobile_money BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Countries table created');

    // Create service_categories table
    await query(`
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
    `);
    console.log('✅ Service categories table created');

    // Insert default service categories
    await query(`
      INSERT INTO service_categories (name, display_name, description, base_price) VALUES
      ('long_term', 'Long Term Escort', 'Professional long-term escort services', 250.00),
      ('short_term', 'Short Term Escort', 'Professional short-term escort services', 180.00),
      ('oral_services', 'Oral Services', 'Professional oral services', 120.00),
      ('special_services', 'Premium Services', 'Exclusive high-end escort services', 500.00)
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('✅ Default service categories inserted');

    // Create services table
    await query(`
      CREATE TABLE IF NOT EXISTS services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID REFERENCES users(id) ON DELETE CASCADE,
        category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        duration_minutes INTEGER,
        location_type VARCHAR(50) DEFAULT 'local',
        location_data JSONB DEFAULT '{}',
        availability JSONB DEFAULT '[]',
        requirements JSONB DEFAULT '[]',
        media_urls JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'active',
        views INTEGER DEFAULT 0,
        bookings INTEGER DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Services table created');

    // Create transactions table with country fields
    await query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        service_id UUID REFERENCES services(id) ON DELETE SET NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_intent_id VARCHAR(255),
        reference VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        country_code VARCHAR(2),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP,
        completed_at TIMESTAMP
      );
    `);
    console.log('✅ Transactions table created');

    // Create escrow table
    await query(`
      CREATE TABLE IF NOT EXISTS escrow (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
        buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        release_conditions JSONB,
        dispute_details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        released_at TIMESTAMP,
        disputed_at TIMESTAMP
      );
    `);
    console.log('✅ Escrow table created');

    // Create reviews table
    await query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        reviewed_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        service_id UUID REFERENCES services(id) ON DELETE SET NULL,
        transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Reviews table created');

    // Create verification table
    await query(`
      CREATE TABLE IF NOT EXISTS verification (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        documents JSONB,
        verification_data JSONB,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Verification table created');

    // Create chat_rooms table
    await query(`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100),
        type VARCHAR(20) DEFAULT 'private',
        participants JSONB,
        last_message_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Chat rooms table created');

    // Create user_connections table for contact requests and connections
    await query(`
      CREATE TABLE IF NOT EXISTS user_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        connection_type VARCHAR(50) NOT NULL DEFAULT 'contact_request',
        message TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_user_id, to_user_id)
      );
    `);
    console.log('✅ User connections table created');

    // Create blocked_users table
    await query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
        blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id)
      );
    `);
    console.log('✅ Blocked users table created');

    // Create notifications table
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Notifications table created');

    // Create enhanced conversations table with status
    await query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        participant1_id UUID REFERENCES users(id) ON DELETE CASCADE,
        participant2_id UUID REFERENCES users(id) ON DELETE CASCADE,
        last_message TEXT,
        last_message_time TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(participant1_id, participant2_id)
      );
    `);
    console.log('✅ Enhanced conversations table created');

    // Create enhanced messages table with metadata
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text',
        metadata JSONB,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Enhanced messages table created');

    // Create file_uploads table for better file management
    await query(`
      CREATE TABLE IF NOT EXISTS file_uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        service_id UUID REFERENCES services(id) ON DELETE SET NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        upload_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ File uploads table created');

    // Create indexes for better performance
    await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    // await query(`CREATE INDEX IF NOT EXISTS idx_users_country ON users(country_preference);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_services_location ON services USING GIN(location_data);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant1_id, participant2_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_connections_users ON user_connections(from_user_id, to_user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads(user_id, upload_type);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_blocked_users ON blocked_users(blocker_id, blocked_id);`);

    console.log('✅ Database indexes created');

    // Insert default country data
    const countries = [
      {
        code: 'NG',
        name: 'Nigeria',
        flag: '🇳🇬',
        currency: 'NGN',
        currencySymbol: '₦',
        timezone: 'Africa/Lagos',
        phoneCode: '+234',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
        localBanks: true,
        mobileMoney: false
      },
      {
        code: 'GH',
        name: 'Ghana',
        flag: '🇬🇭',
        currency: 'GHS',
        currencySymbol: '₵',
        timezone: 'Africa/Accra',
        phoneCode: '+233',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno', 'bitnob'],
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'KE',
        name: 'Kenya',
        flag: '🇰🇪',
        currency: 'KES',
        currencySymbol: 'KSh',
        timezone: 'Africa/Nairobi',
        phoneCode: '+254',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno', 'pesaflow'],
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'ZA',
        name: 'South Africa',
        flag: '🇿🇦',
        currency: 'ZAR',
        currencySymbol: 'R',
        timezone: 'Africa/Johannesburg',
        phoneCode: '+27',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno', 'valr'],
        localBanks: true,
        mobileMoney: false
      },
      {
        code: 'UG',
        name: 'Uganda',
        flag: '🇺🇬',
        currency: 'UGX',
        currencySymbol: 'USh',
        timezone: 'Africa/Kampala',
        phoneCode: '+256',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'TZ',
        name: 'Tanzania',
        flag: '🇹🇿',
        currency: 'TZS',
        currencySymbol: 'TSh',
        timezone: 'Africa/Dar_es_Salaam',
        phoneCode: '+255',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'RW',
        name: 'Rwanda',
        flag: '🇷🇼',
        currency: 'RWF',
        currencySymbol: 'FRw',
        timezone: 'Africa/Kigali',
        phoneCode: '+250',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'BW',
        name: 'Botswana',
        flag: '🇧🇼',
        currency: 'BWP',
        currencySymbol: 'P',
        timezone: 'Africa/Gaborone',
        phoneCode: '+267',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
        localBanks: true,
        mobileMoney: false
      },
      {
        code: 'ZM',
        name: 'Zambia',
        flag: '🇿🇲',
        currency: 'ZMW',
        currencySymbol: 'ZK',
        timezone: 'Africa/Lusaka',
        phoneCode: '+260',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'MW',
        name: 'Malawi',
        flag: '🇲🇼',
        currency: 'MWK',
        currencySymbol: 'MK',
        timezone: 'Africa/Blantyre',
        phoneCode: '+265',
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
        localBanks: true,
        mobileMoney: true
      }
    ];

    for (const country of countries) {
      await query(`
        INSERT INTO countries (
          code, name, flag, currency, currency_symbol, timezone, 
          phone_code, paystack_support, crypto_platforms, 
          local_banks, mobile_money
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          flag = EXCLUDED.flag,
          currency = EXCLUDED.currency,
          currency_symbol = EXCLUDED.currency_symbol,
          timezone = EXCLUDED.timezone,
          phone_code = EXCLUDED.phone_code,
          paystack_support = EXCLUDED.paystack_support,
          crypto_platforms = EXCLUDED.crypto_platforms,
          local_banks = EXCLUDED.local_banks,
          mobile_money = EXCLUDED.mobile_money,
          updated_at = CURRENT_TIMESTAMP
      `, [
        country.code,
        country.name,
        country.flag,
        country.currency,
        country.currencySymbol,
        country.timezone,
        country.phoneCode,
        country.paystackSupport,
        JSON.stringify(country.cryptoPlatforms),
        country.localBanks,
        country.mobileMoney
      ]);
    }

    console.log('✅ Country data populated');

    // Create subscription plans table
    await query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_name VARCHAR(100) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        features JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Subscription plans table created');

    // Create subscriptions table
    await query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        country_code VARCHAR(2),
        paystack_reference VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        activated_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Subscriptions table created');

    // Create user notifications table
    await query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT,
        is_read BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User notifications table created');

    // Insert default subscription plan
    await query(`
      INSERT INTO subscription_plans (
        plan_name, description, price, currency, features
      ) VALUES (
        'Basic Access',
        'Full access to the Zerohook platform',
        20.00,
        'USD',
        '["Full platform access", "Browse services", "Create services", "Secure messaging", "Trust system", "24/7 support"]'
      ) ON CONFLICT (plan_name) DO NOTHING;
    `);
    console.log('✅ Default subscription plan created');

    console.log('🎉 Database setup completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();