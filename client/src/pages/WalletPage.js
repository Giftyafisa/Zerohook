import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  Add as AddIcon,
  Send as SendIcon,
  ArrowUpward as DepositIcon,
  ArrowDownward as WithdrawIcon,
  Lock as LockIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  ContentCopy as CopyIcon,
  QrCode as QrCodeIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const WalletPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [depositDialog, setDepositDialog] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [walletData, setWalletData] = useState({
    balance: 0,
    escrowHeld: 0,
    pendingWithdrawal: 0,
    totalEarnings: 0,
    transactions: []
  });

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/payments/wallet', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setWalletData({
            balance: data.wallet?.balance || data.balance || 0,
            escrowHeld: data.wallet?.escrowHeld || data.escrowHeld || 0,
            pendingWithdrawal: data.wallet?.pendingWithdrawal || data.pendingWithdrawal || 0,
            totalEarnings: data.wallet?.totalEarnings || data.totalEarnings || 0,
            transactions: data.transactions || mockTransactions
          });
        } else {
          setWalletData({
            balance: 250.00,
            escrowHeld: 150.00,
            pendingWithdrawal: 0,
            totalEarnings: 1250.00,
            transactions: mockTransactions
          });
        }
      } catch (error) {
        console.error('Wallet fetch error:', error);
        setWalletData({
          balance: 250.00,
          escrowHeld: 150.00,
          pendingWithdrawal: 0,
          totalEarnings: 1250.00,
          transactions: mockTransactions
        });
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchWalletData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const mockTransactions = [
    { id: 1, type: 'income', title: 'Service Payment', amount: 150.00, date: '2 hours ago', status: 'completed' },
    { id: 2, type: 'expense', title: 'Platform Fee', amount: 7.50, date: '2 hours ago', status: 'completed' },
    { id: 3, type: 'income', title: 'Escrow Release', amount: 200.00, date: 'Yesterday', status: 'completed' },
    { id: 4, type: 'expense', title: 'Withdrawal', amount: 100.00, date: '2 days ago', status: 'completed' },
    { id: 5, type: 'income', title: 'Tip Received', amount: 25.00, date: '3 days ago', status: 'completed' }
  ];

  const quickActions = [
    { icon: <AddIcon />, label: 'Add Funds', color: '#00f2ea', onClick: () => setDepositDialog(true) },
    { icon: <SendIcon />, label: 'Withdraw', color: '#ff0055', onClick: () => setWithdrawDialog(true) },
    { icon: <LockIcon />, label: 'Escrow', color: '#00ff88', onClick: () => navigate('/transactions') }
  ];

  if (!isAuthenticated) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.emptyState}>
          <WalletIcon sx={{ fontSize: 64, color: '#333', mb: 2 }} />
          <Typography color="text.secondary" sx={{ mb: 2 }}>Please log in to view your wallet</Typography>
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
        <Typography sx={styles.headerTitle}>My Wallet</Typography>
      </Box>

      {/* Main Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Box sx={styles.balanceCard}>
          <Typography sx={styles.balanceLabel}>Available Balance</Typography>
          <Typography sx={styles.balanceAmount}>
            ${walletData.balance.toFixed(2)}
          </Typography>
          
          {/* Quick Actions */}
          <Box sx={styles.quickActions}>
            {quickActions.map((action) => (
              <Box 
                key={action.label} 
                sx={styles.quickAction}
                onClick={action.onClick}
              >
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
            <Box sx={{ ...styles.summaryIcon, background: 'rgba(0, 255, 136, 0.15)' }}>
              <LockIcon sx={{ color: '#00ff88' }} />
            </Box>
            <Box>
              <Typography sx={styles.summaryLabel}>In Escrow</Typography>
              <Typography sx={styles.summaryValue}>${walletData.escrowHeld.toFixed(2)}</Typography>
            </Box>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Box sx={styles.summaryCard}>
            <Box sx={{ ...styles.summaryIcon, background: 'rgba(255, 215, 0, 0.15)' }}>
              <TrendingUpIcon sx={{ color: '#ffd700' }} />
            </Box>
            <Box>
              <Typography sx={styles.summaryLabel}>Total Earnings</Typography>
              <Typography sx={styles.summaryValue}>${walletData.totalEarnings.toFixed(2)}</Typography>
            </Box>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Box sx={styles.summaryCard}>
            <Box sx={{ ...styles.summaryIcon, background: 'rgba(255, 0, 85, 0.15)' }}>
              <WithdrawIcon sx={{ color: '#ff0055' }} />
            </Box>
            <Box>
              <Typography sx={styles.summaryLabel}>Pending Withdrawal</Typography>
              <Typography sx={styles.summaryValue}>${walletData.pendingWithdrawal.toFixed(2)}</Typography>
            </Box>
          </Box>
        </motion.div>
      </Box>

      {/* Recent Transactions */}
      <Box sx={styles.sectionHeader}>
        <Typography sx={styles.sectionTitle}>
          <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Recent Transactions
        </Typography>
        <Button 
          size="small" 
          sx={{ color: '#00f2ea' }}
          onClick={() => navigate('/transactions')}
        >
          View All
        </Button>
      </Box>

      <Box sx={styles.transactionsList}>
        {walletData.transactions.slice(0, 5).map((tx, index) => (
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
                {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
              </Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Deposit Dialog */}
      <Dialog 
        open={depositDialog} 
        onClose={() => setDepositDialog(false)}
        PaperProps={{ sx: styles.dialog }}
      >
        <DialogTitle sx={styles.dialogTitle}>Add Funds</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            margin="normal"
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1, color: '#888' }}>$</Typography>
            }}
            sx={styles.textField}
          />
          <TextField
            fullWidth
            select
            label="Payment Method"
            margin="normal"
            defaultValue="card"
            sx={styles.textField}
          >
            <MenuItem value="card">Credit/Debit Card</MenuItem>
            <MenuItem value="paystack">Paystack</MenuItem>
            <MenuItem value="crypto">Cryptocurrency</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositDialog(false)} sx={{ color: '#888' }}>Cancel</Button>
          <Button variant="contained" sx={styles.primaryButton}>Add Funds</Button>
        </DialogActions>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog 
        open={withdrawDialog} 
        onClose={() => setWithdrawDialog(false)}
        PaperProps={{ sx: styles.dialog }}
      >
        <DialogTitle sx={styles.dialogTitle}>Withdraw Funds</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#888', mb: 2 }}>
            Available: <span style={{ color: '#00ff88' }}>${walletData.balance.toFixed(2)}</span>
          </Typography>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            margin="normal"
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1, color: '#888' }}>$</Typography>
            }}
            sx={styles.textField}
          />
          <TextField
            fullWidth
            select
            label="Withdrawal Method"
            margin="normal"
            defaultValue="bank"
            sx={styles.textField}
          >
            <MenuItem value="bank">Bank Transfer</MenuItem>
            <MenuItem value="mobile">Mobile Money</MenuItem>
            <MenuItem value="crypto">Cryptocurrency</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawDialog(false)} sx={{ color: '#888' }}>Cancel</Button>
          <Button variant="contained" sx={styles.withdrawButton}>Withdraw</Button>
        </DialogActions>
      </Dialog>
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
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)'
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
  balanceCard: {
    background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.1) 0%, rgba(255, 0, 85, 0.1) 100%)',
    borderRadius: 4,
    padding: 3,
    textAlign: 'center',
    border: '1px solid rgba(0, 242, 234, 0.2)',
    mb: 3
  },
  balanceLabel: {
    color: '#888',
    fontSize: '0.9rem',
    mb: 1
  },
  balanceAmount: {
    fontSize: { xs: '2.5rem', md: '3.5rem' },
    fontWeight: 700,
    color: '#fff',
    mb: 3
  },
  quickActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: 4
  },
  quickAction: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    '&:hover': {
      transform: 'scale(1.05)'
    }
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionLabel: {
    fontSize: '0.85rem',
    color: '#ccc'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
    gap: 2,
    mb: 3
  },
  summaryCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 3,
    padding: 2.5,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  summaryLabel: {
    fontSize: '0.8rem',
    color: '#888'
  },
  summaryValue: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#fff'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 2
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#fff',
    display: 'flex',
    alignItems: 'center'
  },
  transactionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5
  },
  transactionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: 2,
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 2,
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  txInfo: {
    flex: 1
  },
  txTitle: {
    fontWeight: 500,
    color: '#fff'
  },
  txDate: {
    fontSize: '0.8rem',
    color: '#888'
  },
  txAmount: {
    fontWeight: 600,
    fontSize: '1rem'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    textAlign: 'center'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #00f2ea, #00b4d8)',
    color: '#000',
    fontWeight: 600,
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4d0, #0096c7)'
    }
  },
  withdrawButton: {
    background: 'linear-gradient(135deg, #ff0055, #ff3366)',
    color: '#fff',
    fontWeight: 600,
    '&:hover': {
      background: 'linear-gradient(135deg, #e6004d, #e62e5c)'
    }
  },
  dialog: {
    background: '#1a1a2e',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 3
  },
  dialogTitle: {
    color: '#fff',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      '& fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.2)'
      },
      '&:hover fieldset': {
        borderColor: '#00f2ea'
      }
    },
    '& .MuiInputLabel-root': {
      color: '#888'
    }
  }
};

export default WalletPage;
