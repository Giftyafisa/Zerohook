import React, { useState, useEffect, useCallback, useRef } from 'react';
import CryptoPayment from '../components/payments/CryptoPayment';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  InputAdornment,
  Slide
} from '@mui/material';
import { toast } from 'react-toastify';
import { TELEGRAM_CONFIG } from '../config/constants';
import apiClient from '../services/apiClient';
import {
  AccountBalanceWallet as WalletIcon,
  Add as AddIcon,
  Send as SendIcon,
  ArrowUpward as DepositIcon,
  ArrowDownward as WithdrawIcon,
  Lock as HeldIcon,
  CheckCircle as ReleaseIcon,
  Warning as DisputeIcon,
  History as HistoryIcon,
  ArrowBack as BackIcon,
  Home as HomeIcon,
  Help as HelpIcon,
  PhoneAndroid as MobileIcon,
  CreditCard as CardIcon,
  Receipt as ReceiptIcon,
  Info as InfoIcon,
  VpnKey as PinIcon,
  Timer as TimerIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
  Gavel as GavelIcon,
  AttachFile as AttachIcon,
  Telegram as TelegramIcon,
  OpenInNew as OpenInNewIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import useCurrency from '../hooks/useCurrency';

// Fullscreen transition for dialogs
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Tab name to index mapping for URL-based tab selection
const TAB_MAP = {
  'wallet': 0,
  'transactions': 1,
};

const MyMoneyPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const currentLocation = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { symbol, currencyCode } = useCurrency();
  const mountedRef = useRef(true);
  const timeoutIdsRef = useRef(new Set());
  
  // Tab state - initialize from URL param if present
  const pathTab = currentLocation.pathname === '/transactions' ? 'transactions' : null;
  const initialTab = TAB_MAP[searchParams.get('tab') || pathTab] ?? 0;
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Data
  const [walletData, setWalletData] = useState({
    balance: 0,
    escrowHeld: 0,
    pendingWithdrawal: 0,
    escrows: [],
    transactions: []
  });
  
  // Dialogs
  const [addMoneyDialog, setAddMoneyDialog] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawCrypto, setWithdrawCrypto] = useState('USDT');
  const [cryptoSymbol, setCryptoSymbol] = useState('USDT');
  const [telegramDialog, setTelegramDialog] = useState(false);
  const [telegramAmount, setTelegramAmount] = useState('');
  const [cryptoPaymentData, setCryptoPaymentData] = useState(null);
  const [showCryptoPayment, setShowCryptoPayment] = useState(false);
  
  // PIN Verification States
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [selectedEscrow, setSelectedEscrow] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [disputeStatus, setDisputeStatus] = useState(null);
  
  // Success/Error messages
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // Currency-specific quick amounts
  const getQuickAmounts = () => {
    // Ghana cedis use smaller amounts
    if (symbol === '₵') return [2, 5, 10, 50, 100];
    // Nigerian naira use larger amounts  
    if (symbol === '₦') return [1000, 2000, 5000, 10000, 20000];
    // Default for other currencies
    return [10, 20, 50, 100, 500];
  };

  const scheduleTimeout = useCallback((callback, delay) => {
    const timeoutId = setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);

      if (mountedRef.current) {
        callback();
      }
    }, delay);

    timeoutIdsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

  useEffect(() => {
    const activeTimeoutIds = timeoutIdsRef.current;

    return () => {
      mountedRef.current = false;
      activeTimeoutIds.forEach(clearTimeout);
      activeTimeoutIds.clear();
    };
  }, []);

  const openTelegramChat = (username, message) => {
    const encodedMessage = encodeURIComponent(message);
    const telegramUrl = `https://t.me/${username}?text=${encodedMessage}`;
    const newWindow = window.open(telegramUrl, '_blank', 'noopener,noreferrer');

    if (newWindow) {
      newWindow.opener = null;
    } else {
      toast.error('Popup blocked. Please allow pop-ups to open Telegram.');
    }
  };

  // Fetch all wallet data
  const fetchAllData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    try {
      // Fetch wallet, transactions, and escrows in parallel
      const [walletResult, txResult, escrowResult] = await Promise.allSettled([
        apiClient.get('/payments/wallet'),
        apiClient.get('/payments/transactions'),
        apiClient.get('/escrow/list'),
      ]);

      let balance = 0, escrowHeld = 0, pendingWithdrawal = 0;
      let transactions = [];
      let escrows = [];

      if (walletResult.status === 'fulfilled') {
        const data = walletResult.value.data;
        balance = data.wallet?.balance || data.balance || 0;
        escrowHeld = data.wallet?.escrowHeld || data.escrowHeld || 0;
        pendingWithdrawal = data.wallet?.pendingWithdrawal || data.pendingWithdrawal || 0;
      }

      if (txResult.status === 'fulfilled') {
        const data = txResult.value.data;
        transactions = data.transactions || data.data || [];
      }

      if (escrowResult.status === 'fulfilled') {
        const data = escrowResult.value.data;
        escrows = data.escrows || data.data || [];
      }

      if (!mountedRef.current) return;

      setWalletData({
        balance,
        escrowHeld,
        pendingWithdrawal,
        transactions,
        escrows
      });
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // [LEGACY] Handle payment redirect callback - from Paystack era.
  // Crypto payments use polling in CryptoPayment component instead.
  // Kept as fallback in case any redirect-based flow is added later.
  useEffect(() => {
    const handlePaymentCallback = async () => {
      const reference = searchParams.get('reference');
      const trxref = searchParams.get('trxref'); // Legacy reference parameter
      
      const paymentRef = reference || trxref;
      
      if (paymentRef) {
        console.log('🔄 Payment redirect detected, verifying payment:', paymentRef);
        setLoading(true);
        
        try {
          const response = await apiClient.post('/payments/verify-inline', { reference: paymentRef });
          const data = response.data;

          if (!mountedRef.current) return;
          
          if (data.success) {
            console.log('✅ Payment verified successfully:', data);
            const amount = data.amount || 0;
            const currency = data.currency || symbol;
            toast.success(`Payment of ${currency}${amount.toLocaleString()} verified and credited to your wallet!`);
            setSuccessMessage(`Payment of ${currency}${amount.toLocaleString()} credited!`);
          } else if (data.status === 'already_verified') {
            console.log('ℹ️ Payment was already verified');
            toast.info('Payment already credited to your wallet!');
          } else {
            console.error('❌ Payment verification failed:', data);
            toast.error(data.error || 'Payment verification failed. Please contact support.');
            setErrorMessage(data.error || 'Payment verification failed');
          }
        } catch (err) {
          console.error('Payment verification error:', err);
          toast.error('Failed to verify payment. Please contact support if funds were deducted.');
          setErrorMessage('Verification failed. Contact support if charged.');
        }

        if (!mountedRef.current) return;
        
        // Clear URL params
        setSearchParams({});
        
        // Refresh wallet data
        await fetchAllData();
        
        // Clear messages after delay
        scheduleTimeout(() => {
          setSuccessMessage(null);
          setErrorMessage(null);
        }, 5000);
      }
    };
    
    if (isAuthenticated) {
      handlePaymentCallback();
    }
  }, [isAuthenticated, searchParams, setSearchParams, fetchAllData, symbol, scheduleTimeout]);

  // ==================== PIN VERIFICATION SYSTEM ====================
  
  // Copy PIN to clipboard
  const handleCopyPin = (pin) => {
    navigator.clipboard.writeText(pin);
    toast.success('PIN copied to clipboard!');
  };

  // Open PIN entry dialog (for provider)
  const openPinEntry = (escrow) => {
    setSelectedEscrow(escrow);
    setPinInput('');
    setPinDialogOpen(true);
  };

  // Enter PIN (Provider submits PIN to verify service)
  const handleEnterPin = async () => {
    if (!selectedEscrow || !pinInput || pinInput.length !== 6) {
      toast.error('Please enter the 6-digit PIN');
      return;
    }

    setActionLoading(true);
    try {
      await apiClient.post('/escrow/enter-pin', {
        escrowId: selectedEscrow.id, 
        pin: pinInput 
      });

      // Update local state
      setWalletData(prev => ({
        ...prev,
        escrows: prev.escrows.map(e => 
          e.id === selectedEscrow.id ? { ...e, status: 'pin_entered', pin_entered_at: new Date().toISOString() } : e
        )
      }));
      toast.success('PIN verified! Waiting for client confirmation.');
      setPinDialogOpen(false);
      setPinInput('');
      setSelectedEscrow(null);
    } catch (error) {
      console.error('PIN entry error:', error);
      toast.error(error.response?.data?.error || 'Failed to verify PIN');
    } finally {
      setActionLoading(false);
    }
  };

  // Client confirms service completed
  const handleConfirmService = async (escrow) => {
    setSelectedEscrow(escrow);
    setConfirmDialogOpen(true);
  };

  const confirmServiceDelivery = async () => {
    if (!selectedEscrow) return;

    setActionLoading(true);
    try {
      await apiClient.post('/escrow/confirm', { escrowId: selectedEscrow.id });

      setWalletData(prev => ({
        ...prev,
        escrows: prev.escrows.map(e => 
          e.id === selectedEscrow.id ? { ...e, status: 'released' } : e
        )
      }));
      toast.success('Payment released to provider!');
      setConfirmDialogOpen(false);
      setSelectedEscrow(null);
    } catch (error) {
      console.error('Confirm error:', error);
      toast.error(error.response?.data?.error || 'Failed to confirm service');
    } finally {
      setActionLoading(false);
    }
  };

  // Open dispute dialog (new version with evidence support)
  const openDisputeDialog = (escrow) => {
    setSelectedEscrow(escrow);
    setDisputeReason('');
    setDisputeEvidence(null);
    setDisputeDialogOpen(true);
  };

  // Submit dispute with evidence
  const handleSubmitDispute = async () => {
    if (!selectedEscrow || !disputeReason.trim()) {
      toast.error('Please describe the issue');
      return;
    }

    setActionLoading(true);
    try {
      await apiClient.post('/escrow/dispute', {
        escrowId: selectedEscrow.id, 
        reason: disputeReason 
      });

      // Upload evidence if provided
      if (disputeEvidence) {
        const formData = new FormData();
        formData.append('file', disputeEvidence);
        formData.append('description', 'Dispute evidence');
        
        await apiClient.post(`/escrow/${selectedEscrow.id}/evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setWalletData(prev => ({
        ...prev,
        escrows: prev.escrows.map(e => 
          e.id === selectedEscrow.id ? { ...e, status: 'disputed' } : e
        )
      }));
      toast.info('Dispute submitted. Our team will review and contact you within 24-48 hours.');
      setDisputeDialogOpen(false);
      setSelectedEscrow(null);
      setDisputeReason('');
      setDisputeEvidence(null);
    } catch (error) {
      console.error('Dispute error:', error);
      toast.error(error.response?.data?.error || 'Failed to submit dispute');
    } finally {
      setActionLoading(false);
    }
  };

  // Provider claims service was completed (when client refuses to share PIN)
  const handleClaimComplete = async (escrow) => {
    const confirmed = window.confirm(
      `Claim that you completed this service?\n\n` +
      `If the client doesn't respond within 24 hours, payment will auto-release to you.\n\n` +
      `⚠️ WARNING: False claims may result in account penalties.`
    );
    
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const response = await apiClient.post('/escrow/claim-complete', {
        escrowId: escrow.id,
        evidenceDescription: 'Service completed as agreed'
      });

      const data = response.data;

      setWalletData(prev => ({
        ...prev,
        escrows: prev.escrows.map(e => 
          e.id === escrow.id ? { 
            ...e, 
            provider_claimed_complete: true,
            provider_claim_data: {
              client_response_deadline: data.clientResponseDeadline
            }
          } : e
        )
      }));
      toast.success('Service completion claimed! Client has been notified.');
      toast.info('If client doesn\'t respond within 24 hours, payment will auto-release to you.');
    } catch (error) {
      console.error('Claim complete error:', error);
      toast.error(error.response?.data?.error || 'Failed to claim completion');
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch user's dispute status (warnings/strikes)
  const fetchDisputeStatus = useCallback(async () => {
    try {
      const response = await apiClient.get('/escrow/dispute-status');
      setDisputeStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch dispute status:', error);
    }
  }, []);

  // Fetch dispute status on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchDisputeStatus();
    }
  }, [isAuthenticated, fetchDisputeStatus]);

  // Calculate time remaining for confirmation
  const getTimeRemaining = (autoReleaseAt) => {
    if (!autoReleaseAt) return null;
    const now = new Date();
    const release = new Date(autoReleaseAt);
    const diff = release - now;
    
    if (diff <= 0) return 'Auto-release imminent';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  // Get escrow status display info
  const getEscrowStatusInfo = (escrow) => {
    // Check for provider claim first (it's a sub-state of 'held')
    if (escrow.provider_claimed_complete && escrow.status === 'held') {
      return {
        label: 'Provider Claims Complete',
        color: '#ff9800',
        bgcolor: 'rgba(255, 152, 0, 0.2)',
        icon: <TimerIcon sx={{ fontSize: 16 }} />,
        urgent: true
      };
    }

    switch (escrow.status) {
      case 'held':
        return {
          label: 'Awaiting Service',
          color: '#ffd700',
          bgcolor: 'rgba(255, 215, 0, 0.2)',
          icon: <HeldIcon sx={{ fontSize: 16 }} />
        };
      case 'pin_entered':
        return {
          label: 'PIN Verified - Confirm',
          color: '#00f2ea',
          bgcolor: 'rgba(0, 242, 234, 0.2)',
          icon: <PinIcon sx={{ fontSize: 16 }} />
        };
      case 'disputed':
        return {
          label: 'Under Review',
          color: '#ff5722',
          bgcolor: 'rgba(255, 87, 34, 0.2)',
          icon: <GavelIcon sx={{ fontSize: 16 }} />
        };
      case 'released':
      case 'completed':
        return {
          label: 'Completed',
          color: '#00ff88',
          bgcolor: 'rgba(0, 255, 136, 0.2)',
          icon: <ReleaseIcon sx={{ fontSize: 16 }} />
        };
      case 'refunded':
        return {
          label: 'Refunded',
          color: '#9c27b0',
          bgcolor: 'rgba(156, 39, 176, 0.2)',
          icon: <DepositIcon sx={{ fontSize: 16 }} />
        };
      default:
        return {
          label: escrow.status || 'Pending',
          color: '#888',
          bgcolor: 'rgba(136, 136, 136, 0.2)',
          icon: <HeldIcon sx={{ fontSize: 16 }} />
        };
    }
  };

  // ==================== END PIN VERIFICATION SYSTEM ====================

  // Add money via Crypto - Fee-free blockchain deposit
  const handleAddMoney = async () => {
    const minAmount = symbol === '₵' ? 1 : 100; // GHS min is 1, NGN min is 100
    if (!addAmount || Number(addAmount) < minAmount) {
      toast.warning(`Minimum amount is ${symbol}${minAmount}`);
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await apiClient.post('/payments/deposit', {
        amount: Number(addAmount),
        cryptoSymbol: cryptoSymbol,
        currency: currencyCode
      });

      const data = response.data;

      // Show crypto payment dialog
      const depositAddress = data.address || data.walletAddress;
      if (depositAddress) {
        setAddMoneyDialog(false);
        setAddAmount('');
        setCryptoPaymentData({
          address: depositAddress,
          walletAddress: depositAddress,
          cryptoAmount: data.cryptoAmount,
          cryptoSymbol: data.cryptoSymbol || cryptoSymbol,
          reference: data.reference,
          expiresAt: data.expiresAt,
          network: data.network,
          fiatAmount: data.fiatAmount,
          fiatCurrency: data.currency,
          rate: data.rate
        });
        setShowCryptoPayment(true);
        setActionLoading(false);
      } else {
        // Wallet/balance payment succeeded directly
        toast.success(`Deposit of ${symbol}${Number(addAmount).toLocaleString()} initiated!`);
        setSuccessMessage(`${symbol}${Number(addAmount).toLocaleString()} deposit in progress!`);
        setActionLoading(false);
        setAddMoneyDialog(false);
        setAddAmount('');
        scheduleTimeout(() => {
          fetchAllData();
          setSuccessMessage(null);
        }, 2000);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed. Try again.');
      setActionLoading(false);
      setAddMoneyDialog(false);
    }
  };

  const handleCryptoDepositConfirmed = (result) => {
    setShowCryptoPayment(false);
    setCryptoPaymentData(null);
    toast.success('Deposit confirmed!');
    setSuccessMessage('Deposit confirmed and added to wallet!');
    scheduleTimeout(() => {
      fetchAllData();
      setSuccessMessage(null);
    }, 2000);
  };

  // Withdraw money to crypto wallet
  const handleWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) > walletData.balance) {
      toast.warning('Invalid amount or insufficient balance');
      return;
    }
    if (!withdrawAddress || withdrawAddress.trim().length < 10) {
      toast.warning('Please enter a valid crypto wallet address');
      return;
    }
    
    setActionLoading(true);
    try {
      await apiClient.post('/payments/withdraw', {
        amount: Number(withdrawAmount),
        cryptoSymbol: withdrawCrypto,
        network: withdrawCrypto,
        destinationAddress: withdrawAddress.trim()
      });

      toast.success('Withdrawal request submitted! Admin will process within 24 hours.');
      setWalletData(prev => ({
        ...prev,
        balance: prev.balance - Number(withdrawAmount),
        pendingWithdrawal: prev.pendingWithdrawal + Number(withdrawAmount)
      }));
    } catch (error) {
      console.error('Withdraw error:', error);
      toast.error(error.response?.data?.error || 'Withdrawal failed.');
    } finally {
      setActionLoading(false);
      setWithdrawDialog(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
    }
  };

  // Get active escrows (held status)
  const activeEscrows = walletData.escrows.filter(e => e.status === 'held' || e.status === 'pending');
  const pastEscrows = walletData.escrows.filter(e => e.status !== 'held' && e.status !== 'pending');

  if (!isAuthenticated) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.emptyState}>
          <WalletIcon sx={{ fontSize: 64, color: '#333', mb: 2 }} />
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Log in to see your money
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/login', { state: { from: { pathname: currentLocation.pathname, search: currentLocation.search, hash: currentLocation.hash } } })}
            sx={styles.primaryBtn}
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
        <WalletIcon sx={styles.headerIcon} />
        <Typography sx={styles.headerTitle}>My Money</Typography>
      </Box>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2, bgcolor: 'rgba(0, 255, 136, 0.1)' }}>
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(255, 87, 34, 0.1)' }}>
          {errorMessage}
        </Alert>
      )}

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Box sx={styles.balanceCard}>
          <Typography sx={styles.balanceLabel}>Available Balance</Typography>
          <Typography sx={styles.balanceAmount}>
            {symbol}{Number(walletData.balance).toLocaleString()}
          </Typography>
          
          {/* Quick Actions */}
          <Box sx={styles.quickActions}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddMoneyDialog(true)}
              sx={{ ...styles.actionBtn, bgcolor: '#00f2ea', color: '#000' }}
            >
              Add Money
            </Button>
            <Button
              variant="contained"
              startIcon={<TelegramIcon />}
              onClick={() => setTelegramDialog(true)}
              sx={{ ...styles.actionBtn, bgcolor: '#0088cc', color: '#fff', '&:hover': { bgcolor: '#006699' } }}
            >
              Telegram
            </Button>
            <Button
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={() => setWithdrawDialog(true)}
              disabled={walletData.balance <= 0}
              sx={{ ...styles.actionBtn, borderColor: '#ff0055', color: '#ff0055' }}
            >
              Withdraw
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, v) => setActiveTab(v)}
        sx={styles.tabs}
        variant="fullWidth"
      >
        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HeldIcon fontSize="small" />
              Held
              {activeEscrows.length > 0 && (
                <Chip label={activeEscrows.length} size="small" sx={{ bgcolor: '#00ff88', color: '#000', height: 20 }} />
              )}
            </Box>
          } 
        />
        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon fontSize="small" />
              History
            </Box>
          } 
        />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box sx={styles.tabContent}>
          {activeEscrows.length === 0 ? (
            <Box sx={styles.emptyTab}>
              <HeldIcon sx={{ fontSize: 48, color: '#444', mb: 2 }} />
              <Typography color="text.secondary">No held payments</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                When you hold money for a service, it will appear here
              </Typography>
            </Box>
          ) : (
            activeEscrows.map((escrow) => {
              const statusInfo = getEscrowStatusInfo(escrow);
              // Check role - backend returns userRole, clientId, providerId
              const isClient = escrow.userRole === 'client' || escrow.clientId === user?.id || escrow.client_id === user?.id;
              const isProvider = escrow.userRole === 'provider' || escrow.providerId === user?.id || escrow.provider_id === user?.id;
              const hasProviderClaim = escrow.provider_claimed_complete || escrow.providerClaimedComplete;
              // Get PIN - backend returns as completionPin
              const escrowPin = escrow.completionPin || escrow.completion_pin;
              
              // Escrow debug removed - was causing console spam
              
              return (
                <motion.div
                  key={escrow.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Box sx={{ 
                    ...styles.escrowCard, 
                    border: statusInfo.urgent ? '2px solid #ff9800' : undefined 
                  }}>
                    {/* Role Indicator */}
                    <Chip 
                      label={isClient ? '👤 You are the CLIENT (paying)' : '🛠️ You are the PROVIDER (receiving)'} 
                      size="small"
                      sx={{ 
                        mb: 1, 
                        bgcolor: isClient ? 'rgba(255, 152, 0, 0.2)' : 'rgba(0, 242, 234, 0.2)', 
                        color: isClient ? '#ff9800' : '#00f2ea',
                        fontSize: '0.7rem'
                      }} 
                    />
                    
                    {/* Header with Status */}
                    <Box sx={styles.escrowHeader}>
                      <Typography sx={styles.escrowProvider}>
                        {isClient 
                          ? (escrow.providerName || escrow.provider_name || 'Service Provider')
                          : (escrow.clientName || escrow.client_name || 'Client')
                        }
                      </Typography>
                      <Chip 
                        icon={statusInfo.icon}
                        label={statusInfo.label} 
                        size="small" 
                        sx={{ bgcolor: statusInfo.bgcolor, color: statusInfo.color }} 
                      />
                    </Box>
                    
                    {/* Amount */}
                    <Typography sx={styles.escrowAmount}>
                      {symbol}{Number(escrow.amount).toLocaleString()}
                    </Typography>
                    <Typography sx={styles.escrowDate}>
                      {escrow.createdAt ? new Date(escrow.createdAt).toLocaleDateString() : (escrow.created_at ? new Date(escrow.created_at).toLocaleDateString() : 'Recently')}
                    </Typography>

                    {/* ============ CLIENT VIEW ============ */}
                    {isClient && (
                      <Box sx={{ mt: 2 }}>
                        {/* Status: Held - Show PIN */}
                        {escrow.status === 'held' && !hasProviderClaim && (
                          <>
                            {/* PIN Display */}
                            <Box sx={{ 
                              p: 2, 
                              bgcolor: 'rgba(0, 255, 136, 0.1)', 
                              borderRadius: 2, 
                              mb: 2,
                              border: '1px dashed #00ff88'
                            }}>
                              <Typography variant="caption" sx={{ color: '#888', mb: 1, display: 'block' }}>
                                YOUR COMPLETION PIN
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{ 
                                  fontFamily: 'monospace', 
                                  fontSize: '1.8rem', 
                                  fontWeight: 'bold',
                                  color: '#00ff88',
                                  letterSpacing: '0.3rem'
                                }}>
                                  {showPin ? (escrowPin || '------') : '••••••'}
                                </Typography>
                                <IconButton 
                                  size="small" 
                                  onClick={() => setShowPin(!showPin)}
                                  sx={{ color: '#888' }}
                                >
                                  {showPin ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                </IconButton>
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleCopyPin(escrowPin)}
                                  sx={{ color: '#00ff88' }}
                                >
                                  <CopyIcon />
                                </IconButton>
                              </Box>
                              <Alert severity="warning" sx={{ mt: 1, bgcolor: 'transparent', p: 0 }}>
                                <Typography variant="caption">
                                  Share this PIN with the provider ONLY AFTER you receive the service
                                </Typography>
                              </Alert>
                            </Box>
                            
                            {/* Dispute button only */}
                            <Button
                              variant="outlined"
                              size="small"
                              fullWidth
                              startIcon={<DisputeIcon />}
                              onClick={() => openDisputeDialog(escrow)}
                              disabled={actionLoading}
                              sx={{ borderColor: '#ffa726', color: '#ffa726' }}
                            >
                              Report Problem
                            </Button>
                          </>
                        )}

                        {/* Status: Provider Claimed Complete - URGENT */}
                        {escrow.status === 'held' && hasProviderClaim && (
                          <>
                            <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(255, 152, 0, 0.1)' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                ⚠️ Provider claims service was delivered!
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                Time remaining: {getTimeRemaining(escrow.provider_claim_data?.client_response_deadline)}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#ff5722' }}>
                                If you don't respond, payment will auto-release to provider.
                              </Typography>
                            </Alert>
                            
                            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                              {/* Show PIN for client to share */}
                              <Box sx={{ 
                                p: 1.5, 
                                bgcolor: 'rgba(0, 255, 136, 0.1)', 
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                              }}>
                                <PinIcon sx={{ color: '#00ff88' }} />
                                <Typography sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                  {showPin ? (escrowPin || '------') : '••••••'}
                                </Typography>
                                <IconButton size="small" onClick={() => setShowPin(!showPin)}>
                                  {showPin ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                </IconButton>
                                <IconButton size="small" onClick={() => handleCopyPin(escrowPin)}>
                                  <CopyIcon />
                                </IconButton>
                              </Box>
                              
                              <Button
                                variant="contained"
                                fullWidth
                                startIcon={<ReleaseIcon />}
                                onClick={() => handleConfirmService(escrow)}
                                disabled={actionLoading}
                                sx={{ bgcolor: '#00ff88', color: '#000', '&:hover': { bgcolor: '#00cc6a' } }}
                              >
                                Confirm Service Received
                              </Button>
                              <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<DisputeIcon />}
                                onClick={() => openDisputeDialog(escrow)}
                                disabled={actionLoading}
                                sx={{ borderColor: '#ff5722', color: '#ff5722' }}
                              >
                                Dispute - Service NOT Delivered
                              </Button>
                            </Box>
                          </>
                        )}

                        {/* Status: PIN Entered - Confirm or Dispute */}
                        {escrow.status === 'pin_entered' && (
                          <>
                            <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(0, 242, 234, 0.1)' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                ✓ Provider entered the correct PIN
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                Auto-release in: {getTimeRemaining(escrow.auto_release_at)}
                              </Typography>
                            </Alert>
                            
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="contained"
                                fullWidth
                                startIcon={<ReleaseIcon />}
                                onClick={() => handleConfirmService(escrow)}
                                disabled={actionLoading}
                                sx={{ bgcolor: '#00ff88', color: '#000', '&:hover': { bgcolor: '#00cc6a' } }}
                              >
                                Confirm & Release
                              </Button>
                              <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<DisputeIcon />}
                                onClick={() => openDisputeDialog(escrow)}
                                disabled={actionLoading}
                                sx={{ borderColor: '#ff5722', color: '#ff5722' }}
                              >
                                Dispute
                              </Button>
                            </Box>
                          </>
                        )}

                        {/* Status: Disputed */}
                        {escrow.status === 'disputed' && (
                          <Alert severity="warning" sx={{ bgcolor: 'rgba(255, 87, 34, 0.1)' }}>
                            <Typography variant="subtitle2">Under Admin Review</Typography>
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                              Our team will review evidence and contact you within 24-48 hours.
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                    )}

                    {/* ============ PROVIDER VIEW ============ */}
                    {isProvider && (
                      <Box sx={{ mt: 2 }}>
                        {/* Status: Held - Enter PIN or Claim */}
                        {escrow.status === 'held' && !hasProviderClaim && (
                          <>
                            <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(0, 242, 234, 0.1)' }}>
                              <Typography variant="subtitle2">
                                Deliver the service, then ask the client for the 6-digit PIN
                              </Typography>
                            </Alert>
                            
                            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                              <Button
                                variant="contained"
                                fullWidth
                                startIcon={<PinIcon />}
                                onClick={() => openPinEntry(escrow)}
                                disabled={actionLoading}
                                sx={{ bgcolor: '#00f2ea', color: '#000', '&:hover': { bgcolor: '#00c4be' } }}
                              >
                                Enter PIN
                              </Button>
                              <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<TimerIcon />}
                                onClick={() => handleClaimComplete(escrow)}
                                disabled={actionLoading}
                                sx={{ borderColor: '#ff9800', color: '#ff9800', fontSize: '0.75rem' }}
                              >
                                Client Won't Share PIN? Claim Completion
                              </Button>
                            </Box>
                          </>
                        )}

                        {/* Status: Claimed - Waiting for client response */}
                        {escrow.status === 'held' && hasProviderClaim && (
                          <Alert severity="info" sx={{ bgcolor: 'rgba(255, 152, 0, 0.1)' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              ⏳ Claim submitted - Waiting for client
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                              Client has until: {escrow.provider_claim_data?.client_response_deadline 
                                ? new Date(escrow.provider_claim_data.client_response_deadline).toLocaleString()
                                : '24 hours from claim'}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#00ff88' }}>
                              If client doesn't respond, payment will auto-release to you.
                            </Typography>
                          </Alert>
                        )}

                        {/* Status: PIN Entered - Waiting for client confirmation */}
                        {escrow.status === 'pin_entered' && (
                          <Alert severity="success" sx={{ bgcolor: 'rgba(0, 255, 136, 0.1)' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              ✓ PIN Verified Successfully!
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                              Waiting for client confirmation. Payment will auto-release in: {getTimeRemaining(escrow.auto_release_at)}
                            </Typography>
                          </Alert>
                        )}

                        {/* Status: Disputed */}
                        {escrow.status === 'disputed' && (
                          <Alert severity="warning" sx={{ bgcolor: 'rgba(255, 87, 34, 0.1)' }}>
                            <Typography variant="subtitle2">Dispute Opened</Typography>
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                              Client has disputed this transaction. Our team will review and contact you.
                            </Typography>
                            <Button
                              size="small"
                              sx={{ mt: 1, color: '#ff5722' }}
                              startIcon={<AttachIcon />}
                              onClick={() => {
                                // TODO: Open evidence upload dialog
                                toast.info('Evidence upload coming soon. Please email support@zerohook.com with your evidence.');
                              }}
                            >
                              Upload Evidence
                            </Button>
                          </Alert>
                        )}
                      </Box>
                    )}
                  </Box>
                </motion.div>
              );
            })
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={styles.tabContent}>
          {walletData.transactions.length === 0 && pastEscrows.length === 0 ? (
            <Box sx={styles.emptyTab}>
              <HistoryIcon sx={{ fontSize: 48, color: '#444', mb: 2 }} />
              <Typography color="text.secondary">No transactions yet</Typography>
            </Box>
          ) : (
            <>
              {/* Past Escrows */}
              {pastEscrows.map((escrow) => (
                <Box key={escrow.id} sx={styles.txItem}>
                  <Box sx={{ ...styles.txIcon, bgcolor: escrow.status === 'released' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 167, 38, 0.15)' }}>
                    {escrow.status === 'released' ? (
                      <ReleaseIcon sx={{ color: '#00ff88' }} />
                    ) : (
                      <DisputeIcon sx={{ color: '#ffa726' }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={styles.txTitle}>
                      {escrow.status === 'released' ? 'Payment Released' : 'Payment Disputed'}
                    </Typography>
                    <Typography sx={styles.txDate}>
                      {escrow.updated_at ? new Date(escrow.updated_at).toLocaleDateString() : 'Recently'}
                    </Typography>
                  </Box>
                  <Typography sx={{ ...styles.txAmount, color: escrow.status === 'released' ? '#00ff88' : '#ffa726' }}>
                    {symbol}{Number(escrow.amount).toLocaleString()}
                  </Typography>
                </Box>
              ))}

              {/* Transactions */}
              {walletData.transactions.map((tx) => (
                <Box key={tx.id} sx={styles.txItem}>
                  <Box sx={{ ...styles.txIcon, bgcolor: tx.type === 'credit' || tx.type === 'income' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 51, 51, 0.15)' }}>
                    {tx.type === 'credit' || tx.type === 'income' ? (
                      <DepositIcon sx={{ color: '#00ff88' }} />
                    ) : (
                      <WithdrawIcon sx={{ color: '#ff3333' }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={styles.txTitle}>{tx.description || tx.title || 'Transaction'}</Typography>
                    <Typography sx={styles.txDate}>
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : tx.date || 'Recently'}
                    </Typography>
                  </Box>
                  <Typography sx={{ 
                    ...styles.txAmount, 
                    color: tx.type === 'credit' || tx.type === 'income' ? '#00ff88' : '#ff3333' 
                  }}>
                    {tx.type === 'credit' || tx.type === 'income' ? '+' : '-'}{symbol}{Number(tx.amount).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </>
          )}
        </Box>
      )}

      {/* SportyBet-Style Add Money Dialog - Fullscreen */}
      <Dialog 
        open={addMoneyDialog} 
        onClose={() => setAddMoneyDialog(false)}
        fullScreen
        TransitionComponent={Transition}
        PaperProps={{ sx: styles.fullscreenDialog }}
      >
        {/* Header - SportyBet Red Style */}
        <Box sx={styles.depositHeader}>
          <IconButton onClick={() => setAddMoneyDialog(false)} sx={{ color: '#fff' }}>
            <BackIcon />
          </IconButton>
          <Typography sx={styles.depositHeaderTitle}>Deposit</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton sx={{ color: '#fff' }}>
              <HelpIcon />
            </IconButton>
            <IconButton onClick={() => navigate('/')} sx={{ color: '#fff' }}>
              <HomeIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Crypto Method Tabs */}
        <Box sx={styles.paymentTabs}>
          {['BTC', 'ETH', 'USDT', 'USDC'].map((crypto) => (
            <Box 
              key={crypto}
              sx={{ 
                ...styles.paymentTab, 
                ...(cryptoSymbol === crypto && styles.activePaymentTab) 
              }}
              onClick={() => setCryptoSymbol(crypto)}
            >
              <Typography>{crypto}</Typography>
            </Box>
          ))}
        </Box>

        {/* Content */}
        <Box sx={styles.depositContent}>
          {/* Info Banner */}
          <Box sx={styles.infoBanner}>
            <InfoIcon sx={{ color: '#ffa726', fontSize: 20 }} />
            <Typography sx={styles.infoBannerText}>
              Crypto deposits are fee-free and powered by blockchain.
            </Typography>
          </Box>

          {/* Balance Display */}
          <Box sx={styles.balanceDisplay}>
            <Typography sx={styles.balanceDisplayLabel}>Balance ({symbol.replace(/[^A-Z]/g, '') || 'GHS'})</Typography>
            <Typography sx={styles.balanceDisplayAmount}>{Number(walletData.balance).toFixed(2)}</Typography>
          </Box>

          {/* Amount Input */}
          <Box sx={styles.amountInputSection}>
            <Box sx={styles.amountInputRow}>
              <Typography sx={styles.amountLabel}>Amount ({symbol.replace(/[^A-Z]/g, '') || 'GHS'})</Typography>
              <Typography sx={styles.minLabel}>min. 1.00</Typography>
            </Box>
            <TextField
              fullWidth
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              sx={styles.amountTextField}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>{symbol}</Typography>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Quick Amount Buttons */}
          <Box sx={styles.quickAmountGrid}>
            {getQuickAmounts().map((amt) => (
              <Button
                key={amt}
                variant="outlined"
                onClick={() => setAddAmount(amt.toString())}
                sx={{
                  ...styles.quickAmountBtn,
                  ...(addAmount === amt.toString() && styles.quickAmountBtnActive)
                }}
              >
                +{amt}
              </Button>
            ))}
          </Box>

          {/* Top Up Button */}
          <Button
            fullWidth
            variant="contained"
            onClick={handleAddMoney}
            disabled={actionLoading || !addAmount || Number(addAmount) < 1}
            sx={styles.topUpButton}
          >
            {actionLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Top Up Now'}
          </Button>

          {/* Info List */}
          <Box sx={styles.infoList}>
            <Typography sx={styles.infoItem}>1. Maximum per transaction is {symbol}50,000.00</Typography>
            <Typography sx={styles.infoItem}>2. Minimum per transaction is {symbol}1.00</Typography>
            <Typography sx={styles.infoItem}>3. Deposit is free, no transaction fees.</Typography>
            <Typography sx={styles.infoItem}>4. Powered by blockchain - secure & fee-free.</Typography>
          </Box>
        </Box>
      </Dialog>

      {/* Withdraw Dialog - Also Improved */}
      <Dialog 
        open={withdrawDialog} 
        onClose={() => setWithdrawDialog(false)}
        fullScreen
        TransitionComponent={Transition}
        PaperProps={{ sx: styles.fullscreenDialog }}
      >
        {/* Header */}
        <Box sx={{ ...styles.depositHeader, bgcolor: '#7c4dff' }}>
          <IconButton onClick={() => setWithdrawDialog(false)} sx={{ color: '#fff' }}>
            <BackIcon />
          </IconButton>
          <Typography sx={styles.depositHeaderTitle}>Withdraw</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton sx={{ color: '#fff' }}>
              <HelpIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={styles.depositContent}>
          {/* Available Balance */}
          <Box sx={{ 
            bgcolor: 'rgba(124, 77, 255, 0.15)', 
            borderRadius: '12px', 
            padding: '16px',
            marginBottom: '20px',
            border: '1px solid rgba(124, 77, 255, 0.3)'
          }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', mb: 0.5 }}>
              Available Balance
            </Typography>
            <Typography sx={{ color: '#fff', fontSize: '28px', fontWeight: 700 }}>
              {symbol}{Number(walletData.balance).toLocaleString()}
            </Typography>
          </Box>

          {/* Amount Input */}
          <Box sx={styles.amountInputSection}>
            <Typography sx={styles.amountLabel}>Withdrawal Amount</Typography>
            <TextField
              fullWidth
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              sx={styles.amountTextField}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>{symbol}</Typography>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Quick Amount Buttons */}
          <Box sx={styles.quickAmountGrid}>
            {[walletData.balance * 0.25, walletData.balance * 0.5, walletData.balance * 0.75, walletData.balance].map((amt, idx) => (
              <Button
                key={idx}
                variant="outlined"
                onClick={() => setWithdrawAmount(Math.floor(amt).toString())}
                sx={{
                  ...styles.quickAmountBtn,
                  ...(withdrawAmount === Math.floor(amt).toString() && styles.quickAmountBtnActive)
                }}
              >
                {['25%', '50%', '75%', 'All'][idx]}
              </Button>
            ))}
          </Box>

          {/* Crypto Selection */}
          <Box sx={{ ...styles.amountInputSection, mt: 2 }}>
            <Typography sx={styles.amountLabel}>Crypto Currency</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {['USDT', 'USDC', 'BTC', 'ETH'].map((sym) => (
                <Chip
                  key={sym}
                  label={sym}
                  onClick={() => setWithdrawCrypto(sym)}
                  sx={{
                    bgcolor: withdrawCrypto === sym ? 'rgba(124, 77, 255, 0.3)' : 'rgba(255,255,255,0.05)',
                    color: withdrawCrypto === sym ? '#b388ff' : '#aaa',
                    border: withdrawCrypto === sym ? '1px solid #7c4dff' : '1px solid #333',
                    cursor: 'pointer',
                    fontWeight: withdrawCrypto === sym ? 600 : 400
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Destination Address */}
          <Box sx={{ ...styles.amountInputSection, mt: 2 }}>
            <Typography sx={styles.amountLabel}>Destination Wallet Address</Typography>
            <TextField
              fullWidth
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              placeholder="Enter your crypto wallet address"
              sx={styles.amountTextField}
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.9rem' }
              }}
            />
          </Box>

          {/* Withdraw Button */}
          <Button
            fullWidth
            variant="contained"
            onClick={handleWithdraw}
            disabled={actionLoading || !withdrawAmount || !withdrawAddress || Number(withdrawAmount) > walletData.balance}
            sx={{ ...styles.topUpButton, bgcolor: '#7c4dff', '&:hover': { bgcolor: '#651fff' }, mt: 2 }}
          >
            {actionLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Request Withdrawal'}
          </Button>

          {/* Info */}
          <Box sx={styles.infoList}>
            <Typography sx={styles.infoItem}>• Withdrawals are reviewed and processed within 24 hours</Typography>
            <Typography sx={styles.infoItem}>• Funds will be sent to the crypto address you provide</Typography>
            <Typography sx={styles.infoItem}>• Ensure the address matches the selected crypto network</Typography>
          </Box>
        </Box>
      </Dialog>

      {/* Pay via Telegram - Fullscreen Dialog */}
      <Dialog
        open={telegramDialog}
        onClose={() => setTelegramDialog(false)}
        fullScreen
        TransitionComponent={Transition}
        PaperProps={{ sx: styles.fullscreenDialog }}
      >
        {/* Header - Telegram Blue */}
        <Box sx={{ ...styles.depositHeader, bgcolor: '#0088cc' }}>
          <IconButton onClick={() => setTelegramDialog(false)} sx={{ color: '#fff' }}>
            <BackIcon />
          </IconButton>
          <Typography sx={styles.depositHeaderTitle}>Pay via Telegram</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton sx={{ color: '#fff' }}>
              <HelpIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={styles.depositContent}>
          {/* Telegram Logo & Description */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 3,
            mb: 2
          }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: '#0088cc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
              boxShadow: '0 4px 20px rgba(0, 136, 204, 0.4)'
            }}>
              <TelegramIcon sx={{ fontSize: 44, color: '#fff' }} />
            </Box>
            <Typography sx={{ color: '#fff', fontSize: '20px', fontWeight: 700, mb: 1, textAlign: 'center' }}>
              Pay Any Way You Want
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
              Chat with our payment admin on Telegram to deposit using mobile money, bank transfer, crypto, or any method available in your country.
            </Typography>
          </Box>

          {/* Amount Input (optional) */}
          <Box sx={styles.amountInputSection}>
            <Box sx={styles.amountInputRow}>
              <Typography sx={styles.amountLabel}>Amount to Deposit (optional)</Typography>
            </Box>
            <TextField
              fullWidth
              value={telegramAmount}
              onChange={(e) => setTelegramAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              sx={styles.amountTextField}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>{symbol}</Typography>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Quick Amount Buttons */}
          <Box sx={styles.quickAmountGrid}>
            {getQuickAmounts().map((amt) => (
              <Button
                key={amt}
                variant="outlined"
                onClick={() => setTelegramAmount(amt.toString())}
                sx={{
                  ...styles.quickAmountBtn,
                  ...(telegramAmount === amt.toString() && { borderColor: '#0088cc', bgcolor: 'rgba(0, 136, 204, 0.15)', color: '#0088cc' })
                }}
              >
                +{amt}
              </Button>
            ))}
          </Box>

          {/* Payment Methods Accepted */}
          <Box sx={{
            bgcolor: 'rgba(0, 136, 204, 0.08)',
            borderRadius: '12px',
            p: 2,
            mb: 2,
            border: '1px solid rgba(0, 136, 204, 0.2)'
          }}>
            <Typography sx={{ color: '#0088cc', fontSize: '13px', fontWeight: 600, mb: 1.5 }}>
              Accepted Payment Methods
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {[
                { label: 'Mobile Money', icon: <MobileIcon sx={{ fontSize: 14 }} /> },
                { label: 'Bank Transfer', icon: <CardIcon sx={{ fontSize: 14 }} /> },
                { label: 'Crypto', icon: <WalletIcon sx={{ fontSize: 14 }} /> },
                { label: 'Gift Cards', icon: <ReceiptIcon sx={{ fontSize: 14 }} /> },
              ].map((method) => (
                <Chip
                  key={method.label}
                  icon={method.icon}
                  label={method.label}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    '& .MuiChip-icon': { color: 'rgba(255,255,255,0.6)' }
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Open Telegram Button */}
          <Button
            fullWidth
            variant="contained"
            startIcon={<TelegramIcon />}
            endIcon={<OpenInNewIcon sx={{ fontSize: 18 }} />}
            onClick={() => {
              const message = telegramAmount
                ? `Hi, I want to deposit ${symbol}${Number(telegramAmount).toLocaleString()} to my Zerohook wallet. My username is ${user?.username || 'N/A'}.`
                : `Hi, I want to make a deposit to my Zerohook wallet. My username is ${user?.username || 'N/A'}.`;
              openTelegramChat(TELEGRAM_CONFIG.botUsername, message);
            }}
            sx={{
              bgcolor: '#0088cc',
              color: '#fff',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 600,
              textTransform: 'none',
              mb: 1.5,
              '&:hover': { bgcolor: '#006699' },
            }}
          >
            Chat with Payment Bot
          </Button>

          {/* Or contact admin */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<ChatIcon />}
            onClick={() => {
              const message = telegramAmount
                ? `Hi, I want to deposit ${symbol}${Number(telegramAmount).toLocaleString()} to my Zerohook wallet. My username is ${user?.username || 'N/A'}.`
                : `Hi, I need help with a payment for my Zerohook wallet. My username is ${user?.username || 'N/A'}.`;
                openTelegramChat(TELEGRAM_CONFIG.adminUsername, message);
            }}
            sx={{
              borderColor: 'rgba(0, 136, 204, 0.5)',
              color: '#0088cc',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 600,
              textTransform: 'none',
              mb: 3,
              '&:hover': { borderColor: '#0088cc', bgcolor: 'rgba(0, 136, 204, 0.08)' },
            }}
          >
            Chat with Admin Instead
          </Button>

          {/* How It Works */}
          <Box sx={{
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            p: 2,
            mb: 2,
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: 600, mb: 1.5 }}>
              How It Works
            </Typography>
            {[
              { step: '1', text: 'Tap the button above to open Telegram' },
              { step: '2', text: 'Tell the admin your preferred payment method' },
              { step: '3', text: 'Send payment as instructed by the admin' },
              { step: '4', text: 'Your wallet will be credited within minutes' },
            ].map((item) => (
              <Box key={item.step} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.2 }}>
                <Box sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: 'rgba(0, 136, 204, 0.2)',
                  color: '#0088cc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0,
                  mt: 0.2
                }}>
                  {item.step}
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.5 }}>
                  {item.text}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Info */}
          <Box sx={styles.infoList}>
            <Typography sx={styles.infoItem}>• Available 24/7 — our admin responds within minutes</Typography>
            <Typography sx={styles.infoItem}>• Supports mobile money (MTN, Vodafone, AirtelTigo), bank transfers, and more</Typography>
            <Typography sx={styles.infoItem}>• Your wallet is credited as soon as payment is confirmed</Typography>
            <Typography sx={styles.infoItem}>• No hidden fees — the amount you send is the amount credited</Typography>
          </Box>
        </Box>
      </Dialog>

      {/* PIN Entry Dialog (for Provider) */}
      <Dialog
        open={pinDialogOpen}
        onClose={() => {
          setPinDialogOpen(false);
          setPinInput('');
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            borderRadius: '16px',
            border: '1px solid rgba(0, 242, 234, 0.3)',
            maxWidth: '400px',
            width: '90%'
          }
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PinIcon sx={{ color: '#00f2ea' }} />
            Enter Completion PIN
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(0, 242, 234, 0.1)' }}>
            <Typography variant="body2">
              Ask the client for the 6-digit PIN they received when creating this escrow.
            </Typography>
          </Alert>
          <TextField
            fullWidth
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="Enter 6-digit PIN"
            inputProps={{
              maxLength: 6,
              style: { 
                textAlign: 'center', 
                fontSize: '1.5rem', 
                letterSpacing: '0.5rem',
                fontFamily: 'monospace'
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0, 242, 234, 0.1)',
                '& fieldset': { borderColor: 'rgba(0, 242, 234, 0.3)' },
                '&:hover fieldset': { borderColor: '#00f2ea' },
                '&.Mui-focused fieldset': { borderColor: '#00f2ea' },
              },
              '& .MuiInputBase-input': { color: '#fff' }
            }}
          />
          {selectedEscrow && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Escrow Amount: {symbol}{Number(selectedEscrow.amount).toLocaleString()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button
            onClick={() => {
              setPinDialogOpen(false);
              setPinInput('');
            }}
            sx={{ color: '#888' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEnterPin}
            disabled={actionLoading || pinInput.length !== 6}
            sx={{ bgcolor: '#00f2ea', color: '#000', '&:hover': { bgcolor: '#00c4be' } }}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Verify PIN'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Service Dialog (for Client) */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setSelectedEscrow(null);
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            borderRadius: '16px',
            border: '1px solid rgba(0, 255, 136, 0.3)',
            maxWidth: '400px',
            width: '90%'
          }
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReleaseIcon sx={{ color: '#00ff88' }} />
            Confirm Service Delivery
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(255, 167, 38, 0.1)' }}>
            <Typography variant="body2">
              <strong>This action is final!</strong><br />
              Once confirmed, the payment will be released to the provider immediately.
            </Typography>
          </Alert>
          
          {selectedEscrow && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'rgba(0, 255, 136, 0.1)', 
              borderRadius: 2,
              textAlign: 'center'
            }}>
              <Typography variant="caption" color="text.secondary">
                Amount to Release
              </Typography>
              <Typography sx={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00ff88' }}>
                {symbol}{Number(selectedEscrow.amount).toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                to {selectedEscrow.provider_name || selectedEscrow.providerName || 'Provider'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button
            onClick={() => {
              setConfirmDialogOpen(false);
              setSelectedEscrow(null);
            }}
            sx={{ color: '#888' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmServiceDelivery}
            disabled={actionLoading}
            sx={{ bgcolor: '#00ff88', color: '#000', '&:hover': { bgcolor: '#00cc6a' } }}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Confirm & Release Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog
        open={disputeDialogOpen}
        onClose={() => {
          setDisputeDialogOpen(false);
          setSelectedEscrow(null);
          setDisputeReason('');
          setDisputeEvidence(null);
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            borderRadius: '16px',
            border: '1px solid rgba(255, 87, 34, 0.3)',
            maxWidth: '450px',
            width: '90%'
          }
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GavelIcon sx={{ color: '#ff5722' }} />
            Report Problem
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(255, 87, 34, 0.1)' }}>
            <Typography variant="body2">
              Please describe the issue. Our team will review your case within 24-48 hours.
            </Typography>
          </Alert>
          
          {disputeStatus && disputeStatus.disputeStrikes > 0 && (
            <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(255, 167, 38, 0.1)' }}>
              <Typography variant="body2">
                ⚠️ You have {disputeStatus.disputeStrikes}/{disputeStatus.maxStrikes} strikes. 
                Losing another dispute may result in account suspension.
              </Typography>
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            rows={4}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Describe what went wrong..."
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#ff5722' },
              },
              '& .MuiInputBase-input': { color: '#fff' }
            }}
          />

          <Button
            variant="outlined"
            component="label"
            fullWidth
            startIcon={<AttachIcon />}
            sx={{ 
              borderColor: 'rgba(255, 255, 255, 0.2)', 
              color: '#888',
              '&:hover': { borderColor: '#ff5722' }
            }}
          >
            {disputeEvidence ? disputeEvidence.name : 'Attach Evidence (Optional)'}
            <input
              type="file"
              hidden
              accept="image/*,video/*,.pdf"
              onChange={(e) => setDisputeEvidence(e.target.files[0])}
            />
          </Button>
          
          {selectedEscrow && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Escrow Amount: {symbol}{Number(selectedEscrow.amount).toLocaleString()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button
            onClick={() => {
              setDisputeDialogOpen(false);
              setSelectedEscrow(null);
              setDisputeReason('');
              setDisputeEvidence(null);
            }}
            sx={{ color: '#888' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitDispute}
            disabled={actionLoading || !disputeReason.trim()}
            sx={{ bgcolor: '#ff5722', color: '#fff', '&:hover': { bgcolor: '#e64a19' } }}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Submit Dispute'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Crypto Payment Dialog for deposits */}
      <CryptoPayment
        open={showCryptoPayment}
        onClose={() => { setShowCryptoPayment(false); setCryptoPaymentData(null); }}
        paymentData={cryptoPaymentData}
        onSuccess={handleCryptoDepositConfirmed}
        title="Crypto Deposit"
      />
    </Box>
  );
};

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0f0f13 0%, #1a1a2e 100%)',
    padding: { xs: '16px', md: '24px' },
    paddingBottom: '100px'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#0f0f13'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px'
  },
  headerIcon: {
    fontSize: 32,
    color: '#00f2ea'
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#fff'
  },
  balanceCard: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #252542 100%)',
    borderRadius: '20px',
    padding: '24px',
    marginBottom: '24px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    marginBottom: '8px'
  },
  balanceAmount: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '20px',
    wordBreak: 'break-word',
    '@media (max-width: 375px)': {
      fontSize: '24px'
    }
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  actionBtn: {
    borderRadius: '12px',
    padding: '10px 16px',
    fontWeight: 600,
    textTransform: 'none',
    fontSize: '13px',
    flex: '1 1 auto',
    minWidth: 0,
    whiteSpace: 'nowrap'
  },
  tabs: {
    marginBottom: '16px',
    '& .MuiTab-root': {
      color: 'rgba(255,255,255,0.5)',
      textTransform: 'none',
      fontWeight: 600,
      '&.Mui-selected': {
        color: '#00f2ea'
      }
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#00f2ea'
    }
  },
  tabContent: {
    minHeight: '300px'
  },
  emptyTab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center'
  },
  escrowCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  escrowHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  escrowProvider: {
    fontWeight: 600,
    color: '#fff'
  },
  escrowAmount: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#00ff88',
    marginBottom: '4px'
  },
  escrowDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    marginBottom: '12px'
  },
  escrowActions: {
    display: 'flex',
    gap: '10px'
  },
  txItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  txTitle: {
    color: '#fff',
    fontWeight: 500
  },
  txDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px'
  },
  txAmount: {
    fontWeight: 600,
    fontSize: '15px'
  },
  dialog: {
    bgcolor: '#1a1a2e',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
    minWidth: { xs: '90vw', sm: 360 }
  },
  dialogTitle: {
    color: '#fff',
    fontWeight: 600
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
      '&.Mui-focused fieldset': { borderColor: '#00f2ea' }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }
  },
  quickAmounts: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '16px'
  },
  primaryBtn: {
    bgcolor: '#00f2ea',
    color: '#000',
    borderRadius: '12px',
    fontWeight: 600,
    textTransform: 'none',
    '&:hover': {
      bgcolor: '#00d4ce'
    }
  },
  
  // SportyBet-Style Deposit Dialog Styles
  fullscreenDialog: {
    bgcolor: '#1a1a2e',
    backgroundImage: 'none'
  },
  depositHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    bgcolor: '#d32f2f',
    padding: '12px 8px',
    position: 'sticky',
    top: 0,
    zIndex: 10
  },
  depositHeaderTitle: {
    color: '#fff',
    fontWeight: 700,
    fontSize: '18px'
  },
  paymentTabs: {
    display: 'flex',
    bgcolor: '#252542',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  paymentTab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    padding: '14px',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
    '&:hover': {
      color: '#fff'
    }
  },
  activePaymentTab: {
    color: '#fff',
    borderBottom: '2px solid #fff',
    fontWeight: 600
  },
  newBadge: {
    bgcolor: '#4caf50',
    color: '#fff',
    height: '18px',
    fontSize: '10px',
    fontWeight: 700
  },
  depositContent: {
    padding: '16px',
    flex: 1,
    overflowY: 'auto'
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 1.5,
    bgcolor: 'rgba(255, 167, 38, 0.15)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '20px',
    border: '1px solid rgba(255, 167, 38, 0.3)'
  },
  infoBannerText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: '13px',
    lineHeight: 1.5
  },
  balanceDisplay: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 1,
    marginBottom: '16px'
  },
  balanceDisplayLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px'
  },
  balanceDisplayAmount: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '16px'
  },
  amountInputSection: {
    marginBottom: '16px'
  },
  amountInputRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  amountLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '14px',
    fontWeight: 500
  },
  minLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px'
  },
  amountTextField: {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(255,255,255,0.05)',
      color: '#fff',
      fontSize: '18px',
      fontWeight: 600,
      '& fieldset': { 
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: '8px'
      },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
      '&.Mui-focused fieldset': { borderColor: '#00f2ea' }
    },
    '& input::placeholder': {
      color: 'rgba(255,255,255,0.3)'
    }
  },
  quickAmountGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px',
    marginBottom: '24px'
  },
  quickAmountBtn: {
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    borderRadius: '6px',
    padding: '10px 4px',
    fontSize: '14px',
    fontWeight: 500,
    minWidth: 0,
    '&:hover': {
      borderColor: '#00f2ea',
      bgcolor: 'rgba(0, 242, 234, 0.1)'
    }
  },
  quickAmountBtnActive: {
    borderColor: '#00f2ea',
    bgcolor: 'rgba(0, 242, 234, 0.15)',
    color: '#00f2ea'
  },
  topUpButton: {
    bgcolor: '#666',
    color: '#fff',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 600,
    textTransform: 'none',
    marginBottom: '24px',
    '&:hover': {
      bgcolor: '#00f2ea',
      color: '#000'
    },
    '&:disabled': {
      bgcolor: '#444',
      color: '#888'
    }
  },
  infoList: {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: '16px'
  },
  infoItem: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13px',
    marginBottom: '8px',
    lineHeight: 1.5
  }
};

export default MyMoneyPage;
