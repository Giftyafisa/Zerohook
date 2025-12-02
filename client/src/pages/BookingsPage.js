import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Button,
  Tab,
  Tabs,
  Avatar
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  Cancel as CancelledIcon,
  EventAvailable as UpcomingIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const BookingsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/bookings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setBookings(data.bookings || []);
        } else {
          // Use mock data for now
          setBookings(mockBookings);
        }
      } catch (error) {
        console.error('Bookings fetch error:', error);
        setBookings(mockBookings);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchBookings();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const mockBookings = [
    {
      id: 1,
      service: 'Premium Companion',
      provider: 'Crystal',
      providerAvatar: null,
      date: '2025-12-05',
      time: '8:00 PM',
      location: 'Lagos, Nigeria',
      status: 'upcoming',
      price: 150.00
    },
    {
      id: 2,
      service: 'VIP Experience',
      provider: 'Diamond',
      providerAvatar: null,
      date: '2025-12-03',
      time: '6:00 PM',
      location: 'Accra, Ghana',
      status: 'pending',
      price: 200.00
    },
    {
      id: 3,
      service: 'Evening Companion',
      provider: 'Sapphire',
      providerAvatar: null,
      date: '2025-11-28',
      time: '7:00 PM',
      location: 'Nairobi, Kenya',
      status: 'completed',
      price: 120.00
    }
  ];

  const getStatusConfig = (status) => {
    switch (status) {
      case 'upcoming':
        return { color: '#00f2ea', icon: <UpcomingIcon />, label: 'Upcoming' };
      case 'pending':
        return { color: '#ffd700', icon: <PendingIcon />, label: 'Pending' };
      case 'completed':
        return { color: '#00ff88', icon: <CompletedIcon />, label: 'Completed' };
      case 'cancelled':
        return { color: '#ff3333', icon: <CancelledIcon />, label: 'Cancelled' };
      default:
        return { color: '#888', icon: <PendingIcon />, label: status };
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (activeTab === 0) return true; // All
    if (activeTab === 1) return booking.status === 'upcoming';
    if (activeTab === 2) return booking.status === 'pending';
    if (activeTab === 3) return booking.status === 'completed';
    return true;
  });

  if (!isAuthenticated) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.emptyState}>
          <CalendarIcon sx={{ fontSize: 64, color: '#333', mb: 2 }} />
          <Typography color="text.secondary" sx={{ mb: 2 }}>Please log in to view your bookings</Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/login')}
            sx={styles.primaryButton}
          >
            Login
          </Button>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={styles.loadingContainer}>
        <CircularProgress sx={{ color: '#00f2ea' }} />
      </Box>
    );
  }

  return (
    <Box sx={styles.container}>
      {/* Header */}
      <Box sx={styles.header}>
        <CalendarIcon sx={styles.headerIcon} />
        <Typography sx={styles.headerTitle}>My Bookings</Typography>
      </Box>

      {/* Tabs */}
      <Box sx={styles.tabsContainer}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={styles.tabs}
        >
          <Tab label="All" />
          <Tab label="Upcoming" />
          <Tab label="Pending" />
          <Tab label="Completed" />
        </Tabs>
      </Box>

      {/* Stats Summary */}
      <Box sx={styles.statsRow}>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statValue}>{bookings.filter(b => b.status === 'upcoming').length}</Typography>
          <Typography sx={styles.statLabel}>Upcoming</Typography>
        </Box>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statValue}>{bookings.filter(b => b.status === 'pending').length}</Typography>
          <Typography sx={styles.statLabel}>Pending</Typography>
        </Box>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statValue}>{bookings.filter(b => b.status === 'completed').length}</Typography>
          <Typography sx={styles.statLabel}>Completed</Typography>
        </Box>
      </Box>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <Box sx={styles.emptyState}>
          <CalendarIcon sx={{ fontSize: 48, color: '#333', mb: 2 }} />
          <Typography color="text.secondary">No bookings found</Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/adult-services')}
            sx={{ ...styles.primaryButton, mt: 2 }}
          >
            Browse Services
          </Button>
        </Box>
      ) : (
        <Box sx={styles.bookingsList}>
          {filteredBookings.map((booking, index) => {
            const statusConfig = getStatusConfig(booking.status);
            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Box sx={styles.bookingCard}>
                  <Box sx={styles.bookingHeader}>
                    <Avatar 
                      src={booking.providerAvatar} 
                      sx={styles.providerAvatar}
                    >
                      {booking.provider[0]}
                    </Avatar>
                    <Box sx={styles.bookingInfo}>
                      <Typography sx={styles.serviceName}>{booking.service}</Typography>
                      <Typography sx={styles.providerName}>
                        <PersonIcon sx={{ fontSize: 14, mr: 0.5 }} />
                        {booking.provider}
                      </Typography>
                    </Box>
                    <Chip
                      icon={statusConfig.icon}
                      label={statusConfig.label}
                      size="small"
                      sx={{
                        background: `${statusConfig.color}20`,
                        color: statusConfig.color,
                        '& .MuiChip-icon': { color: statusConfig.color }
                      }}
                    />
                  </Box>
                  
                  <Box sx={styles.bookingDetails}>
                    <Box sx={styles.detailItem}>
                      <CalendarIcon sx={styles.detailIcon} />
                      <Typography sx={styles.detailText}>{booking.date}</Typography>
                    </Box>
                    <Box sx={styles.detailItem}>
                      <TimeIcon sx={styles.detailIcon} />
                      <Typography sx={styles.detailText}>{booking.time}</Typography>
                    </Box>
                    <Box sx={styles.detailItem}>
                      <LocationIcon sx={styles.detailIcon} />
                      <Typography sx={styles.detailText}>{booking.location}</Typography>
                    </Box>
                  </Box>

                  <Box sx={styles.bookingFooter}>
                    <Typography sx={styles.price}>${booking.price.toFixed(2)}</Typography>
                    {booking.status === 'upcoming' && (
                      <Box sx={styles.actionButtons}>
                        <Button size="small" sx={styles.cancelButton}>Cancel</Button>
                        <Button size="small" sx={styles.viewButton}>View Details</Button>
                      </Box>
                    )}
                    {booking.status === 'completed' && (
                      <Button size="small" sx={styles.viewButton}>Leave Review</Button>
                    )}
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
    padding: { xs: '16px', md: '24px' },
    paddingBottom: { xs: '100px', md: '24px' }
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    mb: 3
  },
  headerIcon: {
    fontSize: 32,
    color: '#00f2ea'
  },
  headerTitle: {
    fontSize: { xs: '1.5rem', md: '2rem' },
    fontWeight: 700,
    background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  tabsContainer: {
    mb: 3
  },
  tabs: {
    '& .MuiTab-root': {
      color: '#888',
      '&.Mui-selected': {
        color: '#00f2ea'
      }
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#00f2ea'
    }
  },
  statsRow: {
    display: 'flex',
    gap: 2,
    mb: 3,
    overflowX: 'auto',
    pb: 1
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 2,
    padding: 2,
    textAlign: 'center',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#00f2ea'
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#888'
  },
  bookingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  bookingCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 3,
    padding: 2.5,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    transition: 'all 0.3s ease',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05)',
      borderColor: 'rgba(0, 242, 234, 0.3)'
    }
  },
  bookingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    mb: 2
  },
  providerAvatar: {
    width: 48,
    height: 48,
    background: 'linear-gradient(135deg, #00f2ea, #ff0055)'
  },
  bookingInfo: {
    flex: 1
  },
  serviceName: {
    fontWeight: 600,
    color: '#fff',
    fontSize: '1rem'
  },
  providerName: {
    display: 'flex',
    alignItems: 'center',
    color: '#888',
    fontSize: '0.85rem'
  },
  bookingDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 2,
    mb: 2,
    padding: 1.5,
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 2
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5
  },
  detailIcon: {
    fontSize: 16,
    color: '#00f2ea'
  },
  detailText: {
    fontSize: '0.85rem',
    color: '#ccc'
  },
  bookingFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  price: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#00ff88'
  },
  actionButtons: {
    display: 'flex',
    gap: 1
  },
  cancelButton: {
    color: '#ff3333',
    borderColor: '#ff3333',
    '&:hover': {
      background: 'rgba(255, 51, 51, 0.1)'
    }
  },
  viewButton: {
    color: '#00f2ea',
    '&:hover': {
      background: 'rgba(0, 242, 234, 0.1)'
    }
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    textAlign: 'center'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #00f2ea, #00b4d8)',
    color: '#000',
    fontWeight: 600,
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4d0, #0096c7)'
    }
  }
};

export default BookingsPage;
