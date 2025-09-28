// Test User Configuration
// Add your actual test user credentials here
// These will be used by the automated tests

module.exports = {
  // Test users for authentication testing
  testUsers: [
    {
      email: 'emeka.uzoma@nigeria.com',
      password: 'EmekaPass123!',
      name: 'Emeka Uzoma',
      role: 'user'
    },
    // Add more test users as needed
    // {
    //   email: 'admin@example.com',
    //   password: 'adminpassword123',
    //   name: 'Admin User',
    //   role: 'admin'
    // }
  ],

  // Test service data
  testServices: [
    {
      title: 'Test Service 1',
      description: 'This is a test service description for automated testing',
      category: 'adult',
      price: 50.00
    },
    {
      title: 'Test Service 2', 
      description: 'Another test service for comprehensive testing',
      category: 'adult',
      price: 75.00
    }
  ],

  // Test profile data
  testProfiles: [
    {
      name: 'Test Profile 1',
      bio: 'This is a test profile bio for automated testing',
      location: 'Test City, Test Country'
    },
    {
      name: 'Test Profile 2',
      bio: 'Another test profile for comprehensive testing',
      location: 'Another Test City, Test Country'
    }
  ],

  // Test configuration
  testConfig: {
    timeouts: {
      navigation: 10000,    // 10 seconds for page navigation
      element: 5000,        // 5 seconds for element to appear
      action: 3000,         // 3 seconds for user actions
      api: 15000            // 15 seconds for API calls
    },
    
    // Test environment settings
    environment: {
      baseUrl: 'http://localhost:3000',
      apiUrl: 'http://localhost:5000',
      headless: false,      // Set to true for CI/CD
      slowMo: 1000          // Slow down actions for debugging
    }
  }
};
