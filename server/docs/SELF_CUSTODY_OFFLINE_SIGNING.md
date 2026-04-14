# Self-Custody + Offline Signing Mode

This mode keeps private keys off the server and lets you run Zerohook like a watch-only treasury system.

If you are new to crypto operations, use this file as a checklist and do not skip the backup steps.

## What this gives you

- Users can pay to unique addresses derived from your xpub keys.
- The server can track balances, invoices, and escrow states.
- The server cannot spend funds (no private keys loaded).
- Outgoing payments require offline/hardware wallet signing.

## Required environment variables

- CRYPTO_CUSTODY_MODE=watch_only
- CRYPTO_BTC_ACCOUNT_XPUB=<your BTC account xpub>
- CRYPTO_ETH_ACCOUNT_XPUB=<your ETH account xpub>

### No hardware wallet yet (PC-only start)

Yes, you can start on PC without buying a hardware wallet now.

Recommended minimum-safe approach:

1. Use a dedicated device for key creation if possible (old laptop/phone is better than your daily device).
2. Derive xpub values with the helper script:
	- Create new mnemonic + derive xpub: npm run derive:xpub -- --generate
	- From server folder: npm run derive:xpub
	- Testnet: npm run derive:xpub -- --testnet
3. Paste output values into server/env.local (or server/env.production).
4. Keep mnemonic/seed phrase offline and never store it in server env files.

Warning:

- PC-only custody is less secure than hardware wallet custody.
- Use small limits until you can migrate to hardware wallet signing.

## Where to get xpub values

1. BTC value (CRYPTO_BTC_ACCOUNT_XPUB)
	- Export the BTC account public key from path m/84'/0'/0' for mainnet.
	- If using testnet, set BITCOIN_NETWORK=testnet and export from m/84'/1'/0' (usually tpub prefix).
	- Accepted prefixes for this server setup are xpub (mainnet) and tpub (testnet).
	- If your wallet gives zpub/ypub/upub/vpub, convert to xpub/tpub before setting env.
2. ETH value (CRYPTO_ETH_ACCOUNT_XPUB)
	- Export an Ethereum public derivation key for path m/44'/60'/0'/0.
	- The server derives receive addresses with incremental index from this root.
	- Preferred prefix is xpub; tpub serialization is also accepted.
	- Keep seed/private key only on offline/hardware wallet.

If your wallet app does not show xpub export directly, use a hardware-wallet compatible desktop app that supports account public key export, or perform derivation on an air-gapped machine. Never type seed phrase on an internet-connected computer.

Optional:

- BITCOIN_NETWORK=testnet (for testnet)
- ETHEREUM_RPC_URL=<rpc url>
- ETHERSCAN_API_KEY=<key>

Do not set CRYPTO_MASTER_SEED in watch_only mode.

## Optional multisig policy (high-value withdrawals)

Use this when you want a second admin approval before payout signing is allowed.

- WITHDRAWAL_MULTISIG_ENABLED=true
- WITHDRAWAL_MULTISIG_THRESHOLD_USD=1000
- WITHDRAWAL_MULTISIG_REQUIRED_APPROVALS=2

Behavior:

- If withdrawal amount is below threshold, single admin approval flow continues.
- If withdrawal amount is at or above threshold, each unique admin approval is recorded.
- Signing request is only generated after required approvals are reached.

## Beginner setup (step-by-step)

1. Create or choose hardware wallets
	- One wallet/account for BTC receive addresses.
	- One wallet/account for ETH/ERC-20 receive addresses.
2. Export account xpub values from each wallet
	- Export public account key only.
	- Never export seed phrase or private keys to server.
3. Set server environment values
	- Use watch_only mode and paste the two xpub values.
	- Development file: server/env.local
	- Production file: server/env.production
4. Start Zerohook backend
	- Startup now hard-fails if watch_only is enabled and required xpub values are missing or invalid.
5. Verify custody mode
	- Call GET /api/payments/custody-status.
	- Confirm mode=watch_only and receiveDerivation is true for BTC and ETH.
6. Test a small payment
	- Create invoice, send tiny amount, wait for confirmation, verify activation.
7. Test one withdrawal
	- Approve withdrawal without txHash to generate signing request.
	- Sign and broadcast with offline/hardware wallet.
	- Submit txHash back to platform.

## Supported settlement assets

- BTC
- ETH
- USDT (ERC-20)
- USDC (ERC-20)

## Receive flow

1. Client requests invoice/deposit/escrow payment.
2. Server derives a unique address from xpub and stores CryptoInvoice.
3. Server watches chain confirmations.
4. Funds become active in app state only after confirmation.

## Escrow behavior

- Crypto escrow starts at pending_payment.
- It moves to held only after blockchain confirmation.

## Offline withdrawal flow

1. Admin approves withdrawal without txHash.
2. Server creates offline signing request payload.
3. You sign and broadcast using your offline/hardware wallet.
4. Admin submits txHash to finalize withdrawal.

When multisig is enabled for high-value withdrawals:

1. First admin approval records approval only (status stays pending).
2. Additional unique admin approvals are collected.
3. Final required approval triggers signing request generation.
4. Offline signing and txHash submission complete withdrawal.

API endpoints:

- POST /api/admin/withdrawals/:id/approve
- GET /api/admin/withdrawals/:id/signing-request
- POST /api/admin/withdrawals/:id/submit-signed

## Operational warnings

- Back up xpub source wallet and seed securely offline.
- Treat approved signing requests as time-sensitive.
- Verify destination and amount on hardware wallet screen before signing.
- Keep strict admin access controls and audit logs.
- Use at least two separate admin accounts if multisig is enabled.
- Run periodic drill restores from backup seed on an isolated test wallet.
