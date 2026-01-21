/**
 * WalletPage - TikTok-Inspired Redesign
 * 
 * Design Principles from TikTok:
 * - Full-width cards with generous padding
 * - Clear visual hierarchy with bold typography
 * - Subtle gradients and glass effects
 * - Smooth animations
 * - Bottom-focused actions for thumb reach
 * - Minimal borders, use spacing and shadows instead
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import { API_BASE_URL } from '../config/constants';
import {
  AccountBalanceWallet as WalletIcon,
  Add as AddIcon,
  ArrowUpward as DepositIcon,
  ArrowDownward as WithdrawIcon,
  Lock as LockIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  ChevronRight,
  Visibility,
  VisibilityOff,
  QrCode2,
  Receipt,
  Refresh as RefreshIcon,
  ArrowBack as BackIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useCurrency from '../hooks/useCurrency';

const WalletPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Use currency hook for consistent currency symbol based on detected country
  const { symbol: detectedCurrencySymbol, currencyCode: detectedCurrencyCode } = useCurrency();
  
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [depositDialog, setDepositDialog] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [escrowDialog, setEscrowDialog] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [processingDeposit, setProcessingDeposit] = useState(false);
  const [processingWithdraw, setProcessingWithdraw] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'escrow' ? 1 : 0);
  const [walletData, setWalletData] = useState({
    balance: 0,
    escrowHeld: 0,
    pendingWithdrawal: 0,
    totalEarnings: 0,
    currency: '', // Will be set from detected currency or API
    currencySymbol: '', // Will be set from detected currency or API
    transactions: []
  });

  const mockTransactions = [];

  // Update wallet currency when detected currency changes (before API response arrives)
  useEffect(() => {
    if (detectedCurrencySymbol && !walletData.currencySymbol) {
      setWalletData(prev => ({
        ...prev,
        currency: detectedCurrencyCode,
        currencySymbol: detectedCurrencySymbol
      }));
    }
  }, [detectedCurrencySymbol, detectedCurrencyCode, walletData.currencySymbol]);

  // Fetch wallet data and transactions
  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch wallet data
      const walletResponse = await fetch(`${API_BASE_URL}/payments/wallet`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      // Fetch transactions
      const txResponse = await fetch(`${API_BASE_URL}/payments/transactions?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      let walletInfo = {};
      let transactions = [];
      
      if (walletResponse.ok) {
        const data = await walletResponse.json();
        walletInfo = {
          balance: data.wallet?.balance || data.balance || 0,
          escrowHeld: data.wallet?.escrowHeld || data.escrowHeld || 0,
          pendingWithdrawal: data.wallet?.pendingWithdrawal || data.pendingWithdrawal || 0,
          totalEarnings: data.wallet?.totalEarnings || data.totalEarnings || 0,
          currency: data.wallet?.currency || data.currency || detectedCurrencyCode,
          currencySymbol: data.wallet?.currencySymbol || data.currencySymbol || detectedCurrencySymbol,
        };
      }
      
      if (txResponse.ok) {
        const txData = await txResponse.json();
        transactions = txData.transactions || [];
      }
      
      setWalletData(prev => ({
        ...prev,
        ...walletInfo,
        transactions
      }));
    } catch (error) {
      console.error('Wallet fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchWalletData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch banks when withdraw dialog opens
  useEffect(() => {
    const fetchBanks = async () => {
      if (!withdrawDialog) return;
      setLoadingBanks(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/payments/banks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setBanks(data.banks || []);
        }
      } catch (error) {
        console.error('Failed to fetch banks:', error);
      } finally {
        setLoadingBanks(false);
      }
    };
    fetchBanks();
  }, [withdrawDialog]);

  // Verify bank account
  useEffect(() => {
    const verifyAccount = async () => {
      if (accountNumber.length === 10 && bankCode) {
        setVerifyingAccount(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/payments/verify-account`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ accountNumber, bankCode })
          });
          if (response.ok) {
            const data = await response.json();
            setAccountName(data.accountName || '');
          }
        } catch (error) {
          console.error('Failed to verify account:', error);
        } finally {
          setVerifyingAccount(false);
        }
      }
    };
    verifyAccount();
  }, [accountNumber, bankCode]);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setProcessingDeposit(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/payments/deposit`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: parseFloat(depositAmount) })
      });
      const data = await response.json();
      if (response.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (error) {
      console.error('Deposit error:', error);
    } finally {
      setProcessingDeposit(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    if (!bankCode || !accountNumber || !accountName) return;
    setProcessingWithdraw(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/payments/withdraw`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          amount: parseFloat(withdrawAmount),
          bankCode,
          accountNumber,
          accountName
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setWithdrawDialog(false);
        setWithdrawAmount('');
        setBankCode('');
        setAccountNumber('');
        setAccountName('');
        window.location.reload();
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
    } finally {
      setProcessingWithdraw(false);
    }
  };

  const formatAmount = (amount) => {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.emptyState}>
          <Box sx={styles.emptyIcon}>
            <WalletIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
          </Box>
          <Typography sx={styles.emptyTitle}>Login Required</Typography>
          <Typography sx={styles.emptySubtitle}>Please log in to access your wallet</Typography>
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

  // Loading
  if (loading) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.loadingState}>
          <CircularProgress sx={{ color: '#00f2ea' }} size={40} />
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 2 }}>Loading wallet...</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={styles.container}>
      {/* Main Balance Card - Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Box sx={styles.heroCard}>
          {/* Balance Header */}
          <Box sx={styles.balanceHeader}>
            <Box sx={styles.balanceHeaderLeft}>
              <Typography sx={styles.balanceLabel}>Available Balance</Typography>
              <Box sx={styles.balanceRow}>
                <Typography sx={styles.balanceAmount}>
                  {showBalance 
                    ? `${walletData.currencySymbol}${formatAmount(walletData.balance)}`
                    : '••••••'
                  }
                </Typography>
                <IconButton 
                  onClick={() => setShowBalance(!showBalance)}
                  sx={styles.eyeButton}
                >
                  {showBalance ? <Visibility /> : <VisibilityOff />}
                </IconButton>
              </Box>
            </Box>
            <Box sx={styles.qrButton}>
              <QrCode2 sx={{ fontSize: 24 }} />
            </Box>
          </Box>

          {/* Quick Stats */}
          <Box sx={styles.quickStats}>
            <Box sx={styles.statItem}>
              <LockIcon sx={{ fontSize: 18, color: '#00ff88', mb: 0.5 }} />
              <Typography sx={styles.statValue}>{walletData.currencySymbol}{formatAmount(walletData.escrowHeld)}</Typography>
              <Typography sx={styles.statLabel}>In Escrow</Typography>
            </Box>
            <Box sx={styles.statDivider} />
            <Box sx={styles.statItem}>
              <TrendingUpIcon sx={{ fontSize: 18, color: '#ffd700', mb: 0.5 }} />
              <Typography sx={styles.statValue}>{walletData.currencySymbol}{formatAmount(walletData.totalEarnings)}</Typography>
              <Typography sx={styles.statLabel}>Total Earned</Typography>
            </Box>
            <Box sx={styles.statDivider} />
            <Box sx={styles.statItem}>
              <WithdrawIcon sx={{ fontSize: 18, color: '#ff6b6b', mb: 0.5 }} />
              <Typography sx={styles.statValue}>{walletData.currencySymbol}{formatAmount(walletData.pendingWithdrawal)}</Typography>
              <Typography sx={styles.statLabel}>Pending</Typography>
            </Box>
          </Box>

          {/* Action Buttons - Bottom of Card */}
          <Box sx={styles.actionRow}>
            <Box sx={styles.actionButton} onClick={() => setDepositDialog(true)}>
              <Box sx={styles.actionIconCircle}>
                <AddIcon sx={{ color: '#000', fontSize: 22 }} />
              </Box>
              <Typography sx={styles.actionText}>Add Money</Typography>
            </Box>
            <Box sx={styles.actionButton} onClick={() => setWithdrawDialog(true)}>
              <Box sx={{ ...styles.actionIconCircle, background: 'linear-gradient(135deg, #ff6b6b, #ff8e8e)' }}>
                <WithdrawIcon sx={{ color: '#fff', fontSize: 22 }} />
              </Box>
              <Typography sx={styles.actionText}>Withdraw</Typography>
            </Box>
            <Box sx={styles.actionButton} onClick={fetchWalletData}>
              <Box sx={{ ...styles.actionIconCircle, background: 'linear-gradient(135deg, #a78bfa, #c4b5fd)' }}>
                <RefreshIcon sx={{ color: '#fff', fontSize: 22 }} />
              </Box>
              <Typography sx={styles.actionText}>Refresh</Typography>
            </Box>
            <Box sx={styles.actionButton} onClick={() => setEscrowDialog(true)}>
              <Box sx={{ ...styles.actionIconCircle, background: 'linear-gradient(135deg, #00ff88, #00cc6a)' }}>
                <LockIcon sx={{ color: '#000', fontSize: 22 }} />
              </Box>
              <Typography sx={styles.actionText}>Escrow</Typography>
            </Box>
          </Box>
        </Box>
      </motion.div>

      {/* Transactions Section */}
      <Box sx={styles.section}>
        <Box sx={styles.sectionHeader}>
          <Box sx={styles.sectionTitleRow}>
            <HistoryIcon sx={{ color: '#00f2ea', fontSize: 20 }} />
            <Typography sx={styles.sectionTitle}>Recent Activity</Typography>
          </Box>
          <IconButton onClick={fetchWalletData} size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Transaction List */}
        <Box sx={styles.transactionList}>
          <AnimatePresence>
            {walletData.transactions.slice(0, 5).map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Box sx={styles.transactionItem}>
                  <Box sx={{
                    ...styles.txIconBox,
                    background: tx.type === 'income' 
                      ? 'rgba(0, 255, 136, 0.15)' 
                      : 'rgba(255, 107, 107, 0.15)'
                  }}>
                    {tx.type === 'income' 
                      ? <DepositIcon sx={{ color: '#00ff88', fontSize: 20 }} />
                      : <WithdrawIcon sx={{ color: '#ff6b6b', fontSize: 20 }} />
                    }
                  </Box>
                  <Box sx={styles.txContent}>
                    <Typography sx={styles.txTitle}>{tx.title}</Typography>
                    <Typography sx={styles.txDate}>{tx.date}</Typography>
                  </Box>
                  <Typography sx={{
                    ...styles.txAmount,
                    color: tx.type === 'income' ? '#00ff88' : '#ff6b6b'
                  }}>
                    {tx.type === 'income' ? '+' : '-'}{walletData.currencySymbol}{formatAmount(tx.amount)}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </AnimatePresence>

          {walletData.transactions.length === 0 && (
            <Box sx={styles.noTransactions}>
              <HistoryIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>No transactions yet</Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Deposit Dialog - SportyBet Style */}
      <Dialog 
        open={depositDialog} 
        onClose={() => setDepositDialog(false)}
        PaperProps={{ 
          sx: { 
            ...styles.fullScreenDialog,
            m: 0,
            maxHeight: '100%',
            height: '100%',
            maxWidth: '100%',
            borderRadius: 0
          } 
        }}
        fullScreen
      >
        {/* Header */}
        <Box sx={styles.depositHeader}>
          <IconButton onClick={() => setDepositDialog(false)} sx={{ color: '#fff' }}>
            <BackIcon />
          </IconButton>
          <Typography sx={styles.depositHeaderTitle}>Deposit</Typography>
          <Box sx={{ width: 40 }} /> {/* Spacer */}
        </Box>

        {/* Payment Method Tabs */}
        <Box sx={styles.paymentTabs}>
          <Box sx={styles.paymentTabActive}>
            <WalletIcon sx={{ fontSize: 18, mr: 0.5 }} />
            Mobile Money
          </Box>
          <Box sx={styles.paymentTab}>
            Card
          </Box>
        </Box>

        {/* Content */}
        <Box sx={styles.depositContent}>
          {/* Info Banner */}
          <Box sx={styles.infoBanner}>
            <WarningIcon sx={{ color: '#ffc107', mr: 1, fontSize: 20 }} />
            <Typography sx={styles.infoBannerText}>
              Payments are processed securely via Paystack. You'll be redirected to complete payment.
            </Typography>
          </Box>

          {/* Balance Display */}
          <Box sx={styles.balanceDisplay}>
            <Typography sx={styles.balanceDisplayLabel}>Balance ({walletData.currency})</Typography>
            <Typography sx={styles.balanceDisplayValue}>
              {walletData.currencySymbol}{formatAmount(walletData.balance)}
            </Typography>
          </Box>

          {/* Amount Input */}
          <Box sx={styles.amountInputContainer}>
            <Typography sx={styles.amountLabel}>
              Amount ({walletData.currency})
            </Typography>
            <Box sx={styles.amountInputWrapper}>
              <Typography sx={styles.currencyPrefix}>{walletData.currencySymbol}</Typography>
              <TextField
                fullWidth
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                variant="standard"
                sx={styles.amountInput}
                InputProps={{ disableUnderline: true }}
              />
            </Box>
            <Typography sx={styles.minAmount}>min. {walletData.currencySymbol}1.00</Typography>
          </Box>

          {/* Quick Amount Buttons */}
          <Box sx={styles.quickAmountRow}>
            {[5, 10, 20, 50, 100].map((amount) => (
              <Box 
                key={amount}
                sx={styles.quickAmountBtn}
                onClick={() => setDepositAmount(amount.toString())}
              >
                +{walletData.currencySymbol}{amount}
              </Box>
            ))}
          </Box>

          {/* Deposit Button */}
          <Button
            fullWidth
            variant="contained"
            onClick={handleDeposit}
            disabled={processingDeposit || !depositAmount || parseFloat(depositAmount) < 1}
            sx={styles.depositButton}
          >
            {processingDeposit ? (
              <CircularProgress size={24} sx={{ color: '#fff' }} />
            ) : (
              `Top Up Now`
            )}
          </Button>

          {/* Info Points */}
          <Box sx={styles.infoPoints}>
            <Typography sx={styles.infoPoint}>
              1. Maximum per transaction is {walletData.currencySymbol}50,000.00
            </Typography>
            <Typography sx={styles.infoPoint}>
              2. Minimum per transaction is {walletData.currencySymbol}1.00
            </Typography>
            <Typography sx={styles.infoPoint}>
              3. Deposit is free, no transaction fees.
            </Typography>
            <Typography sx={styles.infoPoint}>
              4. Funds will be available immediately after payment.
            </Typography>
          </Box>
        </Box>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog 
        open={withdrawDialog} 
        onClose={() => setWithdrawDialog(false)}
        PaperProps={{ sx: styles.dialog }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={styles.dialogTitle}>
          <WithdrawIcon sx={{ mr: 1, color: '#ff6b6b' }} />
          Withdraw
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={styles.dialogSubtext}>
            Available: <span style={{ color: '#00ff88', fontWeight: 600 }}>
              {walletData.currencySymbol}{formatAmount(walletData.balance)}
            </span>
          </Typography>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="0.00"
            sx={{ ...styles.textField, mb: 2 }}
            InputProps={{
              startAdornment: (
                <Typography sx={{ color: '#ff6b6b', fontWeight: 700, mr: 1 }}>
                  {walletData.currencySymbol}
                </Typography>
              )
            }}
          />
          <TextField
            select
            fullWidth
            label="Select Bank"
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            sx={{ ...styles.textField, mb: 2 }}
            disabled={loadingBanks}
          >
            {loadingBanks ? (
              <MenuItem disabled>Loading banks...</MenuItem>
            ) : banks.map((bank) => (
              <MenuItem key={bank.code} value={bank.code}>{bank.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10 digits"
            sx={styles.textField}
          />
          {verifyingAccount && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
              <CircularProgress size={16} sx={{ color: '#00f2ea' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                Verifying account...
              </Typography>
            </Box>
          )}
          {accountName && (
            <Alert severity="success" sx={{ mt: 2, background: 'rgba(0,255,136,0.1)' }}>
              Account: {accountName}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={styles.dialogActions}>
          <Button onClick={() => setWithdrawDialog(false)} sx={styles.cancelButton}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleWithdraw}
            disabled={processingWithdraw || !withdrawAmount || !accountName}
            sx={styles.withdrawButton}
          >
            {processingWithdraw ? <CircularProgress size={20} /> : 'Withdraw'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Escrow Info Dialog */}
      <Dialog 
        open={escrowDialog} 
        onClose={() => setEscrowDialog(false)}
        PaperProps={{ sx: styles.dialog }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={styles.dialogTitle}>
          <LockIcon sx={{ mr: 1, color: '#00ff88' }} />
          Escrow Protection
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 2, lineHeight: 1.6 }}>
              Escrow is your safety net. When a client books a service, their payment is held securely 
              until the service is completed and both parties confirm satisfaction.
            </Typography>
            
            <Box sx={{ 
              background: 'rgba(0,255,136,0.1)', 
              borderRadius: 2, 
              p: 2, 
              mb: 2,
              border: '1px solid rgba(0,255,136,0.2)'
            }}>
              <Typography sx={{ color: '#00ff88', fontWeight: 600, mb: 1 }}>Currently in Escrow</Typography>
              <Typography sx={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700 }}>
                {walletData.currencySymbol}{formatAmount(walletData.escrowHeld)}
              </Typography>
            </Box>

            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', mb: 2 }}>
              <strong style={{ color: '#00f2ea' }}>How it works:</strong>
            </Typography>
            <Box component="ul" sx={{ color: 'rgba(255,255,255,0.7)', pl: 2, '& li': { mb: 1 } }}>
              <li>Client books and pays for your service</li>
              <li>Payment is held in secure escrow</li>
              <li>You provide the service</li>
              <li>Client confirms completion</li>
              <li>Funds are released to your wallet (minus platform fee)</li>
            </Box>

            {walletData.escrowHeld > 0 && (
              <Alert severity="info" sx={{ mt: 2, background: 'rgba(0,242,234,0.1)' }}>
                You have active escrow funds. They will be released once services are confirmed complete.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={styles.dialogActions}>
          <Button onClick={() => setEscrowDialog(false)} sx={styles.primaryButton}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// TikTok-Inspired Styles
const styles = {
  container: {
    minHeight: '100%',
    background: '#0a0a0f',
    px: 2,
    py: 2,
    pb: 10, // Space for bottom nav
  },
  
  // Hero Card
  heroCard: {
    background: 'linear-gradient(145deg, #1a1a2e 0%, #16162a 100%)',
    borderRadius: 4,
    p: 3,
    mb: 3,
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      right: 0,
      width: '60%',
      height: '100%',
      background: 'radial-gradient(ellipse at top right, rgba(0,242,234,0.1) 0%, transparent 70%)',
      pointerEvents: 'none',
    }
  },
  balanceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    mb: 3,
  },
  balanceHeaderLeft: {},
  balanceLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.85rem',
    mb: 0.5,
  },
  balanceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: '2.5rem',
    fontWeight: 700,
    fontFamily: '"Outfit", sans-serif',
    letterSpacing: '-0.02em',
  },
  eyeButton: {
    color: 'rgba(255,255,255,0.5)',
    p: 0.5,
  },
  qrButton: {
    width: 44,
    height: 44,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'pointer',
  },
  
  // Quick Stats
  quickStats: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    py: 2,
    px: 1,
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    mb: 3,
  },
  statItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.7rem',
    mt: 0.25,
  },
  statDivider: {
    width: 1,
    height: 40,
    background: 'rgba(255,255,255,0.1)',
  },
  
  // Action Row
  actionRow: {
    display: 'flex',
    justifyContent: 'space-around',
    pt: 1,
  },
  actionButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
    cursor: 'pointer',
    '&:active': {
      transform: 'scale(0.95)',
    },
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00f2ea, #00d4d0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 15px rgba(0,242,234,0.3)',
  },
  actionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  
  // Section
  section: {
    mb: 3,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 2,
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
  },
  viewAllButton: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  viewAllText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.85rem',
  },
  
  // Transactions
  transactionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  transactionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    p: 1.5,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 2,
    '&:active': {
      background: 'rgba(255,255,255,0.06)',
    },
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txContent: {
    flex: 1,
    minWidth: 0,
  },
  txTitle: {
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  txDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.75rem',
  },
  txAmount: {
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  noTransactions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    py: 4,
  },
  
  // Empty State
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center',
    px: 3,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    mb: 2,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: '1.25rem',
    fontWeight: 600,
    mb: 0.5,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.9rem',
    mb: 3,
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  
  // Dialogs
  dialog: {
    background: '#1a1a2e',
    borderRadius: 3,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  dialogTitle: {
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  dialogSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.9rem',
    mb: 2,
  },
  dialogActions: {
    p: 2,
    pt: 1,
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
      '&.Mui-focused fieldset': { borderColor: '#00f2ea' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#00f2ea' },
  },
  infoAlert: {
    mt: 2,
    background: 'rgba(0,242,234,0.1)',
    color: 'rgba(255,255,255,0.8)',
    '& .MuiAlert-icon': { color: '#00f2ea' },
  },
  
  // Buttons
  primaryButton: {
    background: 'linear-gradient(135deg, #00f2ea, #00d4d0)',
    color: '#000',
    fontWeight: 600,
    px: 3,
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4d0, #00b4b0)',
    },
    '&:disabled': {
      background: 'rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.3)',
    },
  },
  withdrawButton: {
    background: 'linear-gradient(135deg, #ff6b6b, #ff8e8e)',
    color: '#fff',
    fontWeight: 600,
    px: 3,
    '&:hover': {
      background: 'linear-gradient(135deg, #ff5252, #ff6b6b)',
    },
    '&:disabled': {
      background: 'rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.3)',
    },
  },
  cancelButton: {
    color: 'rgba(255,255,255,0.6)',
  },
  
  // SportyBet-style Deposit Dialog
  fullScreenDialog: {
    background: '#0a0a0f',
  },
  depositHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(135deg, #e53935, #c62828)',
    px: 1,
    py: 1.5,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  depositHeaderTitle: {
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 600,
  },
  paymentTabs: {
    display: 'flex',
    background: '#1a1a2e',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  paymentTab: {
    flex: 1,
    py: 1.5,
    px: 2,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      background: 'rgba(255,255,255,0.05)',
    },
  },
  paymentTabActive: {
    flex: 1,
    py: 1.5,
    px: 2,
    textAlign: 'center',
    color: '#00f2ea',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    borderBottom: '2px solid #00f2ea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositContent: {
    p: 2,
    flex: 1,
    overflowY: 'auto',
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    background: 'rgba(255, 193, 7, 0.1)',
    border: '1px solid rgba(255, 193, 7, 0.3)',
    borderRadius: 2,
    p: 1.5,
    mb: 3,
  },
  infoBannerText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '0.8rem',
    lineHeight: 1.5,
  },
  balanceDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    py: 1.5,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    mb: 2,
  },
  balanceDisplayLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.9rem',
  },
  balanceDisplayValue: {
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
  },
  amountInputContainer: {
    mb: 3,
  },
  amountLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.85rem',
    mb: 1,
  },
  amountInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    border: '1px solid rgba(255,255,255,0.15)',
    px: 2,
    py: 1.5,
  },
  currencyPrefix: {
    color: '#00f2ea',
    fontWeight: 700,
    fontSize: '1.2rem',
    mr: 1,
  },
  amountInput: {
    '& .MuiInputBase-input': {
      color: '#fff',
      fontSize: '1.2rem',
      fontWeight: 600,
      p: 0,
      '&::placeholder': {
        color: 'rgba(255,255,255,0.3)',
      },
    },
  },
  minAmount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.75rem',
    mt: 0.5,
    textAlign: 'right',
  },
  quickAmountRow: {
    display: 'flex',
    gap: 1,
    mb: 3,
    flexWrap: 'wrap',
  },
  quickAmountBtn: {
    flex: '1 1 auto',
    minWidth: 60,
    py: 1,
    px: 1.5,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 1.5,
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 500,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      background: 'rgba(0,242,234,0.15)',
      borderColor: '#00f2ea',
    },
    '&:active': {
      transform: 'scale(0.95)',
    },
  },
  depositButton: {
    background: 'linear-gradient(135deg, #00f2ea, #00d4d0)',
    color: '#000',
    fontWeight: 700,
    fontSize: '1rem',
    py: 1.5,
    borderRadius: 2,
    textTransform: 'none',
    mb: 3,
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4d0, #00b4b0)',
    },
    '&:disabled': {
      background: 'rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.3)',
    },
  },
  infoPoints: {
    mt: 2,
  },
  infoPoint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.8rem',
    mb: 0.75,
    lineHeight: 1.5,
  },
};

export default WalletPage;
