import React from 'react';
import {
  Box,
  Container,
  Typography,
  Link,
  Grid,
  IconButton,
  Divider
} from '@mui/material';
import {
  Twitter,
  Instagram,
  LinkedIn,
  Email,
  Phone,
  LocationOn
} from '@mui/icons-material';
import { colors } from '../../theme/colors';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: colors.primary.black,
        color: colors.text.inverse,
        py: 6,
        mt: 'auto'
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Brand Section */}
          <Grid item xs={12} md={3}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                mb: 2,
                color: colors.primary.red
              }}
            >
              Zerohook
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mb: 3,
                opacity: 0.8,
                lineHeight: 1.6
              }}
            >
              The most secure marketplace for Kongi services. 
              Built with trust, powered by advanced security.
            </Typography>
            
            {/* Social Media */}
            <Box>
              <IconButton
                sx={{
                  color: colors.text.inverse,
                  '&:hover': { color: colors.primary.red }
                }}
              >
                <Twitter />
              </IconButton>
              <IconButton
                sx={{
                  color: colors.text.inverse,
                  '&:hover': { color: colors.primary.red }
                }}
              >
                <Instagram />
              </IconButton>
              <IconButton
                sx={{
                  color: colors.text.inverse,
                  '&:hover': { color: colors.primary.red }
                }}
              >
                <LinkedIn />
              </IconButton>
            </Box>
          </Grid>

          {/* Services */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                mb: 2,
                color: colors.primary.red
              }}
            >
              Services
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                'Dgy Services',
                'Romans Experience',
                'Ridin Adventures',
                'Bb Suk Special'
              ].map((service) => (
                <Link
                  key={service}
                  href="#"
                  sx={{
                    color: colors.text.inverse,
                    textDecoration: 'none',
                    opacity: 0.8,
                    fontSize: '0.875rem',
                    '&:hover': {
                      opacity: 1,
                      color: colors.primary.red
                    }
                  }}
                >
                  {service}
                </Link>
              ))}
            </Box>
          </Grid>

          {/* Platform */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                mb: 2,
                color: colors.primary.red
              }}
            >
              Platform
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                'How it Works',
                'Trust & Safety',
                'Verification',
                'Dispute Resolution',
                'API Documentation'
              ].map((item) => (
                <Link
                  key={item}
                  href="#"
                  sx={{
                    color: colors.text.inverse,
                    textDecoration: 'none',
                    opacity: 0.8,
                    fontSize: '0.875rem',
                    '&:hover': {
                      opacity: 1,
                      color: colors.primary.red
                    }
                  }}
                >
                  {item}
                </Link>
              ))}
            </Box>
          </Grid>

          {/* Company */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                mb: 2,
                color: colors.primary.red
              }}
            >
              Company
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                'About Us',
                'Careers',
                'Press',
                'Legal',
                'Privacy Policy'
              ].map((item) => (
                <Link
                  key={item}
                  href="#"
                  sx={{
                    color: colors.text.inverse,
                    textDecoration: 'none',
                    opacity: 0.8,
                    fontSize: '0.875rem',
                    '&:hover': {
                      opacity: 1,
                      color: colors.primary.red
                    }
                  }}
                >
                  {item}
                </Link>
              ))}
            </Box>
          </Grid>

          {/* Contact */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                mb: 2,
                color: colors.primary.red
              }}
            >
              Contact
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Email sx={{ fontSize: 18, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  support@zerohook.com
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Phone sx={{ fontSize: 18, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  +1 (555) 123-4567
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationOn sx={{ fontSize: 18, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  San Francisco, CA
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Bottom Section */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2
          }}
        >
          <Typography
            variant="body2"
            sx={{ opacity: 0.6 }}
          >
            © 2024 Zerohook. All rights reserved.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Link
              href="#"
              sx={{
                color: colors.text.inverse,
                textDecoration: 'none',
                opacity: 0.6,
                fontSize: '0.875rem',
                '&:hover': { opacity: 1 }
              }}
            >
              Terms of Service
            </Link>
            <Link
              href="#"
              sx={{
                color: colors.text.inverse,
                textDecoration: 'none',
                opacity: 0.6,
                fontSize: '0.875rem',
                '&:hover': { opacity: 1 }
              }}
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              sx={{
                color: colors.text.inverse,
                textDecoration: 'none',
                opacity: 0.6,
                fontSize: '0.875rem',
                '&:hover': { opacity: 1 }
              }}
            >
              Cookie Policy
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
