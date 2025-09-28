import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  Button,
  TextField,
  Rating,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tabs,
  Tab,
  Badge,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  LocationOn,
  VerifiedUser,
  Phone,
  Email,
  Message,
  Favorite,
  Share,
  Bookmark,
  AccessTime,
  CheckCircle,
  Warning
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { colors } from '../theme/colors';

const ServiceDetailPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    duration: '',
    location: '',
    specialRequests: ''
  });
  const [loading, setLoading] = useState(false);

  // Mock service data
  const [service] = useState({
    id: 'SRV-001',
    title: 'Premium Dgy Experience - Luxury Adventure Package',
    category: 'dgy',
    provider: {
      id: 'PROV-001',
      name: 'Sarah Mitchell',
      avatar: 'SM',
      rating: 4.9,
      totalReviews: 127,
      verified: true,
      trustScore: 95,
      responseTime: '2.3 hours',
      completionRate: 98.5,
      memberSince: '2022-03-15',
      languages: ['English', 'Spanish'],
      specialties: ['Adventure', 'Luxury', 'Cultural']
    },
    description: 'Experience the ultimate Dgy adventure with our premium luxury package. This exclusive experience combines thrilling outdoor activities with world-class service and breathtaking locations. Perfect for adventure seekers who demand excellence.',
    price: 299,
    duration: 180,
    location: 'Flexible (Client/Provider/Online)',
    availability: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
    tags: ['Adventure', 'Luxury', 'Outdoor', 'Premium', 'Exclusive'],
    images: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800'
    ],
    features: [
      'Professional guide with 10+ years experience',
      'All safety equipment included',
      'High-quality adventure gear',
      'Professional photography included',
      'Luxury transportation',
      'Gourmet refreshments',
      'Insurance coverage',
      '24/7 support'
    ],
    requirements: [
      'Minimum age: 18 years',
      'Good physical condition required',
      'Weather-dependent scheduling',
      'Advance booking recommended',
      'Valid ID required'
    ],
    reviews: [
      {
        id: 'REV-001',
        user: 'John D.',
        rating: 5,
        date: '2024-01-15',
        comment: 'Absolutely incredible experience! Sarah was professional, knowledgeable, and made the entire adventure unforgettable. The luxury touches really made it special.',
        helpful: 12
      },
      {
        id: 'REV-002',
        user: 'Maria S.',
        rating: 5,
        date: '2024-01-12',
        comment: 'Best adventure experience I\'ve ever had! The attention to detail and safety measures were outstanding. Highly recommend!',
        helpful: 8
      },
      {
        id: 'REV-003',
        user: 'David L.',
        rating: 4,
        date: '2024-01-10',
        comment: 'Great service and amazing adventure. Sarah knows her stuff and made us feel safe throughout. Would book again!',
        helpful: 5
      }
    ],
    relatedServices: [
      {
        id: 'SRV-002',
        title: 'Romans Cultural Tour',
        category: 'romans',
        price: 199,
        rating: 4.7,
        image: 'https://images.unsplash.com/photo-1555992336-03a23c7b20ee?w=400'
      },
      {
        id: 'SRV-003',
        title: 'Ridin Adventure Safari',
        category: 'ridin',
        price: 249,
        rating: 4.8,
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'
      }
    ]
  });

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      dgy: '💎',
      romans: '🏛️',
      ridin: '🚗',
      bb_suk: '⭐'
    };
    return icons[category] || '🔥';
  };

  const getCategoryColor = (category) => {
    const colors = {
      dgy: 'primary',
      romans: 'secondary',
      ridin: 'success',
      bb_suk: 'warning'
    };
    return colors[category] || 'default';
  };

  const handleBookingSubmit = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoading(false);
    setBookingDialogOpen(false);
    // Show success message or redirect
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 12 }}>
      {/* Service Header */}
      <motion.div {...fadeInUp}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Chip
              icon={<span>{getCategoryIcon(service.category)}</span>}
              label={service.category.toUpperCase()}
              color={getCategoryColor(service.category)}
              size="large"
            />
            <Chip
              label={`${service.duration} min`}
              variant="outlined"
              icon={<AccessTime />}
            />
            <Chip
              label={service.location}
              variant="outlined"
              icon={<LocationOn />}
            />
          </Box>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            {service.title}
          </Typography>
          <Typography variant="h5" color="text.secondary" gutterBottom>
            {service.description}
          </Typography>
        </Box>
      </motion.div>

      <Grid container spacing={4}>
        {/* Main Content */}
        <Grid item xs={12} lg={8}>
          {/* Service Images */}
          <motion.div {...fadeInUp}>
            <Card elevation={4} sx={{ mb: 4 }}>
              <Box sx={{ position: 'relative', height: 400, bgcolor: 'grey.200' }}>
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${service.images[0]})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 1
                  }}
                />
                <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                  <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.9)', mr: 1 }}>
                    <Favorite />
                  </IconButton>
                  <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.9)', mr: 1 }}>
                    <Share />
                  </IconButton>
                  <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
                    <Bookmark />
                  </IconButton>
                </Box>
              </Box>
            </Card>
          </motion.div>

          {/* Service Tabs */}
          <motion.div {...fadeInUp}>
            <Card elevation={4}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                  <Tab label="Overview" />
                  <Tab label="Features" />
                  <Tab label="Requirements" />
                  <Tab label="Reviews" />
                </Tabs>
              </Box>
              <CardContent sx={{ p: 4 }}>
                {/* Overview Tab */}
                {activeTab === 0 && (
                  <Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      About This Service
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {service.description}
                    </Typography>
                    <Typography variant="body1" paragraph>
                      Our premium Dgy experience is designed for those who seek adventure without compromising on luxury. 
                      Every detail has been carefully curated to ensure an unforgettable journey that combines excitement 
                      with comfort and safety.
                    </Typography>
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        What's Included
                      </Typography>
                      <Grid container spacing={2}>
                        {service.features.map((feature, index) => (
                          <Grid item xs={12} sm={6} key={index}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CheckCircle color="success" fontSize="small" />
                              <Typography variant="body2">{feature}</Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  </Box>
                )}

                {/* Features Tab */}
                {activeTab === 1 && (
                  <Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Service Features
                    </Typography>
                    <Grid container spacing={3}>
                      {service.features.map((feature, index) => (
                        <Grid item xs={12} sm={6} key={index}>
                          <Card elevation={2} sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar sx={{ width: 40, height: 40, bgcolor: colors.primary.red }}>
                                <CheckCircle />
                              </Avatar>
                              <Typography variant="body1" fontWeight="medium">
                                {feature}
                              </Typography>
                            </Box>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* Requirements Tab */}
                {activeTab === 2 && (
                  <Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Requirements & Important Information
                    </Typography>
                    <Alert severity="info" sx={{ mb: 3 }}>
                      Please review all requirements before booking to ensure a smooth experience.
                    </Alert>
                    <List>
                      {service.requirements.map((requirement, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <Warning color="warning" />
                          </ListItemIcon>
                          <ListItemText primary={requirement} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {/* Reviews Tab */}
                {activeTab === 3 && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                      <Typography variant="h6" fontWeight="bold">
                        Customer Reviews
                      </Typography>
                      <Chip
                        label={`${service.reviews.length} reviews`}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    {service.reviews.map((review) => (
                      <Box key={review.id} sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Avatar sx={{ width: 40, height: 40 }}>
                            {review.user[0]}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {review.user}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Rating value={review.rating} readOnly size="small" />
                              <Typography variant="body2" color="text.secondary">
                                {new Date(review.date).toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        <Typography variant="body1" paragraph>
                          {review.comment}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Button size="small" startIcon={<CheckCircle />}>
                            Helpful ({review.helpful})
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Pricing & Booking */}
          <motion.div {...fadeInUp}>
            <Card elevation={4} sx={{ mb: 4, position: 'sticky', top: 24 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Typography variant="h3" fontWeight="bold" color={colors.primary.red}>
                    ${service.price}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    per session
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={() => setBookingDialogOpen(true)}
                  sx={{ mb: 2 }}
                >
                  Book Now
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Message />}
                >
                  Contact Provider
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Provider Info */}
          <motion.div {...fadeInUp}>
            <Card elevation={4} sx={{ mb: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  About the Provider
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Badge
                    badgeContent={<VerifiedUser sx={{ fontSize: 12 }} />}
                    color="success"
                  >
                    <Avatar sx={{ width: 60, height: 60 }}>
                      {service.provider.avatar}
                    </Avatar>
                  </Badge>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {service.provider.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Rating value={service.provider.rating} readOnly size="small" />
                      <Typography variant="body2" color="text.secondary">
                        ({service.provider.totalReviews})
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Chip
                    label={`Trust Score: ${service.provider.trustScore}%`}
                    color="success"
                    variant="outlined"
                    fullWidth
                    sx={{ mb: 1 }}
                  />
                  <Chip
                    label={`Response: ${service.provider.responseTime}`}
                    color="info"
                    variant="outlined"
                    fullWidth
                    sx={{ mb: 1 }}
                  />
                  <Chip
                    label={`Completion: ${service.provider.completionRate}%`}
                    color="warning"
                    variant="outlined"
                    fullWidth
                  />
                </Box>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Phone />}
                  sx={{ mb: 1 }}
                >
                  Call Provider
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Email />}
                >
                  Send Message
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Related Services */}
          <motion.div {...fadeInUp}>
            <Card elevation={4}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Related Services
                </Typography>
                {service.relatedServices.map((relatedService) => (
                  <Box key={relatedService.id} sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          backgroundImage: `url(${relatedService.image})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRadius: 1
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          {relatedService.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Rating value={relatedService.rating} readOnly size="small" />
                          <Typography variant="caption" color="text.secondary">
                            {relatedService.rating}
                          </Typography>
                        </Box>
                        <Typography variant="h6" color={colors.primary.red} fontWeight="bold">
                          ${relatedService.price}
                        </Typography>
                      </Box>
                    </Box>
    </Box>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Booking Dialog */}
      <Dialog
        open={bookingDialogOpen}
        onClose={() => setBookingDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">
            Book Service
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={bookingData.date}
                onChange={(e) => setBookingData(prev => ({ ...prev, date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Time"
                type="time"
                value={bookingData.time}
                onChange={(e) => setBookingData(prev => ({ ...prev, time: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Duration</InputLabel>
                <Select
                  value={bookingData.duration}
                  label="Duration"
                  onChange={(e) => setBookingData(prev => ({ ...prev, duration: e.target.value }))}
                >
                  <MenuItem value="60">1 hour</MenuItem>
                  <MenuItem value="120">2 hours</MenuItem>
                  <MenuItem value="180">3 hours</MenuItem>
                  <MenuItem value="240">4 hours</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Location</InputLabel>
                <Select
                  value={bookingData.location}
                  label="Location"
                  onChange={(e) => setBookingData(prev => ({ ...prev, location: e.target.value }))}
                >
                  <MenuItem value="client">Client Location</MenuItem>
                  <MenuItem value="provider">Provider Location</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                  <MenuItem value="flexible">Flexible</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Special Requests"
                multiline
                rows={3}
                value={bookingData.specialRequests}
                onChange={(e) => setBookingData(prev => ({ ...prev, specialRequests: e.target.value }))}
                placeholder="Any special requirements or requests..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBookingDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleBookingSubmit}
            disabled={loading || !bookingData.date || !bookingData.time}
            startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            {loading ? 'Processing...' : 'Confirm Booking'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ServiceDetailPage;
