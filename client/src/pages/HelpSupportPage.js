import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Email as EmailIcon,
  Chat as ChatIcon,
  Phone as PhoneIcon,
  Security as SecurityIcon,
  Payment as PaymentIcon,
  AccountCircle as AccountIcon,
  Verified as VerifiedIcon,
  QuestionAnswer as FAQIcon,
  Send as SendIcon,
  Book as GuideIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const HelpSupportPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [contactMessage, setContactMessage] = useState('');

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  const supportCategories = [
    { icon: <AccountIcon />, label: 'Account', color: '#00f2ea' },
    { icon: <PaymentIcon />, label: 'Payments', color: '#00ff88' },
    { icon: <SecurityIcon />, label: 'Safety', color: '#ff0055' },
    { icon: <VerifiedIcon />, label: 'Verification', color: '#ffd700' }
  ];

  const faqs = [
    {
      id: 'panel1',
      question: 'How do I verify my account?',
      answer: 'To verify your account, go to Settings > Verification. You\'ll need to upload a valid government ID and take a selfie for facial verification. The process usually takes 24-48 hours.',
      category: 'Account'
    },
    {
      id: 'panel2',
      question: 'How does the escrow system work?',
      answer: 'Our escrow system holds payments securely until services are completed. When you book a service, funds are held in escrow. Once the service is completed and confirmed by both parties, funds are released to the provider.',
      category: 'Payments'
    },
    {
      id: 'panel3',
      question: 'What payment methods are accepted?',
      answer: 'We accept credit/debit cards, mobile money (M-Pesa, MTN Mobile Money), bank transfers via Paystack, and cryptocurrency payments (Bitcoin, Ethereum, USDT).',
      category: 'Payments'
    },
    {
      id: 'panel4',
      question: 'How do I report a user or service?',
      answer: 'You can report a user by going to their profile and clicking the "Report" button. For services, click the three-dot menu on the service listing. All reports are reviewed within 24 hours by our trust & safety team.',
      category: 'Safety'
    },
    {
      id: 'panel5',
      question: 'What are Trust Scores?',
      answer: 'Trust Scores are calculated based on verification status, user reviews, transaction history, and platform activity. Higher trust scores indicate more reliable users and providers.',
      category: 'Account'
    },
    {
      id: 'panel6',
      question: 'How do I withdraw my earnings?',
      answer: 'Go to Wallet > Withdraw and select your preferred withdrawal method. Minimum withdrawal is $10. Bank transfers take 1-3 business days, mobile money is instant, and crypto withdrawals process within 1 hour.',
      category: 'Payments'
    },
    {
      id: 'panel7',
      question: 'How do subscriptions work?',
      answer: 'We offer free and premium tiers. Premium subscribers get access to advanced features like priority listing, verified badges, and lower platform fees. Subscriptions renew automatically each month.',
      category: 'Account'
    },
    {
      id: 'panel8',
      question: 'What safety features does Zerohook have?',
      answer: 'We provide ID verification, trust scoring, secure escrow payments, encrypted messaging, fraud detection, emergency contacts, and 24/7 support. All users must verify their identity before offering services.',
      category: 'Safety'
    }
  ];

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const quickGuides = [
    { title: 'Getting Started', description: 'Learn the basics of using Zerohook', icon: <GuideIcon /> },
    { title: 'Create a Service', description: 'How to list your services', icon: <AccountIcon /> },
    { title: 'Stay Safe', description: 'Tips for safe interactions', icon: <SecurityIcon /> },
    { title: 'Payment Guide', description: 'Understanding payments & fees', icon: <PaymentIcon /> }
  ];

  const handleContactSubmit = () => {
    if (contactMessage.trim()) {
      // Would send to backend
      alert('Your message has been sent. We\'ll respond within 24 hours.');
      setContactMessage('');
    }
  };

  return (
    <Box sx={styles.container}>
      {/* Header */}
      <Box sx={styles.header}>
        <HelpIcon sx={styles.headerIcon} />
        <Typography sx={styles.headerTitle}>Help & Support</Typography>
      </Box>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <TextField
          fullWidth
          placeholder="Search for help..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#888' }} />
              </InputAdornment>
            )
          }}
          sx={styles.searchField}
        />
      </motion.div>

      {/* Support Categories */}
      <Box sx={styles.categoriesGrid}>
        {supportCategories.map((cat, index) => (
          <motion.div
            key={cat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Box sx={styles.categoryCard}>
              <Box sx={{ ...styles.categoryIcon, background: `${cat.color}20` }}>
                {React.cloneElement(cat.icon, { sx: { color: cat.color } })}
              </Box>
              <Typography sx={styles.categoryLabel}>{cat.label}</Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Quick Guides */}
      <Typography sx={styles.sectionTitle}>
        <GuideIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Quick Guides
      </Typography>
      <Box sx={styles.guidesGrid}>
        {quickGuides.map((guide, index) => (
          <motion.div
            key={guide.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Box sx={styles.guideCard}>
              <Box sx={styles.guideIcon}>{guide.icon}</Box>
              <Box>
                <Typography sx={styles.guideTitle}>{guide.title}</Typography>
                <Typography sx={styles.guideDescription}>{guide.description}</Typography>
              </Box>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* FAQs */}
      <Typography sx={styles.sectionTitle}>
        <FAQIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Frequently Asked Questions
      </Typography>
      <Box sx={styles.faqContainer}>
        {filteredFaqs.map((faq, index) => (
          <motion.div
            key={faq.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <Accordion
              expanded={expanded === faq.id}
              onChange={handleChange(faq.id)}
              sx={styles.accordion}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#00f2ea' }} />}
                sx={styles.accordionSummary}
              >
                <Box sx={styles.questionRow}>
                  <Typography sx={styles.question}>{faq.question}</Typography>
                  <Chip 
                    label={faq.category} 
                    size="small" 
                    sx={styles.categoryChip}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={styles.accordionDetails}>
                <Typography sx={styles.answer}>{faq.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          </motion.div>
        ))}
      </Box>

      {/* Contact Support */}
      <Typography sx={styles.sectionTitle}>
        <ChatIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Contact Support
      </Typography>
      <Box sx={styles.contactCard}>
        <Typography sx={styles.contactSubtitle}>
          Can't find what you're looking for? Send us a message.
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="Describe your issue..."
          value={contactMessage}
          onChange={(e) => setContactMessage(e.target.value)}
          sx={styles.messageField}
        />
        <Box sx={styles.contactActions}>
          <Box sx={styles.contactMethods}>
            <IconButton sx={styles.contactIcon}>
              <EmailIcon />
            </IconButton>
            <IconButton sx={styles.contactIcon}>
              <ChatIcon />
            </IconButton>
          </Box>
          <Button
            variant="contained"
            endIcon={<SendIcon />}
            onClick={handleContactSubmit}
            disabled={!contactMessage.trim()}
            sx={styles.sendButton}
          >
            Send Message
          </Button>
        </Box>
        
        <Box sx={styles.supportInfo}>
          <Typography sx={styles.supportText}>
            📧 support@zerohook.com
          </Typography>
          <Typography sx={styles.supportText}>
            💬 Live chat available 24/7
          </Typography>
          <Typography sx={styles.supportText}>
            ⏱️ Average response time: 2 hours
          </Typography>
        </Box>
      </Box>
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
  searchField: {
    mb: 3,
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: 3,
      color: '#fff',
      '& fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.1)'
      },
      '&:hover fieldset': {
        borderColor: 'rgba(0, 242, 234, 0.5)'
      },
      '&.Mui-focused fieldset': {
        borderColor: '#00f2ea'
      }
    }
  },
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 2,
    mb: 4
  },
  categoryCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
    padding: 2,
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 3,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.06)',
      transform: 'translateY(-2px)'
    }
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryLabel: {
    fontSize: '0.85rem',
    color: '#ccc',
    fontWeight: 500
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#fff',
    mb: 2,
    display: 'flex',
    alignItems: 'center'
  },
  guidesGrid: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
    gap: 2,
    mb: 4
  },
  guideCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: 2,
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 2,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    '&:hover': {
      background: 'rgba(0, 242, 234, 0.1)',
      borderColor: 'rgba(0, 242, 234, 0.3)'
    }
  },
  guideIcon: {
    width: 40,
    height: 40,
    borderRadius: 2,
    background: 'rgba(0, 242, 234, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#00f2ea'
  },
  guideTitle: {
    fontWeight: 600,
    color: '#fff',
    fontSize: '0.95rem'
  },
  guideDescription: {
    fontSize: '0.8rem',
    color: '#888'
  },
  faqContainer: {
    mb: 4
  },
  accordion: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px !important',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    mb: 1.5,
    '&:before': {
      display: 'none'
    },
    '&.Mui-expanded': {
      borderColor: 'rgba(0, 242, 234, 0.3)'
    }
  },
  accordionSummary: {
    '& .MuiAccordionSummary-content': {
      my: 1.5
    }
  },
  questionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    pr: 2
  },
  question: {
    fontWeight: 500,
    color: '#fff',
    fontSize: '0.95rem'
  },
  categoryChip: {
    background: 'rgba(0, 242, 234, 0.15)',
    color: '#00f2ea',
    fontSize: '0.7rem'
  },
  accordionDetails: {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    pt: 2
  },
  answer: {
    color: '#bbb',
    fontSize: '0.9rem',
    lineHeight: 1.7
  },
  contactCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 3,
    padding: 3,
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  contactSubtitle: {
    color: '#888',
    mb: 2
  },
  messageField: {
    mb: 2,
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      '& fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.15)'
      },
      '&:hover fieldset': {
        borderColor: 'rgba(0, 242, 234, 0.5)'
      },
      '&.Mui-focused fieldset': {
        borderColor: '#00f2ea'
      }
    }
  },
  contactActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3
  },
  contactMethods: {
    display: 'flex',
    gap: 1
  },
  contactIcon: {
    color: '#888',
    '&:hover': {
      color: '#00f2ea'
    }
  },
  sendButton: {
    background: 'linear-gradient(135deg, #00f2ea, #00b4d8)',
    color: '#000',
    fontWeight: 600,
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4d0, #0096c7)'
    },
    '&.Mui-disabled': {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#555'
    }
  },
  supportInfo: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 3,
    padding: 2,
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 2
  },
  supportText: {
    fontSize: '0.85rem',
    color: '#ccc'
  }
};

export default HelpSupportPage;
