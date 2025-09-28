// Enhanced locations for Ghana and Nigeria with more cities and features
export const LOCATIONS = {
  ghana: {
    name: 'Ghana',
    flag: '🇬🇭',
    cities: [
      { name: 'Accra', region: 'Greater Accra', coordinates: { lat: 5.5600, lng: -0.2057 }, population: '2.5M', popular: true },
      { name: 'Kumasi', region: 'Ashanti', coordinates: { lat: 6.6885, lng: -1.6244 }, population: '2.0M', popular: true },
      { name: 'Tamale', region: 'Northern', coordinates: { lat: 9.4035, lng: -0.8423 }, population: '950K', popular: true },
      { name: 'Cape Coast', region: 'Central', coordinates: { lat: 5.1313, lng: -1.2796 }, population: '170K', popular: false },
      { name: 'Sekondi-Takoradi', region: 'Western', coordinates: { lat: 4.9340, lng: -1.7137 }, population: '445K', popular: false },
      { name: 'Sunyani', region: 'Bono', coordinates: { lat: 7.3399, lng: -2.3263 }, population: '87K', popular: false },
      { name: 'Ho', region: 'Volta', coordinates: { lat: 6.6000, lng: 0.4667 }, population: '96K', popular: false },
      { name: 'Koforidua', region: 'Eastern', coordinates: { lat: 6.0944, lng: -0.2591 }, population: '120K', popular: false },
      { name: 'Wa', region: 'Upper West', coordinates: { lat: 10.0600, lng: -2.5000 }, population: '102K', popular: false },
      { name: 'Bolgatanga', region: 'Upper East', coordinates: { lat: 10.7856, lng: -0.8513 }, population: '66K', popular: false },
      { name: 'Tema', region: 'Greater Accra', coordinates: { lat: 5.6833, lng: -0.0167 }, population: '161K', popular: false },
      { name: 'Tarkwa', region: 'Western', coordinates: { lat: 5.3000, lng: -1.9833 }, population: '35K', popular: false },
      { name: 'Konongo', region: 'Ashanti', coordinates: { lat: 6.6167, lng: -1.2167 }, population: '41K', popular: false },
      { name: 'Obuasi', region: 'Ashanti', coordinates: { lat: 6.2000, lng: -1.6833 }, population: '168K', popular: false },
      { name: 'Techiman', region: 'Bono East', coordinates: { lat: 7.5833, lng: -1.9333 }, population: '79K', popular: false },
      { name: 'Kumawu', region: 'Ashanti', coordinates: { lat: 6.8500, lng: -1.4000 }, population: '28K', popular: false },
      { name: 'Ejisu', region: 'Ashanti', coordinates: { lat: 6.7167, lng: -1.3500 }, population: '32K', popular: false },
      { name: 'Mampong', region: 'Ashanti', coordinates: { lat: 7.0667, lng: -1.4000 }, population: '42K', popular: false },
      { name: 'Bekwai', region: 'Ashanti', coordinates: { lat: 6.4500, lng: -1.5833 }, population: '56K', popular: false },
      { name: 'Nkawkaw', region: 'Eastern', coordinates: { lat: 6.5500, lng: -0.7667 }, population: '61K', popular: false }
    ]
  },
  nigeria: {
    name: 'Nigeria',
    flag: '🇳🇬',
    states: [
      {
        name: 'Lagos',
        cities: [
          { name: 'Lagos Island', coordinates: { lat: 6.5244, lng: 3.3792 }, population: '2.5M', popular: true },
          { name: 'Victoria Island', coordinates: { lat: 6.4281, lng: 3.4219 }, population: '1.2M', popular: true },
          { name: 'Ikeja', coordinates: { lat: 6.6018, lng: 3.3515 }, population: '800K', popular: true },
          { name: 'Surulere', coordinates: { lat: 6.5000, lng: 3.3500 }, population: '500K', popular: false },
          { name: 'Yaba', coordinates: { lat: 6.5167, lng: 3.3833 }, population: '300K', popular: false },
          { name: 'Oshodi', coordinates: { lat: 6.5500, lng: 3.3333 }, population: '400K', popular: false },
          { name: 'Alimosho', coordinates: { lat: 6.6167, lng: 3.2833 }, population: '1.2M', popular: false },
          { name: 'Ikorodu', coordinates: { lat: 6.6167, lng: 3.5000 }, population: '600K', popular: false },
          { name: 'Lekki', coordinates: { lat: 6.4500, lng: 3.5667 }, population: '400K', popular: true },
          { name: 'Ajah', coordinates: { lat: 6.4500, lng: 3.6167 }, population: '300K', popular: false }
        ]
      },
      {
        name: 'Rivers',
        cities: [
          { name: 'Port Harcourt', coordinates: { lat: 4.8156, lng: 7.0498 }, population: '1.2M', popular: true },
          { name: 'Obio-Akpor', coordinates: { lat: 4.8500, lng: 7.0000 }, population: '600K', popular: false },
          { name: 'Okrika', coordinates: { lat: 4.7333, lng: 7.0833 }, population: '200K', popular: false },
          { name: 'Eleme', coordinates: { lat: 4.7000, lng: 7.1167 }, population: '150K', popular: false },
          { name: 'Bonny', coordinates: { lat: 4.4333, lng: 7.1667 }, population: '180K', popular: false }
        ]
      },
      {
        name: 'Kano',
        cities: [
          { name: 'Kano', coordinates: { lat: 11.9914, lng: 8.5317 }, population: '4.1M', popular: true },
          { name: 'Ungogo', coordinates: { lat: 11.9667, lng: 8.6000 }, population: '800K', popular: false },
          { name: 'Fagge', coordinates: { lat: 11.9833, lng: 8.5333 }, population: '600K', popular: false },
          { name: 'Dala', coordinates: { lat: 11.9833, lng: 8.5167 }, population: '500K', popular: false },
          { name: 'Tarauni', coordinates: { lat: 11.9500, lng: 8.5500 }, population: '400K', popular: false }
        ]
      },
      {
        name: 'Kaduna',
        cities: [
          { name: 'Kaduna', coordinates: { lat: 10.5222, lng: 7.4384 }, population: '1.6M', popular: true },
          { name: 'Zaria', coordinates: { lat: 11.1111, lng: 7.7222 }, population: '600K', popular: false },
          { name: 'Kafanchan', coordinates: { lat: 9.5833, lng: 8.3000 }, population: '200K', popular: false },
          { name: 'Kachia', coordinates: { lat: 9.9833, lng: 7.9500 }, population: '150K', popular: false }
        ]
      },
      {
        name: 'Ondo',
        cities: [
          { name: 'Akure', coordinates: { lat: 7.2500, lng: 5.2000 }, population: '500K', popular: true },
          { name: 'Ondo', coordinates: { lat: 7.1000, lng: 4.8333 }, population: '300K', popular: false },
          { name: 'Owo', coordinates: { lat: 7.2000, lng: 5.5833 }, population: '250K', popular: false },
          { name: 'Ikare', coordinates: { lat: 7.5167, lng: 5.7500 }, population: '200K', popular: false }
        ]
      },
      {
        name: 'Oyo',
        cities: [
          { name: 'Ibadan', coordinates: { lat: 7.3964, lng: 3.8967 }, population: '3.6M', popular: true },
          { name: 'Oyo', coordinates: { lat: 7.8500, lng: 3.9333 }, population: '400K', popular: false },
          { name: 'Ogbomoso', coordinates: { lat: 8.1333, lng: 4.2500 }, population: '800K', popular: false },
          { name: 'Iseyin', coordinates: { lat: 7.9667, lng: 3.6000 }, population: '300K', popular: false },
          { name: 'Saki', coordinates: { lat: 8.6667, lng: 3.3833 }, population: '250K', popular: false }
        ]
      },
      {
        name: 'Imo',
        cities: [
          { name: 'Owerri', coordinates: { lat: 5.4833, lng: 7.0333 }, population: '600K', popular: true },
          { name: 'Okigwe', coordinates: { lat: 5.8167, lng: 7.3500 }, population: '200K', popular: false },
          { name: 'Orlu', coordinates: { lat: 5.7833, lng: 7.0333 }, population: '250K', popular: false },
          { name: 'Mbaise', coordinates: { lat: 5.4000, lng: 7.1000 }, population: '300K', popular: false }
        ]
      },
      {
        name: 'Enugu',
        cities: [
          { name: 'Enugu', coordinates: { lat: 6.4500, lng: 7.5000 }, population: '800K', popular: true },
          { name: 'Nsukka', coordinates: { lat: 6.8667, lng: 7.3833 }, population: '400K', popular: false },
          { name: 'Awka', coordinates: { lat: 6.2000, lng: 7.0667 }, population: '300K', popular: false },
          { name: 'Abakaliki', coordinates: { lat: 6.3167, lng: 8.1000 }, population: '250K', popular: false }
        ]
      },
      {
        name: 'Anambra',
        cities: [
          { name: 'Awka', coordinates: { lat: 6.2000, lng: 7.0667 }, population: '300K', popular: true },
          { name: 'Onitsha', coordinates: { lat: 6.1667, lng: 6.7833 }, population: '1.1M', popular: true },
          { name: 'Nnewi', coordinates: { lat: 6.0167, lng: 6.9167 }, population: '400K', popular: false },
          { name: 'Ekwulobia', coordinates: { lat: 6.1500, lng: 7.0167 }, population: '200K', popular: false }
        ]
      },
      {
        name: 'Delta',
        cities: [
          { name: 'Asaba', coordinates: { lat: 6.1833, lng: 6.7500 }, population: '400K', popular: true },
          { name: 'Warri', coordinates: { lat: 5.5167, lng: 5.7500 }, population: '800K', popular: true },
          { name: 'Sapele', coordinates: { lat: 5.9000, lng: 5.6833 }, population: '300K', popular: false },
          { name: 'Ughelli', coordinates: { lat: 5.5000, lng: 6.0000 }, population: '250K', popular: false }
        ]
      },
      {
        name: 'Edo',
        cities: [
          { name: 'Benin City', coordinates: { lat: 6.3176, lng: 5.6145 }, population: '1.2M', popular: true },
          { name: 'Auchi', coordinates: { lat: 7.0667, lng: 6.2667 }, population: '300K', popular: false },
          { name: 'Ekpoma', coordinates: { lat: 6.7500, lng: 6.1333 }, population: '200K', popular: false },
          { name: 'Uromi', coordinates: { lat: 6.7000, lng: 6.3333 }, population: '150K', popular: false }
        ]
      },
      {
        name: 'Abuja (FCT)',
        cities: [
          { name: 'Abuja', coordinates: { lat: 9.0820, lng: 7.3981 }, population: '3.3M', popular: true },
          { name: 'Gwagwalada', coordinates: { lat: 8.9500, lng: 7.0833 }, population: '200K', popular: false },
          { name: 'Kuje', coordinates: { lat: 8.8833, lng: 7.2333 }, population: '150K', popular: false },
          { name: 'Abaji', coordinates: { lat: 8.9667, lng: 6.9500 }, population: '100K', popular: false }
        ]
      }
    ]
  }
};

// Enhanced helper functions
export const getAllCities = () => {
  const cities = [];
  
  // Add Ghana cities
  LOCATIONS.ghana.cities.forEach(city => {
    cities.push({
      name: city.name,
      country: 'Ghana',
      region: city.region,
      coordinates: city.coordinates,
      population: city.population,
      popular: city.popular
    });
  });
  
  // Add Nigeria cities
  LOCATIONS.nigeria.states.forEach(state => {
    state.cities.forEach(city => {
      cities.push({
        name: city.name,
        country: 'Nigeria',
        state: state.name,
        coordinates: city.coordinates,
        population: city.population,
        popular: city.popular
      });
    });
  });
  
  return cities;
};

export const getCitiesByCountry = (country) => {
  if (country === 'ghana') {
    return LOCATIONS.ghana.cities.map(city => ({
      name: city.name,
      country: 'Ghana',
      region: city.region,
      coordinates: city.coordinates,
      population: city.population,
      popular: city.popular
    }));
  } else if (country === 'nigeria') {
    const cities = [];
    LOCATIONS.nigeria.states.forEach(state => {
      state.cities.forEach(city => {
        cities.push({
          name: city.name,
          country: 'Nigeria',
          state: state.name,
          coordinates: city.coordinates,
          population: city.population,
          popular: city.popular
        });
      });
    });
    return cities;
  }
  return [];
};

export const getPopularCities = () => {
  return getAllCities().filter(city => city.popular);
};

export const getNearbyCities = (userCity, radiusKm = 50) => {
  const allCities = getAllCities();
  const userCityData = allCities.find(city => 
    city.name.toLowerCase() === userCity.toLowerCase()
  );
  
  if (!userCityData) return [];
  
  const nearby = allCities.filter(city => {
    if (city.name === userCityData.name) return false;
    
    const distance = calculateDistance(
      userCityData.coordinates.lat,
      userCityData.coordinates.lng,
      city.coordinates.lat,
      city.coordinates.lng
    );
    
    return distance <= radiusKm;
  });
  
  return nearby.sort((a, b) => {
    const distA = calculateDistance(
      userCityData.coordinates.lat,
      userCityData.coordinates.lng,
      a.coordinates.lat,
      a.coordinates.lng
    );
    const distB = calculateDistance(
      userCityData.coordinates.lat,
      userCityData.coordinates.lng,
      b.coordinates.lat,
      b.coordinates.lng
    );
    return distA - distB;
  });
};

// Enhanced distance calculation with more accuracy
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
};

// Enhanced user location detection with better error handling
export const getUserLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    
    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000 // 5 minutes
    };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        // Find the nearest city
        const allCities = getAllCities();
        let nearestCity = null;
        let shortestDistance = Infinity;
        
        allCities.forEach(city => {
          const distance = calculateDistance(
            latitude,
            longitude,
            city.coordinates.lat,
            city.coordinates.lng
          );
          
          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestCity = city;
          }
        });
        
        resolve({
          coordinates: { lat: latitude, lng: longitude },
          accuracy: accuracy,
          nearestCity,
          distance: shortestDistance,
          timestamp: new Date().toISOString()
        });
      },
      (error) => {
        let errorMessage = 'Unknown error occurred';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location services.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
          default:
            errorMessage = 'Unknown error occurred';
            break;
        }
        reject(new Error(errorMessage));
      },
      options
    );
  });
};

// New function to get cities by population range
export const getCitiesByPopulation = (minPopulation, maxPopulation) => {
  const allCities = getAllCities();
  return allCities.filter(city => {
    const population = parseInt(city.population.replace(/[^\d]/g, ''));
    return population >= minPopulation && population <= maxPopulation;
  });
};

// New function to get cities by popularity
export const getCitiesByPopularity = (popular = true) => {
  return getAllCities().filter(city => city.popular === popular);
};

// New function to estimate travel time (rough calculation)
export const estimateTravelTime = (distance, transportMode = 'car') => {
  const speeds = {
    car: 60,      // km/h in city
    motorcycle: 40, // km/h in city
    public: 25,   // km/h public transport
    walking: 5    // km/h walking
  };
  
  const speed = speeds[transportMode] || speeds.car;
  const timeHours = distance / speed;
  const timeMinutes = Math.round(timeHours * 60);
  
  if (timeMinutes < 60) {
    return `${timeMinutes} min`;
  } else {
    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
};
