import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Button, Chip, Avatar } from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../config/constants';

const devMock = {
  id: 'mock-1',
  service: 'Premium Companion',
  provider: 'Crystal',
  providerAvatar: null,
  date: '2025-12-05',
  time: '8:00 PM',
  location: 'Lagos, Nigeria',
  status: 'upcoming',
  price: 150.0,
  notes: 'Mock booking – API not available in development.'
};

const statusColors = {
  upcoming: '#00f2ea',
  pending: '#ffd700',
  completed: '#00ff88',
  cancelled: '#ff3333'
};

const BookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/bookings/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setBooking(data.booking || null);
          setError(null);
        } else {
          const msg = `Failed to load booking (${res.status})`;
          console.error(msg);
          if (process.env.NODE_ENV === 'development') {
            setBooking(devMock);
          } else {
            setBooking(null);
          }
          setError(msg);
        }
      } catch (err) {
        console.error('Booking fetch error:', err);
        if (process.env.NODE_ENV === 'development') {
          setBooking(devMock);
        } else {
          setBooking(null);
        }
        setError('Unable to load booking right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [id]);

  if (loading) {
    return (
      <Box sx={styles.containerCentered}>
        <CircularProgress sx={{ color: '#00f2ea' }} />
      </Box>
    );
  }

  if (!booking) {
    return (
      <Box sx={styles.containerCentered}>
        <Typography color="text.secondary">Booking not found.</Typography>
        {error && <Typography color="#ff8080" sx={{ mt: 1 }}>{error}</Typography>}
        <Button onClick={() => navigate(-1)} sx={styles.backButton} startIcon={<BackIcon />}>Back</Button>
      </Box>
    );
  }

  const statusColor = statusColors[booking.status] || '#888';

  return (
    <Box sx={styles.container}>
      <Box sx={styles.header}>
        <IconButtonBack onClick={() => navigate(-1)} />
        <Typography sx={styles.title}>Booking Details</Typography>
        <Chip label={booking.status} sx={{ background: `${statusColor}20`, color: statusColor, textTransform: 'capitalize' }} />
      </Box>

      <Box sx={styles.card}>
        <Box sx={styles.sectionHeader}>
          <Avatar src={booking.providerAvatar} sx={styles.avatar}>
            {booking.provider?.[0]}
          </Avatar>
          <Box>
            <Typography sx={styles.service}>{booking.service}</Typography>
            <Typography sx={styles.provider}><PersonIcon sx={styles.icon} /> {booking.provider}</Typography>
          </Box>
        </Box>

        <Box sx={styles.section}>
          <Box sx={styles.row}><CalendarIcon sx={styles.icon} /><Typography>{booking.date}</Typography></Box>
          <Box sx={styles.row}><TimeIcon sx={styles.icon} /><Typography>{booking.time}</Typography></Box>
          <Box sx={styles.row}><LocationIcon sx={styles.icon} /><Typography>{booking.location}</Typography></Box>
        </Box>

        <Box sx={styles.section}>
          <Typography sx={styles.price}>${Number(booking.price || 0).toFixed(2)}</Typography>
          {booking.notes && <Typography sx={styles.notes}>{booking.notes}</Typography>}
        </Box>

        <Box sx={styles.actions}>
          <Button variant="contained" sx={styles.primary} onClick={() => navigate('/bookings')}>Back to Bookings</Button>
        </Box>
      </Box>

      {error && <Typography color="#ff8080" sx={{ mt: 2 }}>{error}</Typography>}
    </Box>
  );
};

const IconButtonBack = ({ onClick }) => (
  <Button onClick={onClick} startIcon={<BackIcon />} sx={styles.backButton}>
    Back
  </Button>
);

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
    padding: { xs: '16px', md: '24px' }
  },
  containerCentered: {
    minHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    mb: 3
  },
  title: {
    flex: 1,
    fontSize: { xs: '1.4rem', md: '1.8rem' },
    fontWeight: 700,
    color: '#fff'
  },
  backButton: {
    color: '#00f2ea'
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 3,
    padding: { xs: 2, md: 3 },
    boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    mb: 2
  },
  avatar: {
    width: 56,
    height: 56,
    background: 'linear-gradient(135deg, #00f2ea, #ff0055)'
  },
  service: {
    fontWeight: 700,
    color: '#fff',
    fontSize: '1.1rem'
  },
  provider: {
    color: '#aaa',
    display: 'flex',
    alignItems: 'center',
    gap: 0.5
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    padding: 2,
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    mb: 2
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    color: '#ddd'
  },
  icon: {
    fontSize: 16,
    color: '#00f2ea'
  },
  price: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#00ff88'
  },
  notes: {
    color: '#ccc'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  primary: {
    background: 'linear-gradient(135deg, #00f2ea, #00b4d8)',
    color: '#000',
    fontWeight: 600,
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4d0, #0096c7)'
    }
  }
};

export default BookingDetails;
