import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Search,
  LocationOn,
  Favorite,
  FavoriteBorder,
  Message,
  ViewList,
  ViewModule,
  VerifiedUser,
  Work,
  School,
  Language
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { colors } from '../theme/colors';

const ServicesPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  // Mock dating profiles data
  const [profiles] = useState([
    {
      id: 1,
      name: 'Sarah Mitchell',
      age: 28,
      location: 'Lagos, Nigeria',
      distance: '2.3 km away',
      photos: [
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400'
      ],
      bio: 'Adventure seeker, coffee lover, and passionate about life. Looking for someone who shares my love for travel and meaningful conversations.',
      interests: ['Travel', 'Coffee', 'Photography', 'Hiking', 'Reading'],
      occupation: 'Marketing Manager',
      education: 'University of Lagos',
      languages: ['English', 'Yoruba'],
      verificationStatus: 'verified',
      lastActive: '2 hours ago',
      compatibility: 92,
      isLiked: false,
      isSuperLiked: false,
      tags: ['Long Term', 'Professional', 'Verified', 'New']
    },
    {
      id: 2,
      name: 'James Okechukwu',
      age: 31,
      location: 'Abuja, Nigeria',
      distance: '15.7 km away',
      photos: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'
      ],
      bio: 'Tech entrepreneur with a passion for innovation. Love playing guitar, cooking, and exploring new cultures. Seeking a genuine connection.',
      interests: ['Technology', 'Music', 'Cooking', 'Travel', 'Fitness'],
      occupation: 'Software Engineer',
      education: 'University of Nigeria',
      languages: ['English', 'Igbo'],
      verificationStatus: 'verified',
      lastActive: '1 hour ago',
      compatibility: 88,
      isLiked: false,
      isSuperLiked: false,
      tags: ['Short Term', 'Tech', 'Musician', 'Verified']
    },
    {
      id: 3,
      name: 'Aisha Bello',
      age: 26,
      location: 'Kano, Nigeria',
      distance: '45.2 km away',
      photos: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400'
      ],
      bio: 'Medical student with a heart for helping others. Love reading, painting, and spending time with family. Looking for someone kind and ambitious.',
      interests: ['Medicine', 'Art', 'Reading', 'Family', 'Charity'],
      occupation: 'Medical Student',
      education: 'Bayero University',
      languages: ['English', 'Hausa'],
      verificationStatus: 'pending',
      lastActive: '30 minutes ago',
      compatibility: 95,
      isLiked: false,
      isSuperLiked: false,
      tags: ['Long Term', 'Medical', 'Artist', 'Student']
    },
    {
      id: 4,
      name: 'David Eze',
      age: 29,
      location: 'Port Harcourt, Nigeria',
      distance: '120.5 km away',
      photos: [
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
        'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400'
      ],
      bio: 'Financial analyst who loves the outdoors. Enjoy playing football, watching movies, and trying new restaurants. Seeking someone adventurous and caring.',
      interests: ['Finance', 'Sports', 'Movies', 'Food', 'Outdoors'],
      occupation: 'Financial Analyst',
      education: 'University of Port Harcourt',
      languages: ['English', 'Igbo'],
      verificationStatus: 'verified',
      lastActive: '3 hours ago',
      compatibility: 85,
      isLiked: false,
      isSuperLiked: false,
      tags: ['Short Term', 'Finance', 'Athlete', 'Verified']
    },
    {
      id: 5,
      name: 'Fatima Yusuf',
      age: 27,
      location: 'Kaduna, Nigeria',
      distance: '89.3 km away',
      photos: [
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400'
      ],
      bio: 'Architect with a creative soul. Love designing spaces, photography, and exploring new cities. Looking for someone who appreciates beauty and creativity.',
      interests: ['Architecture', 'Design', 'Photography', 'Travel', 'Art'],
      occupation: 'Architect',
      education: 'Ahmadu Bello University',
      languages: ['English', 'Hausa'],
      verificationStatus: 'verified',
      lastActive: '45 minutes ago',
      compatibility: 90,
      isLiked: false,
      isSuperLiked: false,
      tags: ['Long Term', 'Creative', 'Architect', 'Verified']
    },
    {
      id: 6,
      name: 'Michael Adebayo',
      age: 32,
      location: 'Ibadan, Nigeria',
      distance: '67.8 km away',
      photos: [
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'
      ],
      bio: 'Lawyer with a passion for justice and equality. Enjoy playing chess, reading legal thrillers, and mentoring young people. Seeking someone with strong values.',
      interests: ['Law', 'Chess', 'Reading', 'Mentoring', 'Justice'],
      occupation: 'Lawyer',
      education: 'University of Ibadan',
      languages: ['English', 'Yoruba'],
      verificationStatus: 'verified',
      lastActive: '1 hour ago',
      compatibility: 87,
      isLiked: false,
      isSuperLiked: false,
      tags: ['Long Term', 'Professional', 'Lawyer', 'Verified']
    },
    {
      id: 7,
      name: 'Grace Okafor',
      age: 24,
      location: 'Enugu, Nigeria',
      distance: '95.1 km away',
      photos: [
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400'
      ],
      bio: 'Nursing student who loves to please. Looking for generous men who appreciate quality service. Available for intimate experiences.',
      interests: ['Nursing', 'Dancing', 'Travel', 'Fashion', 'Music'],
      occupation: 'Nursing Student',
      education: 'University of Nigeria',
      languages: ['English', 'Igbo'],
      verificationStatus: 'verified',
      lastActive: '20 minutes ago',
      compatibility: 78,
      isLiked: false,
      isSuperLiked: false,
      tags: ['Oral Services', 'Student', 'Verified', 'Popular']
    },
    {
      id: 8,
      name: 'Sophia Adebayo',
      age: 28,
      location: 'Lagos, Nigeria',
      distance: '5.2 km away',
      photos: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400'
      ],
      bio: 'Elite escort with premium services. Offering exclusive experiences for discerning clients. Discretion guaranteed.',
      interests: ['Luxury', 'Travel', 'Fine Dining', 'Art', 'Fashion'],
      occupation: 'Elite Escort',
      education: 'Private',
      languages: ['English', 'French', 'Yoruba'],
      verificationStatus: 'verified',
      lastActive: '10 minutes ago',
      compatibility: 92,
      isLiked: false,
      isSuperLiked: false,
      tags: ['Special Services', 'Elite', 'Verified', 'Premium']
    }
  ]);

  const categories = [
    { value: 'all', label: 'All Services', icon: '👥' },
    { value: 'long', label: 'Long Term', icon: '💕' },
    { value: 'short', label: 'Short Term', icon: '🔥' },
    { value: 'bj', label: 'Oral Services', icon: '💋' },
    { value: 'scv', label: 'Special Services', icon: '⭐' }
  ];

  const sortOptions = [
    { value: 'recent', label: 'Recently Active' },
    { value: 'nearby', label: 'Distance' },
    { value: 'compatibility', label: 'Compatibility' },
    { value: 'verified', label: 'Verification Status' }
  ];

  const handleProfileClick = (profile) => {
    setSelectedProfile(profile);
    setProfileDialogOpen(true);
  };

  const handleLike = (profileId) => {
    // Update like status
    // In real app, this would update Redux state
    console.log('Liked profile:', profileId);
  };

  const handleSuperLike = (profileId) => {
    // Update super like status
    // In real app, this would update Redux state
    console.log('Super liked profile:', profileId);
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         profile.bio.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         profile.interests.some(interest => 
                           interest.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'long' && profile.tags.includes('Long Term')) ||
                           (selectedCategory === 'short' && profile.tags.includes('Short Term')) ||
                           (selectedCategory === 'bj' && profile.tags.includes('Oral Services')) ||
                           (selectedCategory === 'scv' && profile.tags.includes('Special Services'));
    
    return matchesSearch && matchesCategory;
  });

  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return a.lastActive.localeCompare(b.lastActive);
      case 'nearby':
        return parseFloat(a.distance) - parseFloat(b.distance);
      case 'compatibility':
        return b.compatibility - a.compatibility;
      case 'verified':
        return b.verificationStatus.localeCompare(a.verificationStatus);
      default:
        return 0;
    }
  });

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <motion.div {...fadeInUp}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            Premium Dating Services 💕
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Browse verified providers offering exclusive dating experiences
          </Typography>
        </Box>
      </motion.div>

      {/* Search and Filters */}
      <motion.div {...fadeInUp}>
        <Box sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={3} alignItems="center">
            {/* Search Bar */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by name, interests, or bio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Category Filter */}
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  label="Category"
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map((category) => (
                    <MenuItem key={category.value} value={category.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{category.icon}</span>
                        {category.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Sort By */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  {sortOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* View Mode Toggle */}
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  onClick={() => setViewMode('grid')}
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                >
                  <ViewModule />
                </Button>
                <Button
                  onClick={() => setViewMode('list')}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                >
                  <ViewList />
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </motion.div>

      {/* Results Count */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" color="text.secondary">
          Showing {sortedProfiles.length} services
        </Typography>
      </Box>

      {/* Profiles Grid/List */}
      <Grid container spacing={3}>
        {sortedProfiles.map((profile, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={profile.id}>
            <motion.div
              {...fadeInUp}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                elevation={4} 
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 8
                  }
                }}
                onClick={() => handleProfileClick(profile)}
              >
                {/* Profile Photo */}
                <CardMedia
                  component="img"
                  height="280"
                  image={profile.photos[0]}
                  alt={profile.name}
                  sx={{ position: 'relative' }}
                />
                
                {/* Verification Badge */}
                {profile.verificationStatus === 'verified' && (
                  <Badge
                    badgeContent={<VerifiedUser sx={{ fontSize: 16, color: 'white' }} />}
                    color="success"
                    sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      '& .MuiBadge-badge': {
                        backgroundColor: colors.success,
                        color: 'white'
                      }
                    }}
                  >
                    <Box />
                  </Badge>
                )}

                {/* Compatibility Score */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    borderRadius: '50%',
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}
                >
                  {profile.compatibility}%
                </Box>

                <CardContent sx={{ p: 2 }}>
                  {/* Basic Info */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" fontWeight="bold" noWrap>
                      {profile.name}, {profile.age}
                    </Typography>
                    {profile.isSuperLiked && (
                      <Favorite sx={{ color: 'red', fontSize: 20 }} />
                    )}
                  </Box>

                  {/* Location */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {profile.distance}
                    </Typography>
                  </Box>

                  {/* Occupation */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                    <Work sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {profile.occupation}
                    </Typography>
                  </Box>

                  {/* Bio Preview */}
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {profile.bio}
                  </Typography>

                  {/* Interests Tags */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    {profile.interests.slice(0, 3).map((interest, idx) => (
                      <Chip
                        key={idx}
                        label={interest}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                    {profile.interests.length > 3 && (
                      <Chip
                        label={`+${profile.interests.length - 3}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>

                  {/* Last Active */}
                  <Typography variant="caption" color="text.secondary">
                    {profile.lastActive}
                  </Typography>
                </CardContent>

                {/* Action Buttons */}
                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Message />}
                    size="small"
                    sx={{ mb: 1 }}
                  >
                    Message
                  </Button>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(profile.id);
                      }}
                      sx={{ 
                        minWidth: 'auto',
                        color: profile.isLiked ? 'red' : 'inherit'
                      }}
                    >
                      {profile.isLiked ? <Favorite sx={{ color: 'red' }} /> : <FavoriteBorder />}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSuperLike(profile.id);
                      }}
                      sx={{ 
                        minWidth: 'auto',
                        color: profile.isSuperLiked ? 'red' : 'inherit'
                      }}
                    >
                      <Favorite sx={{ 
                        color: profile.isSuperLiked ? 'red' : 'inherit',
                        fontSize: 20
                      }} />
                    </Button>
                  </Box>
                </CardActions>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Profile Detail Dialog */}
      <Dialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedProfile && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h5" fontWeight="bold">
                  {selectedProfile.name}, {selectedProfile.age}
                </Typography>
                {selectedProfile.verificationStatus === 'verified' && (
                  <Chip
                    icon={<VerifiedUser />}
                    label="Verified"
                    color="success"
                    size="small"
                  />
                )}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                {/* Photos */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ position: 'relative' }}>
                    <img
                      src={selectedProfile.photos[0]}
                      alt={selectedProfile.name}
                      style={{
                        width: '100%',
                        height: 300,
                        objectFit: 'cover',
                        borderRadius: 8
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        borderRadius: '50%',
                        width: 50,
                        height: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {selectedProfile.compatibility}%
                    </Box>
                  </Box>
                </Grid>

                {/* Profile Details */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      About {selectedProfile.name}
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {selectedProfile.bio}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Basic Information
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <Work />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Occupation" 
                          secondary={selectedProfile.occupation} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <School />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Education" 
                          secondary={selectedProfile.education} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <LocationOn />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Location" 
                          secondary={selectedProfile.location} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Language />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Languages" 
                          secondary={selectedProfile.languages.join(', ')} 
                        />
                      </ListItem>
                    </List>
                  </Box>

                  <Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Interests & Hobbies
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {selectedProfile.interests.map((interest, idx) => (
                        <Chip
                          key={idx}
                          label={interest}
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Box>
    </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setProfileDialogOpen(false)}>
                Close
              </Button>
              <Button
                variant="outlined"
                startIcon={<Message />}
                onClick={() => {
                  setProfileDialogOpen(false);
                  // Navigate to chat or open message modal
                }}
              >
                Send Message
              </Button>
              <Button
                variant="contained"
                startIcon={<Favorite />}
                onClick={() => {
                  setProfileDialogOpen(false);
                  handleLike(selectedProfile.id);
                }}
              >
                Like Profile
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default ServicesPage;
