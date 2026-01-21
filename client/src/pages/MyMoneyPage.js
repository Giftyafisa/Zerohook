import React, { useState, useEffect } from 'react';
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
  MenuItem,
  Alert,
  IconButton,
  InputAdornment,
  Slide
} from '@mui/material';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config/constants';
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
  Info as InfoIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const { symbol, format } = useCurrency();
  
  // Tab state - initialize from URL param if present
  const initialTab = TAB_MAP[searchParams.get('tab')] ?? 0;
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
  const [paymentMethod, setPaymentMethod] = useState('mobile'); // 'mobile', 'card'
  
  // Currency-specific quick amounts
  const getQuickAmounts = () => {
    // Ghana cedis use smaller amounts
    if (symbol === '₵') return [2, 5, 10, 50, 100];
    // Nigerian naira use larger amounts  
    if (symbol === '₦') return [1000, 2000, 5000, 10000, 20000];
    // Default for other currencies
    return [10, 20, 50, 100, 500];
  };

  useEffect(() => {
    const fetchAllData = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        
        // Fetch wallet data
        const walletRes = await fetch(`${API_BASE_URL}/payments/wallet`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Fetch transactions
        const txRes = await fetch(`${API_BASE_URL}/payments/transactions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Fetch escrows
        const escrowRes = await fetch(`${API_BASE_URL}/escrow/list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        let balance = 0, escrowHeld = 0, pendingWithdrawal = 0;
        let transactions = [];
        let escrows = [];

        if (walletRes.ok) {
          const data = await walletRes.json();
          balance = data.wallet?.balance || data.balance || 0;
          escrowHeld = data.wallet?.escrowHeld || data.escrowHeld || 0;
          pendingWithdrawal = data.wallet?.pendingWithdrawal || data.pendingWithdrawal || 0;
        }

        if (txRes.ok) {
          const data = await txRes.json();
          transactions = data.transactions || data.data || [];
        }

        if (escrowRes.ok) {
          const data = await escrowRes.json();
          escrows = data.escrows || data.data || [];
        }

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
        setLoading(false);
      }
    };

    fetchAllData();
  }, [isAuthenticated]);

  // Handle escrow release
  const handleRelease = async (escrowId) => {
    if (!window.confirm('Release this payment? The provider will receive the funds.')) return;
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/escrow/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ escrowId })
      });

      if (response.ok) {
        // Update local state
        setWalletData(prev => ({
          ...prev,
          escrows: prev.escrows.map(e => 
            e.id === escrowId ? { ...e, status: 'released' } : e
          )
        }));
        toast.success('Payment released successfully!');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to release payment');
      }
    } catch (error) {
      console.error('Release error:', error);
      toast.error('Failed to release payment.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle escrow dispute
  const handleDispute = async (escrowId) => {
    const reason = prompt('What went wrong? Briefly describe:');
    if (!reason) return;
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/escrow/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ escrowId, reason })
      });

      if (response.ok) {
        setWalletData(prev => ({
          ...prev,
          escrows: prev.escrows.map(e => 
            e.id === escrowId ? { ...e, status: 'disputed' } : e
          )
        }));
        toast.info('Issue reported. Support will contact you.');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to report issue');
      }
    } catch (error) {
      console.error('Dispute error:', error);
      toast.error('Failed to report issue.');
    } finally {
      setActionLoading(false);
    }
  };

  // Add money via Paystack
  const handleAddMoney = async () => {
    const minAmount = symbol === '₵' ? 1 : 100; // GHS min is 1, NGN min is 100
    if (!addAmount || Number(addAmount) < minAmount) {
      toast.warning(`Minimum amount is ${symbol}${minAmount}`);
      return;
    }
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/payments/paystack/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(addAmount),
          type: 'wallet_topup'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authorizationUrl || data.authorization_url) {
          window.location.href = data.authorizationUrl || data.authorization_url;
        }
      } else {
        toast.error('Failed to initiate payment');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Try again.');
    } finally {
      setActionLoading(false);
      setAddMoneyDialog(false);
    }
  };

  // Withdraw money
  const handleWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) > walletData.balance) {
      toast.warning('Invalid amount or insufficient balance');
      return;
    }
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/payments/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: Number(withdrawAmount) })
      });

      if (response.ok) {
        toast.success('Withdrawal initiated! You will receive it within 24 hours.');
        setWalletData(prev => ({
          ...prev,
          balance: prev.balance - Number(withdrawAmount),
          pendingWithdrawal: prev.pendingWithdrawal + Number(withdrawAmount)
        }));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Withdrawal failed');
      }
    } catch (error) {
      console.error('Withdraw error:', error);
      toast.error('Withdrawal failed.');
    } finally {
      setActionLoading(false);
      setWithdrawDialog(false);
      setWithdrawAmount('');
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
            onClick={() => navigate('/login')}
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
            activeEscrows.map((escrow) => (
              <motion.div
                key={escrow.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Box sx={styles.escrowCard}>
                  <Box sx={styles.escrowHeader}>
                    <Typography sx={styles.escrowProvider}>
                      {escrow.provider_name || escrow.providerName || 'Service Provider'}
                    </Typography>
                    <Chip 
                      label="Held" 
                      size="small" 
                      sx={{ bgcolor: 'rgba(0, 255, 136, 0.2)', color: '#00ff88' }} 
                    />
                  </Box>
                  <Typography sx={styles.escrowAmount}>
                    {symbol}{Number(escrow.amount).toLocaleString()}
                  </Typography>
                  <Typography sx={styles.escrowDate}>
                    {escrow.created_at ? new Date(escrow.created_at).toLocaleDateString() : 'Recently'}
                  </Typography>
                  
                  {/* Actions - Only show for client */}
                  {escrow.client_id === user?.id && (
                    <Box sx={styles.escrowActions}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<ReleaseIcon />}
                        onClick={() => handleRelease(escrow.id)}
                        disabled={actionLoading}
                        sx={{ bgcolor: '#00ff88', color: '#000', '&:hover': { bgcolor: '#00cc6a' } }}
                      >
                        Release
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DisputeIcon />}
                        onClick={() => handleDispute(escrow.id)}
                        disabled={actionLoading}
                        sx={{ borderColor: '#ffa726', color: '#ffa726' }}
                      >
                        Problem
                      </Button>
                    </Box>
                  )}
                  
                  {/* Provider view */}
                  {escrow.provider_id === user?.id && (
                    <Alert severity="info" sx={{ mt: 2, bgcolor: 'rgba(0, 242, 234, 0.1)' }}>
                      Waiting for client to release payment
                    </Alert>
                  )}
                </Box>
              </motion.div>
            ))
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

        {/* Payment Method Tabs */}
        <Box sx={styles.paymentTabs}>
          <Box 
            sx={{ 
              ...styles.paymentTab, 
              ...(paymentMethod === 'mobile' && styles.activePaymentTab) 
            }}
            onClick={() => setPaymentMethod('mobile')}
          >
            <MobileIcon sx={{ fontSize: 18 }} />
            <Typography>Mobile Money</Typography>
          </Box>
          <Box 
            sx={{ 
              ...styles.paymentTab, 
              ...(paymentMethod === 'card' && styles.activePaymentTab) 
            }}
            onClick={() => setPaymentMethod('card')}
          >
            <CardIcon sx={{ fontSize: 18 }} />
            <Typography>Card</Typography>
            <Chip label="NEW" size="small" sx={styles.newBadge} />
          </Box>
        </Box>

        {/* Content */}
        <Box sx={styles.depositContent}>
          {/* Info Banner */}
          <Box sx={styles.infoBanner}>
            <InfoIcon sx={{ color: '#ffa726', fontSize: 20 }} />
            <Typography sx={styles.infoBannerText}>
              {paymentMethod === 'mobile' 
                ? 'Mobile Money deposits are processed instantly via Paystack.'
                : 'Card payments are secure and processed via Paystack.'}
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
            <Typography sx={styles.infoItem}>4. Powered by Paystack - secure & instant.</Typography>
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

          {/* Withdraw Button */}
          <Button
            fullWidth
            variant="contained"
            onClick={handleWithdraw}
            disabled={actionLoading || !withdrawAmount || Number(withdrawAmount) > walletData.balance}
            sx={{ ...styles.topUpButton, bgcolor: '#7c4dff', '&:hover': { bgcolor: '#651fff' } }}
          >
            {actionLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Withdraw Now'}
          </Button>

          {/* Info */}
          <Box sx={styles.infoList}>
            <Typography sx={styles.infoItem}>• Withdrawals are processed within 24 hours</Typography>
            <Typography sx={styles.infoItem}>• Funds will be sent to your registered bank account</Typography>
            <Typography sx={styles.infoItem}>• Minimum withdrawal is {symbol}100</Typography>
          </Box>
        </Box>
      </Dialog>
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
    gap: '12px'
  },
  actionBtn: {
    borderRadius: '12px',
    padding: '10px 20px',
    fontWeight: 600,
    textTransform: 'none'
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
