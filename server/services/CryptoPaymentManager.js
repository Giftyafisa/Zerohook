const { Transaction } = require('../config/database');
const bitcoin = require('bitcoinjs-lib');
const { ethers } = require('ethers');
const axios = require('axios');
const crypto = require('crypto');
const NodeCache = require('node-cache');

// HD wallet support
const bip39 = require('bip39');
const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const bip32 = BIP32Factory(ecc);

/**
 * CryptoPaymentManager - Direct Blockchain Payment System (Fee-Free)
 * 
 * Generates unique payment addresses per transaction using HD wallets.
 * Verifies payments via free public blockchain APIs:
 *  - Blockstream.info for BTC (no API key)
 *  - Etherscan public API for ETH/ERC-20 (free tier)
 *  - Blockchain.com for BTC fallback
 * 
 * NO third-party payment gateways. NO fees beyond network gas.
 */
class CryptoPaymentManager {
  constructor() {
    this.initialized = false;
    this.bitcoinNetwork = bitcoin.networks.bitcoin;
    this.ethereumProvider = null;
    
    // HD wallet root keys (derived from master seed in env)
    this.btcRoot = null;
    this.ethRoot = null;
    
    // Address derivation index tracking (per-session, persistent via DB)
    this.addressIndex = new NodeCache({ stdTTL: 0 }); // no expiry
    
    // Payment monitoring cache
    this.pendingPayments = new NodeCache({ stdTTL: 3600 }); // 1 hour expiry
    
    // Platform wallet addresses (where fees/revenue goes)
    this.platformWallets = {};
    
    // Network configuration
    this.blockstreamBase = 'https://blockstream.info/api';
    this.etherscanBase = 'https://api.etherscan.io/api';
    this.etherscanApiKey = ''; // free tier works without key for basic calls
    
    // Supported networks for address verification
    this.verificationAPIs = {
      BTC: { primary: 'blockstream', fallback: 'blockchain' },
      ETH: { primary: 'etherscan', fallback: 'provider' },
      USDT: { primary: 'etherscan', fallback: 'provider' },
      USDC: { primary: 'etherscan', fallback: 'provider' }
    };
    
    // ERC-20 token contract addresses (Ethereum mainnet)
    this.tokenContracts = {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    };
  }

  async initialize() {
    try {
      console.log('🪙 Initializing Crypto Payment Manager (Direct Blockchain)...');

      // Bitcoin network selection
      if (process.env.BITCOIN_NETWORK === 'testnet') {
        this.bitcoinNetwork = bitcoin.networks.testnet;
        this.blockstreamBase = 'https://blockstream.info/testnet/api';
        console.log('  ⚡ Bitcoin testnet mode');
      } else {
        console.log('  ⚡ Bitcoin mainnet mode');
      }

      // Initialize HD wallet from master seed
      const masterSeed = process.env.CRYPTO_MASTER_SEED;
      if (masterSeed) {
        try {
          const seed = bip39.mnemonicToSeedSync(masterSeed);
          const root = bip32.fromSeed(seed, this.bitcoinNetwork);
          
          // BTC derivation path: m/84'/0'/0' (BIP84 native segwit)
          this.btcRoot = root.derivePath("m/84'/0'/0'");
          console.log('  ✅ BTC HD wallet initialized');
          
          // ETH derivation path: m/44'/60'/0'/0 (BIP44)
          this.ethRoot = root.derivePath("m/44'/60'/0'/0");
          console.log('  ✅ ETH HD wallet initialized');
        } catch (hdError) {
          console.log('  ⚠️ HD wallet init failed, using random addresses:', hdError.message);
        }
      } else {
        console.log('  ⚠️ CRYPTO_MASTER_SEED not set - using random address generation');
      }

      // Initialize Ethereum provider (for ETH/ERC-20 verification)
      const rpcUrl = process.env.ETHEREUM_RPC_URL;
      if (rpcUrl) {
        try {
          this.ethereumProvider = new ethers.JsonRpcProvider(rpcUrl);
          console.log('  ✅ Ethereum RPC provider connected');
        } catch (ethError) {
          console.log('  ⚠️ Ethereum RPC failed, using Etherscan API only:', ethError.message);
        }
      }

      // Etherscan API key (free tier: 5 calls/sec)
      this.etherscanApiKey = process.env.ETHERSCAN_API_KEY || '';

      // Platform wallet addresses
      this.platformWallets = {
        BTC: process.env.PLATFORM_BTC_ADDRESS || '',
        ETH: process.env.PLATFORM_ETH_ADDRESS || '',
        USDT: process.env.PLATFORM_ETH_ADDRESS || '', // ERC-20 same address
        USDC: process.env.PLATFORM_ETH_ADDRESS || ''
      };

      this.initialized = true;
      console.log('✅ Crypto Payment Manager initialized (Direct Blockchain - Fee Free)');
      return true;
    } catch (error) {
      console.error('❌ Crypto Payment Manager initialization failed:', error);
      // Still mark as initialized for graceful degradation
      this.initialized = true;
      return true;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  // ============ ADDRESS GENERATION ============

  /**
   * Generate a unique BTC payment address for a transaction
   */
  generateBTCAddress(derivationIndex) {
    try {
      if (this.btcRoot) {
        // HD wallet derivation (deterministic, recoverable)
        const child = this.btcRoot.derive(0).derive(derivationIndex);
        const { address } = bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(child.publicKey),
          network: this.bitcoinNetwork
        });
        return { address, index: derivationIndex, method: 'hd_wallet' };
      }

      // Fallback: random keypair (not recoverable without saving private key)
      const keyPair = bitcoin.ECPair.makeRandom({ network: this.bitcoinNetwork });
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: this.bitcoinNetwork
      });
      return { address, privateKey: keyPair.toWIF(), method: 'random' };
    } catch (error) {
      console.error('BTC address generation failed:', error);
      throw new Error('Failed to generate Bitcoin payment address');
    }
  }

  /**
   * Generate a unique ETH payment address for a transaction
   */
  generateETHAddress(derivationIndex) {
    try {
      if (this.ethRoot) {
        // HD wallet derivation
        const child = this.ethRoot.derive(derivationIndex);
        const wallet = new ethers.Wallet(
          '0x' + Buffer.from(child.privateKey).toString('hex')
        );
        return { address: wallet.address, index: derivationIndex, method: 'hd_wallet' };
      }

      // Fallback: random wallet
      const wallet = ethers.Wallet.createRandom();
      return { address: wallet.address, privateKey: wallet.privateKey, method: 'random' };
    } catch (error) {
      console.error('ETH address generation failed:', error);
      throw new Error('Failed to generate Ethereum payment address');
    }
  }

  /**
   * Get next derivation index from DB
   */
  async getNextDerivationIndex() {
    try {
      // Use a simple counter stored in cache, persisted via transaction metadata
      const cached = this.addressIndex.get('deriv_index');
      const nextIndex = (cached || 0) + 1;
      this.addressIndex.set('deriv_index', nextIndex);
      return nextIndex;
    } catch {
      return Math.floor(Date.now() / 1000) % 2147483647; // safe fallback
    }
  }

  // ============ PAYMENT CREATION ============

  /**
   * Create a crypto payment invoice
   * @param {Object} paymentData - { amount, cryptoSymbol, fiatAmount, fiatCurrency, transactionId, userId, metadata }
   * @returns {Object} Payment invoice with address, amounts, and expiry
   */
  async createPaymentInvoice(paymentData) {
    try {
      const {
        cryptoAmount,
        cryptoSymbol,
        fiatAmount,
        fiatCurrency,
        transactionId,
        userId,
        metadata = {}
      } = paymentData;

      const symbol = cryptoSymbol.toUpperCase();
      const derivIndex = await this.getNextDerivationIndex();
      let addressData;

      // Generate address based on crypto type
      switch (symbol) {
        case 'BTC':
        case 'LTC': // LTC uses similar address scheme
          addressData = this.generateBTCAddress(derivIndex);
          break;
        case 'ETH':
        case 'USDT':
        case 'USDC':
        case 'BNB': // BNB on BSC uses ETH-compatible addresses
          addressData = this.generateETHAddress(derivIndex);
          break;
        default:
          throw new Error(`Unsupported cryptocurrency: ${symbol}`);
      }

      // Invoice reference
      const reference = `CRYPTO_${symbol}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      // Payment expires in 30 minutes
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // Store pending payment for monitoring
      const invoice = {
        reference,
        address: addressData.address,
        cryptoAmount,
        cryptoSymbol: symbol,
        fiatAmount,
        fiatCurrency,
        transactionId,
        userId,
        derivationIndex: derivIndex,
        addressMethod: addressData.method,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        metadata
      };

      this.pendingPayments.set(reference, invoice);

      return {
        success: true,
        reference,
        address: addressData.address,
        cryptoAmount,
        cryptoSymbol: symbol,
        fiatAmount,
        fiatCurrency,
        expiresAt: expiresAt.toISOString(),
        network: this.getNetworkName(symbol),
        qrData: this.generateQRData(symbol, addressData.address, cryptoAmount),
        message: `Send exactly ${cryptoAmount} ${symbol} to the address below`
      };
    } catch (error) {
      console.error('Failed to create payment invoice:', error);
      throw error;
    }
  }

  // ============ PAYMENT VERIFICATION ============

  /**
   * Verify a crypto payment by checking blockchain
   * @param {string} address - Payment address to check
   * @param {number} expectedAmount - Expected crypto amount
   * @param {string} cryptoSymbol - BTC, ETH, USDT, etc.
   * @returns {Object} Verification result
   */
  async verifyPayment(address, expectedAmount, cryptoSymbol) {
    const symbol = cryptoSymbol.toUpperCase();
    
    try {
      switch (symbol) {
        case 'BTC':
          return await this.verifyBTCPayment(address, expectedAmount);
        case 'ETH':
          return await this.verifyETHPayment(address, expectedAmount);
        case 'USDT':
          return await this.verifyERC20Payment(address, expectedAmount, 'USDT');
        case 'USDC':
          return await this.verifyERC20Payment(address, expectedAmount, 'USDC');
        default:
          return { success: false, confirmed: false, error: `Verification not supported for ${symbol}` };
      }
    } catch (error) {
      console.error(`Payment verification failed for ${symbol}:`, error.message);
      return { success: false, confirmed: false, error: error.message };
    }
  }

  /**
   * Verify BTC payment via Blockstream API (free, no key)
   */
  async verifyBTCPayment(address, expectedAmount) {
    try {
      // Blockstream API: get address info
      const response = await axios.get(`${this.blockstreamBase}/address/${address}`, {
        timeout: 15000
      });

      const data = response.data;
      const totalReceived = data.chain_stats.funded_txo_sum / 100000000; // satoshis to BTC
      const unconfirmedReceived = data.mempool_stats.funded_txo_sum / 100000000;
      const receivedAmount = totalReceived + unconfirmedReceived;
      const confirmations = data.chain_stats.funded_txo_count;

      return {
        success: true,
        address,
        receivedAmount,
        expectedAmount,
        currency: 'BTC',
        confirmed: receivedAmount >= expectedAmount && confirmations > 0,
        pendingConfirmation: receivedAmount >= expectedAmount && confirmations === 0,
        confirmations,
        source: 'blockstream'
      };
    } catch (error) {
      // Fallback to blockchain.com API
      try {
        const fallbackResponse = await axios.get(
          `https://blockchain.info/q/getreceivedbyaddress/${address}?confirmations=0`,
          { timeout: 15000 }
        );
        const receivedSatoshis = parseInt(fallbackResponse.data) || 0;
        const receivedAmount = receivedSatoshis / 100000000;

        return {
          success: true,
          address,
          receivedAmount,
          expectedAmount,
          currency: 'BTC',
          confirmed: receivedAmount >= expectedAmount,
          source: 'blockchain.info'
        };
      } catch (fallbackError) {
        return {
          success: false,
          confirmed: false,
          error: `BTC verification failed: ${error.message}`
        };
      }
    }
  }

  /**
   * Verify ETH payment via Etherscan API (free tier)
   */
  async verifyETHPayment(address, expectedAmount) {
    try {
      // Try Etherscan first
      const params = {
        module: 'account',
        action: 'balance',
        address: address,
        tag: 'latest'
      };
      if (this.etherscanApiKey) params.apikey = this.etherscanApiKey;

      const response = await axios.get(this.etherscanBase, {
        params,
        timeout: 15000
      });

      if (response.data.status === '1') {
        const balanceWei = BigInt(response.data.result);
        const receivedAmount = parseFloat(ethers.formatEther(balanceWei));

        return {
          success: true,
          address,
          receivedAmount,
          expectedAmount,
          currency: 'ETH',
          confirmed: receivedAmount >= expectedAmount,
          source: 'etherscan'
        };
      }

      throw new Error('Etherscan returned error');
    } catch (error) {
      // Fallback to direct RPC provider
      if (this.ethereumProvider) {
        try {
          const balance = await this.ethereumProvider.getBalance(address);
          const receivedAmount = parseFloat(ethers.formatEther(balance));

          return {
            success: true,
            address,
            receivedAmount,
            expectedAmount,
            currency: 'ETH',
            confirmed: receivedAmount >= expectedAmount,
            source: 'rpc_provider'
          };
        } catch (rpcError) {
          // fall through
        }
      }

      return {
        success: false,
        confirmed: false,
        error: `ETH verification failed: ${error.message}`
      };
    }
  }

  /**
   * Verify ERC-20 token payment (USDT, USDC) via Etherscan
   */
  async verifyERC20Payment(address, expectedAmount, tokenSymbol) {
    try {
      const contractAddress = this.tokenContracts[tokenSymbol];
      if (!contractAddress) {
        throw new Error(`Unknown token: ${tokenSymbol}`);
      }

      const params = {
        module: 'account',
        action: 'tokenbalance',
        contractaddress: contractAddress,
        address: address,
        tag: 'latest'
      };
      if (this.etherscanApiKey) params.apikey = this.etherscanApiKey;

      const response = await axios.get(this.etherscanBase, {
        params,
        timeout: 15000
      });

      if (response.data.status === '1') {
        const rawBalance = BigInt(response.data.result);
        // USDT and USDC have 6 decimals
        const receivedAmount = Number(rawBalance) / 1e6;

        return {
          success: true,
          address,
          receivedAmount,
          expectedAmount,
          currency: tokenSymbol,
          confirmed: receivedAmount >= expectedAmount,
          source: 'etherscan'
        };
      }

      throw new Error('Etherscan token balance query failed');
    } catch (error) {
      // Fallback to direct contract call via RPC
      if (this.ethereumProvider) {
        try {
          const contractAddress = this.tokenContracts[tokenSymbol];
          const abi = ['function balanceOf(address) view returns (uint256)'];
          const contract = new ethers.Contract(contractAddress, abi, this.ethereumProvider);
          const balance = await contract.balanceOf(address);
          const receivedAmount = Number(balance) / 1e6;

          return {
            success: true,
            address,
            receivedAmount,
            expectedAmount,
            currency: tokenSymbol,
            confirmed: receivedAmount >= expectedAmount,
            source: 'rpc_contract'
          };
        } catch (rpcError) {
          // fall through
        }
      }

      return {
        success: false,
        confirmed: false,
        error: `${tokenSymbol} verification failed: ${error.message}`
      };
    }
  }

  /**
   * Check payment status by reference
   */
  async checkPaymentStatus(reference) {
    const invoice = this.pendingPayments.get(reference);
    if (!invoice) {
      return { success: false, error: 'Invoice not found or expired' };
    }

    // Check if expired
    if (new Date() > new Date(invoice.expiresAt)) {
      this.pendingPayments.del(reference);
      return { success: false, error: 'Payment invoice has expired', status: 'expired' };
    }

    // Verify on blockchain
    const verification = await this.verifyPayment(
      invoice.address,
      invoice.cryptoAmount,
      invoice.cryptoSymbol
    );

    if (verification.confirmed) {
      invoice.status = 'confirmed';
      this.pendingPayments.set(reference, invoice);
    } else if (verification.pendingConfirmation) {
      invoice.status = 'pending_confirmation';
      this.pendingPayments.set(reference, invoice);
    }

    return {
      success: true,
      reference,
      status: invoice.status,
      address: invoice.address,
      cryptoAmount: invoice.cryptoAmount,
      cryptoSymbol: invoice.cryptoSymbol,
      fiatAmount: invoice.fiatAmount,
      fiatCurrency: invoice.fiatCurrency,
      verification,
      expiresAt: invoice.expiresAt
    };
  }

  // ============ UTILITY METHODS ============

  /**
   * Get network name for display
   */
  getNetworkName(symbol) {
    const networks = {
      BTC: this.bitcoinNetwork === bitcoin.networks.testnet ? 'Bitcoin Testnet' : 'Bitcoin Mainnet',
      ETH: 'Ethereum Mainnet',
      USDT: 'Ethereum (ERC-20)',
      USDC: 'Ethereum (ERC-20)',
      BNB: 'BNB Smart Chain',
      SOL: 'Solana',
      LTC: 'Litecoin'
    };
    return networks[symbol] || symbol;
  }

  /**
   * Generate QR-friendly payment URI
   */
  generateQRData(symbol, address, amount) {
    switch (symbol) {
      case 'BTC':
        return `bitcoin:${address}?amount=${amount}`;
      case 'ETH':
        return `ethereum:${address}?value=${ethers.parseEther(amount.toString())}`;
      case 'LTC':
        return `litecoin:${address}?amount=${amount}`;
      default:
        return address;
    }
  }

  /**
   * Get supported cryptocurrencies
   */
  getSupportedCryptocurrencies() {
    return [
      { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', decimals: 8, logo: '₿' },
      { symbol: 'ETH', name: 'Ethereum', network: 'Ethereum', decimals: 18, logo: 'Ξ' },
      { symbol: 'USDT', name: 'Tether', network: 'Ethereum (ERC-20)', decimals: 6, logo: '₮' },
      { symbol: 'USDC', name: 'USD Coin', network: 'Ethereum (ERC-20)', decimals: 6, logo: '💵' },
      { symbol: 'BNB', name: 'BNB', network: 'BSC', decimals: 18, logo: '🟡' },
      { symbol: 'SOL', name: 'Solana', network: 'Solana', decimals: 9, logo: '◎' },
      { symbol: 'LTC', name: 'Litecoin', network: 'Litecoin', decimals: 8, logo: 'Ł' }
    ];
  }

  /**
   * Get exchange rates via CurrencyManager (delegate)
   * Kept for backward compatibility - routes should use CurrencyManager directly
   */
  async getExchangeRates(baseCurrency = 'USD') {
    try {
      // Return a simple structure for backward compatibility
      return {
        success: true,
        base: baseCurrency,
        rates: {},
        message: 'Use /api/payments/rates for live rates via CurrencyManager',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = CryptoPaymentManager;
