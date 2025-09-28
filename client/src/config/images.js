// Default images for different profile types and genders
export const getDefaultImage = (type, gender = 'unknown') => {
  const baseUrl = 'https://images.unsplash.com/photo-';
  
  switch (type) {
    case 'PROFILE':
      switch (gender?.toLowerCase()) {
        case 'female':
          return `${baseUrl}1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face&auto=format&q=80`;
        case 'male':
          return `${baseUrl}1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&auto=format&q=80`;
        default:
          return `${baseUrl}1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face&auto=format&q=80`;
      }
    
    case 'SERVICE':
      return `${baseUrl}1515378960530-7c0da6231fb1?w=600&h=400&fit=crop&auto=format&q=80`;
    
    case 'BANNER':
      return `${baseUrl}1522202176988-66273c2fd55f?w=1200&h=400&fit=crop&auto=format&q=80`;
    
    case 'THUMBNAIL':
      return `${baseUrl}1552664730-d307ca884978?w=300&h=200&fit=crop&auto=format&q=80`;
    
    default:
      return `${baseUrl}1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face&auto=format&q=80`;
  }
};

// Profile picture placeholders by gender with working URLs
export const getProfilePlaceholder = (gender = 'unknown') => {
  const baseUrl = 'https://images.unsplash.com/photo-';
  
  switch (gender?.toLowerCase()) {
    case 'female':
      return `${baseUrl}1494790108755-2616b612b786?w=300&h=250&fit=crop&crop=face&auto=format&q=80`;
    case 'male':
      return `${baseUrl}1507003211169-0a1dd7228f2d?w=300&h=250&fit=crop&crop=face&auto=format&q=80`;
    default:
      return `${baseUrl}1472099645785-5658abf4ff4e?w=300&h=250&fit=crop&crop=face&auto=format&q=80`;
  }
};

// Service category images with working URLs
export const getServiceImage = (category) => {
  const baseUrl = 'https://images.unsplash.com/photo-';
  
  const categoryImages = {
    'Long Term': `${baseUrl}1515378960530-7c0da6231fb1?w=600&h=400&fit=crop&auto=format&q=80`,
    'Short Term': `${baseUrl}1573496359142-b8d87734a5a2?w=600&h=400&fit=crop&auto=format&q=80`,
    'Oral Services': `${baseUrl}1559757148-5c350d0d3c56?w=600&h=400&fit=crop&auto=format&q=80`,
    'Special Services': `${baseUrl}1522202176988-66273c2fd55f?w=600&h=400&fit=crop&auto=format&q=80`,
    'Massage': `${baseUrl}1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&auto=format&q=80`,
    'Wellness': `${baseUrl}1559757148-5c350d0d3c56?w=600&h=400&fit=crop&auto=format&q=80`,
    'Cultural': `${baseUrl}1515378960530-7c0da6231fb1?w=600&h=400&fit=crop&auto=format&q=80`,
    'Business': `${baseUrl}1522202176988-66273c2fd55f?w=600&h=400&fit=crop&auto=format&q=80`,
    'Travel': `${baseUrl}1552664730-d307ca884978?w=600&h=400&fit=crop&auto=format&q=80`,
    'Fitness': `${baseUrl}1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&auto=format&q=80`
  };
  
  return categoryImages[category] || categoryImages['Long Term'];
};

// Default avatar images with working URLs
export const getAvatarImage = (gender = 'unknown') => {
  const baseUrl = 'https://images.unsplash.com/photo-';
  
  switch (gender?.toLowerCase()) {
    case 'female':
      return `${baseUrl}1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face&auto=format&q=80`;
    case 'male':
      return `${baseUrl}1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face&auto=format&q=80`;
    default:
      return `${baseUrl}1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face&auto=format&q=80`;
  }
};

// Background images for different sections with working URLs
export const getBackgroundImage = (section) => {
  const baseUrl = 'https://images.unsplash.com/photo-';
  
  const sectionImages = {
    'hero': `${baseUrl}1522202176988-66273c2fd55f?w=1920&h=600&fit=crop&auto=format&q=80`,
    'services': `${baseUrl}1515378960530-7c0da6231fb1?w=1920&h=400&fit=crop&auto=format&q=80`,
    'profiles': `${baseUrl}1552664730-d307ca884978?w=1920&h=400&fit=crop&auto=format&q=80`,
    'about': `${baseUrl}1571019613454-1cb2f99b2d8b?w=1920&h=400&fit=crop&auto=format&q=80`,
    'contact': `${baseUrl}1559757148-5c350d0d3c56?w=1920&h=400&fit=crop&auto=format&q=80`
  };
  
  return sectionImages[section] || sectionImages['hero'];
};

// Enhanced fallback image system
export const getFallbackImage = (type, gender = 'unknown', size = 'medium') => {
  const sizes = {
    small: 'w=100&h=100',
    medium: 'w=300&h=250',
    large: 'w=400&h=400',
    xlarge: 'w=600&h=400'
  };
  
  const sizeParam = sizes[size] || sizes.medium;
  const baseUrl = 'https://images.unsplash.com/photo-';
  
  // Use reliable, always-working images
  const fallbackImages = {
    female: `${baseUrl}1494790108755-2616b612b786?${sizeParam}&fit=crop&crop=face&auto=format&q=80`,
    male: `${baseUrl}1507003211169-0a1dd7228f2d?${sizeParam}&fit=crop&crop=face&auto=format&q=80`,
    default: `${baseUrl}1472099645785-5658abf4ff4e?${sizeParam}&fit=crop&crop=face&auto=format&q=80`
  };
  
  return fallbackImages[gender?.toLowerCase()] || fallbackImages.default;
};
