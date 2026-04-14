const CryptoPaymentManager = require('../services/CryptoPaymentManager');

describe('CryptoPaymentManager startup validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CRYPTO_CUSTODY_MODE = 'watch_only';
    delete process.env.CRYPTO_BTC_ACCOUNT_XPUB;
    delete process.env.BTC_ACCOUNT_XPUB;
    delete process.env.CRYPTO_ETH_ACCOUNT_XPUB;
    delete process.env.ETH_ACCOUNT_XPUB;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('throws hard configuration error when required xpub values are missing', async () => {
    const manager = new CryptoPaymentManager();

    await expect(manager.initialize()).rejects.toMatchObject({
      code: 'CRYPTO_CUSTODY_CONFIG_ERROR'
    });
  });

  test('throws hard configuration error when xpub values are invalid', async () => {
    process.env.CRYPTO_BTC_ACCOUNT_XPUB = 'invalid_btc_xpub';
    process.env.CRYPTO_ETH_ACCOUNT_XPUB = 'invalid_eth_xpub';

    const manager = new CryptoPaymentManager();

    await expect(manager.initialize()).rejects.toMatchObject({
      code: 'CRYPTO_CUSTODY_CONFIG_ERROR'
    });
  });
});
