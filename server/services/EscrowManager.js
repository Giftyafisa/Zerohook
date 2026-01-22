const { query, Transaction, User, EscrowTransaction } = require('../config/database');
const mongoose = require('mongoose');
// const { ethers } = require('ethers'); // Commented out for now - blockchain features disabled
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Using Paystack instead

class EscrowManager {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.escrowContract = null;
    this.wallet = null;
  }

  async initialize() {
    try {
      console.log('💰 Initializing Escrow Manager...');
      
      // For now, we're using Paystack for payments (Africa-focused)
      // Blockchain escrow is disabled until properly configured
      console.log('✅ Escrow Manager initialized (Paystack mode)');
      
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
   * Create a new escrow transaction - Uses MongoDB
   */
  async createEscrow(transactionData) {
    try {
      const { 
        clientId, 
        providerId, 
        serviceId, 
        amount, 
        currency = 'NGN',
        scheduledTime,
        locationData,
        paymentMethod = 'wallet' // 'wallet' uses user's wallet balance, 'paystack' uses Paystack
      } = transactionData;

      // Convert IDs to ObjectId
      const clientObjId = typeof clientId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(clientId) : clientId;
      const providerObjId = typeof providerId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(providerId) : providerId;
      
      // If using wallet payment, check client has sufficient balance
      if (paymentMethod === 'wallet') {
        const { Transaction } = require('../config/database');
        
        // Calculate client's wallet balance
        const depositResult = await Transaction.aggregate([
          { 
            $match: { 
              user_id: clientObjId, 
              type: { $in: ['deposit', 'wallet_topup'] }, 
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
              status: { $in: ['held', 'pending'] } 
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

      // Generate reference
      const reference = `ESC_${Date.now()}_${clientId.toString().substring(0, 8)}`;

      // Create escrow hold transaction in MongoDB
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
        status: 'held', // Escrow status
        type: 'escrow_hold',
        scheduled_time: scheduledTime ? new Date(scheduledTime) : null,
        location_data: locationData || {},
        metadata: {
          type: 'escrow',
          description: `Escrow for service`,
          scheduledTime: scheduledTime,
          paymentMethod: paymentMethod
        }
      });

      console.log(`✅ Escrow created: ${reference} - ${currency}${amount} from ${clientId} to ${providerId}`);

      return {
        id: escrowTransaction._id.toString(),
        transactionId: escrowTransaction._id.toString(),
        reference: reference,
        status: 'held',
        amount: amount,
        currency: currency,
        created: escrowTransaction.created_at
      };

    } catch (error) {
      console.error('Escrow creation failed:', error);
      throw error;
    }
  }

  /**
   * Confirm service completion and release funds - MongoDB version
   */
  async confirmCompletion(transactionId, completionProof) {
    try {
      const { Transaction } = require('../config/database');
      
      // Get transaction details
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;
      
      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      if (transaction.status !== 'held' && transaction.status !== 'escrowed') {
        throw new Error(`Transaction not in escrow status. Current status: ${transaction.status}`);
      }

      // Update escrow transaction to released
      transaction.status = 'released';
      transaction.completion_proof = completionProof || {};
      transaction.completed_at = new Date();
      await transaction.save();

      // Create a new transaction for the provider showing they earned the money
      const platformFee = transaction.amount * 0.05; // 5% platform fee
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
          description: 'Escrow funds released'
        }
      });

      console.log(`✅ Escrow released: ${transaction.reference} - ${transaction.currency}${providerAmount} to provider`);

      return {
        success: true,
        transactionId: transactionId,
        status: 'completed',
        amount: providerAmount,
        platformFee: platformFee,
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Completion confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Handle dispute initiation - MongoDB version
   */
  async initiateDispute(transactionId, disputeData, initiatorId) {
    try {
      const { Transaction } = require('../config/database');
      
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;
      
      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update transaction with dispute data
      transaction.status = 'disputed';
      transaction.dispute_data = {
        initiator: initiatorId,
        reason: disputeData.reason,
        evidence: disputeData.evidence,
        timestamp: new Date().toISOString(),
        status: 'open'
      };
      await transaction.save();

      console.log(`⚠️ Dispute initiated for escrow: ${transaction.reference}`);

      return {
        success: true,
        disputeId: `DIS_${transaction._id.toString().substring(0, 8)}`,
        status: 'disputed'
      };

    } catch (error) {
      console.error('Dispute initiation failed:', error);
      throw error;
    }
  }

  /**
   * Resolve dispute based on evidence - MongoDB version
   */
  async resolveDispute(transactionId, resolution) {
    try {
      const { winner, reasoning, evidence } = resolution;
      const { Transaction } = require('../config/database');
      
      const transactionObjId = typeof transactionId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(transactionId) : transactionId;

      const transaction = await Transaction.findById(transactionObjId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (winner === 'client') {
        // Refund to client - mark escrow as refunded
        transaction.status = 'refunded';
        transaction.dispute_data = {
          ...transaction.dispute_data,
          resolution: {
            winner: 'client',
            reasoning,
            evidence,
            resolvedAt: new Date().toISOString()
          },
          status: 'resolved'
        };
        await transaction.save();
        
        console.log(`✅ Dispute resolved in favor of client - Escrow refunded: ${transaction.reference}`);
      } else {
        // Release to provider
        await this.confirmCompletion(transactionId, {
          type: 'dispute_resolution',
          winner: 'provider',
          reasoning,
          evidence,
          resolvedAt: new Date().toISOString()
        });
        
        console.log(`✅ Dispute resolved in favor of provider - Escrow released: ${transaction.reference}`);
      }

      return {
        success: true,
        resolution: winner,
        transactionId
      };

    } catch (error) {
      console.error('Dispute resolution failed:', error);
      throw error;
    }
  }

  /**
   * Get escrow status - MongoDB version
   */
  async getEscrowStatus(transactionId) {
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

      return {
        transactionId: transaction._id.toString(),
        reference: transaction.reference,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        client: client?.username || 'Unknown',
        provider: provider?.username || 'Unknown',
        scheduledTime: transaction.scheduled_time,
        createdAt: transaction.created_at,
        completedAt: transaction.completed_at,
        disputeData: transaction.dispute_data,
        escrowAddress: transaction.escrow_address
      };

    } catch (error) {
      console.error('Failed to get escrow status:', error);
      throw error;
    }
  }

  // Helper methods

  async createBlockchainEscrow(transactionId, clientId, providerId, amount) {
    // This would create an actual smart contract escrow
    // Simplified implementation - in production, this would deploy/interact with smart contracts
    const mockTxHash = `0x${Buffer.from(`${transactionId}_${Date.now()}`).toString('hex')}`;
    return mockTxHash;
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

  async createDisputeCase(transaction, disputeData, initiatorId) {
    // Create a dispute case for DAO resolution
    const disputeId = `dispute_${transaction.id}_${Date.now()}`;
    
    // In production, this would integrate with a DAO system
    console.log(`Created dispute case: ${disputeId}`);
    
    return disputeId;
  }

  async transferToProvider(transaction) {
    // Transfer funds to provider after successful completion or dispute resolution
    const platformFee = Math.round(transaction.amount * 0.05 * 100);
    const providerAmount = Math.round(transaction.amount * 100) - platformFee;

    // Get provider's Stripe account
    const providerResult = await query(`
      SELECT profile_data->'stripe_account_id' as stripe_account_id 
      FROM users WHERE id = $1
    `, [transaction.provider_id]);

    const stripeAccountId = providerResult.rows[0]?.stripe_account_id;

    if (stripeAccountId) {
      await stripe.transfers.create({
        amount: providerAmount,
        currency: 'usd',
        destination: stripeAccountId,
      });
    }
  }

  async updateReputationScores(transaction) {
    // Update reputation for both client and provider after successful transaction
    await query(`
      UPDATE users 
      SET reputation_score = reputation_score + 10
      WHERE id IN ($1, $2)
    `, [transaction.client_id, transaction.provider_id]);
  }

  async updateDisputeReputation(transaction, winner) {
    // Update reputation based on dispute outcome
    if (winner === 'provider') {
      await query('UPDATE users SET reputation_score = reputation_score + 5 WHERE id = $1', [transaction.provider_id]);
      await query('UPDATE users SET reputation_score = GREATEST(0, reputation_score - 10) WHERE id = $1', [transaction.client_id]);
    } else if (winner === 'client') {
      await query('UPDATE users SET reputation_score = reputation_score + 5 WHERE id = $1', [transaction.client_id]);
      await query('UPDATE users SET reputation_score = GREATEST(0, reputation_score - 15) WHERE id = $1', [transaction.provider_id]);
    }
  }
}

module.exports = EscrowManager;