/**
 * InfoPages - Static informational pages
 * About, Privacy Policy, Terms, Contact, Trust & Safety, How it Works
 * Zerohook Platform
 */

import React from 'react';
import { Box, Container, Typography, Paper, Grid, Divider } from '@mui/material';
import { 
  Info, 
  Security, 
  Gavel, 
  PrivacyTip, 
  Help, 
  ContactSupport,
  Shield,
  Verified,
  Lock,
  AttachMoney,
  Support,
  Email,
  Phone
} from '@mui/icons-material';

const PageContainer = ({ children, title, icon: Icon }) => (
  <Box sx={{ 
    minHeight: '100vh', 
    bgcolor: '#0f0f13',
    pt: { xs: 2, md: 4 },
    pb: { xs: 10, md: 4 }
  }}>
    <Container maxWidth="md">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        {Icon && <Icon sx={{ fontSize: 40, color: '#00f2ea' }} />}
        <Typography variant="h3" sx={{ 
          fontWeight: 700, 
          color: '#fff',
          fontSize: { xs: '1.75rem', md: '2.5rem' }
        }}>
          {title}
        </Typography>
      </Box>
      {children}
    </Container>
  </Box>
);

const ContentSection = ({ title, children }) => (
  <Paper sx={{ 
    p: 3, 
    mb: 3, 
    bgcolor: 'rgba(30,30,35,0.9)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)'
  }}>
    {title && (
      <Typography variant="h6" sx={{ color: '#00f2ea', mb: 2, fontWeight: 600 }}>
        {title}
      </Typography>
    )}
    <Typography sx={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
      {children}
    </Typography>
  </Paper>
);

// About Us Page
export const AboutPage = () => (
  <PageContainer title="About Zerohook" icon={Info}>
    <ContentSection title="Our Mission">
      Zerohook is a secure marketplace connecting adults with premium services. 
      We prioritize safety, privacy, and trust in every interaction.
    </ContentSection>
    <ContentSection title="Why Choose Us">
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <Shield sx={{ fontSize: 48, color: '#00f2ea', mb: 1 }} />
            <Typography sx={{ color: '#fff', fontWeight: 600 }}>Verified Users</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
              Multi-tier verification system
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <Lock sx={{ fontSize: 48, color: '#00f2ea', mb: 1 }} />
            <Typography sx={{ color: '#fff', fontWeight: 600 }}>Secure Payments</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
              Escrow protection for all transactions
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <AttachMoney sx={{ fontSize: 48, color: '#00f2ea', mb: 1 }} />
            <Typography sx={{ color: '#fff', fontWeight: 600 }}>Fair Pricing</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
              Transparent fees, no hidden costs
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </ContentSection>
  </PageContainer>
);

// Privacy Policy Page
export const PrivacyPage = () => (
  <PageContainer title="Privacy Policy" icon={PrivacyTip}>
    <ContentSection title="Information We Collect">
      We collect information you provide directly, including profile details, 
      communication data, and transaction records. We also collect usage data 
      to improve our services.
    </ContentSection>
    <ContentSection title="How We Use Your Information">
      Your data is used to provide services, verify identities, process payments, 
      prevent fraud, and improve user experience. We never sell your personal data.
    </ContentSection>
    <ContentSection title="Data Protection">
      We employ industry-standard encryption, secure servers, and regular security 
      audits to protect your information. Your privacy is our priority.
    </ContentSection>
    <ContentSection title="Your Rights">
      You can access, update, or delete your data at any time through your account 
      settings. Contact us for any privacy-related requests.
    </ContentSection>
  </PageContainer>
);

// Terms of Service Page
export const TermsPage = () => (
  <PageContainer title="Terms of Service" icon={Gavel}>
    <ContentSection title="Acceptance of Terms">
      By using Zerohook, you agree to these terms. You must be 18+ to use our platform.
    </ContentSection>
    <ContentSection title="User Conduct">
      Users must behave respectfully, not engage in illegal activities, and comply 
      with local laws. Harassment, fraud, and deceptive practices are prohibited.
    </ContentSection>
    <ContentSection title="Payments & Refunds">
      All payments are processed securely. Escrow funds are released upon service 
      completion. Disputes are handled through our resolution system.
    </ContentSection>
    <ContentSection title="Account Termination">
      We reserve the right to suspend or terminate accounts that violate our terms 
      or engage in prohibited activities.
    </ContentSection>
  </PageContainer>
);

// Trust & Safety Page
export const TrustSafetyPage = () => (
  <PageContainer title="Trust & Safety" icon={Security}>
    <ContentSection title="Verification Tiers">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Verified sx={{ color: '#888' }} />
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 600 }}>Basic</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
              Email verified
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Verified sx={{ color: '#00f2ea' }} />
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 600 }}>Verified</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
              ID and phone verified
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Verified sx={{ color: '#FFD700' }} />
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 600 }}>Elite</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
              Full verification with background check
            </Typography>
          </Box>
        </Box>
      </Box>
    </ContentSection>
    <ContentSection title="Escrow Protection">
      All transactions use escrow. Money is held securely until service is completed 
      and both parties are satisfied. This protects against fraud.
    </ContentSection>
    <ContentSection title="Report Issues">
      If you encounter suspicious activity or feel unsafe, use the in-app report 
      feature or contact our support team immediately.
    </ContentSection>
  </PageContainer>
);

// How It Works Page
export const HowItWorksPage = () => (
  <PageContainer title="How It Works" icon={Help}>
    <ContentSection title="For Clients">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          1. <strong style={{ color: '#00f2ea' }}>Browse</strong> - Explore verified providers near you
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          2. <strong style={{ color: '#00f2ea' }}>Connect</strong> - Message providers to discuss services
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          3. <strong style={{ color: '#00f2ea' }}>Book</strong> - Create a booking with escrow payment
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          4. <strong style={{ color: '#00f2ea' }}>Meet</strong> - Complete the service safely
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          5. <strong style={{ color: '#00f2ea' }}>Review</strong> - Leave feedback to help the community
        </Typography>
      </Box>
    </ContentSection>
    <ContentSection title="For Providers">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          1. <strong style={{ color: '#00f2ea' }}>Register</strong> - Create your provider profile
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          2. <strong style={{ color: '#00f2ea' }}>Verify</strong> - Complete verification for higher trust
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          3. <strong style={{ color: '#00f2ea' }}>List Services</strong> - Add your services and pricing
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          4. <strong style={{ color: '#00f2ea' }}>Accept Bookings</strong> - Receive and manage requests
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
          5. <strong style={{ color: '#00f2ea' }}>Get Paid</strong> - Receive payment after completion
        </Typography>
      </Box>
    </ContentSection>
  </PageContainer>
);

// Contact Us Page
export const ContactPage = () => (
  <PageContainer title="Contact Us" icon={ContactSupport}>
    <ContentSection title="Get In Touch">
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Email sx={{ color: '#00f2ea' }} />
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 600 }}>Email Support</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>
                support@zerohook.com
              </Typography>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Support sx={{ color: '#00f2ea' }} />
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 600 }}>Live Chat</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Available 24/7 in-app
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </ContentSection>
    <ContentSection title="Business Inquiries">
      For partnerships, press, or business inquiries, contact us at 
      business@zerohook.com
    </ContentSection>
    <ContentSection title="Report Safety Issues">
      If you encounter urgent safety concerns, use our in-app emergency 
      reporting feature or email safety@zerohook.com immediately.
    </ContentSection>
  </PageContainer>
);

export default {
  AboutPage,
  PrivacyPage,
  TermsPage,
  TrustSafetyPage,
  HowItWorksPage,
  ContactPage
};
