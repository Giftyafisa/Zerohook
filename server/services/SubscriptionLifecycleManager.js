/**
 * SubscriptionLifecycleManager
 * 
 * Background service that handles:
 * 1. Monitoring pending crypto payments (C5 fix)
 * 2. Auto-downgrading expired subscriptions (M3 fix)
 * 
 * This ensures:
 * - Payments made after browser close are still detected
 * - Expired subscriptions are cleaned up without user action
 */

const { User, Subscription, CryptoInvoice, Transaction } = require('../config/database');
const NotificationService = require('./NotificationService');

class SubscriptionLifecycleManager {
  constructor(cryptoPaymentManager, io) {
    this.cryptoPaymentManager = cryptoPaymentManager;
    this.io = io;
    this.initialized = false;
    this.paymentCheckInterval = null;
    this.expiryCheckInterval = null;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing Subscription Lifecycle Manager...');

      // Check pending payments every 60 seconds
      this.paymentCheckInterval = setInterval(
        () => this.checkPendingPayments(),
        60 * 1000
      );

      // Check expired subscriptions every 5 minutes
      this.expiryCheckInterval = setInterval(
        () => this.downgradeExpiredSubscriptions(),
        5 * 60 * 1000
      );

      // Run initial checks
      await this.downgradeExpiredSubscriptions();

      this.initialized = true;
      console.log('✅ Subscription Lifecycle Manager initialized');
      return true;
    } catch (error) {
      console.error('❌ Subscription Lifecycle Manager init failed:', error);
      return false;
    }
  }

  /**
   * C5 FIX: Check all pending crypto invoices and activate subscriptions
   * if payment has been confirmed on the blockchain.
   * 
   * This catches payments made after the user closed their browser.
   */
  async checkPendingPayments() {
    try {
      // Find all pending invoices that haven't expired
      const pendingInvoices = await CryptoInvoice.find({
        status: 'pending',
        expires_at: { $gt: new Date() }
      }).limit(50).lean();

      if (pendingInvoices.length === 0) return;

      console.log(`🔍 Checking ${pendingInvoices.length} pending crypto invoices...`);

      for (const invoice of pendingInvoices) {
        try {
          // Check blockchain for payment
          if (!this.cryptoPaymentManager) continue;

          const paymentStatus = await this.cryptoPaymentManager.checkPaymentStatus(
            invoice.payment_address,
            invoice.expected_amount,
            invoice.crypto_symbol,
            invoice.network
          );

          if (paymentStatus && paymentStatus.confirmed) {
            console.log(`✅ Payment confirmed for invoice ${invoice._id} (${invoice.crypto_symbol})`);
            await this.activateSubscription(invoice);
          }
        } catch (err) {
          console.error(`Error checking invoice ${invoice._id}:`, err.message);
        }
      }

      // Mark expired invoices
      await CryptoInvoice.updateMany(
        { status: 'pending', expires_at: { $lte: new Date() } },
        { $set: { status: 'expired' } }
      );
    } catch (error) {
      console.error('Pending payment check error:', error.message);
    }
  }

  /**
   * Activate subscription after confirmed payment
   */
  async activateSubscription(invoice) {
    try {
      const now = new Date();
      const sixMonthsLater = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

      // Update invoice status
      await CryptoInvoice.findByIdAndUpdate(invoice._id, {
        status: 'confirmed',
        confirmed_at: now
      });

      // Update subscription record
      await Subscription.findOneAndUpdate(
        { 
          user_id: invoice.user_id,
          status: 'pending'
        },
        {
          status: 'active',
          activated_at: now,
          expires_at: sixMonthsLater,
          payment_confirmed_at: now,
          payment_method: 'crypto_background_check'
        },
        { sort: { created_at: -1 } }
      );

      // Update user record
      await User.findByIdAndUpdate(invoice.user_id, {
        is_subscribed: true,
        subscription_tier: 'premium',
        subscription_expires_at: sixMonthsLater
      });

      // Create transaction record
      await Transaction.create({
        user_id: invoice.user_id,
        amount: invoice.fiat_amount || invoice.expected_amount,
        currency: invoice.fiat_currency || invoice.crypto_symbol,
        payment_method: 'crypto',
        reference: `bg_confirm_${invoice._id}`,
        status: 'completed',
        type: 'subscription',
        metadata: {
          invoiceId: invoice._id,
          cryptoSymbol: invoice.crypto_symbol,
          expectedAmount: invoice.expected_amount,
          paymentAddress: invoice.payment_address,
          confirmedBy: 'background_monitor'
        }
      });

      // Notify user via socket
      if (this.io) {
        this.io.to(`user_${invoice.user_id}`).emit('subscription_activated', {
          message: 'Your subscription has been activated!',
          tier: 'premium',
          expiresAt: sixMonthsLater
        });
      }

      // Create in-app notification
      try {
        await NotificationService.createNotification(invoice.user_id, {
          type: 'subscription',
          title: 'Subscription Activated',
          message: 'Your crypto payment has been confirmed and your premium subscription is now active!',
          data: { tier: 'premium', expiresAt: sixMonthsLater }
        });
      } catch (notifErr) {
        console.warn('Failed to create activation notification:', notifErr.message);
      }

      console.log(`🎉 Subscription activated for user ${invoice.user_id} via background payment check`);
    } catch (error) {
      console.error('Subscription activation error:', error.message);
    }
  }

  /**
   * M3 FIX: Auto-downgrade expired subscriptions
   * Runs periodically to ensure expired subscriptions are cleaned up
   * without relying on user-initiated requests.
   */
  async downgradeExpiredSubscriptions() {
    try {
      const now = new Date();

      // Find users with expired subscriptions still marked as active
      const result = await User.updateMany(
        {
          is_subscribed: true,
          subscription_expires_at: { $lte: now }
        },
        {
          $set: {
            is_subscribed: false,
            subscription_tier: 'free'
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`📛 Downgraded ${result.modifiedCount} expired subscriptions`);

        // Also update subscription records
        await Subscription.updateMany(
          {
            status: 'active',
            expires_at: { $lte: now }
          },
          {
            $set: { status: 'expired' }
          }
        );
      }
    } catch (error) {
      console.error('Subscription expiry check error:', error.message);
    }
  }

  /**
   * Cleanup intervals on shutdown
   */
  shutdown() {
    if (this.paymentCheckInterval) {
      clearInterval(this.paymentCheckInterval);
      this.paymentCheckInterval = null;
    }
    if (this.expiryCheckInterval) {
      clearInterval(this.expiryCheckInterval);
      this.expiryCheckInterval = null;
    }
    console.log('🔄 Subscription Lifecycle Manager shut down');
  }

  isHealthy() {
    return this.initialized;
  }
}

module.exports = SubscriptionLifecycleManager;
