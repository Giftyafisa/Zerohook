const { Transaction, User } = require('../config/database');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Configuration constants
const CONFIRMATION_WINDOW_HOURS = 48; // Client has 48 hours to confirm or dispute after PIN entered
const AUTO_RELEASE_HOURS = 48; // Auto-release funds after this time if no dispute
const MAX_DISPUTE_STRIKES = 3; // Number of lost disputes before ban
const PROVIDER_CLAIM_RESPONSE_HOURS = 24; // Client has 24h to respond to provider's claim

class EscrowManager {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.escrowContract = null;
    this.wallet = null;
    this.autoReleaseInterval = null;
    this.MAX_PIN_ATTEMPTS = 5;
    this.io = null; // Socket.io instance for auto-release notifications
  }

  /**
   * Set the Socket.io instance for emitting auto-release notifications
   * @param {object} io - Socket.io server instance
   */
  setIO(io) {
    this.io = io;
  }

  async initialize() {
    try {
      console.log('💰 Initializing Escrow Manager (PIN Verification Mode)...');
      
      // Clear any existing interval before starting a new one
      if (this.autoReleaseInterval) {
        clearInterval(this.autoReleaseInterval);
      }
      
      // Start auto-release checker (runs every hour)
      this.startAutoReleaseChecker();
      
      console.log('✅ Escrow Manager initialized with PIN verification system');
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Escrow Manager initialization failed:', error);
      return false;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  /**
   * Generate a secure 6-digit completion PIN
   */
  generateCompletionPin() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Create a new escrow transaction with completion PIN - Uses MongoDB
   */
  async createEscrow(transactionData) {
    try {
      const { 
        clientId, 
        providerId, 
        serviceId, 
        amount, 
        currency = 'USD',
        scheduledTime,
        locationData,
        paymentMethod = 'wallet' // 'wallet' uses user's wallet balance, 'crypto' uses crypto payment
      } = transactionData;

      // Convert IDs to ObjectId
      const clientObjId = typeof clientId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(clientId) : clientId;
      const providerObjId = typeof providerId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(providerId) : providerId;
      
      // Check if client is banned
      const client = await User.findById(clientObjId);
      if (client?.is_banned) {
        throw new Error('Your account is banned. Please contact support to appeal.');
      }

      // Check if provider is banned
      const provider = await User.findById(providerObjId);
      if (provider?.is_banned) {
        throw new Error('This service provider is currently unavailable.');
      }

      // If using wallet payment, check client has sufficient balance
      if (paymentMethod === 'wallet') {
        const { Transaction } = require('../config/database');
        
        // Calculate client's wallet balance
        const depositResult = await Transaction.aggregate([
          { 
            $match: { 
              user_id: clientObjId, 
              type: { $in: ['deposit', 'wallet_topup', 'escrow_release'] }, 
              status: { $in: ['completed', 'confirmed'] } 
            } 
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const withdrawalResult = await Transaction.aggregate([
          { 
            $match: { 
              user_id: clientObjId, 
              type: 'withdrawal', 
              status: { $in: ['completed', 'confirmed'] } 
            } 
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const escrowHeldResult = await Transaction.aggregate([
          { 
            $match: { 
              client_id: clientObjId, 
              type: 'escrow_hold',
              status: { $in: ['held', 'pending', 'pin_entered'] } 
            } 
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const deposits = depositResult[0]?.total || 0;
        const withdrawals = withdrawalResult[0]?.total || 0;
        const escrowHeld = escrowHeldResult[0]?.total || 0;
        const availableBalance = deposits - withdrawals - escrowHeld;
        
        if (availableBalance < amount) {
          throw new Error(`Insufficient wallet balance. Available: ${currency}${availableBalance.toFixed(2)}, Required: ${currency}${amount}`);
        }
      }

      // Generate reference and completion PIN
      const reference = `ESC_${Date.now()}_${clientId.toString().substring(0, 8)}`;
      const completionPin = this.generateCompletionPin();
      const initialStatus = paymentMethod === 'crypto' ? 'pending_payment' : 'held';

      // Create escrow hold transaction in MongoDB with PIN
      const { Transaction } = require('../config/database');
      const escrowTransaction = await Transaction.create({
        service_id: serviceId ? mongoose.Types.ObjectId.createFromHexString(serviceId) : null,
        client_id: clientObjId,
        provider_id: providerObjId,
        user_id: clientObjId, // The client is the one holding the money
        amount: amount,
        currency: currency,
        payment_method: paymentMethod,
        reference: reference,
        status: initialStatus, // Wallet payments are held immediately; crypto waits for confirmation.
        type: 'escrow_hold',
        scheduled_time: scheduledTime ? new Date(scheduledTime) : null,
        location_data: locationData || {},
        completion_pin: completionPin, // Store PIN (only client can see it)
        metadata: {
          type: 'escrow',
          description: `Escrow for service`,
          scheduledTime: scheduledTime,
          paymentMethod: paymentMethod
        }
      });

      console.log(`✅ Escrow created with PIN: ${reference} - ${currency}${amount} from ${clientId} to ${providerId}`);

      return {
        id: escrowTransaction._id.toString(),
        transactionId: escrowTransaction._id.toString(),
        reference: reference,
        status: initialStatus,
        amount: amount,
        currency: currency,
        completionPin: completionPin, // Return PIN to client only
        created: escrowTransaction.created_at,
        message: paymentMethod === 'crypto'
          ? 'Complete crypto payment to activate the escrow hold, then share the 6-digit PIN after service completion.'
          : 'Share the 6-digit PIN with the provider ONLY after service is completed.'
      };

    } catch (error) {
      console.error('Escrow creation failed:', error);
      throw error;
    }
  }

  /**
   * Provider enters PIN to confirm they provided the service (Uber-style)
   */
  async enterCompletionPin(transactionId, pin, providerId) {
    try {
      const { Transaction, User } = require('../config/database');
      
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;
      const providerObjId = typeof providerId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(providerId) : providerId;
      
      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      // Verify the user is the provider for this escrow
      if (transaction.provider_id.toString() !== providerObjId.toString()) {
        throw new Error('Only the service provider can enter the completion PIN');
      }

      if (transaction.status !== 'held') {
        throw new Error(`Cannot enter PIN. Transaction status: ${transaction.status}`);
      }

      // Verify PIN matches with brute-force protection
      const pinAttempts = transaction.pin_attempts || 0;
      if (pinAttempts >= this.MAX_PIN_ATTEMPTS) {
        console.log(`🚫 PIN attempts exhausted for escrow ${transactionId}`);
        return {
          success: false,
          error: 'Too many invalid PIN attempts. Please contact support.',
          attemptsRemaining: 0
        };
      }

      if (transaction.completion_pin !== pin) {
        // Increment attempts atomically
        await Transaction.findByIdAndUpdate(transactionObjId, {
          $inc: { pin_attempts: 1 }
        });
        const remaining = this.MAX_PIN_ATTEMPTS - pinAttempts - 1;
        console.log(`❌ Invalid PIN attempt for escrow ${transactionId} by provider ${providerId} (${remaining} left)`);
        return {
          success: false,
          error: 'Invalid PIN. Please ask the client for the correct PIN.',
          attemptsRemaining: remaining
        };
      }

      // PIN is correct - update transaction status
      const confirmationDeadline = new Date();
      confirmationDeadline.setHours(confirmationDeadline.getHours() + CONFIRMATION_WINDOW_HOURS);
      
      const autoReleaseAt = new Date();
      autoReleaseAt.setHours(autoReleaseAt.getHours() + AUTO_RELEASE_HOURS);

      transaction.status = 'pin_entered';
      transaction.pin_entered_at = new Date();
      transaction.pin_entered_by = providerObjId;
      transaction.provider_confirmed = true;
      transaction.provider_confirmed_at = new Date();
      transaction.confirmation_deadline = confirmationDeadline;
      transaction.auto_release_at = autoReleaseAt;
      await transaction.save();

      console.log(`✅ PIN verified for escrow ${transaction.reference}. Client has ${CONFIRMATION_WINDOW_HOURS}h to confirm or dispute.`);

      return {
        success: true,
        message: 'PIN verified! Waiting for client confirmation.',
        confirmationDeadline: confirmationDeadline,
        autoReleaseAt: autoReleaseAt,
        status: 'pin_entered'
      };

    } catch (error) {
      console.error('PIN verification failed:', error);
      throw error;
    }
  }

  /**
   * Client confirms service was delivered - releases funds to provider
   */
  async clientConfirmService(transactionId, clientId) {
    try {
      const { Transaction, User } = require('../config/database');
      
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;
      const clientObjId = typeof clientId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(clientId) : clientId;
      
      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      // Verify the user is the client for this escrow
      if (transaction.client_id.toString() !== clientObjId.toString()) {
        throw new Error('Only the client can confirm service delivery');
      }

      if (transaction.status !== 'pin_entered' && transaction.status !== 'held') {
        throw new Error(`Cannot confirm. Transaction status: ${transaction.status}`);
      }

      // Mark client confirmed
      transaction.client_confirmed = true;
      transaction.client_confirmed_at = new Date();
      
      // Release funds since both parties confirmed
      return await this.releaseFundsToProvider(transaction, 'client_confirmed');

    } catch (error) {
      console.error('Client confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Provider claims they completed the service (when client refuses to share PIN)
   * This gives client 24 hours to either:
   * 1. Share the PIN (normal flow continues)
   * 2. Dispute with evidence
   * 3. Do nothing (provider gets paid + client gets warning)
   */
  async providerClaimServiceComplete(transactionId, providerId, claimData) {
    try {
      const { Transaction, User } = require('../config/database');
      
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;
      const providerObjId = typeof providerId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(providerId) : providerId;
      
      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      // Verify the user is the provider for this escrow
      if (transaction.provider_id.toString() !== providerObjId.toString()) {
        throw new Error('Only the provider can claim service completion');
      }

      // Can only claim if escrow is in 'held' status (PIN not yet entered)
      if (transaction.status !== 'held') {
        throw new Error(`Cannot claim. Transaction status: ${transaction.status}. You can only claim when status is 'held' and client hasn't shared PIN.`);
      }

      // Check if already claimed
      if (transaction.provider_claimed_complete) {
        throw new Error('You have already claimed this service as complete. Waiting for client response.');
      }

      // Set up 24-hour response window for client
      const clientResponseDeadline = new Date();
      clientResponseDeadline.setHours(clientResponseDeadline.getHours() + PROVIDER_CLAIM_RESPONSE_HOURS);

      // Update transaction with claim data
      transaction.provider_claimed_complete = true;
      transaction.provider_claim_data = {
        claimed_at: new Date(),
        evidence_description: claimData.evidenceDescription || 'Service completed as agreed',
        evidence_files: claimData.evidenceFiles || [],
        client_notified_at: new Date(),
        client_response_deadline: clientResponseDeadline
      };
      await transaction.save();

      // Get client info for notification
      const client = await User.findById(transaction.client_id).select('username email');
      const provider = await User.findById(providerObjId).select('username');

      console.log(`📝 Provider ${provider?.username} claimed service complete for escrow ${transaction.reference}. Client ${client?.username} has ${PROVIDER_CLAIM_RESPONSE_HOURS}h to respond.`);

      return {
        success: true,
        message: `Service completion claimed. ${client?.username || 'Client'} has been notified and has 24 hours to share the PIN, confirm, or dispute.`,
        clientResponseDeadline: clientResponseDeadline,
        status: 'claim_pending',
        nextSteps: [
          'Client shares PIN → You enter it → Payment released',
          'Client disputes → Admin reviews evidence → Winner decided',
          'Client ignores (24h) → Payment released to you + Client gets warning'
        ]
      };

    } catch (error) {
      console.error('Provider claim failed:', error);
      throw error;
    }
  }

  /**
   * Release funds to provider (internal method) - with idempotency guard
   */
  async releaseFundsToProvider(transaction, releaseType = 'confirmed') {
    try {
      const { Transaction, User } = require('../config/database');

      // Atomic status update to prevent double-release
      const updated = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: { $ne: 'released' } },
        {
          $set: {
            status: 'released',
            completion_proof: {
              type: releaseType,
              releasedAt: new Date().toISOString()
            },
            completed_at: new Date()
          }
        },
        { new: true }
      );

      if (!updated) {
        console.log(`⚠️ Escrow ${transaction.reference} already released, skipping duplicate`);
        return {
          success: true,
          transactionId: transaction._id.toString(),
          status: 'released',
          message: 'Funds already released'
        };
      }

      // Create a new transaction for the provider showing they earned the money
      const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5') / 100;
      const platformFee = Math.round(transaction.amount * platformFeePercent * 100) / 100; // Round to 2 decimal places
      const providerAmount = transaction.amount - platformFee;

      await Transaction.create({
        provider_id: transaction.provider_id,
        user_id: transaction.provider_id, // For wallet calculations
        client_id: transaction.client_id,
        amount: providerAmount,
        currency: transaction.currency,
        payment_method: 'escrow_release',
        reference: `REL_${transaction.reference}`,
        status: 'completed',
        type: 'escrow_release',
        metadata: {
          originalEscrowId: transaction._id.toString(),
          originalAmount: transaction.amount,
          platformFee: platformFee,
          platformFeePercent: platformFeePercent * 100,
          description: 'Escrow funds released',
          releaseType: releaseType
        }
      });

      // Record platform fee as a separate transaction for accurate revenue tracking
      if (platformFee > 0) {
        await Transaction.create({
          amount: platformFee,
          currency: transaction.currency,
          payment_method: 'platform_fee',
          reference: `FEE_${transaction.reference}`,
          status: 'completed',
          type: 'platform_fee',
          metadata: {
            originalEscrowId: transaction._id.toString(),
            originalAmount: transaction.amount,
            providerAmount: providerAmount,
            providerId: transaction.provider_id?.toString(),
            clientId: transaction.client_id?.toString(),
            description: `Platform fee (${platformFeePercent * 100}%) from escrow release`,
            releaseType: releaseType
          }
        });
        console.log(`💰 Platform fee collected: ${transaction.currency}${platformFee} from escrow ${transaction.reference}`);
      }

      // Update reputation scores positively for successful transaction
      await User.findByIdAndUpdate(transaction.client_id, {
        $inc: { reputation_score: 5, trust_score: 2 }
      });
      await User.findByIdAndUpdate(transaction.provider_id, {
        $inc: { reputation_score: 5, trust_score: 2 }
      });

      console.log(`✅ Escrow released (${releaseType}): ${transaction.reference} - ${transaction.currency}${providerAmount} to provider`);

      return {
        success: true,
        transactionId: transaction._id.toString(),
        status: 'released',
        amount: providerAmount,
        platformFee: platformFee,
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Fund release failed:', error);
      throw error;
    }
  }

  /**
   * Confirm service completion and release funds - MongoDB version
   * REQUIRES caller authorization (must be client or admin)
   */
  async confirmCompletion(transactionId, completionProof, callerUserId) {
    try {
      const { Transaction } = require('../config/database');
      
      // Get transaction details
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;
      
      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Authorization check: only the client or an admin can confirm
      if (callerUserId) {
        const callerObjId = typeof callerUserId === 'string' ?
          mongoose.Types.ObjectId.createFromHexString(callerUserId) : callerUserId;
        const isClient = transaction.client_id.toString() === callerObjId.toString();
        if (!isClient) {
          throw new Error('Only the client can confirm service completion');
        }
      } else {
        throw new Error('Caller user ID is required for authorization');
      }
      
      if (transaction.status !== 'held' && transaction.status !== 'escrowed' && transaction.status !== 'pin_entered') {
        throw new Error(`Transaction not in escrow status. Current status: ${transaction.status}`);
      }

      // Use the idempotent releaseFundsToProvider
      return await this.releaseFundsToProvider(transaction, 'client_confirmed');

    } catch (error) {
      console.error('Completion confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Handle dispute initiation with strike tracking - MongoDB version
   */
  async initiateDispute(transactionId, disputeData, initiatorId) {
    try {
      const { Transaction, User } = require('../config/database');
      
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;
      const initiatorObjId = typeof initiatorId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(initiatorId) : initiatorId;
      
      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Check if user is part of this transaction
      const isClient = transaction.client_id.toString() === initiatorObjId.toString();
      const isProvider = transaction.provider_id.toString() === initiatorObjId.toString();
      
      if (!isClient && !isProvider) {
        throw new Error('You are not authorized to dispute this transaction');
      }

      // Update transaction with dispute data
      transaction.status = 'disputed';
      transaction.dispute_data = {
        initiator_id: initiatorObjId,
        initiator_role: isClient ? 'client' : 'provider',
        reason: disputeData.reason,
        evidence: disputeData.evidence || [],
        timestamp: new Date().toISOString(),
        status: 'open',
        pin_was_entered: !!transaction.pin_entered_at,
        provider_had_confirmed: transaction.provider_confirmed,
        client_had_confirmed: transaction.client_confirmed
      };
      await transaction.save();

      console.log(`⚠️ Dispute initiated for escrow: ${transaction.reference} by ${isClient ? 'client' : 'provider'}`);

      return {
        success: true,
        disputeId: `DIS_${transaction._id.toString().substring(0, 8)}`,
        status: 'disputed',
        message: 'Dispute submitted. Admin will review within 24-48 hours. You can upload evidence to support your case.'
      };

    } catch (error) {
      console.error('Dispute initiation failed:', error);
      throw error;
    }
  }

  /**
   * Add evidence to a dispute
   */
  async addDisputeEvidence(transactionId, userId, evidenceData) {
    try {
      const { Transaction } = require('../config/database');
      
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;
      const userObjId = typeof userId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(userId) : userId;
      
      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction || transaction.status !== 'disputed') {
        throw new Error('Transaction not found or not in dispute');
      }

      // Add evidence
      const evidence = {
        uploaded_by: userObjId,
        file_url: evidenceData.fileUrl,
        file_type: evidenceData.fileType,
        description: evidenceData.description,
        uploaded_at: new Date()
      };

      transaction.evidence = transaction.evidence || [];
      transaction.evidence.push(evidence);
      await transaction.save();

      return {
        success: true,
        message: 'Evidence uploaded successfully'
      };

    } catch (error) {
      console.error('Add evidence failed:', error);
      throw error;
    }
  }

  /**
   * Resolve dispute and apply strike to loser - Admin function
   */
  async resolveDispute(transactionId, resolution, adminId) {
    try {
      const { winner, reasoning, adminNotes } = resolution;
      const { Transaction, User } = require('../config/database');
      
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;

      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'disputed') {
        throw new Error('Transaction is not in disputed status');
      }

      // Determine the loser
      const loserId = winner === 'client' ? transaction.provider_id : transaction.client_id;
      const winnerId = winner === 'client' ? transaction.client_id : transaction.provider_id;

      // Apply strike to the loser and check for ban
      const banResult = await this.applyDisputeStrike(loserId, transactionObjId, reasoning);

      // Update dispute resolution
      transaction.dispute_data = {
        ...transaction.dispute_data,
        resolution: {
          winner: winner,
          reasoning: reasoning,
          admin_notes: adminNotes,
          resolved_by: adminId,
          resolved_at: new Date().toISOString(),
          loser_strike_count: banResult.newStrikeCount,
          loser_banned: banResult.isBanned
        },
        status: 'resolved'
      };

      if (winner === 'client') {
        // Refund to client - mark escrow as refunded
        transaction.status = 'refunded';
        await transaction.save();
        
        // Update reputation
        await User.findByIdAndUpdate(winnerId, {
          $inc: { reputation_score: 5, trust_score: 2 }
        });
        await User.findByIdAndUpdate(loserId, {
          $inc: { reputation_score: -15, trust_score: -5 }
        });
        
        console.log(`✅ Dispute resolved in favor of client - Escrow refunded: ${transaction.reference}`);
      } else {
        // Persist dispute resolution data BEFORE releasing (releaseFundsToProvider uses atomic findOneAndUpdate
        // which would overwrite without saving dispute_data first)
        await transaction.save();
        
        // Release to provider — do NOT pre-set status; releaseFundsToProvider handles it atomically
        await this.releaseFundsToProvider(transaction, 'dispute_resolved_provider');
        
        // Update reputation
        await User.findByIdAndUpdate(winnerId, {
          $inc: { reputation_score: 5, trust_score: 2 }
        });
        await User.findByIdAndUpdate(loserId, {
          $inc: { reputation_score: -15, trust_score: -5 }
        });
        
        console.log(`✅ Dispute resolved in favor of provider - Escrow released: ${transaction.reference}`);
      }

      return {
        success: true,
        resolution: winner,
        transactionId: transactionId,
        loserStrikeCount: banResult.newStrikeCount,
        loserBanned: banResult.isBanned,
        warning: banResult.warning
      };

    } catch (error) {
      console.error('Dispute resolution failed:', error);
      throw error;
    }
  }

  /**
   * Apply a dispute strike to a user and potentially ban them
   */
  async applyDisputeStrike(userId, escrowId, reason) {
    try {
      const { User } = require('../config/database');
      
      const userObjId = typeof userId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(userId) : userId;
      
      const user = await User.findById(userObjId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Increment strike count
      const newStrikeCount = (user.dispute_strikes || 0) + 1;
      
      // Create warning record
      const warning = {
        warning_number: newStrikeCount,
        reason: reason,
        escrow_id: escrowId,
        issued_at: new Date()
      };

      // Check if user should be banned
      const shouldBan = newStrikeCount >= MAX_DISPUTE_STRIKES;

      const updateData = {
        $inc: { dispute_strikes: 1 },
        $push: { dispute_warnings: warning }
      };

      // If reached max strikes, ban the user
      if (shouldBan) {
        updateData.$set = {
          is_banned: true,
          status: 'banned',
          ban_data: {
            banned_at: new Date(),
            ban_reason: `Automatically banned after ${MAX_DISPUTE_STRIKES} lost disputes. Pattern of fraudulent behavior detected.`,
            ban_type: 'dispute_fraud',
            related_disputes: user.dispute_warnings?.map(w => w.escrow_id).filter(Boolean) || []
          }
        };
        updateData.$set.ban_data.related_disputes.push(escrowId);
      }

      await User.findByIdAndUpdate(userObjId, updateData);

      // Generate warning message
      let warningMessage = '';
      if (newStrikeCount === 1) {
        warningMessage = '⚠️ WARNING 1/3: You have lost a dispute. Two more strikes and your account will be permanently banned.';
      } else if (newStrikeCount === 2) {
        warningMessage = '⚠️⚠️ WARNING 2/3: FINAL WARNING! One more lost dispute will result in a permanent ban.';
      } else if (shouldBan) {
        warningMessage = '🚫 BANNED: Your account has been banned due to multiple fraudulent disputes. You may apply for unban through support.';
      }

      console.log(`🔨 Strike ${newStrikeCount}/${MAX_DISPUTE_STRIKES} applied to user ${userId}. Banned: ${shouldBan}`);

      return {
        newStrikeCount: newStrikeCount,
        isBanned: shouldBan,
        warning: warningMessage
      };

    } catch (error) {
      console.error('Apply strike failed:', error);
      throw error;
    }
  }

  /**
   * Request account unban (user self-service)
   */
  async requestUnban(userId, reason) {
    try {
      const { User } = require('../config/database');
      
      const userObjId = typeof userId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(userId) : userId;
      
      const user = await User.findById(userObjId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.is_banned) {
        throw new Error('Your account is not banned');
      }

      // Check if there's already a pending request
      const pendingRequest = user.unban_requests?.find(r => r.status === 'pending');
      if (pendingRequest) {
        throw new Error('You already have a pending unban request. Please wait for admin review.');
      }

      // Create unban request
      const unbanRequest = {
        requested_at: new Date(),
        reason: reason,
        status: 'pending'
      };

      await User.findByIdAndUpdate(userObjId, {
        $push: { unban_requests: unbanRequest }
      });

      console.log(`📝 Unban request submitted by user ${userId}`);

      return {
        success: true,
        message: 'Your unban request has been submitted. An admin will review your case within 3-5 business days.'
      };

    } catch (error) {
      console.error('Unban request failed:', error);
      throw error;
    }
  }

  /**
   * Admin approves or rejects unban request
   */
  async processUnbanRequest(userId, adminId, approved, adminNotes) {
    try {
      const { User } = require('../config/database');
      
      const userObjId = typeof userId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(userId) : userId;
      const adminObjId = typeof adminId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(adminId) : adminId;
      
      const user = await User.findById(userObjId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Find pending request
      const pendingRequestIndex = user.unban_requests?.findIndex(r => r.status === 'pending');
      if (pendingRequestIndex === -1 || pendingRequestIndex === undefined) {
        throw new Error('No pending unban request found');
      }

      // Update the request
      const updatePath = `unban_requests.${pendingRequestIndex}`;
      const updateData = {
        [`${updatePath}.status`]: approved ? 'approved' : 'rejected',
        [`${updatePath}.reviewed_by`]: adminObjId,
        [`${updatePath}.reviewed_at`]: new Date(),
        [`${updatePath}.admin_notes`]: adminNotes
      };

      // If approved, unban the user but keep strike history
      if (approved) {
        updateData.is_banned = false;
        updateData.status = 'active';
        updateData.dispute_strikes = 0; // Reset strikes on unban (give fresh start)
      }

      await User.findByIdAndUpdate(userObjId, { $set: updateData });

      console.log(`✅ Unban request ${approved ? 'APPROVED' : 'REJECTED'} for user ${userId} by admin ${adminId}`);

      return {
        success: true,
        approved: approved,
        message: approved 
          ? 'User has been unbanned. Strike count reset to 0.' 
          : 'Unban request rejected.'
      };

    } catch (error) {
      console.error('Process unban request failed:', error);
      throw error;
    }
  }

  /**
   * Get user's dispute/ban status
   */
  async getUserDisputeStatus(userId) {
    try {
      const { User } = require('../config/database');
      
      const userObjId = typeof userId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(userId) : userId;
      
      const user = await User.findById(userObjId).select(
        'dispute_strikes dispute_warnings is_banned ban_data unban_requests'
      );
      
      if (!user) {
        throw new Error('User not found');
      }

      return {
        disputeStrikes: user.dispute_strikes || 0,
        maxStrikes: MAX_DISPUTE_STRIKES,
        warnings: user.dispute_warnings || [],
        isBanned: user.is_banned || false,
        banData: user.ban_data,
        unbanRequests: user.unban_requests || [],
        hasPendingUnbanRequest: user.unban_requests?.some(r => r.status === 'pending') || false
      };

    } catch (error) {
      console.error('Get dispute status failed:', error);
      throw error;
    }
  }

  /**
   * Start the auto-release checker (runs periodically)
   */
  startAutoReleaseChecker() {
    // Clear any existing interval to prevent duplicates on re-init
    if (this.autoReleaseInterval) {
      clearInterval(this.autoReleaseInterval);
    }
    // Check every hour for escrows that need auto-release
    this.autoReleaseInterval = setInterval(async () => {
      try {
        await this.processAutoReleases();
      } catch (error) {
        console.error('Auto-release checker error:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    console.log('🔄 Auto-release checker started (runs hourly)');
  }

  /**
   * Process auto-releases for escrows where confirmation deadline passed
   */
  async processAutoReleases() {
    try {
      const { Transaction, User } = require('../config/database');
      
      const now = new Date();
      
      // CASE 1: PIN was entered but client didn't confirm within 48 hours
      const pinEnteredEscrows = await Transaction.find({
        type: 'escrow_hold',
        status: 'pin_entered',
        auto_release_at: { $lte: now },
        client_confirmed: { $ne: true }
      });

      console.log(`🔄 Processing ${pinEnteredEscrows.length} PIN-entered auto-releases`);

      for (const escrow of pinEnteredEscrows) {
        try {
          await this.releaseFundsToProvider(escrow, 'auto_released_pin_timeout');
          console.log(`✅ Auto-released escrow (PIN timeout): ${escrow.reference}`);
          
          // Notify both parties about auto-release
          if (this.io) {
            const NotificationService = require('./NotificationService');
            const provId = escrow.provider_id?.toString();
            const cliId = escrow.client_id?.toString();
            if (provId) {
              this.io.to(`user_${provId}`).emit('escrow_released', {
                escrowId: escrow._id.toString(), amount: escrow.amount, currency: escrow.currency,
                message: `Payment of ${escrow.currency}${escrow.amount} auto-released to your wallet (client did not confirm within 48h).`
              });
              try { await NotificationService.createAndEmit(this.io, { userId: provId, type: 'payment', title: 'Payment Auto-Released', message: `${escrow.currency}${escrow.amount} auto-released to your wallet.`, data: { escrowId: escrow._id.toString() } }); } catch (e) {}
            }
            if (cliId) {
              this.io.to(`user_${cliId}`).emit('escrow_released', {
                escrowId: escrow._id.toString(), amount: escrow.amount, currency: escrow.currency,
                message: `Payment of ${escrow.currency}${escrow.amount} auto-released to provider (confirmation deadline passed).`
              });
              try { await NotificationService.createAndEmit(this.io, { userId: cliId, type: 'escrow', title: 'Escrow Auto-Released', message: `${escrow.currency}${escrow.amount} was auto-released to the provider because you did not confirm within 48 hours.`, data: { escrowId: escrow._id.toString() } }); } catch (e) {}
            }
          }
        } catch (error) {
          console.error(`Failed to auto-release escrow ${escrow.reference}:`, error);
        }
      }

      // CASE 2: Provider claimed complete but client didn't respond within 24 hours
      const providerClaimEscrows = await Transaction.find({
        type: 'escrow_hold',
        status: 'held',
        provider_claimed_complete: true,
        'provider_claim_data.client_response_deadline': { $lte: now }
      });

      console.log(`🔄 Processing ${providerClaimEscrows.length} provider-claim auto-releases`);

      for (const escrow of providerClaimEscrows) {
        try {
          // Release funds to provider
          await this.releaseFundsToProvider(escrow, 'auto_released_client_unresponsive');
          
          // Apply warning to client for not responding (but not a full strike)
          const client = await User.findById(escrow.client_id);
          if (client) {
            const warning = {
              warning_number: 0, // Soft warning, doesn't count as dispute strike
              reason: 'Failed to respond to provider service completion claim within 24 hours. Payment auto-released to provider.',
              escrow_id: escrow._id,
              issued_at: new Date()
            };
            await User.findByIdAndUpdate(escrow.client_id, {
              $push: { dispute_warnings: warning },
              $inc: { reputation_score: -5 } // Small reputation hit
            });
            console.log(`⚠️ Soft warning applied to client ${client.username} for unresponsive behavior`);
          }
          
          console.log(`✅ Auto-released escrow (client unresponsive to claim): ${escrow.reference}`);
          
          // Notify both parties about auto-release due to client unresponsiveness
          if (this.io) {
            const NotificationService = require('./NotificationService');
            const provId = escrow.provider_id?.toString();
            const cliId = escrow.client_id?.toString();
            if (provId) {
              this.io.to(`user_${provId}`).emit('escrow_released', {
                escrowId: escrow._id.toString(), amount: escrow.amount, currency: escrow.currency,
                message: `Payment of ${escrow.currency}${escrow.amount} auto-released (client did not respond to your claim within 24h).`
              });
              try { await NotificationService.createAndEmit(this.io, { userId: provId, type: 'payment', title: 'Payment Auto-Released', message: `${escrow.currency}${escrow.amount} auto-released to your wallet (client unresponsive).`, data: { escrowId: escrow._id.toString() } }); } catch (e) {}
            }
            if (cliId) {
              try { await NotificationService.createAndEmit(this.io, { userId: cliId, type: 'escrow', title: 'Escrow Auto-Released', message: `${escrow.currency}${escrow.amount} was auto-released to the provider because you did not respond to their service claim within 24 hours.`, data: { escrowId: escrow._id.toString() } }); } catch (e) {}
            }
          }
        } catch (error) {
          console.error(`Failed to process provider claim auto-release ${escrow.reference}:`, error);
        }
      }

      return { 
        processed: pinEnteredEscrows.length + providerClaimEscrows.length,
        pinTimeoutReleases: pinEnteredEscrows.length,
        claimUnresponsiveReleases: providerClaimEscrows.length
      };

    } catch (error) {
      console.error('Process auto-releases failed:', error);
      throw error;
    }
  }

  /**
   * Get escrow status with PIN visibility rules - MongoDB version
   */
  async getEscrowStatus(transactionId, requesterId = null) {
    try {
      const { Transaction, User, Service } = require('../config/database');
      
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;
      
      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Get client and provider info
      const client = await User.findById(transaction.client_id).select('username');
      const provider = await User.findById(transaction.provider_id).select('username');

      // Only show PIN to the client (never to provider)
      const isClient = requesterId && transaction.client_id.toString() === requesterId.toString();
      const isProvider = requesterId && transaction.provider_id.toString() === requesterId.toString();
      
      return {
        transactionId: transaction._id.toString(),
        reference: transaction.reference,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        client: client?.username || 'Unknown',
        clientId: transaction.client_id.toString(),
        provider: provider?.username || 'Unknown',
        providerId: transaction.provider_id.toString(),
        scheduledTime: transaction.scheduled_time,
        createdAt: transaction.created_at,
        completedAt: transaction.completed_at,
        // PIN visibility: Only client can see PIN
        completionPin: isClient ? transaction.completion_pin : null,
        pinEntered: !!transaction.pin_entered_at,
        pinEnteredAt: transaction.pin_entered_at,
        // Confirmation status
        providerConfirmed: transaction.provider_confirmed,
        clientConfirmed: transaction.client_confirmed,
        confirmationDeadline: transaction.confirmation_deadline,
        autoReleaseAt: transaction.auto_release_at,
        // Provider claim info (for when client refuses to share PIN)
        providerClaimedComplete: transaction.provider_claimed_complete || false,
        providerClaimData: transaction.provider_claim_data || null,
        // Dispute info
        disputeData: transaction.dispute_data,
        evidence: transaction.evidence,
        escrowAddress: transaction.escrow_address,
        // Role info for UI
        viewerRole: isClient ? 'client' : (isProvider ? 'provider' : null)
      };

    } catch (error) {
      console.error('Failed to get escrow status:', error);
      throw error;
    }
  }

  // Helper methods

  calculateDistance(coord1, coord2) {
    // Haversine formula for distance calculation
    const R = 6371e3; // Earth's radius in meters
    const φ1 = coord1.lat * Math.PI / 180;
    const φ2 = coord2.lat * Math.PI / 180;
    const Δφ = (coord2.lat - coord1.lat) * Math.PI / 180;
    const Δλ = (coord2.lng - coord1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  async validateCompletionProof(transaction, proof) {
    // Validate various types of proof
    const validations = [];

    // GPS proof validation
    if (proof.gps && transaction.location_data) {
      const distance = this.calculateDistance(
        proof.gps.coordinates,
        transaction.location_data.coordinates
      );
      validations.push({
        type: 'gps',
        valid: distance < 100, // Within 100 meters
        details: { distance }
      });
    }

    // Time proof validation
    if (proof.timestamp && transaction.scheduled_time) {
      const timeDiff = Math.abs(
        new Date(proof.timestamp) - new Date(transaction.scheduled_time)
      );
      validations.push({
        type: 'timing',
        valid: timeDiff < 30 * 60 * 1000, // Within 30 minutes
        details: { timeDifference: timeDiff / (1000 * 60) }
      });
    }

    // Photo/video proof validation
    if (proof.media) {
      validations.push({
        type: 'media',
        valid: true, // In production, use AI to validate media
        details: { mediaCount: proof.media.length }
      });
    }

    const allValid = validations.every(v => v.valid);
    const failedValidations = validations.filter(v => !v.valid);

    return {
      valid: allValid,
      validations,
      reason: failedValidations.length > 0 
        ? `Failed validations: ${failedValidations.map(v => v.type).join(', ')}`
        : 'All validations passed'
    };
  }
}

module.exports = EscrowManager;