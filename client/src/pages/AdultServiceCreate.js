import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  FormControlLabel,
  Switch,
  Slider,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent
} from '@mui/material';
import {
  Add,
  Save,
  PhotoCamera
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/constants';

const AdultServiceCreate = () => {
  const navigate = useNavigate();
  
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    // Basic Information
    title: '',
    description: '',
    category: '',
    subcategory: '',
    price: '',
    currency: 'NGN',
    
    // Service Details
    duration: '',
    location: '',
    travelRadius: 0,
    availableDays: [],
    availableHours: '',
    
    // Requirements & Preferences
    ageRange: [18, 50],
    genderPreference: 'all',
    specialRequirements: '',
    
    // Privacy & Verification
    privacyLevel: 'standard',
    showFace: false,
    showLocation: false,
    verificationRequired: true,
    
    // Photos & Media
    photos: [],
    tags: [],
    
    // Contact & Communication
    contactMethods: [],
    responseTime: '1 hour',
    languages: ['English']
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Fetch categories from backend API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/services/categories`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCategories(data.categories.map(cat => ({
              id: cat.id,
              value: cat.name,
              label: cat.display_name,
              description: cat.description,
              base_price: cat.base_price
            })));
          } else {
            console.error('Failed to fetch categories:', data.error);
            // Fallback to default categories if API fails
            setCategories([
              { id: 'long_term', value: 'long_term', label: 'Long Term', description: 'Long-term companionship services' },
              { id: 'short_term', value: 'short_term', label: 'Short Term', description: 'Short-term services' },
              { id: 'oral_services', value: 'oral_services', label: 'Oral Services', description: 'Specialized services' },
              { id: 'special_services', value: 'special_services', label: 'Special Services', description: 'Premium services' }
            ]);
          }
        } else {
          throw new Error('Failed to fetch categories');
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Fallback to default categories
        setCategories([
          { id: 'long_term', value: 'long_term', label: 'Long Term', description: 'Long-term companionship services' },
          { id: 'short_term', value: 'short_term', label: 'Short Term', description: 'Short-term services' },
          { id: 'oral_services', value: 'oral_services', label: 'Oral Services', description: 'Specialized services' },
          { id: 'special_services', value: 'special_services', label: 'Special Services', description: 'Premium services' }
        ]);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const steps = [
    'Basic Information',
    'Service Details', 
    'Requirements & Preferences',
    'Privacy & Verification',
    'Photos & Media',
    'Contact & Communication'
  ];

  const privacyLevels = [
    { value: 'minimal', label: 'Minimal', description: 'Only username and verification tier visible' },
    { value: 'standard', label: 'Standard', description: 'Add photos and basic bio' },
    { value: 'enhanced', label: 'Enhanced', description: 'Add location and detailed preferences' },
    { value: 'premium', label: 'Premium', description: 'Full profile with contact options' }
  ];

  const contactMethods = [
    { value: 'chat', label: 'In-app Chat', icon: '💬' },
    { value: 'phone', label: 'Phone Call', icon: '📞' },
    { value: 'whatsapp', label: 'WhatsApp', icon: '📱' },
    { value: 'telegram', label: 'Telegram', icon: '✈️' },
    { value: 'email', label: 'Email', icon: '📧' }
  ];

  const availableDaysOptions = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 0: // Basic Information
        if (!formData.title.trim()) newErrors.title = 'Title is required';
        if (!formData.description.trim()) newErrors.description = 'Description is required';
        if (!formData.category) newErrors.category = 'Category is required';
        if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price is required';
        break;
        
      case 1: // Service Details
        if (!formData.location.trim()) newErrors.location = 'Location is required';
        if (!formData.duration) newErrors.duration = 'Duration is required';
        break;
        
      case 2: // Requirements & Preferences
        if (formData.ageRange[0] < 18) newErrors.ageRange = 'Minimum age must be 18+';
        break;
        
      case 3: // Privacy & Verification
        // No validation needed for this step
        break;
        
      case 4: // Photos & Media
        if (formData.photos.length === 0) newErrors.photos = 'At least one photo is required';
        break;
        
      case 5: // Contact & Communication
        if (formData.contactMethods.length === 0) newErrors.contactMethods = 'At least one contact method is required';
        break;
        
      default:
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateStep(activeStep)) return;
    
    setLoading(true);
    
    try {
      // First, create the service
      const serviceData = {
        title: formData.title,
        description: formData.description,
        category_id: getCategoryId(formData.category),
        price: parseFloat(formData.price),
        duration_minutes: parseInt(formData.duration) || 60,
        location_type: 'local',
        location_data: { address: formData.location },
        availability: formData.availableDays || {},
        requirements: formData.specialRequirements ? [formData.specialRequirements] : [],
        media_urls: []
      };
      
      // Create service first to get serviceId
      const serviceResponse = await fetch(`${API_BASE_URL}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(serviceData)
      });
      
      if (!serviceResponse.ok) {
        throw new Error('Failed to create service');
      }
      
      const serviceResult = await serviceResponse.json();
      const serviceId = serviceResult.service.id;
      
      // Upload photos if any
      if (formData.photos.length > 0) {
        const formDataPhotos = new FormData();
        formData.photos.forEach((photo, index) => {
          formDataPhotos.append('media', photo.file);
        });
        formDataPhotos.append('serviceId', serviceId);
        
        const uploadResponse = await fetch(`${API_BASE_URL}/uploads/service-media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formDataPhotos
        });
        
        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          setError(`Photo upload failed: ${uploadError.error || 'Unknown error'}. Service was created but without photos.`);
          // Continue with service creation even if photos fail
        }
      }
      
             console.log('Service created successfully:', serviceResult);
       
       // Clear any previous errors and set success message
       setError('');
       setSuccess('Service created successfully! Redirecting...');
       
       // Redirect to the new service page after a short delay
       setTimeout(() => {
         navigate(`/adult-services/${serviceId}`);
       }, 2000);
      
    } catch (error) {
      console.error('Error creating service:', error);
      setSuccess(''); // Clear any success messages
      setError('Failed to create service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (event) => {
    const files = Array.from(event.target.files);
    
    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        alert(`File ${file.name} is not a supported image type. Please use JPEG, PNG, GIF, or WebP.`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        alert(`File ${file.name} is too large. Maximum size is 50MB.`);
        return false;
      }
      return true;
    });
    
    const newPhotos = validFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      preview: URL.createObjectURL(file)
    }));
    
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos]
    }));
  };

  const removePhoto = (photoId) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter(photo => photo.id !== photoId)
    }));
  };

  const addTag = (tag) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()]
      }));
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Category ID mapping function - FIXED TO USE ACTUAL DATABASE IDs
  const getCategoryId = (categoryName) => {
    // Find the category object that matches the display name
    const category = categories.find(cat => cat.label === categoryName);
    // Return the actual database ID if found, otherwise return null
    return category ? category.id : null;
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Service Information
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Service Title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                error={!!errors.title}
                helperText={errors.title}
                placeholder="e.g., Premium Long Term Companion"
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                error={!!errors.description}
                helperText={errors.description}
                placeholder="Describe your service, experience, and what clients can expect..."
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.category}>
                <InputLabel>Service Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  label="Service Category"
                >
                  {categories.map(cat => (
                    <MenuItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.category && (
                  <Typography variant="caption" color="error">
                    {errors.category}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Subcategory</InputLabel>
                <Select
                  value={formData.subcategory}
                  onChange={(e) => handleInputChange('subcategory', e.target.value)}
                  label="Subcategory"
                  disabled={!formData.category}
                >
                  {/* Subcategories can be added later when needed */}
                  <MenuItem value="standard">Standard</MenuItem>
                  <MenuItem value="premium">Premium</MenuItem>
                  <MenuItem value="vip">VIP</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Price"
                type="number"
                value={formData.price}
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value))}
                error={!!errors.price}
                helperText={errors.price}
                InputProps={{
                  startAdornment: <Typography>₦</Typography>
                }}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  label="Currency"
                >
                  <MenuItem value="NGN">Nigerian Naira (₦)</MenuItem>
                  <MenuItem value="USD">US Dollar ($)</MenuItem>
                  <MenuItem value="EUR">Euro (€)</MenuItem>
                  <MenuItem value="GBP">British Pound (£)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Service Details & Availability
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Service Duration"
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', e.target.value)}
                error={!!errors.duration}
                helperText={errors.duration}
                placeholder="e.g., 2 hours, Overnight, Weekend"
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                error={!!errors.location}
                helperText={errors.location}
                placeholder="e.g., Lagos, Nigeria"
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography gutterBottom>Travel Radius (km)</Typography>
              <Slider
                value={formData.travelRadius}
                onChange={(e, newValue) => handleInputChange('travelRadius', newValue)}
                valueLabelDisplay="auto"
                min={0}
                max={100}
                step={5}
                marks={[
                  { value: 0, label: '0km' },
                  { value: 25, label: '25km' },
                  { value: 50, label: '50km' },
                  { value: 100, label: '100km' }
                ]}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography gutterBottom>Available Days</Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {availableDaysOptions.map(day => (
                  <FormControlLabel
                    key={day.value}
                    control={
                      <Switch
                        checked={formData.availableDays.includes(day.value)}
                        onChange={(e) => {
                          const newDays = e.target.checked
                            ? [...formData.availableDays, day.value]
                            : formData.availableDays.filter(d => d !== day.value);
                          handleInputChange('availableDays', newDays);
                        }}
                      />
                    }
                    label={day.label}
                  />
                ))}
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Available Hours"
                value={formData.availableHours}
                onChange={(e) => handleInputChange('availableHours', e.target.value)}
                placeholder="e.g., 9 AM - 11 PM, 24/7, Weekends only"
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Requirements & Preferences
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography gutterBottom>Age Range</Typography>
              <Slider
                value={formData.ageRange}
                onChange={(e, newValue) => handleInputChange('ageRange', newValue)}
                valueLabelDisplay="auto"
                min={18}
                max={80}
                step={1}
                marks={[
                  { value: 18, label: '18' },
                  { value: 30, label: '30' },
                  { value: 50, label: '50' },
                  { value: 80, label: '80' }
                ]}
              />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="caption">{formData.ageRange[0]} years</Typography>
                <Typography variant="caption">{formData.ageRange[1]} years</Typography>
              </Box>
              {errors.ageRange && (
                <Typography variant="caption" color="error">
                  {errors.ageRange}
                </Typography>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Gender Preference</InputLabel>
                <Select
                  value={formData.genderPreference}
                  onChange={(e) => handleInputChange('genderPreference', e.target.value)}
                  label="Gender Preference"
                >
                  <MenuItem value="all">All Genders</MenuItem>
                  <MenuItem value="male">Male Only</MenuItem>
                  <MenuItem value="female">Female Only</MenuItem>
                  <MenuItem value="couples">Couples</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Special Requirements"
                value={formData.specialRequirements}
                onChange={(e) => handleInputChange('specialRequirements', e.target.value)}
                placeholder="Any specific requirements, preferences, or restrictions..."
              />
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Privacy & Verification Settings
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Privacy Level</InputLabel>
                <Select
                  value={formData.privacyLevel}
                  onChange={(e) => handleInputChange('privacyLevel', e.target.value)}
                  label="Privacy Level"
                >
                  {privacyLevels.map(level => (
                    <MenuItem key={level.value} value={level.value}>
                      <Box>
                        <Typography variant="body1">{level.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {level.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Profile Visibility Options
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.showFace}
                        onChange={(e) => handleInputChange('showFace', e.target.checked)}
                      />
                    }
                    label="Show Face in Photos"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.showLocation}
                        onChange={(e) => handleInputChange('showLocation', e.target.checked)}
                      />
                    }
                    label="Show Exact Location"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.verificationRequired}
                        onChange={(e) => handleInputChange('verificationRequired', e.target.checked)}
                      />
                    }
                    label="Require Client Verification"
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        );

      case 4:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Photos & Media
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="photo-upload"
                multiple
                type="file"
                onChange={handlePhotoUpload}
              />
              <label htmlFor="photo-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<PhotoCamera />}
                  size="large"
                >
                  Upload Photos
                </Button>
              </label>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Upload at least 3 photos. First photo will be your profile picture.
              </Typography>
              {errors.photos && (
                <Typography variant="caption" color="error" display="block">
                  {errors.photos}
                </Typography>
              )}
            </Grid>
            
            {formData.photos.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Uploaded Photos ({formData.photos.length})
                </Typography>
                <Grid container spacing={2}>
                  {formData.photos.map((photo, index) => (
                    <Grid item xs={12} sm={6} md={4} key={photo.id}>
                      <Card>
                        <CardContent sx={{ p: 1 }}>
                          <img
                            src={photo.preview}
                            alt={`Photo ${index + 1}`}
                            style={{
                              width: '100%',
                              height: '150px',
                              objectFit: 'cover',
                              borderRadius: '4px'
                            }}
                          />
                          <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                            <Typography variant="caption">
                              {index === 0 ? 'Profile Photo' : `Photo ${index + 1}`}
                            </Typography>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => removePhoto(photo.id)}
                            >
                              Remove
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            )}
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Tags
              </Typography>
              <Box display="flex" gap={1} mb={2}>
                <TextField
                  size="small"
                  placeholder="Add a tag"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addTag(e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Add a tag"]');
                    if (input && input.value.trim()) {
                      addTag(input.value);
                      input.value = '';
                    }
                  }}
                >
                  Add
                </Button>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {formData.tags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => removeTag(tag)}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        );

      case 5:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Contact & Communication
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Contact Methods
              </Typography>
              <Grid container spacing={2}>
                {contactMethods.map(method => (
                  <Grid item xs={12} sm={6} md={4} key={method.value}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.contactMethods.includes(method.value)}
                          onChange={(e) => {
                            const newMethods = e.target.checked
                              ? [...formData.contactMethods, method.value]
                              : formData.contactMethods.filter(m => m !== method.value);
                            handleInputChange('contactMethods', newMethods);
                          }}
                        />
                      }
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <span>{method.icon}</span>
                          <span>{method.label}</span>
                        </Box>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
              {errors.contactMethods && (
                <Typography variant="caption" color="error">
                  {errors.contactMethods}
                </Typography>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Response Time</InputLabel>
                <Select
                  value={formData.responseTime}
                  onChange={(e) => handleInputChange('responseTime', e.target.value)}
                  label="Response Time"
                >
                  <MenuItem value="15 minutes">15 minutes</MenuItem>
                  <MenuItem value="1 hour">1 hour</MenuItem>
                  <MenuItem value="2 hours">2 hours</MenuItem>
                  <MenuItem value="4 hours">4 hours</MenuItem>
                  <MenuItem value="24 hours">24 hours</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Languages Spoken"
                value={formData.languages.join(', ')}
                onChange={(e) => handleInputChange('languages', e.target.value.split(', ').map(lang => lang.trim()))}
                placeholder="e.g., English, French, Spanish"
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {/* Header */}
        <Box mb={4} textAlign="center">
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Create Adult Service Listing 🔥
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Set up your service profile to attract quality clients
          </Typography>
        </Box>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Success Display */}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* Categories Loading */}
        {loadingCategories && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Loading service categories...
          </Alert>
        )}

        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step Content */}
        <Box mb={4}>
          {renderStepContent(activeStep)}
        </Box>

        {/* Navigation Buttons */}
        <Box display="flex" justifyContent="space-between">
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            variant="outlined"
          >
            Back
          </Button>
          
          <Box>
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                startIcon={<Save />}
                size="large"
              >
                {loading ? 'Creating...' : 'Create Service'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<Add />}
                size="large"
              >
                Next
              </Button>
            )}
          </Box>
        </Box>

        {/* Progress Indicator */}
        <Box mt={4}>
          <Typography variant="body2" color="text.secondary" align="center">
            Step {activeStep + 1} of {steps.length}
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default AdultServiceCreate;
