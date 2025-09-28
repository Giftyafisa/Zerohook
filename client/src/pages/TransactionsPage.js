import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import {
  Search,
  FilterList,
  Receipt,
  Schedule,
  Star,
  Visibility,
  Download,
  TrendingUp,
  AccountBalance
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { colors } from '../theme/colors';

const TransactionsPage = () => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Mock transactions data
  const [transactions] = useState([
    {
      id: 'TXN-001',
      serviceTitle: 'Premium Dgy Experience',
      provider: 'Sarah M.',
      client: 'John D.',
      amount: 150,
      status: 'completed',
      date: '2024-01-15',
      time: '14:30',
      paymentMethod: 'Stripe',
      serviceCategory: 'dgy',
      duration: 120,
      rating: 5,
      review: 'Excellent service, highly recommended!',
      transactionFee: 7.50,
      netAmount: 142.50
    },
    {
      id: 'TXN-002',
      serviceTitle: 'Romans Cultural Tour',
      provider: 'James K.',
      client: 'John D.',
      amount: 200,
      status: 'pending',
      date: '2024-01-14',
      time: '10:15',
      paymentMethod: 'Escrow',
      serviceCategory: 'romans',
      duration: 180,
      rating: null,
      review: null,
      transactionFee: 10.00,
      netAmount: 190.00
    },
    {
      id: 'TXN-003',
      serviceTitle: 'Ridin Adventure Safari',
      provider: 'Mike A.',
      client: 'John D.',
      amount: 120,
      status: 'completed',
      date: '2024-01-12',
      time: '16:45',
      paymentMethod: 'Stripe',
      serviceCategory: 'ridin',
      duration: 240,
      rating: 4,
      review: 'Great adventure experience!',
      transactionFee: 6.00,
      netAmount: 114.00
    },
    {
      id: 'TXN-004',
      serviceTitle: 'Bb Suk Elite Package',
      provider: 'Grace O.',
      client: 'John D.',
      amount: 350,
      status: 'cancelled',
      date: '2024-01-10',
      time: '09:20',
      paymentMethod: 'Escrow',
      serviceCategory: 'bb_suk',
      duration: 300,
      rating: null,
      review: null,
      transactionFee: 17.50,
      netAmount: 332.50
    }
  ]);

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'success',
      pending: 'warning',
      cancelled: 'error',
      failed: 'error'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      completed: '✅',
      pending: '⏳',
      cancelled: '❌',
      failed: '💥'
    };
    return icons[status] || '❓';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      dgy: '💎',
      romans: '🏛️',
      ridin: '🚗',
      bb_suk: '⭐'
    };
    return icons[category] || '🔥';
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
    const matchesSearch = transaction.serviceTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalEarnings = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.netAmount, 0);

  const pendingAmount = transactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedTransaction(null);
  };

  const TransactionRow = ({ transaction }) => (
    <TableRow hover>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span>{getCategoryIcon(transaction.serviceCategory)}</span>
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {transaction.serviceTitle}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {transaction.id}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
            {transaction.provider[0]}
          </Avatar>
          <Typography variant="body2">{transaction.provider}</Typography>
        </Box>
      </TableCell>
      
      <TableCell>
        <Typography variant="body2" fontWeight="bold" color="primary.main">
          ${transaction.amount}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Net: ${transaction.netAmount}
        </Typography>
      </TableCell>
      
      <TableCell>
        <Chip
          label={`${getStatusIcon(transaction.status)} ${transaction.status}`}
          color={getStatusColor(transaction.status)}
          size="small"
          sx={{ textTransform: 'capitalize' }}
        />
      </TableCell>
      
      <TableCell>
        <Typography variant="body2">
          {new Date(transaction.date).toLocaleDateString()}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {transaction.time}
        </Typography>
      </TableCell>
      
      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => handleViewDetails(transaction)}
            color="primary"
          >
            <Visibility />
          </IconButton>
          {transaction.status === 'completed' && (
            <IconButton size="small" color="success">
              <Download />
            </IconButton>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 12 }}>
      {/* Header */}
      <motion.div {...fadeInUp}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Transaction History 💳
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track all your service payments and earnings
          </Typography>
        </Box>
      </motion.div>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div {...fadeInUp}>
            <Card elevation={4}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TrendingUp sx={{ color: 'success.main', mr: 1 }} />
                  <Typography variant="h6" fontWeight="bold">
                    Total Earnings
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  ${totalEarnings.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  From completed services
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div {...fadeInUp}>
            <Card elevation={4}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Schedule sx={{ color: 'warning.main', mr: 1 }} />
                  <Typography variant="h6" fontWeight="bold">
                    Pending
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" color="warning.main">
                  ${pendingAmount.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Awaiting completion
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div {...fadeInUp}>
            <Card elevation={4}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Receipt sx={{ color: 'primary.main', mr: 1 }} />
                  <Typography variant="h6" fontWeight="bold">
                    Total Transactions
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="primary.main">
                    {transactions.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    All time
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div {...fadeInUp}>
            <Card elevation={4}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AccountBalance sx={{ color: 'info.main', mr: 1 }} />
                  <Typography variant="h6" fontWeight="bold">
                    Success Rate
                  </Typography>
                <Typography variant="h4" fontWeight="bold" color="info.main">
                  {Math.round((transactions.filter(t => t.status === 'completed').length / transactions.length) * 100)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed services
                </Typography>
              </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Filters */}
      <motion.div {...fadeInUp}>
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Status Filter"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </motion.div>

      {/* Transactions Table */}
      <motion.div {...fadeInUp}>
        <Card elevation={4}>
          <CardHeader
            title="Transaction Details"
            subheader={`Showing ${filteredTransactions.length} of ${transactions.length} transactions`}
          />
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Service</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {filteredTransactions.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No transactions found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search criteria or filters
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Transaction Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedTransaction && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{getCategoryIcon(selectedTransaction.serviceCategory)}</span>
                Transaction Details
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Service Information
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Title:</strong> {selectedTransaction.serviceTitle}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Category:</strong> {selectedTransaction.serviceCategory}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Duration:</strong> {selectedTransaction.duration} minutes
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Provider:</strong> {selectedTransaction.provider}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Payment Details
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Transaction ID:</strong> {selectedTransaction.id}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Amount:</strong> ${selectedTransaction.amount}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Fee:</strong> ${selectedTransaction.transactionFee}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Net Amount:</strong> ${selectedTransaction.netAmount}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Method:</strong> {selectedTransaction.paymentMethod}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Status & Date
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Chip
                      label={`${getStatusIcon(selectedTransaction.status)} ${selectedTransaction.status}`}
                      color={getStatusColor(selectedTransaction.status)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                    <Typography variant="body2">
                      {new Date(selectedTransaction.date).toLocaleDateString()} at {selectedTransaction.time}
                    </Typography>
                  </Box>
                </Grid>

                {selectedTransaction.rating && (
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Review & Rating
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {[...Array(selectedTransaction.rating)].map((_, i) => (
                        <Star key={i} sx={{ color: colors.warning }} />
                      ))}
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {selectedTransaction.rating}/5
                      </Typography>
    </Box>
                    <Typography variant="body2" color="text.secondary">
                      "{selectedTransaction.review}"
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Close</Button>
              {selectedTransaction.status === 'completed' && (
                <Button variant="contained" startIcon={<Download />}>
                  Download Receipt
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default TransactionsPage;
