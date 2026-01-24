import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment
} from '@mui/material';
import {
  Lock as HoldIcon,
  CheckCircle as AcceptIcon,
  Cancel as DeclineIcon,
  Send as SendIcon,
  AccountBalanceWallet as WalletIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../config/constants';
import useCurrency from '../hooks/useCurrency';

/**
 * MilestoneRequest Component
 * 
 * Used in chat for:
 * 1. Client to REQUEST provider to set up a milestone (tag provider)
 * 2. Provider to SEND a milestone request to client (with amount)
 * 3. Display incoming/outgoing milestone requests
 * 4. Accept/decline milestone requests
 */

// Request Dialog - For sending a milestone request
export const MilestoneRequestDialog = ({ 
  open, 
  onClose, 
  recipientId, 
  recipientName,
  isProvider = false, // true if current user is the provider
  onSuccess 
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use currency hook for country-specific currency
  const { symbol, code: currencyCode, minAmount, quickAmounts: defaultQuickAmounts } = useCurrency();
  
  // Dynamic quick amounts based on currency
  const quickAmounts = defaultQuickAmounts || 
    (currencyCode === 'GHS' ? [10, 50, 100, 200, 500] :
     currencyCode === 'NGN' ? [1000, 5000, 10000, 20000, 50000] :
     [10, 50, 100, 200, 500]);
  
  const minimumAmount = minAmount || (currencyCode === 'GHS' ? 5 : 500);

  const handleSend = async () => {
    if (!amount || Number(amount) < minimumAmount) {
      setError(`Minimum amount is ${symbol}${minimumAmount}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/milestone/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId,
          amount: Number(amount),
          currency: currencyCode,
          description: description || (isProvider ? 'Service payment' : 'Payment request'),
          requestType: isProvider ? 'provider_request' : 'client_request'
        })
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess?.(data);
        onClose();
        setAmount('');
        setDescription('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send request');
      }
    } catch (err) {
      console.error('Milestone request error:', err);
      setError('Failed to send request. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{ sx: styles.dialog }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={styles.dialogTitle}>
        {isProvider ? '💰 Request Payment' : '🔒 Request Payment Hold'}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isProvider 
            ? `Send a payment request to ${recipientName}. They will hold the money until service is complete.`
            : `Request ${recipientName} to set up a payment. You'll hold the money safely until service is done.`
          }
        </Typography>

        <TextField
          fullWidth
          label={`Amount (${symbol})`}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          sx={styles.textField}
          placeholder="Enter amount"
          InputProps={{
            startAdornment: <InputAdornment position="start" sx={{ color: '#fff' }}>{symbol}</InputAdornment>,
          }}
        />

        {/* Quick amount buttons */}
        <Box sx={styles.quickAmounts}>
          {quickAmounts.map((amt) => (
            <Chip
              key={amt}
              label={`${symbol}${amt.toLocaleString()}`}
              onClick={() => setAmount(amt.toString())}
              sx={{
                bgcolor: amount === amt.toString() ? '#00f2ea' : 'rgba(255,255,255,0.1)',
                color: amount === amt.toString() ? '#000' : '#fff',
                fontWeight: 600
              }}
            />
          ))}
        </Box>

        <TextField
          fullWidth
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ ...styles.textField, mt: 2 }}
          placeholder={isProvider ? "What is this payment for?" : "Add a note"}
          multiline
          rows={2}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ color: '#888' }}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSend}
          disabled={loading || !amount}
          startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
          sx={styles.primaryBtn}
        >
          Send Request
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Milestone Request Card - Displayed in chat messages
export const MilestoneRequestCard = ({
  request,
  currentUserId,
  onAccept,
  onDecline,
  onPay
}) => {
  const [loading, setLoading] = useState(false);
  
  const isFromMe = request.senderId === currentUserId;
  const isPending = request.status === 'pending';
  const isAccepted = request.status === 'accepted';
  const isDeclined = request.status === 'declined';
  const isPaid = request.status === 'paid';

  const handleAccept = async () => {
    setLoading(true);
    try {
      await onAccept?.(request.id);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      await onDecline?.(request.id);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      await onPay?.(request);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      ...styles.requestCard,
      borderColor: isPaid ? '#00ff88' : isAccepted ? '#00f2ea' : isDeclined ? '#ff3333' : '#ffd700'
    }}>
      <Box sx={styles.requestHeader}>
        <HoldIcon sx={{ color: '#ffd700', fontSize: 20 }} />
        <Typography sx={styles.requestTitle}>
          {isFromMe ? 'Payment Request Sent' : 'Payment Request'}
        </Typography>
        <Chip 
          label={isPaid ? 'Paid' : isAccepted ? 'Accepted' : isDeclined ? 'Declined' : 'Pending'}
          size="small"
          sx={{
            bgcolor: isPaid ? 'rgba(0,255,136,0.2)' : isAccepted ? 'rgba(0,242,234,0.2)' : isDeclined ? 'rgba(255,51,51,0.2)' : 'rgba(255,215,0,0.2)',
            color: isPaid ? '#00ff88' : isAccepted ? '#00f2ea' : isDeclined ? '#ff3333' : '#ffd700',
            fontWeight: 600
          }}
        />
      </Box>

      <Typography sx={styles.requestAmount}>
        ₦{Number(request.amount).toLocaleString()}
      </Typography>

      {request.description && (
        <Typography sx={styles.requestDescription}>
          {request.description}
        </Typography>
      )}

      {/* Actions for recipient */}
      {!isFromMe && isPending && (
        <Box sx={styles.requestActions}>
          <Button
            variant="contained"
            size="small"
            startIcon={<AcceptIcon />}
            onClick={handleAccept}
            disabled={loading}
            sx={{ bgcolor: '#00ff88', color: '#000', '&:hover': { bgcolor: '#00cc6a' } }}
          >
            Accept
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DeclineIcon />}
            onClick={handleDecline}
            disabled={loading}
            sx={{ borderColor: '#ff3333', color: '#ff3333' }}
          >
            Decline
          </Button>
        </Box>
      )}

      {/* Pay button for client after accepting */}
      {!isFromMe && isAccepted && request.requestType === 'provider_request' && (
        <Box sx={styles.requestActions}>
          <Button
            variant="contained"
            size="small"
            startIcon={<WalletIcon />}
            onClick={handlePay}
            disabled={loading}
            sx={{ bgcolor: '#00f2ea', color: '#000', '&:hover': { bgcolor: '#00d4ce' } }}
          >
            Pay & Hold
          </Button>
        </Box>
      )}

      {/* Waiting indicator for sender */}
      {isFromMe && isPending && (
        <Typography sx={styles.waitingText}>
          Waiting for response...
        </Typography>
      )}
    </Box>
  );
};

// Quick action buttons for chat input area
export const MilestoneQuickActions = ({ 
  onRequestPayment, 
  onSendRequest,
  isProvider,
  hasActiveRequest 
}) => {
  if (hasActiveRequest) {
    return (
      <Chip
        icon={<HoldIcon />}
        label="Request Pending"
        size="small"
        sx={{ bgcolor: 'rgba(255,215,0,0.2)', color: '#ffd700' }}
      />
    );
  }

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<HoldIcon />}
      onClick={isProvider ? onSendRequest : onRequestPayment}
      sx={{
        borderColor: '#ffd700',
        color: '#ffd700',
        fontSize: '12px',
        py: 0.5,
        '&:hover': {
          borderColor: '#ffc107',
          bgcolor: 'rgba(255,215,0,0.1)'
        }
      }}
    >
      {isProvider ? 'Request Payment' : 'Request Hold'}
    </Button>
  );
};

const styles = {
  dialog: {
    bgcolor: '#1a1a2e',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  dialogTitle: {
    color: '#fff',
    fontWeight: 600,
    textAlign: 'center'
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
    mt: 2
  },
  primaryBtn: {
    bgcolor: '#00f2ea',
    color: '#000',
    borderRadius: '12px',
    fontWeight: 600,
    '&:hover': { bgcolor: '#00d4ce' }
  },
  requestCard: {
    bgcolor: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '16px',
    border: '2px solid',
    maxWidth: '280px'
  },
  requestHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    mb: 1
  },
  requestTitle: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    flex: 1
  },
  requestAmount: {
    color: '#00ff88',
    fontWeight: 700,
    fontSize: '24px',
    my: 1
  },
  requestDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '13px',
    mb: 2
  },
  requestActions: {
    display: 'flex',
    gap: '10px',
    mt: 2
  },
  waitingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px',
    fontStyle: 'italic',
    mt: 1
  }
};

export default MilestoneRequestCard;
