import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Pagination,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  FilterList,
  ViewModule,
  ViewList,
  LocationOn,
  Star,
  Security,
  FavoriteBorder,
  Phone,
  Add
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getDefaultImage } from '../config/images';

const AdultServiceBrowse = () => {
  const navigate = useNavigate();
  
  // State
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactDialog, setContactDialog] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [contactMessage, setContactMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    location: '',
    priceRange: [0, 1000], // Fixed: Adjusted to real service price range
    verificationTier: 'all',
    trustScore: [0, 100],
    privacyLevel: 'all'
  });
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Mock data for development - moved inside useEffect to fix dependency warning

  const categories = [
    { value: 'all', label: 'All Services' },
    { value: 'Long Term', label: 'Long Term' },
    { value: 'Short Term', label: 'Short Term' },
    { value: 'Oral Services', label: 'Oral Services' },
    { value: 'Special Services', label: 'Special Services' }
  ];

  useEffect(() => {
    // Fetch real services from API
    const fetchServices = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/services');
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 Raw API Response:', data);
          console.log('🔍 Services count:', data.services?.length);
          
          const realServices = data.services.map(service => ({
            id: service.id,
            title: service.title,
            description: service.description,
            category: service.category_name,
            price: parseFloat(service.price), // Fixed: Remove incorrect * 100 multiplication
            location: `${service.location_data?.city || 'Various'}, ${service.location_data?.country || 'Unknown'}`,
            verificationTier: service.verification_tier === 3 ? 'Elite' : service.verification_tier === 2 ? 'Advanced' : 'Basic',
            trustScore: parseFloat(service.reputation_score),
            privacyLevel: "Standard",
            photos: service.media_urls || [getDefaultImage('SERVICE')],
            tags: [service.category_name, service.provider_username],
            rating: parseFloat(service.rating) || 0,
            reviews: 0,
            available: true
          }));
          
          console.log('🔍 Processed Services:', realServices);
          console.log('🔍 First service sample:', realServices[0]);
          
          setServices(realServices);
          setTotalPages(Math.ceil(realServices.length / 8));
        } else {
          console.error('Failed to fetch services');
          setServices([]);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
        setServices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const filteredServices = services.filter(service => {
    const matchesCategory = filters.category === 'all' || service.category === filters.category;
    const matchesLocation = !filters.location || service.location.toLowerCase().includes(filters.location.toLowerCase());
    const matchesPrice = service.price >= filters.priceRange[0] && service.price <= filters.priceRange[1];
    const matchesVerification = filters.verificationTier === 'all' || service.verificationTier === filters.verificationTier;
    const matchesTrustScore = service.trustScore >= filters.trustScore[0] && service.trustScore <= filters.trustScore[1];
    
    return matchesCategory && matchesLocation && matchesPrice && matchesVerification && matchesTrustScore;
  });

  const handleViewService = (serviceId) => {
    navigate(`/adult-services/${serviceId}`);
  };

  const handleContact = (service) => {
    setSelectedService(service);
    setContactMessage('');
    setContactDialog(true);
  };

  const handleSendMessage = async () => {
    if (!contactMessage.trim()) {
      return;
    }

    setSendingMessage(true);
    try {
      // Get current user info from localStorage or context
      const token = localStorage.getItem('token');
              const userResponse = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to get user profile');
      }
      
      const userData = await userResponse.json();
      
      // Send service inquiry
              const inquiryResponse = await fetch('/api/connections/service-inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          toUserId: selectedService.providerId || selectedService.id, // You'll need to add providerId to service data
          serviceId: selectedService.id,
          message: contactMessage
        })
      });

      if (inquiryResponse.ok) {
        const result = await inquiryResponse.json();
        alert('Message sent successfully! You can continue the conversation in your chat.');
        setContactDialog(false);
        setSelectedService(null);
        setContactMessage('');
      } else {
        const error = await inquiryResponse.json();
        throw new Error(error.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Send message error:', error);
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCloseContactDialog = () => {
    setContactDialog(false);
    setSelectedService(null);
    setContactMessage('');
  };

  const handleFavorite = (serviceId) => {
    // In real app, this would toggle favorite status
    console.log('Toggling favorite for service:', serviceId);
  };

  const getVerificationColor = (tier) => {
    switch (tier) {
      case 'Elite': return '#FFD700';
      case 'Pro': return '#9C27B0';
      case 'Advanced': return '#2196F3';
      case 'Basic': return '#4CAF50';
      default: return '#757575';
    }
  };

  const getTrustScoreColor = (score) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 80) return '#8BC34A';
    if (score >= 70) return '#FFC107';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold' }}>
          Adult Services Marketplace 🔥
        </Typography>
        <Typography variant="h6" color="text.secondary" align="center">
          Browse verified providers offering premium adult services with complete privacy and security
        </Typography>
      </Box>

      {/* Filters and Search */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => navigate('/adult-services/create')}
              sx={{ mr: 2 }}
            >
              Create Service
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('grid')}
              startIcon={<ViewModule />}
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('list')}
              startIcon={<ViewList />}
            >
              List
            </Button>
          </Box>
        </Box>

        {showFilters && (
          <Box sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    label="Category"
                  >
                    {categories.map(cat => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Location"
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  placeholder="Enter city or region"
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Typography gutterBottom>Price Range (₦)</Typography>
                <Slider
                  value={filters.priceRange}
                  onChange={(e, newValue) => handleFilterChange('priceRange', newValue)}
                  valueLabelDisplay="auto"
                  min={0}
                  max={100000}
                  step={1000}
                />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption">₦{filters.priceRange[0].toLocaleString()}</Typography>
                  <Typography variant="caption">₦{filters.priceRange[1].toLocaleString()}</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Typography gutterBottom>Trust Score</Typography>
                <Slider
                  value={filters.trustScore}
                  onChange={(e, newValue) => handleFilterChange('trustScore', newValue)}
                  valueLabelDisplay="auto"
                  min={0}
                  max={100}
                  step={5}
                />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption">{filters.trustScore[0]}</Typography>
                  <Typography variant="caption">{filters.trustScore[1]}</Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>

      {/* Results Count */}
      <Box mb={3}>
        <Typography variant="h6" color="text.secondary">
          Showing {filteredServices.length} services
        </Typography>
      </Box>

      {/* Services Grid */}
      <Grid container spacing={3}>
        {filteredServices.map((service) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={service.id}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
            >
              <CardMedia
                component="img"
                height="200"
                image={service.photos[0]}
                alt={service.title}
                sx={{ objectFit: 'cover' }}
              />
              
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Service Header */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold', flex: 1 }}>
                    {service.title}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => handleFavorite(service.id)}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    <FavoriteBorder fontSize="small" />
                  </Button>
                </Box>

                {/* Category and Price */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Chip 
                    label={service.category} 
                    size="small" 
                    color="primary"
                    variant="outlined"
                  />
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                    ₦{service.price.toLocaleString()}
                  </Typography>
                </Box>

                {/* Description */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flex: 1 }}>
                  {service.description}
                </Typography>

                {/* Location */}
                <Box display="flex" alignItems="center" mb={1}>
                  <LocationOn fontSize="small" color="action" sx={{ mr: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    {service.location}
                  </Typography>
                </Box>

                {/* Verification and Trust Score */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center">
                    <Security fontSize="small" sx={{ color: getVerificationColor(service.verificationTier), mr: 0.5 }} />
                    <Typography variant="caption" sx={{ color: getVerificationColor(service.verificationTier) }}>
                      {service.verificationTier}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Star fontSize="small" sx={{ color: getTrustScoreColor(service.trustScore), mr: 0.5 }} />
                    <Typography variant="caption" sx={{ color: getTrustScoreColor(service.trustScore) }}>
                      {service.trustScore}
                    </Typography>
                  </Box>
                </Box>

                {/* Rating and Reviews */}
                <Box display="flex" alignItems="center" mb={2}>
                  <Star fontSize="small" sx={{ color: '#FFD700', mr: 0.5 }} />
                  <Typography variant="caption" sx={{ mr: 1 }}>
                    {service.rating} ({service.reviews} reviews)
                  </Typography>
                </Box>

                {/* Action Buttons */}
                <Box display="flex" gap={1}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    onClick={() => handleViewService(service.id)}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleContact(service)}
                    startIcon={<Phone />}
                  >
                    Contact
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination 
            count={totalPages} 
            page={page} 
            onChange={(e, value) => setPage(value)}
            color="primary"
            size="large"
          />
        </Box>
      )}

      {/* Contact Dialog */}
      {contactDialog && selectedService && (
        <Dialog 
          open={contactDialog} 
          onClose={handleCloseContactDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Contact Service Provider
          </DialogTitle>
          <DialogContent>
            <Box mb={2}>
              <Typography variant="h6" gutterBottom>
                {selectedService.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Send a message to inquire about this service
              </Typography>
            </Box>
            
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Your Message"
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              placeholder="Hi! I'm interested in your service. Can you tell me more about..."
              variant="outlined"
              sx={{ mb: 2 }}
            />
            
            <Typography variant="caption" color="text.secondary">
              Your message will be sent to the service provider and you can continue the conversation in your chat.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseContactDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage}
              variant="contained"
              disabled={!contactMessage.trim() || sendingMessage}
            >
              {sendingMessage ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
};

export default AdultServiceBrowse;
