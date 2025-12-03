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
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Rating,
  Paper,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  LocationOn,
  Star,
  Security,
  Phone,
  Email,
  WhatsApp,
  Telegram,
  Favorite,
  FavoriteBorder,
  Share,
  Report,
  CalendarToday,
  AccessTime,
  Payment,
  Verified,
  Warning,
  CheckCircle,
  Schedule,
  AttachMoney,
  Language,
  Public,
  Lock
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/constants';
import VideoSystem from '../components/video/VideoSystem';

const AdultServiceDetail = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [bookingStep, setBookingStep] = useState(0);
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    duration: '',
    location: '',
    specialRequests: '',
    contactMethod: 'chat'
  });
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    // Fetch real service data from API
    const fetchService = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/services/${id}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 Fetched service:', data);
          
          // Add null check for data.service
          if (data && data.service) {
            // Validate service data structure
            const validatedService = {
              ...data.service,
              photos: data.service.photos || [],
              title: data.service.title || 'Untitled Service',
              description: data.service.description || 'No description available',
              price: data.service.price || 0,
              category: data.service.category || 'General',
              subcategory: data.service.subcategory || 'Standard',
              rating: data.service.rating || 0,
              reviews: data.service.reviews || 0,
              available: data.service.available !== false,
              location: data.service.location || 'Location not specified',
              availableHours: data.service.availableHours || 'Hours not specified',
              availableDays: data.service.availableDays || [],
              verificationTier: data.service.verificationTier || 'Basic',
              trustScore: data.service.trustScore || 0,
              privacyLevel: data.service.privacyLevel || 'standard',
              provider: data.service.provider || null,
              services: data.service.services || [],
              requirements: data.service.requirements || [],
              safety: data.service.safety || [],
              tags: data.service.tags || []
            };
            
            setService(validatedService);
          } else {
            console.error('Service data is missing or malformed');
            setService(null);
          }
        } else {
          console.error('Failed to fetch service:', response.status);
          setService(null);
        }
      } catch (error) {
        console.error('Error fetching service:', error);
        setService(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchService();
    }
  }, [id, navigate]);

  const handlePhotoChange = (index) => {
    setSelectedPhoto(index);
  };

  const handleFavorite = () => {
    setIsFavorite(!isFavorite);
    // In real app, this would update the backend
  };

  const handleShare = () => {
    // In real app, this would share the service
    if (navigator.share && service) {
      navigator.share({
        title: service.title || 'Service',
        text: service.description || 'Check out this service',
        url: window.location.href
      });
    }
  };

  const handleReport = () => {
    // In real app, this would open report dialog
    if (service) {
      console.log('Report service:', service.id);
    }
  };

  const handleBookingChange = (field, value) => {
    setBookingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBookingSubmit = async () => {
    // In real app, this would submit booking to backend
    console.log('Booking submitted:', bookingData);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Close dialog and show success
    setShowBookingDialog(false);
    setBookingStep(0);
    setBookingData({
      date: '',
      time: '',
      duration: '',
      location: '',
      specialRequests: '',
      contactMethod: 'chat'
    });
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

  const getPrivacyIcon = (level) => {
    switch (level) {
      case 'minimal': return <Lock />;
      case 'standard': return <Public />;
      case 'enhanced': return <Verified />;
      case 'premium': return <Security />;
      default: return <Public />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading service details...</Typography>
      </Box>
    );
  }

  if (!service) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Service not found. Please check the URL and try again.
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => navigate('/adult-services')}
          sx={{ mt: 2 }}
        >
          Back to Services
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Actions */}
      <Box 
        display="flex" 
        flexDirection={isMobile ? 'column' : 'row'}
        justifyContent="space-between" 
        alignItems={isMobile ? 'stretch' : 'center'} 
        gap={isMobile ? 2 : 0}
        mb={3}
      >
        <Button
          variant="outlined"
          onClick={() => navigate('/adult-services')}
          fullWidth={isMobile}
        >
          ← Back to Services
        </Button>
        
        <Box 
          display="flex" 
          gap={1} 
          flexDirection={isSmallMobile ? 'column' : 'row'}
          width={isMobile ? '100%' : 'auto'}
        >
          <Button
            variant="outlined"
            startIcon={isFavorite ? <Favorite /> : <FavoriteBorder />}
            onClick={handleFavorite}
            color={isFavorite ? 'error' : 'primary'}
            fullWidth={isSmallMobile}
          >
            {isFavorite ? 'Favorited' : 'Favorite'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Share />}
            onClick={handleShare}
            fullWidth={isSmallMobile}
          >
            Share
          </Button>
          <Button
            variant="outlined"
            startIcon={<Report />}
            onClick={handleReport}
            color="warning"
            fullWidth={isSmallMobile}
          >
            Report
          </Button>
        </Box>
      </Box>

      <Grid container spacing={4}>
        {/* Left Column - Photos and Basic Info */}
        <Grid item xs={12} md={8}>
          {/* Main Photo */}
          <Card sx={{ mb: 3 }}>
            <CardMedia
              component="img"
              height={isMobile ? "250" : "400"}
              image={service?.photos?.[selectedPhoto] || service?.photos?.[0] || '/default-service-image.jpg'}
              alt={service?.title || 'Service'}
              sx={{ objectFit: 'cover' }}
            />
          </Card>

          {/* Photo Thumbnails */}
          {service?.photos && service.photos.length > 0 && (
            <Box display="flex" gap={1} mb={3} sx={{ overflowX: 'auto' }}>
              {service.photos.map((photo, index) => (
                <Card
                  key={index}
                  sx={{
                    minWidth: isMobile ? 80 : 100,
                    cursor: 'pointer',
                    border: selectedPhoto === index ? '2px solid' : 'none',
                    borderColor: 'primary.main'
                  }}
                  onClick={() => handlePhotoChange(index)}
                >
                  <CardMedia
                    component="img"
                     height={isMobile ? "60" : "80"}
                    image={photo}
                    alt={`Photo ${index + 1}`}
                    sx={{ objectFit: 'cover' }}
                  />
                </Card>
              ))}
            </Box>
           )}

          {/* Video Section */}
          {service?.videos && service.videos.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Service Videos
                </Typography>
                <VideoSystem 
                  mode="player" 
                  initialVideo={service.videos[0]}
                />
              </CardContent>
            </Card>
          )}

          {/* Service Details */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
                  <Typography 
                    variant={isMobile ? "h5" : "h4"} 
                    component="h1" 
                    gutterBottom 
                    sx={{ fontWeight: 'bold' }}
                  >
                    {service?.title || 'Untitled Service'}
                  </Typography>
                  
               <Box 
                 display="flex" 
                 flexDirection={isMobile ? 'column' : 'row'}
                 alignItems={isMobile ? 'stretch' : 'center'} 
                 gap={isMobile ? 1 : 2} 
                 mb={2}
               >
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip 
                      label={service?.category || 'General'} 
                      color="primary"
                      variant="outlined"
                      size={isMobile ? "small" : "medium"}
                    />
                    <Chip 
                      label={service?.subcategory || 'Standard'} 
                      color="secondary"
                      variant="outlined"
                      size={isMobile ? "small" : "medium"}
                    />
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Star sx={{ color: '#FFD700' }} />
                    <Typography variant={isMobile ? "body2" : "body1"}>
                      {service?.rating || 0} ({service?.reviews || 0} reviews)
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body1" paragraph>
                {service?.description || 'No description available'}
              </Typography>

              <Typography variant="body1" paragraph>
                {service?.longDescription || ''}
              </Typography>

              {/* Tags */}
              {service?.tags && service.tags.length > 0 && (
                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  {service.tags.map(tag => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Provider Information */}
          {service?.provider && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                   About {service.provider?.name || 'Provider'}
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <Typography variant="body2" color="text.secondary">Age:</Typography>
                        </ListItemIcon>
                         <ListItemText primary={service.provider?.age || 'N/A'} />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Typography variant="body2" color="text.secondary">Height:</Typography>
                        </ListItemIcon>
                         <ListItemText primary={service.provider?.height || 'N/A'} />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Typography variant="body2" color="text.secondary">Body Type:</Typography>
                        </ListItemIcon>
                         <ListItemText primary={service.provider?.bodyType || 'N/A'} />
                      </ListItem>
                    </List>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <Typography variant="body2" color="text.secondary">Languages:</Typography>
                        </ListItemIcon>
                         <ListItemText primary={service.provider?.languages && service.provider.languages.length > 0 ? service.provider.languages.join(', ') : 'N/A'} />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Typography variant="body2" color="text.secondary">Response Time:</Typography>
                        </ListItemIcon>
                         <ListItemText primary={service.provider?.responseTime || 'N/A'} />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Typography variant="body2" color="text.secondary">Member Since:</Typography>
                        </ListItemIcon>
                         <ListItemText primary={service.provider?.memberSince || 'N/A'} />
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>

                <Box display="flex" gap={2} mt={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" />
                    <Typography variant="body2">
                       {service.provider?.totalBookings || 0} total bookings
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" />
                    <Typography variant="body2">
                       {service.provider?.completionRate || 0}% completion rate
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Services Offered */}
          {service?.services && service.services.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Services Offered
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {service.services.map(serviceItem => (
                    <Chip
                      key={serviceItem}
                      label={serviceItem}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Requirements & Safety */}
          <Grid container spacing={3}>
            {service?.requirements && service.requirements.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                      Requirements
                    </Typography>
                    <List dense>
                      {service.requirements.map((req, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <CheckCircle color="primary" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={req} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
                </Grid>
            )}
            
            {service?.safety && service.safety.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Safety & Verification
                    </Typography>
                    <List dense>
                      {service.safety.map((item, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <Verified color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={item} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Grid>

        {/* Right Column - Booking and Info */}
        <Grid item xs={12} md={4}>
                     {/* Pricing Card */}
           <Card sx={{ 
             mb: 3, 
             position: isMobile ? 'static' : 'sticky', 
             top: isMobile ? 'auto' : 20 
           }}>
            <CardContent>
                                                          <Typography 
                 variant={isMobile ? "h5" : "h4"} 
                 color="primary" 
                 gutterBottom 
                 sx={{ fontWeight: 'bold' }}
               >
                  ₦{(service?.price || 0).toLocaleString()}
                </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                per {service?.duration || 'session'}
                </Typography>
              
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={() => setShowBookingDialog(true)}
                sx={{ mb: 2 }}
                 disabled={service?.available === false}
              >
                 {service?.available !== false ? 'Book Now' : 'Currently Unavailable'}
              </Button>
              
               {service?.available === false && (
                 <Alert severity="warning" sx={{ mb: 2 }}>
                   This service is currently unavailable. Please check back later.
                 </Alert>
               )}

              <Divider sx={{ my: 2 }} />

              {/* Quick Info */}
              <Box display="flex" flexDirection="column" gap={2}>
                                 <Box display="flex" alignItems="center" gap={1}>
                   <LocationOn color="action" />
                   <Typography variant="body2">
                     {service?.location || 'Location not specified'}
                   </Typography>
                 </Box>
                 
                 <Box display="flex" alignItems="center" gap={1}>
                   <AccessTime color="action" />
                   <Typography variant="body2">
                     {service?.availableHours || 'Hours not specified'}
                   </Typography>
                 </Box>
                 
                 <Box display="flex" alignItems="center" gap={1}>
                   <CalendarToday color="action" />
                   <Typography variant="body2">
                     {service?.availableDays && service.availableDays.length > 0 ? service.availableDays.join(', ') : 'Days not specified'}
                   </Typography>
                 </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Verification & Trust */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Verification & Trust
              </Typography>
              
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                 <Security sx={{ color: getVerificationColor(service?.verificationTier || 'Basic') }} />
                 <Typography variant="body1" sx={{ color: getVerificationColor(service?.verificationTier || 'Basic') }}>
                   {service?.verificationTier || 'Basic'} Tier
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                 <Star sx={{ color: getTrustScoreColor(service?.trustScore || 0) }} />
                 <Typography variant="body1" sx={{ color: getTrustScoreColor(service?.trustScore || 0) }}>
                   Trust Score: {service?.trustScore || 0}
                </Typography>
              </Box>
              
               <Box display="flex" alignItems="center" gap={1}>
                 {getPrivacyIcon(service?.privacyLevel || 'standard')}
                <Typography variant="body2">
                   {(service?.privacyLevel || 'standard').charAt(0).toUpperCase() + (service?.privacyLevel || 'standard').slice(1)} Privacy
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Contact Methods */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                Contact Methods
                </Typography>
                
              <Box display="flex" flexDirection="column" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<Phone />}
                  fullWidth
                  size="small"
                >
                  Call Provider
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<Email />}
                  fullWidth
                  size="small"
                >
                  Send Message
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<WhatsApp />}
                  fullWidth
                  size="small"
                >
                  WhatsApp
                </Button>
                </Box>
              </CardContent>
            </Card>
        </Grid>
      </Grid>

      {/* Booking Dialog */}
      <Dialog 
        open={showBookingDialog} 
        onClose={() => setShowBookingDialog(false)}
         maxWidth={isMobile ? "xs" : "md"}
        fullWidth
         fullScreen={isSmallMobile}
      >
        <DialogTitle>
           Book Service: {service?.title || 'Service'}
        </DialogTitle>
        
        <DialogContent>
                     <Stepper 
             activeStep={bookingStep} 
             sx={{ mb: 3 }}
             orientation={isMobile ? "vertical" : "horizontal"}
           >
             <Step>
               <StepLabel>Service Details</StepLabel>
             </Step>
             <Step>
               <StepLabel>Contact & Payment</StepLabel>
             </Step>
             <Step>
               <StepLabel>Confirmation</StepLabel>
             </Step>
           </Stepper>

          {bookingStep === 0 && (
             <Grid container spacing={isMobile ? 2 : 3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                   label="Preferred Date"
                  type="date"
                  value={bookingData.date}
                  onChange={(e) => handleBookingChange('date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                   label="Preferred Time"
                  type="time"
                  value={bookingData.time}
                  onChange={(e) => handleBookingChange('time', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                 <FormControl fullWidth>
                   <InputLabel>Duration</InputLabel>
                   <Select
                  value={bookingData.duration}
                  onChange={(e) => handleBookingChange('duration', e.target.value)}
                     label="Duration"
                   >
                     <MenuItem value="1 hour">1 Hour</MenuItem>
                     <MenuItem value="2 hours">2 Hours</MenuItem>
                     <MenuItem value="3 hours">3 Hours</MenuItem>
                     <MenuItem value="4 hours">4 Hours</MenuItem>
                     <MenuItem value="Overnight">Overnight</MenuItem>
                   </Select>
                 </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                   label="Meeting Location"
                  value={bookingData.location}
                  onChange={(e) => handleBookingChange('location', e.target.value)}
                   placeholder="Enter preferred location"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                   multiline
                   rows={isMobile ? 2 : 3}
                  label="Special Requests"
                  value={bookingData.specialRequests}
                  onChange={(e) => handleBookingChange('specialRequests', e.target.value)}
                   placeholder="Any special requests or preferences..."
                />
              </Grid>
            </Grid>
          )}

          {bookingStep === 1 && (
             <Grid container spacing={isMobile ? 2 : 3}>
              <Grid item xs={12}>
                <Typography variant={isMobile ? "h6" : "h6"} gutterBottom>
                  Contact Method
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Preferred Contact</InputLabel>
                  <Select
                    value={bookingData.contactMethod}
                    onChange={(e) => handleBookingChange('contactMethod', e.target.value)}
                    label="Preferred Contact"
                  >
                    <MenuItem value="chat">In-app Chat</MenuItem>
                    <MenuItem value="phone">Phone Call</MenuItem>
                    <MenuItem value="whatsapp">WhatsApp</MenuItem>
                    <MenuItem value="telegram">Telegram</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant={isMobile ? "h6" : "h6"} gutterBottom>
                  Payment Information
                </Typography>
                <Alert severity="info">
                  Payment will be processed securely through our escrow system. 
                  Funds are only released after service completion and your satisfaction.
                </Alert>
              </Grid>
            </Grid>
          )}

          {bookingStep === 2 && (
            <Box>
              <Typography variant={isMobile ? "h6" : "h6"} gutterBottom>
                Booking Summary
              </Typography>
              
              <Paper sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
                <Typography variant={isMobile ? "body2" : "body1"} gutterBottom>
                   <strong>Service:</strong> {service?.title || 'Service'}
                </Typography>
                <Typography variant={isMobile ? "body2" : "body1"} gutterBottom>
                  <strong>Date:</strong> {bookingData.date}
                </Typography>
                <Typography variant={isMobile ? "body2" : "body1"} gutterBottom>
                  <strong>Time:</strong> {bookingData.time}
                </Typography>
                <Typography variant={isMobile ? "body2" : "body1"} gutterBottom>
                  <strong>Duration:</strong> {bookingData.duration}
                </Typography>
                <Typography variant={isMobile ? "body2" : "body1"} gutterBottom>
                  <strong>Location:</strong> {bookingData.location}
                </Typography>
                <Typography variant={isMobile ? "body2" : "body1"} gutterBottom>
                     <strong>Total Price:</strong> ₦{(service?.price || 0).toLocaleString()}
                </Typography>
              </Paper>
              
              <Alert severity="success">
                Your booking request has been submitted successfully! 
                 The provider will review and confirm within {service?.provider?.responseTime || '24 hours'}.
              </Alert>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowBookingDialog(false)}>
            Cancel
          </Button>
          
          {bookingStep > 0 && (
            <Button onClick={() => setBookingStep(prev => prev - 1)}>
              Back
            </Button>
          )}
          
          {bookingStep < 2 ? (
            <Button 
              variant="contained"
              onClick={() => setBookingStep(prev => prev + 1)}
            >
              Next
            </Button>
          ) : (
            <Button 
              variant="contained"
              onClick={handleBookingSubmit}
            >
              Confirm Booking
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdultServiceDetail;
