import React from 'react';
import { Box, Container, Typography, Grid, IconButton } from '@mui/material';
import { styled } from '@mui/system';
import {
  Twitter,
  Instagram,
  LinkedIn,
  Email,
  Phone,
  LocationOn,
  Telegram
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const FooterContainer = styled(Box)({
  background: 'linear-gradient(180deg, rgba(15, 15, 19, 0.95), rgba(10, 10, 15, 1))',
  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  paddingTop: '64px',
  paddingBottom: '32px',
});

const FooterLink = styled(RouterLink)({
  color: 'rgba(255, 255, 255, 0.6)',
  textDecoration: 'none',
  fontFamily: '"Outfit", sans-serif',
  fontSize: '14px',
  display: 'block',
  marginBottom: '12px',
  transition: 'all 0.2s ease',
  
  '&:hover': {
    color: '#00f2ea',
    transform: 'translateX(4px)',
  },
});

const SocialButton = styled(IconButton)({
  width: '44px',
  height: '44px',
  borderRadius: '12px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: 'rgba(255, 255, 255, 0.6)',
  marginRight: '12px',
  transition: 'all 0.3s ease',
  
  '&:hover': {
    background: 'rgba(0, 242, 234, 0.15)',
    borderColor: '#00f2ea',
    color: '#00f2ea',
    transform: 'translateY(-4px)',
  },
});

const GradientLogo = styled(Typography)({
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 800,
  fontSize: '32px',
  background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  marginBottom: '16px',
});

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { name: 'Browse Profiles', path: '/profiles' },
    { name: 'Adult Services', path: '/adult-services' },
    { name: 'Subscription', path: '/subscription' },
    { name: 'Dashboard', path: '/dashboard' },
  ];

  const supportLinks = [
    { name: 'Help Center', path: '/help' },
    { name: 'Safety Tips', path: '/safety' },
    { name: 'Report Issue', path: '/report' },
    { name: 'Contact Us', path: '/contact' },
  ];

  const legalLinks = [
    { name: 'Terms of Service', path: '/terms' },
    { name: 'Privacy Policy', path: '/privacy' },
    { name: 'Cookie Policy', path: '/cookies' },
    { name: 'Age Verification', path: '/age-verify' },
  ];

  return (
    <FooterContainer component="footer">
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Brand Section */}
          <Grid item xs={12} md={4}>
            <GradientLogo>Zerohook</GradientLogo>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontFamily: '"Outfit", sans-serif',
                fontSize: '14px',
                lineHeight: 1.8,
                mb: 3,
                maxWidth: '300px',
              }}
            >
              The premium platform for secure adult services. 
              Built with trust, powered by advanced security and 
              complete privacy protection.
            </Typography>
            
            {/* Social Media */}
            <Box sx={{ display: 'flex' }}>
              <SocialButton aria-label="Twitter">
                <Twitter fontSize="small" />
              </SocialButton>
              <SocialButton aria-label="Instagram">
                <Instagram fontSize="small" />
              </SocialButton>
              <SocialButton aria-label="Telegram">
                <Telegram fontSize="small" />
              </SocialButton>
              <SocialButton aria-label="LinkedIn">
                <LinkedIn fontSize="small" />
              </SocialButton>
            </Box>
          </Grid>

          {/* Quick Links */}
          <Grid item xs={6} sm={4} md={2}>
            <Typography
              sx={{
                color: '#ffffff',
                fontWeight: 700,
                fontFamily: '"Outfit", sans-serif',
                fontSize: '16px',
                mb: 3,
              }}
            >
              Quick Links
            </Typography>
            {quickLinks.map((link) => (
              <FooterLink key={link.path} to={link.path}>
                {link.name}
              </FooterLink>
            ))}
          </Grid>

          {/* Support */}
          <Grid item xs={6} sm={4} md={2}>
            <Typography
              sx={{
                color: '#ffffff',
                fontWeight: 700,
                fontFamily: '"Outfit", sans-serif',
                fontSize: '16px',
                mb: 3,
              }}
            >
              Support
            </Typography>
            {supportLinks.map((link) => (
              <FooterLink key={link.path} to={link.path}>
                {link.name}
              </FooterLink>
            ))}
          </Grid>

          {/* Legal */}
          <Grid item xs={6} sm={4} md={2}>
            <Typography
              sx={{
                color: '#ffffff',
                fontWeight: 700,
                fontFamily: '"Outfit", sans-serif',
                fontSize: '16px',
                mb: 3,
              }}
            >
              Legal
            </Typography>
            {legalLinks.map((link) => (
              <FooterLink key={link.path} to={link.path}>
                {link.name}
              </FooterLink>
            ))}
          </Grid>

          {/* Contact */}
          <Grid item xs={6} sm={4} md={2}>
            <Typography
              sx={{
                color: '#ffffff',
                fontWeight: 700,
                fontFamily: '"Outfit", sans-serif',
                fontSize: '16px',
                mb: 3,
              }}
            >
              Contact
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Email sx={{ color: '#00f2ea', fontSize: 18, mr: 1 }} />
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: '"Outfit", sans-serif',
                  fontSize: '14px',
                }}
              >
                support@zerohook.com
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Phone sx={{ color: '#00f2ea', fontSize: 18, mr: 1 }} />
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: '"Outfit", sans-serif',
                  fontSize: '14px',
                }}
              >
                +234 800 123 4567
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <LocationOn sx={{ color: '#00f2ea', fontSize: 18, mr: 1, mt: 0.3 }} />
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: '"Outfit", sans-serif',
                  fontSize: '14px',
                }}
              >
                Lagos, Nigeria
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Bottom Bar */}
        <Box
          sx={{
            mt: 6,
            pt: 3,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.4)',
              fontFamily: '"Outfit", sans-serif',
              fontSize: '13px',
            }}
          >
            © {currentYear} Zerohook. All rights reserved.
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontFamily: '"Outfit", sans-serif',
                fontSize: '13px',
              }}
            >
              🔒 Secure & Encrypted
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontFamily: '"Outfit", sans-serif',
                fontSize: '13px',
              }}
            >
              ✓ 18+ Only
            </Typography>
          </Box>
        </Box>
      </Container>
    </FooterContainer>
  );
};

export default Footer;
