/**
 * LocationVerificationService
 * 
 * Detects when users change their physical location and prompts them to update their profile.
 * Also provides coordinate lookups for cities when users don't have GPS.
 */

class LocationVerificationService {
  constructor() {
    // Distance threshold (in km) to trigger location change prompt
    this.locationChangeThreshold = 50; // 50km
    
    // How often to check for location changes (in hours)
    this.checkInterval = 24; // Check once per day
    
    // Comprehensive city coordinates for all supported African countries
    // Format: { countryCode: { cityName: { lat, lng, population, timezone } } }
    this.cityCoordinates = {
      // ========== GHANA (GH) ==========
      GH: {
        'Accra': { lat: 5.6037, lng: -0.1870, population: 2291352, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'East Legon': { lat: 5.6350, lng: -0.1580, population: 150000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Osu': { lat: 5.5560, lng: -0.1870, population: 100000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Airport Residential': { lat: 5.6050, lng: -0.1700, population: 50000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Tema': { lat: 5.6698, lng: -0.0166, population: 402637, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Madina': { lat: 5.6830, lng: -0.1640, population: 137162, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Kumasi': { lat: 6.6885, lng: -1.6244, population: 1468609, timezone: 'Africa/Accra', region: 'Ashanti' },
        'Tamale': { lat: 9.4008, lng: -0.8393, population: 360579, timezone: 'Africa/Accra', region: 'Northern' },
        'Takoradi': { lat: 4.8845, lng: -1.7554, population: 232919, timezone: 'Africa/Accra', region: 'Western' },
        'Sekondi': { lat: 4.9340, lng: -1.7137, population: 138872, timezone: 'Africa/Accra', region: 'Western' },
        'Cape Coast': { lat: 5.1054, lng: -1.2466, population: 143015, timezone: 'Africa/Accra', region: 'Central' },
        'Koforidua': { lat: 6.0941, lng: -0.2612, population: 120553, timezone: 'Africa/Accra', region: 'Eastern' },
        'Sunyani': { lat: 7.3390, lng: -2.3268, population: 74240, timezone: 'Africa/Accra', region: 'Bono' },
        'Ho': { lat: 6.6113, lng: 0.4703, population: 96167, timezone: 'Africa/Accra', region: 'Volta' },
        'Bolgatanga': { lat: 10.7855, lng: -0.8514, population: 66685, timezone: 'Africa/Accra', region: 'Upper East' },
        'Wa': { lat: 10.0601, lng: -2.5099, population: 71051, timezone: 'Africa/Accra', region: 'Upper West' },
        'Techiman': { lat: 7.5908, lng: -1.9344, population: 104212, timezone: 'Africa/Accra', region: 'Bono East' },
        'Kasoa': { lat: 5.5344, lng: -0.4169, population: 69384, timezone: 'Africa/Accra', region: 'Central' },
        'Nungua': { lat: 5.5900, lng: -0.0700, population: 75000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Teshie': { lat: 5.5850, lng: -0.1000, population: 95000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Labadi': { lat: 5.5620, lng: -0.1470, population: 40000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Dansoman': { lat: 5.5380, lng: -0.2620, population: 85000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Cantonments': { lat: 5.5750, lng: -0.1780, population: 30000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Labone': { lat: 5.5720, lng: -0.1680, population: 25000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Spintex': { lat: 5.6330, lng: -0.0860, population: 60000, timezone: 'Africa/Accra', region: 'Greater Accra' },
        'Achimota': { lat: 5.6180, lng: -0.2280, population: 70000, timezone: 'Africa/Accra', region: 'Greater Accra' }
      },

      // ========== NIGERIA (NG) ==========
      NG: {
        'Lagos': { lat: 6.5244, lng: 3.3792, population: 14862111, timezone: 'Africa/Lagos', region: 'Lagos' },
        'Ikeja': { lat: 6.6018, lng: 3.3515, population: 313196, timezone: 'Africa/Lagos', region: 'Lagos' },
        'Victoria Island': { lat: 6.4281, lng: 3.4219, population: 250000, timezone: 'Africa/Lagos', region: 'Lagos' },
        'Lekki': { lat: 6.4698, lng: 3.5852, population: 500000, timezone: 'Africa/Lagos', region: 'Lagos' },
        'Ikoyi': { lat: 6.4535, lng: 3.4371, population: 150000, timezone: 'Africa/Lagos', region: 'Lagos' },
        'Yaba': { lat: 6.5158, lng: 3.3761, population: 200000, timezone: 'Africa/Lagos', region: 'Lagos' },
        'Surulere': { lat: 6.5028, lng: 3.3570, population: 300000, timezone: 'Africa/Lagos', region: 'Lagos' },
        'Ajah': { lat: 6.4667, lng: 3.5833, population: 200000, timezone: 'Africa/Lagos', region: 'Lagos' },
        'Abuja': { lat: 9.0579, lng: 7.4951, population: 1235880, timezone: 'Africa/Lagos', region: 'FCT' },
        'Wuse': { lat: 9.0765, lng: 7.4717, population: 200000, timezone: 'Africa/Lagos', region: 'FCT' },
        'Garki': { lat: 9.0380, lng: 7.4890, population: 150000, timezone: 'Africa/Lagos', region: 'FCT' },
        'Maitama': { lat: 9.0820, lng: 7.5010, population: 80000, timezone: 'Africa/Lagos', region: 'FCT' },
        'Kano': { lat: 12.0022, lng: 8.5920, population: 3626068, timezone: 'Africa/Lagos', region: 'Kano' },
        'Ibadan': { lat: 7.3775, lng: 3.9470, population: 3565108, timezone: 'Africa/Lagos', region: 'Oyo' },
        'Port Harcourt': { lat: 4.8156, lng: 7.0498, population: 1865000, timezone: 'Africa/Lagos', region: 'Rivers' },
        'Benin City': { lat: 6.3350, lng: 5.6037, population: 1495800, timezone: 'Africa/Lagos', region: 'Edo' },
        'Kaduna': { lat: 10.5222, lng: 7.4383, population: 760084, timezone: 'Africa/Lagos', region: 'Kaduna' },
        'Enugu': { lat: 6.4483, lng: 7.5139, population: 722664, timezone: 'Africa/Lagos', region: 'Enugu' },
        'Owerri': { lat: 5.4836, lng: 7.0333, population: 401873, timezone: 'Africa/Lagos', region: 'Imo' },
        'Warri': { lat: 5.5167, lng: 5.7500, population: 536023, timezone: 'Africa/Lagos', region: 'Delta' },
        'Calabar': { lat: 4.9517, lng: 8.3220, population: 461796, timezone: 'Africa/Lagos', region: 'Cross River' },
        'Uyo': { lat: 5.0500, lng: 7.9333, population: 436606, timezone: 'Africa/Lagos', region: 'Akwa Ibom' },
        'Abeokuta': { lat: 7.1475, lng: 3.3619, population: 449088, timezone: 'Africa/Lagos', region: 'Ogun' },
        'Jos': { lat: 9.8965, lng: 8.8583, population: 816824, timezone: 'Africa/Lagos', region: 'Plateau' },
        'Ilorin': { lat: 8.4799, lng: 4.5418, population: 908490, timezone: 'Africa/Lagos', region: 'Kwara' }
      },

      // ========== KENYA (KE) ==========
      KE: {
        'Nairobi': { lat: -1.2921, lng: 36.8219, population: 4397073, timezone: 'Africa/Nairobi', region: 'Nairobi' },
        'Westlands': { lat: -1.2676, lng: 36.8119, population: 150000, timezone: 'Africa/Nairobi', region: 'Nairobi' },
        'Karen': { lat: -1.3159, lng: 36.7128, population: 60000, timezone: 'Africa/Nairobi', region: 'Nairobi' },
        'Kilimani': { lat: -1.2889, lng: 36.7869, population: 100000, timezone: 'Africa/Nairobi', region: 'Nairobi' },
        'Lavington': { lat: -1.2807, lng: 36.7682, population: 50000, timezone: 'Africa/Nairobi', region: 'Nairobi' },
        'Mombasa': { lat: -4.0435, lng: 39.6682, population: 1208333, timezone: 'Africa/Nairobi', region: 'Coast' },
        'Nyali': { lat: -4.0317, lng: 39.7044, population: 80000, timezone: 'Africa/Nairobi', region: 'Coast' },
        'Kisumu': { lat: -0.1022, lng: 34.7617, population: 409928, timezone: 'Africa/Nairobi', region: 'Kisumu' },
        'Nakuru': { lat: -0.3031, lng: 36.0800, population: 367183, timezone: 'Africa/Nairobi', region: 'Nakuru' },
        'Eldoret': { lat: 0.5143, lng: 35.2698, population: 289380, timezone: 'Africa/Nairobi', region: 'Uasin Gishu' },
        'Thika': { lat: -1.0334, lng: 37.0690, population: 139853, timezone: 'Africa/Nairobi', region: 'Kiambu' },
        'Malindi': { lat: -3.2138, lng: 40.1169, population: 119859, timezone: 'Africa/Nairobi', region: 'Kilifi' },
        'Kitale': { lat: 1.0157, lng: 35.0062, population: 106187, timezone: 'Africa/Nairobi', region: 'Trans-Nzoia' },
        'Machakos': { lat: -1.5177, lng: 37.2634, population: 114109, timezone: 'Africa/Nairobi', region: 'Machakos' },
        'Meru': { lat: 0.0500, lng: 37.6500, population: 59687, timezone: 'Africa/Nairobi', region: 'Meru' }
      },

      // ========== SOUTH AFRICA (ZA) ==========
      ZA: {
        'Johannesburg': { lat: -26.2041, lng: 28.0473, population: 5635127, timezone: 'Africa/Johannesburg', region: 'Gauteng' },
        'Sandton': { lat: -26.1076, lng: 28.0567, population: 222415, timezone: 'Africa/Johannesburg', region: 'Gauteng' },
        'Rosebank': { lat: -26.1455, lng: 28.0405, population: 50000, timezone: 'Africa/Johannesburg', region: 'Gauteng' },
        'Soweto': { lat: -26.2678, lng: 27.8585, population: 1271628, timezone: 'Africa/Johannesburg', region: 'Gauteng' },
        'Cape Town': { lat: -33.9249, lng: 18.4241, population: 4617560, timezone: 'Africa/Johannesburg', region: 'Western Cape' },
        'Sea Point': { lat: -33.9173, lng: 18.3861, population: 30000, timezone: 'Africa/Johannesburg', region: 'Western Cape' },
        'Camps Bay': { lat: -33.9505, lng: 18.3779, population: 10000, timezone: 'Africa/Johannesburg', region: 'Western Cape' },
        'Durban': { lat: -29.8587, lng: 31.0218, population: 3720953, timezone: 'Africa/Johannesburg', region: 'KwaZulu-Natal' },
        'Umhlanga': { lat: -29.7308, lng: 31.0853, population: 100000, timezone: 'Africa/Johannesburg', region: 'KwaZulu-Natal' },
        'Pretoria': { lat: -25.7461, lng: 28.1881, population: 2921488, timezone: 'Africa/Johannesburg', region: 'Gauteng' },
        'Port Elizabeth': { lat: -33.9608, lng: 25.6022, population: 1152115, timezone: 'Africa/Johannesburg', region: 'Eastern Cape' },
        'Bloemfontein': { lat: -29.0852, lng: 26.1596, population: 463064, timezone: 'Africa/Johannesburg', region: 'Free State' },
        'East London': { lat: -33.0153, lng: 27.9116, population: 478676, timezone: 'Africa/Johannesburg', region: 'Eastern Cape' },
        'Kimberley': { lat: -28.7323, lng: 24.7621, population: 225152, timezone: 'Africa/Johannesburg', region: 'Northern Cape' },
        'Polokwane': { lat: -23.9045, lng: 29.4688, population: 628999, timezone: 'Africa/Johannesburg', region: 'Limpopo' }
      },

      // ========== UGANDA (UG) ==========
      UG: {
        'Kampala': { lat: 0.3476, lng: 32.5825, population: 1507080, timezone: 'Africa/Kampala', region: 'Central' },
        'Kololo': { lat: 0.3336, lng: 32.5892, population: 50000, timezone: 'Africa/Kampala', region: 'Central' },
        'Nakasero': { lat: 0.3189, lng: 32.5849, population: 30000, timezone: 'Africa/Kampala', region: 'Central' },
        'Ntinda': { lat: 0.3567, lng: 32.6144, population: 80000, timezone: 'Africa/Kampala', region: 'Central' },
        'Gulu': { lat: 2.7746, lng: 32.2990, population: 146858, timezone: 'Africa/Kampala', region: 'Northern' },
        'Lira': { lat: 2.2499, lng: 32.8998, population: 108238, timezone: 'Africa/Kampala', region: 'Northern' },
        'Mbarara': { lat: -0.6046, lng: 30.6545, population: 195013, timezone: 'Africa/Kampala', region: 'Western' },
        'Jinja': { lat: 0.4244, lng: 33.2041, population: 72931, timezone: 'Africa/Kampala', region: 'Eastern' },
        'Entebbe': { lat: 0.0512, lng: 32.4637, population: 69958, timezone: 'Africa/Kampala', region: 'Central' },
        'Mbale': { lat: 1.0647, lng: 34.1797, population: 92864, timezone: 'Africa/Kampala', region: 'Eastern' },
        'Masaka': { lat: -0.3341, lng: 31.7361, population: 74085, timezone: 'Africa/Kampala', region: 'Central' },
        'Soroti': { lat: 1.7140, lng: 33.6111, population: 48000, timezone: 'Africa/Kampala', region: 'Eastern' }
      },

      // ========== TANZANIA (TZ) ==========
      TZ: {
        'Dar es Salaam': { lat: -6.7924, lng: 39.2083, population: 6368000, timezone: 'Africa/Dar_es_Salaam', region: 'Dar es Salaam' },
        'Masaki': { lat: -6.7600, lng: 39.2800, population: 30000, timezone: 'Africa/Dar_es_Salaam', region: 'Dar es Salaam' },
        'Oyster Bay': { lat: -6.7700, lng: 39.2700, population: 25000, timezone: 'Africa/Dar_es_Salaam', region: 'Dar es Salaam' },
        'Dodoma': { lat: -6.1630, lng: 35.7516, population: 410956, timezone: 'Africa/Dar_es_Salaam', region: 'Dodoma' },
        'Mwanza': { lat: -2.5164, lng: 32.9175, population: 706453, timezone: 'Africa/Dar_es_Salaam', region: 'Mwanza' },
        'Arusha': { lat: -3.3869, lng: 36.6830, population: 416442, timezone: 'Africa/Dar_es_Salaam', region: 'Arusha' },
        'Mbeya': { lat: -8.9000, lng: 33.4500, population: 385279, timezone: 'Africa/Dar_es_Salaam', region: 'Mbeya' },
        'Zanzibar': { lat: -6.1659, lng: 39.1989, population: 501459, timezone: 'Africa/Dar_es_Salaam', region: 'Zanzibar' },
        'Tanga': { lat: -5.0689, lng: 39.0992, population: 273332, timezone: 'Africa/Dar_es_Salaam', region: 'Tanga' },
        'Morogoro': { lat: -6.8211, lng: 37.6700, population: 315866, timezone: 'Africa/Dar_es_Salaam', region: 'Morogoro' },
        'Kigoma': { lat: -4.8769, lng: 29.6267, population: 135234, timezone: 'Africa/Dar_es_Salaam', region: 'Kigoma' }
      },

      // ========== RWANDA (RW) ==========
      RW: {
        'Kigali': { lat: -1.9403, lng: 30.0588, population: 1132686, timezone: 'Africa/Kigali', region: 'Kigali' },
        'Nyarutarama': { lat: -1.9350, lng: 30.1100, population: 20000, timezone: 'Africa/Kigali', region: 'Kigali' },
        'Kimihurura': { lat: -1.9450, lng: 30.0850, population: 25000, timezone: 'Africa/Kigali', region: 'Kigali' },
        'Butare': { lat: -2.5975, lng: 29.7392, population: 89600, timezone: 'Africa/Kigali', region: 'Southern' },
        'Gitarama': { lat: -2.0728, lng: 29.7578, population: 87613, timezone: 'Africa/Kigali', region: 'Southern' },
        'Gisenyi': { lat: -1.7031, lng: 29.2578, population: 83623, timezone: 'Africa/Kigali', region: 'Western' },
        'Ruhengeri': { lat: -1.4997, lng: 29.6350, population: 86685, timezone: 'Africa/Kigali', region: 'Northern' },
        'Byumba': { lat: -1.5775, lng: 30.0703, population: 70593, timezone: 'Africa/Kigali', region: 'Northern' },
        'Cyangugu': { lat: -2.4844, lng: 28.9075, population: 63883, timezone: 'Africa/Kigali', region: 'Western' }
      },

      // ========== BOTSWANA (BW) ==========
      BW: {
        'Gaborone': { lat: -24.6282, lng: 25.9231, population: 231626, timezone: 'Africa/Gaborone', region: 'South-East' },
        'Francistown': { lat: -21.1667, lng: 27.5000, population: 98961, timezone: 'Africa/Gaborone', region: 'North-East' },
        'Molepolole': { lat: -24.4067, lng: 25.4950, population: 66466, timezone: 'Africa/Gaborone', region: 'Kweneng' },
        'Maun': { lat: -20.0000, lng: 23.4167, population: 55784, timezone: 'Africa/Gaborone', region: 'North-West' },
        'Serowe': { lat: -22.3833, lng: 26.7167, population: 50820, timezone: 'Africa/Gaborone', region: 'Central' },
        'Kanye': { lat: -24.9667, lng: 25.3333, population: 47007, timezone: 'Africa/Gaborone', region: 'Southern' },
        'Selebi-Phikwe': { lat: -21.9833, lng: 27.8333, population: 49849, timezone: 'Africa/Gaborone', region: 'Central' },
        'Kasane': { lat: -17.8000, lng: 25.1500, population: 10000, timezone: 'Africa/Gaborone', region: 'North-West' }
      },

      // ========== ZAMBIA (ZM) ==========
      ZM: {
        'Lusaka': { lat: -15.3875, lng: 28.3228, population: 2330200, timezone: 'Africa/Lusaka', region: 'Lusaka' },
        'Kabulonga': { lat: -15.4200, lng: 28.3100, population: 50000, timezone: 'Africa/Lusaka', region: 'Lusaka' },
        'Kitwe': { lat: -12.8024, lng: 28.2132, population: 517543, timezone: 'Africa/Lusaka', region: 'Copperbelt' },
        'Ndola': { lat: -12.9587, lng: 28.6366, population: 475194, timezone: 'Africa/Lusaka', region: 'Copperbelt' },
        'Kabwe': { lat: -14.4469, lng: 28.4464, population: 202914, timezone: 'Africa/Lusaka', region: 'Central' },
        'Chingola': { lat: -12.5297, lng: 27.8533, population: 147448, timezone: 'Africa/Lusaka', region: 'Copperbelt' },
        'Mufulira': { lat: -12.5494, lng: 28.2402, population: 120444, timezone: 'Africa/Lusaka', region: 'Copperbelt' },
        'Livingstone': { lat: -17.8419, lng: 25.8544, population: 109203, timezone: 'Africa/Lusaka', region: 'Southern' },
        'Luanshya': { lat: -13.1367, lng: 28.4167, population: 113365, timezone: 'Africa/Lusaka', region: 'Copperbelt' }
      },

      // ========== MALAWI (MW) ==========
      MW: {
        'Lilongwe': { lat: -13.9626, lng: 33.7741, population: 989318, timezone: 'Africa/Blantyre', region: 'Central' },
        'Area 47': { lat: -13.9400, lng: 33.7500, population: 30000, timezone: 'Africa/Blantyre', region: 'Central' },
        'Blantyre': { lat: -15.7861, lng: 35.0058, population: 800264, timezone: 'Africa/Blantyre', region: 'Southern' },
        'Mzuzu': { lat: -11.4658, lng: 34.0218, population: 221272, timezone: 'Africa/Blantyre', region: 'Northern' },
        'Zomba': { lat: -15.3833, lng: 35.3167, population: 105013, timezone: 'Africa/Blantyre', region: 'Southern' },
        'Kasungu': { lat: -13.0333, lng: 33.4833, population: 42555, timezone: 'Africa/Blantyre', region: 'Central' },
        'Mangochi': { lat: -14.4833, lng: 35.2667, population: 40000, timezone: 'Africa/Blantyre', region: 'Southern' },
        'Karonga': { lat: -9.9333, lng: 33.9333, population: 41704, timezone: 'Africa/Blantyre', region: 'Northern' }
      }
    };

    // Country capitals for fallback
    this.countryCapitals = {
      GH: 'Accra',
      NG: 'Lagos', // Using Lagos as de facto capital (most populous)
      KE: 'Nairobi',
      ZA: 'Johannesburg', // Using Johannesburg (most populous)
      UG: 'Kampala',
      TZ: 'Dar es Salaam',
      RW: 'Kigali',
      BW: 'Gaborone',
      ZM: 'Lusaka',
      MW: 'Lilongwe'
    };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {number} lat1 - Latitude of point 1
   * @param {number} lng1 - Longitude of point 1
   * @param {number} lat2 - Latitude of point 2
   * @param {number} lng2 - Longitude of point 2
   * @returns {number} Distance in kilometers
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get coordinates for a city
   * @param {string} cityName - Name of the city
   * @param {string} countryCode - Country code (e.g., 'GH', 'NG')
   * @returns {Object|null} Coordinates object or null
   */
  getCityCoordinates(cityName, countryCode) {
    if (!cityName || !countryCode) return null;

    const country = this.cityCoordinates[countryCode.toUpperCase()];
    if (!country) return null;

    // Try exact match first
    const normalizedCity = cityName.trim();
    if (country[normalizedCity]) {
      return { ...country[normalizedCity], city: normalizedCity, country: countryCode };
    }

    // Try case-insensitive match
    const lowerCity = normalizedCity.toLowerCase();
    for (const [city, coords] of Object.entries(country)) {
      if (city.toLowerCase() === lowerCity) {
        return { ...coords, city, country: countryCode };
      }
    }

    // Try partial match (city contains or is contained in search term)
    for (const [city, coords] of Object.entries(country)) {
      if (city.toLowerCase().includes(lowerCity) || lowerCity.includes(city.toLowerCase())) {
        return { ...coords, city, country: countryCode };
      }
    }

    return null;
  }

  /**
   * Get capital city coordinates as fallback
   * @param {string} countryCode - Country code
   * @returns {Object|null} Coordinates of capital city
   */
  getCapitalCoordinates(countryCode) {
    if (!countryCode) return null;

    const code = countryCode.toUpperCase();
    const capitalName = this.countryCapitals[code];
    if (!capitalName) return null;

    return this.getCityCoordinates(capitalName, code);
  }

  /**
   * Find nearest city to given coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} countryCode - Optional country code to limit search
   * @returns {Object} Nearest city info
   */
  findNearestCity(lat, lng, countryCode = null) {
    let nearestCity = null;
    let minDistance = Infinity;

    const countriesToSearch = countryCode
      ? [countryCode.toUpperCase()]
      : Object.keys(this.cityCoordinates);

    for (const code of countriesToSearch) {
      const cities = this.cityCoordinates[code];
      if (!cities) continue;

      for (const [cityName, coords] of Object.entries(cities)) {
        const distance = this.calculateDistance(lat, lng, coords.lat, coords.lng);
        if (distance < minDistance) {
          minDistance = distance;
          nearestCity = {
            city: cityName,
            country: code,
            distance: Math.round(distance * 10) / 10,
            ...coords
          };
        }
      }
    }

    return nearestCity;
  }

  /**
   * Check if user's current location differs significantly from stored location
   * @param {Object} currentLocation - Current GPS location {lat, lng}
   * @param {Object} storedLocation - Stored profile location
   * @returns {Object} Location change detection result
   */
  detectLocationChange(currentLocation, storedLocation) {
    if (!currentLocation || !currentLocation.lat || !currentLocation.lng) {
      return { changed: false, reason: 'No current location available' };
    }

    // Extract stored coordinates
    let storedLat, storedLng;
    
    if (storedLocation?.coordinates) {
      if (storedLocation.coordinates.lat && storedLocation.coordinates.lng) {
        storedLat = storedLocation.coordinates.lat;
        storedLng = storedLocation.coordinates.lng;
      } else if (Array.isArray(storedLocation.coordinates)) {
        [storedLng, storedLat] = storedLocation.coordinates;
      }
    }

    if (!storedLat || !storedLng) {
      // No stored coordinates - try to get from city name
      if (storedLocation?.city && storedLocation?.country) {
        const cityCoords = this.getCityCoordinates(storedLocation.city, storedLocation.country);
        if (cityCoords) {
          storedLat = cityCoords.lat;
          storedLng = cityCoords.lng;
        }
      }
    }

    if (!storedLat || !storedLng) {
      return { 
        changed: true, 
        reason: 'No stored location - please set your location',
        shouldPrompt: true,
        promptType: 'initial_setup'
      };
    }

    const distance = this.calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      storedLat,
      storedLng
    );

    const nearestCity = this.findNearestCity(currentLocation.lat, currentLocation.lng);
    const storedCity = storedLocation?.city || 'Unknown';

    if (distance > this.locationChangeThreshold) {
      return {
        changed: true,
        distance: Math.round(distance),
        previousLocation: {
          lat: storedLat,
          lng: storedLng,
          city: storedCity
        },
        currentLocation: {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          nearestCity: nearestCity?.city,
          country: nearestCity?.country
        },
        reason: `You appear to be ${Math.round(distance)}km away from your profile location`,
        shouldPrompt: true,
        promptType: 'location_change',
        suggestedCity: nearestCity?.city,
        suggestedCountry: nearestCity?.country
      };
    }

    return { 
      changed: false, 
      distance: Math.round(distance),
      reason: 'Location matches profile'
    };
  }

  /**
   * Assign fallback coordinates to a user profile
   * @param {Object} user - User document
   * @returns {Object} Updated location with coordinates
   */
  assignFallbackCoordinates(user) {
    const profileData = user.profile_data || {};
    const location = profileData.location || {};

    // If user already has valid coordinates, return them
    if (location.coordinates?.lat && location.coordinates?.lng) {
      return {
        source: 'existing',
        coordinates: location.coordinates,
        city: location.city,
        country: location.country
      };
    }

    // Try to get coordinates from city name
    if (location.city && location.country) {
      const cityCoords = this.getCityCoordinates(location.city, location.country);
      if (cityCoords) {
        return {
          source: 'city_lookup',
          coordinates: { lat: cityCoords.lat, lng: cityCoords.lng },
          city: cityCoords.city,
          country: location.country,
          quality: 'medium'
        };
      }
    }

    // Try country code at root level
    const countryCode = location.country || user.country || user.countryCode;
    if (countryCode) {
      const capitalCoords = this.getCapitalCoordinates(countryCode);
      if (capitalCoords) {
        return {
          source: 'capital_fallback',
          coordinates: { lat: capitalCoords.lat, lng: capitalCoords.lng },
          city: capitalCoords.city,
          country: countryCode,
          quality: 'low',
          note: 'Using capital city as fallback'
        };
      }
    }

    // No location data available
    return {
      source: 'none',
      coordinates: null,
      quality: 'none',
      note: 'No location data available'
    };
  }

  /**
   * Get all cities for a country (for dropdown/autocomplete)
   * @param {string} countryCode - Country code
   * @returns {Array} Array of city objects
   */
  getCitiesForCountry(countryCode) {
    if (!countryCode) return [];

    const cities = this.cityCoordinates[countryCode.toUpperCase()];
    if (!cities) return [];

    return Object.entries(cities)
      .map(([name, data]) => ({
        name,
        lat: data.lat,
        lng: data.lng,
        population: data.population,
        region: data.region
      }))
      .sort((a, b) => (b.population || 0) - (a.population || 0));
  }

  /**
   * Get supported countries list
   * @returns {Array} Array of supported country codes
   */
  getSupportedCountries() {
    return Object.keys(this.cityCoordinates);
  }

  /**
   * Validate if a city exists in our database
   * @param {string} cityName - City name
   * @param {string} countryCode - Country code
   * @returns {boolean} True if city exists
   */
  isValidCity(cityName, countryCode) {
    return this.getCityCoordinates(cityName, countryCode) !== null;
  }
}

module.exports = LocationVerificationService;
