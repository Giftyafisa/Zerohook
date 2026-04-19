import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Alert,
  Tab,
  Tabs
} from '@mui/material';
import {
  Diamond,
  Lock,
  LockOpen,
  Verified,
  LocationOn,
  Star,
  ShoppingCart
} from '@mui/icons-material';
import { GlassCard, GlassButton } from '../components/ui';
import apiClient from '../services/apiClient';
import CryptoPayment from '../components/payments/CryptoPayment';
import { getAccountType } from '../utils/accountTypeUtils';

const SugarProfilesPage = () => {
  const navigate = useNavigate();
  const currentLocation = useLocation();
  const { user, token, isAuthenticated } = useSelector((state) => state.auth);
  const accountType = getAccountType(user) || 'client';
  const isEligibleSugarViewer = accountType === 'provider' || accountType === 'client';
  
  const [loading, setLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeTab, setActiveTab] = useState('sugar_daddy');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [error, setError] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [cryptoPaymentData, setCryptoPaymentData] = useState(null);
  const [showCryptoPayment, setShowCryptoPayment] = useState(false);

  // Fetch access status
  const fetchAccessStatus = useCallback(async () => {
    if (!token) return;
    
    try {
      const { data } = await apiClient.get('/sugar-access/status');
      setAccessStatus(data);
      setPricing(data.effectivePricing || data.pricing || null);
    } catch (err) {
      console.error('Error fetching access status:', err);
    }
  }, [token]);

  // Fetch sugar profiles
  const fetchProfiles = useCallback(async (type) => {
    if (!token || !accessStatus) return;
    
    // Check if user has access to this type
    const hasAccess = type === 'sugar_daddy' 
      ? accessStatus.hasSugarDaddyAccess 
      : accessStatus.hasSugarMommyAccess;
    
    if (!hasAccess) {
      setProfiles([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.get(`/users/sugar-profiles?type=${type}`);
      setProfiles(data.profiles || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
      if (err.response?.data?.requiresPayment) {
        setProfiles([]);
      } else {
        setError(err.response?.data?.error || 'Failed to load profiles');
      }
    } finally {
      setLoading(false);
    }
  }, [token, accessStatus]);

  // Initialize payment via crypto
  const initializePayment = async (accessType) => {
    try {
      const { data } = await apiClient.post('/sugar-access/initialize', {
        accessType,
        billingCycle,
        cryptoSymbol: 'USDT'
      });
      if (data.paymentData?.address) {
        setCryptoPaymentData({
          walletAddress: data.paymentData.address,
          cryptoAmount: data.paymentData.cryptoAmount,
          cryptoSymbol: data.paymentData.cryptoSymbol,
          network: data.paymentData.network,
          qrData: data.paymentData.qrData,
          reference: data.paymentData.reference,
          expiresAt: data.paymentData.expiresAt,
          fiatAmount: data.amount,
          fiatCurrency: data.currency
        });
        setShowCryptoPayment(true);
      }
    } catch (err) {
      console.error('Payment initialization error:', err);
      setError(err.response?.data?.error || 'Failed to initialize payment');
    }
  };

  // Handle crypto payment confirmed
  const handleCryptoPaymentConfirmed = async () => {
    setShowCryptoPayment(false);
    setCryptoPaymentData(null);
    // Refresh access status after payment
    await fetchAccessStatus();
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: currentLocation.pathname, search: currentLocation.search, hash: currentLocation.hash } } });
      return;
    }
    
    if (!isEligibleSugarViewer) {
      // Ineligible roles should not access this page.
      navigate('/profiles');
      return;
    }

    fetchAccessStatus();
  }, [
    isAuthenticated,
    isEligibleSugarViewer,
    navigate,
    fetchAccessStatus,
    currentLocation.pathname,
    currentLocation.search,
    currentLocation.hash
  ]);

  useEffect(() => {
    if (accessStatus) {
      fetchProfiles(activeTab);
    }
  }, [accessStatus, activeTab, fetchProfiles]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Format currency
  const formatCurrency = (amount, currency = 'GHS') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Get access status for current tab
  const hasCurrentAccess = activeTab === 'sugar_daddy' 
    ? accessStatus?.hasSugarDaddyAccess 
    : accessStatus?.hasSugarMommyAccess;

  const activeCyclePricing = pricing?.[activeTab]?.[billingCycle] || null;
  const bundleCyclePricing = pricing?.both?.[billingCycle] || null;
  const cycleLabel = billingCycle === 'yearly' ? 'Yearly' : 'Monthly';

  if (!isEligibleSugarViewer) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">
          Only client and provider accounts can access the Sugar Profiles section.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
          <Diamond sx={{ fontSize: 40, color: '#FFD700' }} />
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 800,
              fontFamily: '"Outfit", sans-serif',
              background: 'linear-gradient(135deg, #FFD700, #FF69B4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Sugar Profiles
          </Typography>
        </Box>
        <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>
          Connect with VVIP members. Sugar access is standalone and can be billed monthly or yearly.
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          centered
          sx={{
            '& .MuiTab-root': {
              color: 'rgba(255,255,255,0.6)',
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 600,
              '&.Mui-selected': {
                color: activeTab === 'sugar_daddy' ? '#FFD700' : '#FF69B4'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: activeTab === 'sugar_daddy' ? '#FFD700' : '#FF69B4'
            }
          }}
        >
          <Tab 
            value="sugar_daddy" 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Diamond sx={{ color: '#FFD700' }} />
                Sugar Daddies
                {accessStatus?.hasSugarDaddyAccess ? (
                  <LockOpen sx={{ fontSize: 16, color: '#4CAF50' }} />
                ) : (
                  <Lock sx={{ fontSize: 16, color: '#ff5722' }} />
                )}
              </Box>
            }
          />
          <Tab 
            value="sugar_mommy" 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Diamond sx={{ color: '#FF69B4' }} />
                Sugar Mommies
                {accessStatus?.hasSugarMommyAccess ? (
                  <LockOpen sx={{ fontSize: 16, color: '#4CAF50' }} />
                ) : (
                  <Lock sx={{ fontSize: 16, color: '#ff5722' }} />
                )}
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* Access Required Card */}
      {!hasCurrentAccess && pricing && (
        <GlassCard sx={{ p: 4, mb: 4, textAlign: 'center' }}>
          <Lock sx={{ fontSize: 60, color: '#ff5722', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, fontFamily: '"Outfit", sans-serif' }}>
            Access Required
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
            Purchase access to view {activeTab === 'sugar_daddy' ? 'Sugar Daddy' : 'Sugar Mommy'} profiles.
            Access activates automatically after payment confirmation.
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
            <Chip
              label="Monthly"
              onClick={() => setBillingCycle('monthly')}
              color={billingCycle === 'monthly' ? 'success' : 'default'}
              sx={{ cursor: 'pointer' }}
            />
            <Chip
              label="Yearly (x10)"
              onClick={() => setBillingCycle('yearly')}
              color={billingCycle === 'yearly' ? 'success' : 'default'}
              sx={{ cursor: 'pointer' }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            {/* Individual Access */}
            <GlassCard 
              sx={{ 
                p: 3, 
                minWidth: 200,
                border: '1px solid rgba(255, 215, 0, 0.3)',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: '#FFD700',
                  transform: 'scale(1.02)'
                }
              }}
              onClick={() => initializePayment(activeTab)}
            >
              <Diamond sx={{ fontSize: 30, color: activeTab === 'sugar_daddy' ? '#FFD700' : '#FF69B4', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
                {activeTab === 'sugar_daddy' ? 'Sugar Daddy' : 'Sugar Mommy'} Access
              </Typography>
              <Typography variant="h5" sx={{ color: '#00f2ea', fontWeight: 800, my: 1 }}>
                {formatCurrency(activeCyclePricing?.price || 300, activeCyclePricing?.currency || 'GHS')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                {cycleLabel} Access
              </Typography>
              <GlassButton 
                variant="primary" 
                sx={{ mt: 2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  initializePayment(activeTab);
                }}
              >
                <ShoppingCart sx={{ mr: 1 }} />
                Purchase
              </GlassButton>
            </GlassCard>

            {/* Bundle Access */}
            <GlassCard 
              sx={{ 
                p: 3, 
                minWidth: 200,
                border: '2px solid rgba(255, 215, 0, 0.5)',
                position: 'relative',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: '#FFD700',
                  transform: 'scale(1.02)'
                }
              }}
              onClick={() => initializePayment('both')}
            >
              <Chip 
                label="Best Value" 
                size="small" 
                sx={{ 
                  position: 'absolute', 
                  top: -10, 
                  right: 10,
                  background: 'linear-gradient(135deg, #FFD700, #FF69B4)',
                  color: '#000',
                  fontWeight: 700
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1 }}>
                <Diamond sx={{ fontSize: 30, color: '#FFD700' }} />
                <Diamond sx={{ fontSize: 30, color: '#FF69B4' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
                Both Access
              </Typography>
              <Typography variant="h5" sx={{ color: '#00f2ea', fontWeight: 800, my: 1 }}>
                {formatCurrency(bundleCyclePricing?.price || 300, bundleCyclePricing?.currency || 'GHS')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                {cycleLabel} Access
              </Typography>
              <GlassButton 
                variant="primary" 
                sx={{ mt: 2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  initializePayment('both');
                }}
              >
                <ShoppingCart sx={{ mr: 1 }} />
                Purchase Bundle
              </GlassButton>
            </GlassCard>
          </Box>
        </GlassCard>
      )}

      {/* Loading State */}
      {loading && hasCurrentAccess && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#FFD700' }} />
        </Box>
      )}

      {/* Profiles Grid */}
      {hasCurrentAccess && !loading && (
        <>
          {profiles.length === 0 ? (
            <GlassCard sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                No {activeTab === 'sugar_daddy' ? 'Sugar Daddy' : 'Sugar Mommy'} profiles are currently visible.
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', mt: 1, fontSize: '14px' }}>
                VVIP members choose when to make their profiles visible to paid viewers.
              </Typography>
            </GlassCard>
          ) : (
            <Grid container spacing={3}>
              {profiles.map((profile) => (
                <Grid item xs={12} sm={6} md={4} key={profile.id}>
                  <GlassCard 
                    sx={{ 
                      p: 0, 
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'translateY(-5px)'
                      }
                    }}
                    onClick={() => navigate(`/profile/${profile.id}`)}
                  >
                    {/* Profile Image */}
                    <Box sx={{ position: 'relative', height: 200 }}>
                      <CardMedia
                        component="img"
                        height="200"
                        image={profile.profile_data?.photos?.[0] || '/default-avatar.png'}
                        alt={profile.username}
                        sx={{ objectFit: 'cover' }}
                      />
                      <Box 
                        sx={{ 
                          position: 'absolute', 
                          top: 10, 
                          right: 10,
                          display: 'flex',
                          gap: 1
                        }}
                      >
                        <Chip 
                          icon={<Diamond sx={{ color: activeTab === 'sugar_daddy' ? '#FFD700' : '#FF69B4' }} />}
                          label="VVIP"
                          size="small"
                          sx={{ 
                            background: 'rgba(0,0,0,0.7)',
                            color: '#fff',
                            fontWeight: 600
                          }}
                        />
                        {profile.verification_tier >= 2 && (
                          <Chip 
                            icon={<Verified sx={{ color: '#4CAF50' }} />}
                            label="Verified"
                            size="small"
                            sx={{ 
                              background: 'rgba(0,0,0,0.7)',
                              color: '#4CAF50'
                            }}
                          />
                        )}
                      </Box>
                    </Box>

                    {/* Profile Info */}
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
                        {profile.profile_data?.firstName || profile.username}
                        {profile.profile_data?.lastName && ` ${profile.profile_data.lastName.charAt(0)}.`}
                      </Typography>
                      
                      {profile.profile_data?.location && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                          <LocationOn sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            {profile.profile_data.location.city}, {profile.profile_data.location.country}
                          </Typography>
                        </Box>
                      )}

                      {profile.reputation_score && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                          <Star sx={{ fontSize: 16, color: '#FFD700' }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            {profile.reputation_score.toFixed(1)} reputation
                          </Typography>
                        </Box>
                      )}

                      <GlassButton 
                        variant="secondary" 
                        fullWidth 
                        sx={{ mt: 2 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${profile.id}`);
                        }}
                      >
                        View Profile
                      </GlassButton>
                    </CardContent>
                  </GlassCard>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Access Info */}
      {accessStatus && (
        <Box sx={{ mt: 4, p: 2, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1 }}>
            Your Access Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Sugar Daddy Access: {' '}
                <Chip 
                  size="small"
                  label={accessStatus.hasSugarDaddyAccess ? 'Active' : 'Not Purchased'}
                  sx={{ 
                    background: accessStatus.hasSugarDaddyAccess ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 87, 34, 0.2)',
                    color: accessStatus.hasSugarDaddyAccess ? '#4CAF50' : '#ff5722'
                  }}
                />
              </Typography>
              {accessStatus.accessDetails?.sugar_daddy?.expiresAt && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  Expires: {new Date(accessStatus.accessDetails.sugar_daddy.expiresAt).toLocaleDateString()} ({accessStatus.accessDetails.sugar_daddy.billingCycle || 'monthly'})
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Sugar Mommy Access: {' '}
                <Chip 
                  size="small"
                  label={accessStatus.hasSugarMommyAccess ? 'Active' : 'Not Purchased'}
                  sx={{ 
                    background: accessStatus.hasSugarMommyAccess ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 87, 34, 0.2)',
                    color: accessStatus.hasSugarMommyAccess ? '#4CAF50' : '#ff5722'
                  }}
                />
              </Typography>
              {accessStatus.accessDetails?.sugar_mommy?.expiresAt && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  Expires: {new Date(accessStatus.accessDetails.sugar_mommy.expiresAt).toLocaleDateString()} ({accessStatus.accessDetails.sugar_mommy.billingCycle || 'monthly'})
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Crypto Payment Dialog */}
      {showCryptoPayment && cryptoPaymentData && (
        <CryptoPayment
          open={showCryptoPayment}
          onClose={() => { setShowCryptoPayment(false); setCryptoPaymentData(null); }}
          paymentData={cryptoPaymentData}
          verifyEndpoint="/sugar-access/verify"
          onSuccess={handleCryptoPaymentConfirmed}
        />
      )}
    </Container>
  );
};

export default SugarProfilesPage;
