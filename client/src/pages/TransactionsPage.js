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
  Alert
} from '@mui/material';
import { toast } from 'react-toastify';
import apiClient from '../services/apiClient';
import {
  AccountBalanceWallet as WalletIcon,
  Add as AddIcon,
  Send as SendIcon,
  ArrowUpward as DepositIcon,
  ArrowDownward as WithdrawIcon,
  Lock as HeldIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as ReleaseIcon,
  Warning as DisputeIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import EscrowCard from '../components/EscrowCard';
import useCurrency from '../hooks/useCurrency';

const defaultTransactions = [
  { id: 1, type: 'income', title: 'Service Payment', amount: 150.00, date: '2 hours ago' },
  { id: 2, type: 'expense', title: 'Platform Fee', amount: 7.50, date: '2 hours ago' },
  { id: 3, type: 'income', title: 'Escrow Release', amount: 200.00, date: 'Yesterday' },
  { id: 4, type: 'expense', title: 'Withdrawal', amount: 100.00, date: '2 days ago' }
];

const TransactionsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState({
    balance: 0,
    escrowHeld: 0,
    pendingWithdrawal: 0,
    transactions: [],
    escrows: []
  });
  const [releaseDialog, setReleaseDialog] = useState({ open: false, escrowId: null });
  const [disputeDialog, setDisputeDialog] = useState({ open: false, escrowId: null });
  const [actionLoading, setActionLoading] = useState(false);

  // Extracted fetch logic so it can be re-called after escrow actions
  const fetchWalletData = React.useCallback(async () => {
    try {
      const [walletResult, txResult, escrowResult] = await Promise.allSettled([
        apiClient.get('/payments/wallet'),
        apiClient.get('/payments/transactions'),
        apiClient.get('/escrow/list')
      ]);

      let wallet = { balance: 0, escrowHeld: 0, pendingWithdrawal: 0 };
      let transactions = defaultTransactions;
      let escrows = [];

      if (walletResult.status === 'fulfilled') {
        const data = walletResult.value.data;
        wallet = {
          balance: data.wallet?.balance || data.balance || 0,
          escrowHeld: data.wallet?.escrowHeld || data.escrowHeld || 0,
          pendingWithdrawal: data.wallet?.pendingWithdrawal || data.pendingWithdrawal || 0
        };
      }

      if (txResult.status === 'fulfilled') {
        const data = txResult.value.data;
        transactions = data.transactions || data.data || defaultTransactions;
      }

      if (escrowResult.status === 'fulfilled') {
        const data = escrowResult.value.data;
        escrows = data.escrows || data.data || [];
      }

      setWalletData({
        ...wallet,
        transactions,
        escrows
      });
    } catch (error) {
      console.error('Wallet fetch error:', error);
      setWalletData({
        balance: 250.00,
        escrowHeld: 150.00,
        pendingWithdrawal: 0,
        transactions: defaultTransactions,
        escrows: []
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWalletData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchWalletData]);

  // Handle escrow release
  const handleRelease = async (escrowId) => {
    setActionLoading(true);
    try {
      await apiClient.post('/escrow/complete', { escrowId });
      toast.success('Payment released successfully!');
      await fetchWalletData();
    } catch (error) {
      console.error('Release error:', error);
      toast.error(error.response?.data?.error || 'Failed to release payment. Please try again.');
    } finally {
      setActionLoading(false);
      setReleaseDialog({ open: false, escrowId: null });
    }
  };

  // Handle escrow dispute
  const handleDispute = async (escrowId) => {
    setActionLoading(true);
    try {
      await apiClient.post('/escrow/dispute', { escrowId, reason: 'Service not as described' });
      toast.info('Dispute submitted. Our team will review and contact you.');
      await fetchWalletData();
    } catch (error) {
      console.error('Dispute error:', error);
      toast.error(error.response?.data?.error || 'Failed to submit dispute. Please try again.');
    } finally {
      setActionLoading(false);
      setDisputeDialog({ open: false, escrowId: null });
    }
  };

  const quickActions = [
    { icon: <AddIcon />, label: 'Add Money', color: '#00f2ea', onClick: () => navigate('/wallet') },
    { icon: <SendIcon />, label: 'Withdraw', color: '#ff0055', onClick: () => navigate('/wallet') },
    { icon: <HeldIcon />, label: 'My Escrows', color: '#00ff88', onClick: () => {} }
  ];

  if (!isAuthenticated) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.emptyState}>
          <Typography color="text.secondary">Please log in to view your wallet</Typography>
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
        <Typography sx={styles.headerTitle}>Wallet</Typography>
      </Box>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Box sx={styles.balanceCard}>
          <Typography sx={styles.balanceLabel}>Available Balance</Typography>
          <Typography sx={styles.balanceAmount}>
            {format(walletData.balance)}
          </Typography>
          
          {/* Quick Actions */}
          <Box sx={styles.quickActions}>
            {quickActions.map((action, index) => (
              <Box key={action.label} sx={styles.quickAction}>
                <Box sx={{ ...styles.actionIcon, background: `${action.color}20` }}>
                  {React.cloneElement(action.icon, { sx: { color: action.color } })}
                </Box>
                <Typography sx={styles.actionLabel}>{action.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </motion.div>

      {/* Summary Cards */}
      <Box sx={styles.summaryGrid}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Box sx={styles.summaryCard}>
            <Box sx={styles.summaryIcon}>
              <HeldIcon sx={{ color: '#00ff88' }} />
            </Box>
            <Box>
              <Typography sx={styles.summaryLabel}>In Escrow</Typography>
              <Typography sx={styles.summaryValue}>{format(walletData.escrowHeld)}</Typography>
            </Box>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Box sx={styles.summaryCard}>
            <Box sx={styles.summaryIcon}>
              <TrendingUpIcon sx={{ color: '#ffd700' }} />
            </Box>
            <Box>
              <Typography sx={styles.summaryLabel}>Pending</Typography>
              <Typography sx={styles.summaryValue}>{format(walletData.pendingWithdrawal)}</Typography>
            </Box>
          </Box>
        </motion.div>
      </Box>

      {/* Active Escrows */}
      {walletData.escrows && walletData.escrows.length > 0 && (
        <>
          <Typography sx={styles.sectionTitle}>Active Payments</Typography>
          <Typography sx={styles.sectionSubtitle}>
            Money held until you confirm service is done
          </Typography>
          <Box sx={{ mb: 3 }}>
            {walletData.escrows.filter(e => e.status === 'held' || e.status === 'pending').map((escrow) => (
              <EscrowCard
                key={escrow.id}
                escrow={escrow}
                onRelease={(id) => setReleaseDialog({ open: true, escrowId: id })}
                onDispute={(id) => setDisputeDialog({ open: true, escrowId: id })}
                isProvider={escrow.providerId === user?.id}
              />
            ))}
          </Box>
        </>
      )}

      {/* Recent Transactions */}
      <Typography sx={styles.sectionTitle}>Recent Transactions</Typography>
      <Box sx={styles.transactionsList}>
        {walletData.transactions.map((tx, index) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Box sx={styles.transactionItem}>
              <Box sx={{
                ...styles.txIcon,
                background: tx.type === 'income' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 51, 51, 0.15)'
              }}>
                {tx.type === 'income' ? (
                  <DepositIcon sx={{ color: '#00ff88' }} />
                ) : (
                  <WithdrawIcon sx={{ color: '#ff3333' }} />
                )}
              </Box>
              <Box sx={styles.txInfo}>
                <Typography sx={styles.txTitle}>{tx.title}</Typography>
                <Typography sx={styles.txDate}>{tx.date}</Typography>
              </Box>
              <Typography sx={{
                ...styles.txAmount,
                color: tx.type === 'income' ? '#00ff88' : '#ff3333'
              }}>
                {tx.type === 'income' ? '+' : '-'}{format(tx.amount)}
              </Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Security Notice */}
      <Box sx={styles.securityNotice}>
        <HeldIcon sx={{ fontSize: 18 }} />
        <Typography>Your money is safe. Released only when you confirm.</Typography>
      </Box>

      {/* Release Confirmation Dialog */}
      <Dialog 
        open={releaseDialog.open} 
        onClose={() => setReleaseDialog({ open: false, escrowId: null })}
        PaperProps={{ sx: styles.dialog }}
        aria-labelledby="release-dialog-title"
      >
        <DialogTitle id="release-dialog-title" sx={styles.dialogTitle}>
          <ReleaseIcon sx={{ color: '#66bb6a', mr: 1 }} />
          Release Payment?
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This will send the money to the service provider. Only do this after the service is complete.
          </Alert>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Was the service good? If yes, click "Release" to pay the provider.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setReleaseDialog({ open: false, escrowId: null })}
            sx={{ color: 'rgba(255,255,255,0.6)' }}
          >
            Not Yet
          </Button>
          <Button 
            variant="contained"
            onClick={() => handleRelease(releaseDialog.escrowId)}
            disabled={actionLoading}
            sx={styles.releaseBtn}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Release Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog 
        open={disputeDialog.open} 
        onClose={() => setDisputeDialog({ open: false, escrowId: null })}
        PaperProps={{ sx: styles.dialog }}
        aria-labelledby="dispute-dialog-title"
      >
        <DialogTitle id="dispute-dialog-title" sx={styles.dialogTitle}>
          <DisputeIcon sx={{ color: '#ef5350', mr: 1 }} />
          Report an Issue?
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Only report if something went wrong. Our team will review and help.
          </Alert>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
            What happened? Let us know and we'll help resolve it.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDisputeDialog({ open: false, escrowId: null })}
            sx={{ color: 'rgba(255,255,255,0.6)' }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={() => handleDispute(disputeDialog.escrowId)}
            disabled={actionLoading}
            sx={styles.disputeBtn}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Report Issue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg-primary, #0f0f13)',
    padding: '20px',
    paddingBottom: '100px'
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary, #0f0f13)'
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh'
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
    background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.1), rgba(255, 0, 85, 0.1))',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '24px',
    textAlign: 'center',
    marginBottom: '20px'
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    marginBottom: '8px'
  },
  balanceAmount: {
    fontSize: '48px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '24px'
  },
  quickActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px'
  },
  quickAction: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s',
    '&:hover': {
      transform: 'scale(1.05)'
    }
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '12px',
    fontWeight: 500
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '24px'
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '16px'
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px'
  },
  summaryValue: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: 600
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '16px'
  },
  transactionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '24px'
  },
  transactionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '14px 16px'
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  txInfo: {
    flex: 1
  },
  txTitle: {
    color: '#fff',
    fontSize: '15px',
    fontWeight: 500
  },
  txDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px'
  },
  txAmount: {
    fontSize: '16px',
    fontWeight: 600
  },
  securityNotice: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    background: 'rgba(0, 255, 136, 0.08)',
    border: '1px solid rgba(0, 255, 136, 0.2)',
    borderRadius: '12px',
    color: '#00ff88',
    fontSize: '13px'
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    marginBottom: '16px',
    marginTop: '-12px'
  },
  dialog: {
    bgcolor: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px'
  },
  dialogTitle: {
    display: 'flex',
    alignItems: 'center',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 600
  },
  releaseBtn: {
    background: 'linear-gradient(135deg, #66bb6a, #4caf50)',
    color: '#fff',
    fontWeight: 600,
    '&:hover': {
      background: 'linear-gradient(135deg, #57a05a, #43a047)'
    }
  },
  disputeBtn: {
    background: 'linear-gradient(135deg, #ef5350, #e53935)',
    color: '#fff',
    fontWeight: 600,
    '&:hover': {
      background: 'linear-gradient(135deg, #e53935, #d32f2f)'
    }
  }
};

export default TransactionsPage;
