/**
 * AdminDashboard - Platform Owner Dashboard
 * 
 * Shows platform revenue, pending withdrawals, dispute management,
 * user management, and allows admin to withdraw platform fees.
 * 
 * Access: Only users with is_admin=true or role='admin' can see this.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
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
  Divider,
  Tooltip
} from '@mui/material';
import { toast } from 'react-toastify';
import apiClient from '../services/apiClient';
import {
  Dashboard as DashIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Gavel as GavelIcon,
  AccountBalanceWallet as WalletIcon,
  TrendingUp as TrendingIcon,
  ArrowBack as BackIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Warning as WarningIcon,
  Block as BanIcon,
  LockOpen as UnbanIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const AdminDashboard = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const currentLocation = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Data states
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [unbanRequests, setUnbanRequests] = useState([]);
  
  // Dialog states
  const [withdrawFeeDialog, setWithdrawFeeDialog] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeAddress, setFeeAddress] = useState('');
  const [feeCrypto, setFeeCrypto] = useState('USDT');
  const [resolveDialog, setResolveDialog] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolveWinner, setResolveWinner] = useState('');
  const [resolveReasoning, setResolveReasoning] = useState('');
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [confirmDepositDialog, setConfirmDepositDialog] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [depositTxHash, setDepositTxHash] = useState('');
  const [depositNotes, setDepositNotes] = useState('');

  // Check admin status and fetch data
  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch stats first to verify admin access
      let statsRes;
      try {
        statsRes = await apiClient.get('/admin/stats');
      } catch (err) {
        if (err.response?.status === 403) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        throw err;
      }
      setIsAdmin(true);
      setStats(statsRes.data.stats);

      // Fetch remaining data in parallel
      const [revRes, dispRes, banRes, unbanRes, depRes] = await Promise.allSettled([
        apiClient.get('/admin/revenue'),
        apiClient.get('/admin/disputes'),
        apiClient.get('/admin/banned-users'),
        apiClient.get('/admin/unban-requests'),
        apiClient.get('/admin/pending-deposits')
      ]);

      if (revRes.status === 'fulfilled') {
        setRevenue(revRes.value.data.revenue);
        setPendingWithdrawals(revRes.value.data.revenue?.pendingWithdrawals?.items || []);
      }
      if (dispRes.status === 'fulfilled') setDisputes(dispRes.value.data.disputes || []);
      if (banRes.status === 'fulfilled') setBannedUsers(banRes.value.data.users || []);
      if (unbanRes.status === 'fulfilled') setUnbanRequests(unbanRes.value.data.requests || []);
      if (depRes.status === 'fulfilled') setPendingDeposits(depRes.value.data.deposits || []);
    } catch (error) {
      console.error('Admin data fetch error:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchAdminData();
    else setLoading(false);
  }, [isAuthenticated, fetchAdminData]);

  // ============ ACTIONS ============

  // Withdraw platform fees
  const handleWithdrawFees = async () => {
    if (!feeAmount || !feeAddress) {
      toast.warning('Amount and wallet address required');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post('/admin/withdraw-fees', {
        amount: parseFloat(feeAmount), destinationAddress: feeAddress, cryptoSymbol: feeCrypto
      });
      const data = res.data;
      toast.success(data.message || 'Fee withdrawal requested!');
      setWithdrawFeeDialog(false);
      setFeeAmount('');
      setFeeAddress('');
      fetchAdminData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to withdraw fees');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve/Reject user withdrawal
  const handleApproveWithdrawal = async (approve) => {
    if (!selectedWithdrawal) return;
    setActionLoading(true);
    try {
      const endpoint = approve ? 'approve' : 'reject';
      const body = approve ? { txHash: txHash || undefined } : { reason: 'Rejected by admin' };
      const res = await apiClient.post(`/admin/withdrawals/${selectedWithdrawal.id}/${endpoint}`, body);
      const data = res.data;
      toast.success(data.message || `Withdrawal ${approve ? 'approved' : 'rejected'}`);
      setApprovalDialog(false);
      setSelectedWithdrawal(null);
      setTxHash('');
      fetchAdminData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve dispute
  const handleResolveDispute = async () => {
    if (!selectedDispute || !resolveWinner || !resolveReasoning) {
      toast.warning('Select winner and provide reasoning');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/admin/disputes/${selectedDispute.id}/resolve`, {
        winner: resolveWinner, reasoning: resolveReasoning
      });
      const data = res.data;
      toast.success(data.message || 'Dispute resolved');
      setResolveDialog(false);
      setSelectedDispute(null);
      setResolveWinner('');
      setResolveReasoning('');
      fetchAdminData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to resolve dispute');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm deposit manually
  const handleConfirmDeposit = async () => {
    if (!selectedDeposit) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/admin/deposits/${selectedDeposit.id}/confirm`, {
        txHash: depositTxHash || undefined, notes: depositNotes || undefined
      });
      const data = res.data;
      toast.success(data.message || 'Deposit confirmed & credited!');
      setConfirmDepositDialog(false);
      setSelectedDeposit(null);
      setDepositTxHash('');
      setDepositNotes('');
      fetchAdminData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to confirm deposit');
    } finally {
      setActionLoading(false);
    }
  };

  // Process unban request
  const handleUnbanDecision = async (userId, approved) => {
    setActionLoading(true);
    try {
      await apiClient.post(`/admin/unban/${userId}`, {
        approved, adminNotes: approved ? 'Approved by admin' : 'Rejected by admin'
      });
      toast.success(approved ? 'User unbanned!' : 'Unban request rejected');
      fetchAdminData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ============ RENDER HELPERS ============

  const formatCurrency = (amount, currency = 'USD') => {
    return `${currency === 'NGN' ? '₦' : currency === 'GHS' ? '₵' : '$'}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.centerBox}>
          <DashIcon sx={{ fontSize: 64, color: '#333', mb: 2 }} />
          <Typography color="text.secondary">Login required</Typography>
          <Button variant="contained" onClick={() => navigate('/login', { state: { from: { pathname: currentLocation.pathname, search: currentLocation.search, hash: currentLocation.hash } } })} sx={{ mt: 2, bgcolor: '#00f2ea', color: '#000' }}>Login</Button>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.centerBox}>
          <CircularProgress sx={{ color: '#00f2ea' }} />
          <Typography sx={{ mt: 2, color: '#888' }}>Loading admin dashboard...</Typography>
        </Box>
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.centerBox}>
          <WarningIcon sx={{ fontSize: 64, color: '#ff5555', mb: 2 }} />
          <Typography sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Access Denied</Typography>
          <Typography sx={{ color: '#888' }}>Admin privileges required to access this page.</Typography>
          <Button variant="outlined" onClick={() => navigate('/dashboard')} sx={{ mt: 2, borderColor: '#00f2ea', color: '#00f2ea' }}>
            Go to Dashboard
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={styles.container}>
      {/* Header */}
      <Box sx={styles.header}>
        <IconButton onClick={() => navigate('/dashboard')} sx={{ color: '#fff' }}>
          <BackIcon />
        </IconButton>
        <DashIcon sx={{ color: '#00f2ea', fontSize: 28 }} />
        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#fff', flex: 1 }}>
          Admin Dashboard
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/socket-trace')}
          sx={{
            borderColor: 'rgba(0,242,234,0.45)',
            color: '#00f2ea',
            mr: 1,
            fontWeight: 700,
            '&:hover': {
              borderColor: '#00f2ea',
              backgroundColor: 'rgba(0,242,234,0.08)'
            }
          }}
        >
          Socket Trace
        </Button>
        <IconButton onClick={fetchAdminData} sx={{ color: '#00f2ea' }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Stats Cards */}
      <Box sx={styles.statsGrid}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Box sx={{ ...styles.statCard, borderColor: '#00f2ea' }}>
            <MoneyIcon sx={{ color: '#00f2ea', fontSize: 32 }} />
            <Typography sx={styles.statValue}>{formatCurrency(revenue?.totalRevenue)}</Typography>
            <Typography sx={styles.statLabel}>Total Revenue</Typography>
          </Box>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Box sx={{ ...styles.statCard, borderColor: '#00ff88' }}>
            <TrendingIcon sx={{ color: '#00ff88', fontSize: 32 }} />
            <Typography sx={styles.statValue}>{formatCurrency(revenue?.platformFees?.allTime)}</Typography>
            <Typography sx={styles.statLabel}>Platform Fees</Typography>
          </Box>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Box sx={{ ...styles.statCard, borderColor: '#ffd700' }}>
            <PeopleIcon sx={{ color: '#ffd700', fontSize: 32 }} />
            <Typography sx={styles.statValue}>{stats?.users?.total || 0}</Typography>
            <Typography sx={styles.statLabel}>Total Users</Typography>
          </Box>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Box sx={{ ...styles.statCard, borderColor: '#ff5555' }}>
            <GavelIcon sx={{ color: '#ff5555', fontSize: 32 }} />
            <Typography sx={styles.statValue}>{stats?.disputes?.pending || 0}</Typography>
            <Typography sx={styles.statLabel}>Open Disputes</Typography>
          </Box>
        </motion.div>
      </Box>

      {/* Revenue Summary */}
      {revenue && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Box sx={styles.revenueCard}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff', mb: 2 }}>Revenue Breakdown</Typography>
            <Box sx={styles.revenueRow}>
              <Typography sx={{ color: '#aaa' }}>Platform Fees (Last 30d)</Typography>
              <Typography sx={{ color: '#00ff88', fontWeight: 700 }}>{formatCurrency(revenue?.platformFees?.last30Days)}</Typography>
            </Box>
            <Box sx={styles.revenueRow}>
              <Typography sx={{ color: '#aaa' }}>Subscription Revenue</Typography>
              <Typography sx={{ color: '#00f2ea', fontWeight: 700 }}>{formatCurrency(revenue?.subscriptions?.totalRevenue)}</Typography>
            </Box>
            <Box sx={styles.revenueRow}>
              <Typography sx={{ color: '#aaa' }}>Active Subscriptions</Typography>
              <Typography sx={{ color: '#ffd700', fontWeight: 700 }}>{revenue?.subscriptions?.activeCount || 0}</Typography>
            </Box>
            <Box sx={styles.revenueRow}>
              <Typography sx={{ color: '#aaa' }}>Escrows Released</Typography>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>{revenue?.platformFees?.escrowsReleased || 0}</Typography>
            </Box>
            <Box sx={styles.revenueRow}>
              <Typography sx={{ color: '#aaa' }}>Total Transaction Volume</Typography>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>{formatCurrency(revenue?.totalVolume)}</Typography>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 2 }} />
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => setWithdrawFeeDialog(true)}
              fullWidth
              sx={{ bgcolor: '#00ff88', color: '#000', fontWeight: 700, py: 1.5, '&:hover': { bgcolor: '#00dd77' } }}
            >
              Withdraw Platform Fees
            </Button>
          </Box>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, v) => setActiveTab(v)}
        sx={styles.tabs}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ReceiptIcon fontSize="small" />Deposits
          {pendingDeposits.length > 0 && <Chip label={pendingDeposits.length} size="small" sx={{ bgcolor: '#00f2ea', color: '#000', height: 20, ml: 0.5 }} />}
        </Box>} />
        <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <WalletIcon fontSize="small" />Withdrawals
          {pendingWithdrawals.length > 0 && <Chip label={pendingWithdrawals.length} size="small" sx={{ bgcolor: '#ff5555', color: '#fff', height: 20, ml: 0.5 }} />}
        </Box>} />
        <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <GavelIcon fontSize="small" />Disputes
          {disputes.length > 0 && <Chip label={disputes.length} size="small" sx={{ bgcolor: '#ffd700', color: '#000', height: 20, ml: 0.5 }} />}
        </Box>} />
        <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <BanIcon fontSize="small" />Bans & Appeals
          {unbanRequests.length > 0 && <Chip label={unbanRequests.length} size="small" sx={{ bgcolor: '#ff9800', color: '#000', height: 20, ml: 0.5 }} />}
        </Box>} />
      </Tabs>

      {/* Tab 0: Pending Deposits */}
      {activeTab === 0 && (
        <Box sx={styles.tabContent}>
          {pendingDeposits.length === 0 ? (
            <Box sx={styles.emptyState}>
              <ReceiptIcon sx={{ fontSize: 48, color: '#333', mb: 1 }} />
              <Typography sx={{ color: '#666' }}>No pending deposits</Typography>
              <Typography sx={{ color: '#555', fontSize: '0.8rem', mt: 1 }}>Deposits appear here when users initiate crypto payments</Typography>
            </Box>
          ) : (
            pendingDeposits.map((d) => (
              <Box key={d.id} sx={{ ...styles.listItem, borderColor: 'rgba(0,242,234,0.15)' }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, color: '#fff' }}>
                      ${Number(d.amount || 0).toFixed(2)}
                    </Typography>
                    {d.cryptoSymbol && (
                      <Chip label={`${d.cryptoAmount || '?'} ${d.cryptoSymbol}`} size="small" sx={{ bgcolor: 'rgba(0,242,234,0.15)', color: '#00f2ea', height: 20 }} />
                    )}
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', color: '#aaa' }}>
                    User: {d.username || d.userId?.substring(0, 8) + '...'} {d.email && `(${d.email})`}
                  </Typography>
                  {d.cryptoAddress && (
                    <Typography sx={{ fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', mt: 0.5, wordBreak: 'break-all' }}>
                      Pay to: {d.cryptoAddress}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.7rem', color: '#666', mt: 0.5 }}>
                    Ref: {d.reference || 'N/A'} | {formatDate(d.createdAt)}
                  </Typography>
                </Box>
                <Tooltip title="Confirm Deposit">
                  <IconButton
                    onClick={() => { setSelectedDeposit(d); setConfirmDepositDialog(true); }}
                    sx={{ color: '#00ff88', bgcolor: 'rgba(0,255,136,0.1)', width: 48, height: 48 }}
                  >
                    <ApproveIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Tab 1: Pending Withdrawals */}
      {activeTab === 1 && (
        <Box sx={styles.tabContent}>
          {pendingWithdrawals.length === 0 ? (
            <Box sx={styles.emptyState}>
              <WalletIcon sx={{ fontSize: 48, color: '#333', mb: 1 }} />
              <Typography sx={{ color: '#666' }}>No pending withdrawals</Typography>
            </Box>
          ) : (
            pendingWithdrawals.map((w) => (
              <Box key={w.id} sx={styles.listItem}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: '#fff' }}>
                    {formatCurrency(w.amount, w.currency)} → {w.cryptoSymbol || 'USDT'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#aaa', mt: 0.5 }}>
                    User: {w.userId?.substring(0, 8)}... | {formatDate(w.createdAt)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#888', fontFamily: 'monospace', mt: 0.5, wordBreak: 'break-all' }}>
                    To: {w.destinationAddress || 'N/A'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Approve & Mark Complete">
                    <IconButton 
                      onClick={() => { setSelectedWithdrawal(w); setApprovalDialog(true); }}
                      sx={{ color: '#00ff88', bgcolor: 'rgba(0,255,136,0.1)' }}
                    >
                      <ApproveIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reject">
                    <IconButton 
                      onClick={async () => {
                        if (window.confirm('Reject this withdrawal? Funds will return to user wallet.')) {
                          setSelectedWithdrawal(w);
                          await handleApproveWithdrawal(false);
                        }
                      }}
                      sx={{ color: '#ff5555', bgcolor: 'rgba(255,85,85,0.1)' }}
                    >
                      <RejectIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Tab 2: Disputes */}
      {activeTab === 2 && (
        <Box sx={styles.tabContent}>
          {disputes.length === 0 ? (
            <Box sx={styles.emptyState}>
              <GavelIcon sx={{ fontSize: 48, color: '#333', mb: 1 }} />
              <Typography sx={{ color: '#666' }}>No open disputes</Typography>
            </Box>
          ) : (
            disputes.map((d) => (
              <Box key={d.id} sx={styles.listItem}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, color: '#fff' }}>
                      {formatCurrency(d.amount, d.currency)}
                    </Typography>
                    <Chip label={d.status} size="small" sx={{ bgcolor: 'rgba(255,87,34,0.2)', color: '#ff5722', height: 20 }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', color: '#aaa' }}>
                    Client: {d.client?.username || 'N/A'} (strikes: {d.client?.disputeStrikes || 0})
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#aaa' }}>
                    Provider: {d.provider?.username || 'N/A'} (strikes: {d.provider?.disputeStrikes || 0})
                  </Typography>
                  {d.disputeData?.reason && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#ffd700', mt: 0.5 }}>
                      Reason: {d.disputeData.reason}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.7rem', color: '#666', mt: 0.5 }}>
                    Created: {formatDate(d.createdAt)} | PIN entered: {d.pinEntered ? 'Yes' : 'No'}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => { setSelectedDispute(d); setResolveDialog(true); }}
                  sx={{ bgcolor: '#ffd700', color: '#000', fontWeight: 700, minWidth: 80 }}
                >
                  Resolve
                </Button>
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Tab 3: Banned Users & Unban Requests */}
      {activeTab === 3 && (
        <Box sx={styles.tabContent}>
          {/* Unban Requests */}
          {unbanRequests.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 700, color: '#ff9800', mb: 1, px: 1 }}>
                Pending Unban Requests ({unbanRequests.length})
              </Typography>
              {unbanRequests.map((r) => (
                <Box key={r.userId} sx={{ ...styles.listItem, borderColor: 'rgba(255,152,0,0.3)' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, color: '#fff' }}>{r.username}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: '#aaa' }}>
                      Strikes: {r.disputeStrikes} | Ban: {r.banData?.ban_reason || 'N/A'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: '#ffd700', mt: 0.5 }}>
                      Appeal: {r.request?.reason || 'No reason provided'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      onClick={() => handleUnbanDecision(r.userId, true)}
                      sx={{ color: '#00ff88', bgcolor: 'rgba(0,255,136,0.1)' }}
                      disabled={actionLoading}
                    >
                      <UnbanIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleUnbanDecision(r.userId, false)}
                      sx={{ color: '#ff5555', bgcolor: 'rgba(255,85,85,0.1)' }}
                      disabled={actionLoading}
                    >
                      <RejectIcon />
                    </IconButton>
                  </Box>
                </Box>
              ))}
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 2 }} />
            </>
          )}

          {/* Banned Users */}
          <Typography sx={{ fontWeight: 700, color: '#ff5555', mb: 1, px: 1 }}>
            Banned Users ({bannedUsers.length})
          </Typography>
          {bannedUsers.length === 0 ? (
            <Box sx={styles.emptyState}>
              <BanIcon sx={{ fontSize: 48, color: '#333', mb: 1 }} />
              <Typography sx={{ color: '#666' }}>No banned users</Typography>
            </Box>
          ) : (
            bannedUsers.map((u) => (
              <Box key={u.id} sx={styles.listItem}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: '#fff' }}>{u.username}</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#aaa' }}>
                    {u.email} | Strikes: {u.disputeStrikes}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#888' }}>
                    {u.banData?.ban_reason || 'No reason'} | {formatDate(u.banData?.banned_at)}
                  </Typography>
                </Box>
                <Chip 
                  label={u.hasPendingUnbanRequest ? 'Appeal Pending' : 'Banned'} 
                  size="small"
                  sx={{ 
                    bgcolor: u.hasPendingUnbanRequest ? 'rgba(255,152,0,0.2)' : 'rgba(255,85,85,0.2)', 
                    color: u.hasPendingUnbanRequest ? '#ff9800' : '#ff5555' 
                  }} 
                />
              </Box>
            ))
          )}
        </Box>
      )}

      {/* ============ DIALOGS ============ */}

      {/* Withdraw Platform Fees Dialog */}
      <Dialog open={withdrawFeeDialog} onClose={() => setWithdrawFeeDialog(false)}
        PaperProps={{ sx: { bgcolor: '#0a0a0f', color: '#fff', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', minWidth: 350 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Withdraw Platform Fees</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(0,242,234,0.1)', color: '#00f2ea' }}>
            Available: {formatCurrency(revenue?.totalRevenue)} total revenue
          </Alert>
          <TextField
            label="Amount (USD)"
            type="number"
            fullWidth
            value={feeAmount}
            onChange={e => setFeeAmount(e.target.value)}
            sx={{ mb: 2, ...styles.textField }}
          />
          <TextField
            label="Destination Wallet Address"
            fullWidth
            value={feeAddress}
            onChange={e => setFeeAddress(e.target.value)}
            sx={{ mb: 2, ...styles.textField }}
          />
          <TextField
            select
            label="Crypto"
            fullWidth
            value={feeCrypto}
            onChange={e => setFeeCrypto(e.target.value)}
            sx={styles.textField}
          >
            {['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL', 'LTC'].map(c => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setWithdrawFeeDialog(false)} sx={{ color: '#888' }}>Cancel</Button>
          <Button onClick={handleWithdrawFees} variant="contained" disabled={actionLoading}
            sx={{ bgcolor: '#00ff88', color: '#000', fontWeight: 700 }}>
            {actionLoading ? <CircularProgress size={20} /> : 'Withdraw'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={resolveDialog} onClose={() => setResolveDialog(false)}
        PaperProps={{ sx: { bgcolor: '#0a0a0f', color: '#fff', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', minWidth: 350 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Resolve Dispute</DialogTitle>
        <DialogContent>
          {selectedDispute && (
            <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(255,215,0,0.1)', color: '#ffd700' }}>
              {formatCurrency(selectedDispute.amount, selectedDispute.currency)} between {selectedDispute.client?.username} (client) and {selectedDispute.provider?.username} (provider)
            </Alert>
          )}
          <TextField
            select
            label="Winner"
            fullWidth
            value={resolveWinner}
            onChange={e => setResolveWinner(e.target.value)}
            sx={{ mb: 2, ...styles.textField }}
          >
            <MenuItem value="client">Client (Refund)</MenuItem>
            <MenuItem value="provider">Provider (Release Payment)</MenuItem>
          </TextField>
          <TextField
            label="Reasoning"
            fullWidth
            multiline
            rows={3}
            value={resolveReasoning}
            onChange={e => setResolveReasoning(e.target.value)}
            sx={styles.textField}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResolveDialog(false)} sx={{ color: '#888' }}>Cancel</Button>
          <Button onClick={handleResolveDispute} variant="contained" disabled={actionLoading}
            sx={{ bgcolor: '#ffd700', color: '#000', fontWeight: 700 }}>
            {actionLoading ? <CircularProgress size={20} /> : 'Resolve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Deposit Dialog */}
      <Dialog open={confirmDepositDialog} onClose={() => setConfirmDepositDialog(false)}
        PaperProps={{ sx: { bgcolor: '#0a0a0f', color: '#fff', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', minWidth: 350 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Deposit</DialogTitle>
        <DialogContent>
          {selectedDeposit && (
            <>
              <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(0,242,234,0.1)', color: '#00f2ea' }}>
                ${Number(selectedDeposit.amount || 0).toFixed(2)}
                {selectedDeposit.cryptoSymbol && ` ≈ ${selectedDeposit.cryptoAmount || '?'} ${selectedDeposit.cryptoSymbol}`}
              </Alert>
              <Typography sx={{ fontSize: '0.85rem', color: '#aaa', mb: 0.5 }}>
                User: {selectedDeposit.username || selectedDeposit.userId}
              </Typography>
              {selectedDeposit.cryptoAddress && (
                <Typography sx={{ fontSize: '0.75rem', color: '#888', fontFamily: 'monospace', mb: 2, wordBreak: 'break-all' }}>
                  Payment address: {selectedDeposit.cryptoAddress}
                </Typography>
              )}
              <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(255,215,0,0.1)', color: '#ffd700', fontSize: '0.8rem' }}>
                Verify the user actually sent crypto to the address above before confirming. Check the blockchain explorer for the relevant network.
              </Alert>
            </>
          )}
          <TextField
            label="Blockchain TX Hash (optional)"
            fullWidth
            value={depositTxHash}
            onChange={e => setDepositTxHash(e.target.value)}
            placeholder="0x... or similar"
            sx={{ mb: 2, ...styles.textField }}
          />
          <TextField
            label="Admin Notes (optional)"
            fullWidth
            multiline
            rows={2}
            value={depositNotes}
            onChange={e => setDepositNotes(e.target.value)}
            placeholder="e.g. Verified on Etherscan, TX confirmed"
            sx={styles.textField}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmDepositDialog(false)} sx={{ color: '#888' }}>Cancel</Button>
          <Button onClick={handleConfirmDeposit} variant="contained" disabled={actionLoading}
            sx={{ bgcolor: '#00ff88', color: '#000', fontWeight: 700 }}>
            {actionLoading ? <CircularProgress size={20} /> : 'Confirm & Credit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Withdrawal Dialog */}
      <Dialog open={approvalDialog} onClose={() => setApprovalDialog(false)}
        PaperProps={{ sx: { bgcolor: '#0a0a0f', color: '#fff', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', minWidth: 350 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Approve Withdrawal</DialogTitle>
        <DialogContent>
          {selectedWithdrawal && (
            <>
              <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(0,242,234,0.1)', color: '#00f2ea' }}>
                {formatCurrency(selectedWithdrawal.amount, selectedWithdrawal.currency)}
                {' → '}{selectedWithdrawal.cryptoSymbol || 'USDT'}
              </Alert>
              <Typography sx={{ fontSize: '0.85rem', color: '#aaa', mb: 1, wordBreak: 'break-all' }}>
                To: {selectedWithdrawal.destinationAddress || 'N/A'}
              </Typography>
            </>
          )}
          <TextField
            label="Blockchain TX Hash (optional - fill after sending)"
            fullWidth
            value={txHash}
            onChange={e => setTxHash(e.target.value)}
            placeholder="0x..."
            sx={{ mb: 1, ...styles.textField }}
          />
          <Typography sx={{ fontSize: '0.75rem', color: '#888' }}>
            After manually sending crypto to the user's wallet, paste the transaction hash here for records.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setApprovalDialog(false)} sx={{ color: '#888' }}>Cancel</Button>
          <Button onClick={() => handleApproveWithdrawal(true)} variant="contained" disabled={actionLoading}
            sx={{ bgcolor: '#00ff88', color: '#000', fontWeight: 700 }}>
            {actionLoading ? <CircularProgress size={20} /> : 'Approve & Complete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ============ STYLES ============
const styles = {
  container: {
    minHeight: '100vh',
    bgcolor: '#000',
    pb: 10,
    maxWidth: 600,
    mx: 'auto'
  },
  centerBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    p: 2,
    position: 'sticky',
    top: 0,
    bgcolor: 'rgba(0,0,0,0.95)',
    zIndex: 100,
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 1.5,
    p: 2
  },
  statCard: {
    p: 2,
    borderRadius: 3,
    bgcolor: 'rgba(255,255,255,0.03)',
    border: '1px solid',
    borderColor: 'rgba(255,255,255,0.08)',
    textAlign: 'center'
  },
  statValue: {
    fontWeight: 800,
    fontSize: '1.3rem',
    color: '#fff',
    mt: 0.5
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#888',
    mt: 0.5
  },
  revenueCard: {
    mx: 2,
    p: 2.5,
    borderRadius: 3,
    bgcolor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    mb: 2
  },
  revenueRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    py: 0.8
  },
  tabs: {
    mx: 2,
    '& .MuiTab-root': { color: '#888', textTransform: 'none', minHeight: 44, fontSize: '0.85rem' },
    '& .Mui-selected': { color: '#00f2ea' },
    '& .MuiTabs-indicator': { bgcolor: '#00f2ea' }
  },
  tabContent: {
    px: 2,
    py: 1
  },
  emptyState: {
    textAlign: 'center',
    py: 6
  },
  listItem: {
    p: 2,
    mb: 1.5,
    borderRadius: 2,
    bgcolor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: 2
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
      '&.Mui-focused fieldset': { borderColor: '#00f2ea' }
    },
    '& .MuiInputLabel-root': { color: '#888' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#00f2ea' }
  }
};

export default AdminDashboard;
