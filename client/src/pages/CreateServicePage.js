import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  FormControlLabel,
  Checkbox,
  Card,
  CardContent,
  CardHeader,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Add,
  LocationOn,
  AttachMoney,
  Security,
  Star,
  CheckCircle
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SERVICE_CATEGORIES } from '../config/constants';

const CreateServicePage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    category: '',
    title: '',
    description: '',
    price: '',
    duration: '',
    locationType: 'flexible',
    locationData: {
      city: '',
      address: ''
    },
    requirements: {
      minimumTier: 1,
      ageRestriction: false,
      identityVerification: false
    },
    tags: []
  });

  const [currentTag, setCurrentTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleNestedInputChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const addTag = () => {
    if (currentTag && !formData.tags.includes(currentTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.description) newErrors.description = 'Description is required';
    if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price is required';
    if (!formData.duration || formData.duration <= 0) newErrors.duration = 'Valid duration is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      console.log('Creating service:', formData);
      await new Promise(resolve => setTimeout(resolve, 2000));
      navigate('/dashboard');
    } catch (error) {
      console.error('Service creation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryDetails = (categoryName) => {
    return SERVICE_CATEGORIES.find(cat => cat.name === categoryName);
  };

  const durationOptions = [
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 90, label: '1.5 hours' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 240, label: '4 hours' }
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 12 }}>
      <motion.div {...fadeInUp}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Create New Service ✨
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Share your expertise and start earning on the Hkup marketplace
          </Typography>
        </Box>
      </motion.div>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <motion.div {...fadeInUp}>
              <Card elevation={4}>
                <CardHeader 
                  title="Service Information"
                  subheader="Tell us about your service"
                  avatar={<Star color="primary" />}
                />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth error={!!errors.category}>
                        <InputLabel>Service Category</InputLabel>
                        <Select
                          value={formData.category}
                          onChange={(e) => handleInputChange('category', e.target.value)}
                          label="Service Category"
                        >
                          {SERVICE_CATEGORIES.map((category) => (
                            <MenuItem key={category.name} value={category.name}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{category.icon}</span>
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {category.displayName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Starting at ${category.startingPrice}
                                  </Typography>
                                </Box>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.category && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                            {errors.category}
                          </Typography>
                        )}
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      {formData.category && (
                        <Alert severity="info">
                          <Typography variant="body2">
                            <strong>{getCategoryDetails(formData.category)?.displayName}</strong>
                            <br />
                            {getCategoryDetails(formData.category)?.description}
                          </Typography>
                        </Alert>
                      )}
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Service Title"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        error={!!errors.title}
                        helperText={errors.title || 'Create an eye-catching title for your service'}
                        placeholder="e.g., Premium Dgy Experience with Verified Provider"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Service Description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        error={!!errors.description}
                        helperText={errors.description || 'Describe what clients can expect from your service'}
                        placeholder="Detailed description of your service..."
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} md={6}>
            <motion.div {...fadeInUp}>
              <Card elevation={4}>
                <CardHeader 
                  title="Pricing & Duration"
                  avatar={<AttachMoney color="primary" />}
                />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Price (USD)"
                        value={formData.price}
                        onChange={(e) => handleInputChange('price', e.target.value)}
                        error={!!errors.price}
                        helperText={errors.price}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <FormControl fullWidth error={!!errors.duration}>
                        <InputLabel>Duration</InputLabel>
                        <Select
                          value={formData.duration}
                          onChange={(e) => handleInputChange('duration', e.target.value)}
                          label="Duration"
                        >
                          {durationOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} md={6}>
            <motion.div {...fadeInUp}>
              <Card elevation={4}>
                <CardHeader 
                  title="Location"
                  avatar={<LocationOn color="primary" />}
                />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Location Type</InputLabel>
                        <Select
                          value={formData.locationType}
                          onChange={(e) => handleInputChange('locationType', e.target.value)}
                          label="Location Type"
                        >
                          <MenuItem value="flexible">Flexible Location</MenuItem>
                          <MenuItem value="client">At Client's Location</MenuItem>
                          <MenuItem value="provider">At My Location</MenuItem>
                          <MenuItem value="online">Online/Virtual</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    {formData.locationType !== 'online' && (
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="City"
                          value={formData.locationData.city}
                          onChange={(e) => handleNestedInputChange('locationData', 'city', e.target.value)}
                          placeholder="Lagos, Abuja, etc."
                        />
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12}>
            <motion.div {...fadeInUp}>
              <Card elevation={4}>
                <CardHeader 
                  title="Requirements"
                  avatar={<Security color="primary" />}
                />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Minimum Trust Tier</InputLabel>
                        <Select
                          value={formData.requirements.minimumTier}
                          onChange={(e) => handleNestedInputChange('requirements', 'minimumTier', e.target.value)}
                          label="Minimum Trust Tier"
                        >
                          <MenuItem value={1}>Basic (Tier 1)</MenuItem>
                          <MenuItem value={2}>Advanced (Tier 2)</MenuItem>
                          <MenuItem value={3}>Pro (Tier 3)</MenuItem>
                          <MenuItem value={4}>Elite (Tier 4)</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.requirements.identityVerification}
                            onChange={(e) => handleNestedInputChange('requirements', 'identityVerification', e.target.checked)}
                          />
                        }
                        label="Require Identity Verification"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.requirements.ageRestriction}
                            onChange={(e) => handleNestedInputChange('requirements', 'ageRestriction', e.target.checked)}
                          />
                        }
                        label="Age Restriction (18+)"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12}>
            <motion.div {...fadeInUp}>
              <Card elevation={4}>
                <CardHeader 
                  title="Tags"
                  avatar={<CheckCircle color="primary" />}
                />
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      fullWidth
                      label="Add Tags"
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value)}
                      placeholder="premium, verified, experienced, etc."
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={addTag} disabled={!currentTag}>
                              <Add />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {formData.tags.map((tag, index) => (
                      <Chip
                        key={index}
                        label={tag}
                        onDelete={() => removeTag(tag)}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
    </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12}>
            <motion.div {...fadeInUp}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Grid container spacing={2} justifyContent="flex-end">
                  <Grid item>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => navigate('/dashboard')}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={loading}
                      sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
                    >
                      {loading ? 'Creating Service...' : 'Create Service'}
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </motion.div>
          </Grid>
        </Grid>
      </form>
    </Container>
  );
};

export default CreateServicePage;
