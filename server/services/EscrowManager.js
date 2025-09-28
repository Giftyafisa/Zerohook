const { query } = require('../config/database');
const { ethers } = require('ethers');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
      
      // Initialize blockchain provider (Polygon)
      this.provider = new ethers.JsonRpcProvider(
        process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
      );
      
      // Initialize wallet for contract interactions
      if (process.env.ESCROW_PRIVATE_KEY && 
          process.env.ESCROW_PRIVATE_KEY !== 'your_escrow_wallet_private_key' &&
          process.env.ESCROW_PRIVATE_KEY.length > 10) {
        try {
          this.wallet = new ethers.Wallet(process.env.ESCROW_PRIVATE_KEY, this.provider);
          console.log('✅ Blockchain wallet initialized');
        } catch (error) {
          console.log('⚠️  Invalid private key format, skipping wallet initialization');
        }
      } else {
        console.log('⚠️  No valid private key provided, blockchain features disabled');
      }
      
      // Initialize Stripe
      if (process.env.STRIPE_SECRET_KEY) {
        console.log('✅ Stripe initialized');
      }
      
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
   * Create a new escrow transaction
   */
  async createEscrow(transactionData) {
    try {
      const { 
        clientId, 
        providerId, 
        serviceId, 
        amount, 
        scheduledTime,
        locationData,
        paymentMethodId 
      } = transactionData;

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        capture_method: 'manual', // Don't capture until service completed
        metadata: {
          clientId,
          providerId,
          serviceId,
          type: 'escrow'
        }
      });

      // Create transaction record
      const transactionResult = await query(`
        INSERT INTO transactions (
          service_id, client_id, provider_id, amount, 
          scheduled_time, location_data, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'escrowed')
        RETURNING *
      `, [
        serviceId, 
        clientId, 
        providerId, 
        amount, 
        scheduledTime,
        JSON.stringify(locationData)
      ]);

      const transaction = transactionResult.rows[0];

      // Store payment intent details
      await query(`
        UPDATE transactions 
        SET verification_data = jsonb_set(
          verification_data, 
          '{payment_intent_id}', 
          to_jsonb($1::text)
        )
        WHERE id = $2
      `, [paymentIntent.id, transaction.id]);

      // If blockchain integration is available, also create on-chain escrow
      if (this.wallet && process.env.ESCROW_CONTRACT_ADDRESS) {
        try {
          const txHash = await this.createBlockchainEscrow(
            transaction.id,
            clientId,
            providerId,
            amount
          );
          
          await query(`
            UPDATE transactions 
            SET escrow_address = $1
            WHERE id = $2
          `, [txHash, transaction.id]);
        } catch (blockchainError) {
          console.warn('Blockchain escrow creation failed, using Stripe only:', blockchainError.message);
        }
      }

      return {
        transactionId: transaction.id,
        paymentIntentId: paymentIntent.id,
        status: 'escrowed',
        amount,
        created: transaction.created_at
      };

    } catch (error) {
      console.error('Escrow creation failed:', error);
      throw error;
    }
  }

  /**
   * Confirm service completion and release funds
   */
  async confirmCompletion(transactionId, completionProof) {
    try {
      // Get transaction details
      const transactionResult = await query(`
        SELECT * FROM transactions WHERE id = $1
      `, [transactionId]);

      if (transactionResult.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = transactionResult.rows[0];
      
      if (transaction.status !== 'escrowed') {
        throw new Error('Transaction not in escrow status');
      }

      // Validate completion proof
      const proofValidation = await this.validateCompletionProof(
        transaction, 
        completionProof
      );

      if (!proofValidation.valid) {
        throw new Error(`Invalid completion proof: ${proofValidation.reason}`);
      }

      // Release funds via Stripe
      const paymentIntentId = transaction.verification_data?.payment_intent_id;
      if (paymentIntentId) {
        await stripe.paymentIntents.capture(paymentIntentId);
      }

      // Create Stripe transfer to provider
      const platformFee = Math.round(transaction.amount * 0.05 * 100); // 5% platform fee
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

      // Update transaction status
      await query(`
        UPDATE transactions 
        SET status = 'completed',
            completion_proof = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [JSON.stringify(completionProof), transactionId]);

      // Update reputation scores
      await this.updateReputationScores(transaction);

      return {
        success: true,
        transactionId,
        status: 'completed',
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Completion confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Handle dispute initiation
   */
  async initiateDispute(transactionId, disputeData, initiatorId) {
    try {
      const transactionResult = await query(`
        SELECT * FROM transactions WHERE id = $1
      `, [transactionId]);

      if (transactionResult.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = transactionResult.rows[0];

      // Update transaction with dispute data
      await query(`
        UPDATE transactions 
        SET status = 'disputed',
            dispute_data = $1
        WHERE id = $2
      `, [JSON.stringify({
        initiator: initiatorId,
        reason: disputeData.reason,
        evidence: disputeData.evidence,
        timestamp: new Date().toISOString(),
        status: 'open'
      }), transactionId]);

      // Pause any pending transfers
      const paymentIntentId = transaction.verification_data?.payment_intent_id;
      if (paymentIntentId) {
        // In a real implementation, you might need to handle this differently
        console.log(`Dispute initiated for payment intent: ${paymentIntentId}`);
      }

      // Create dispute resolution case
      const disputeId = await this.createDisputeCase(transaction, disputeData, initiatorId);

      return {
        success: true,
        disputeId,
        status: 'disputed'
      };

    } catch (error) {
      console.error('Dispute initiation failed:', error);
      throw error;
    }
  }

  /**
   * Resolve dispute based on evidence and voting
   */
  async resolveDispute(transactionId, resolution) {
    try {
      const { winner, reasoning, evidence } = resolution;

      const transactionResult = await query(`
        SELECT * FROM transactions WHERE id = $1
      `, [transactionId]);

      const transaction = transactionResult.rows[0];
      const paymentIntentId = transaction.verification_data?.payment_intent_id;

      if (winner === 'client') {
        // Refund to client
        if (paymentIntentId) {
          await stripe.refunds.create({
            payment_intent: paymentIntentId
          });
        }
      } else if (winner === 'provider') {
        // Release funds to provider
        if (paymentIntentId) {
          await stripe.paymentIntents.capture(paymentIntentId);
        }
        
        // Transfer to provider (similar to completion)
        await this.transferToProvider(transaction);
      }

      // Update transaction
      await query(`
        UPDATE transactions 
        SET status = 'resolved',
            dispute_data = jsonb_set(
              dispute_data, 
              '{resolution}', 
              to_jsonb($1::jsonb)
            )
        WHERE id = $2
      `, [JSON.stringify({
        winner,
        reasoning,
        evidence,
        resolvedAt: new Date().toISOString()
      }), transactionId]);

      // Update reputation based on resolution
      await this.updateDisputeReputation(transaction, winner);

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
   * Get escrow status
   */
  async getEscrowStatus(transactionId) {
    try {
      const result = await query(`
        SELECT 
          t.*,
          c.username as client_username,
          p.username as provider_username,
          s.title as service_title
        FROM transactions t
        JOIN users c ON t.client_id = c.id
        JOIN users p ON t.provider_id = p.id
        JOIN services s ON t.service_id = s.id
        WHERE t.id = $1
      `, [transactionId]);

      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = result.rows[0];

      return {
        transactionId: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        client: transaction.client_username,
        provider: transaction.provider_username,
        service: transaction.service_title,
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