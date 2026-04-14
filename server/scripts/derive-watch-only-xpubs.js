#!/usr/bin/env node

const readline = require('readline');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');

const bip32 = BIP32Factory(ecc);

const args = process.argv.slice(2);
const useTestnet = args.includes('--testnet');
const shouldGenerateMnemonic = args.includes('--generate');

const btcNetwork = useTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
const ethXpubNetwork = bitcoin.networks.bitcoin;
const btcPath = useTestnet ? "m/84'/1'/0'" : "m/84'/0'/0'";
const ethPath = "m/44'/60'/0'/0";

function getArgValue(name) {
  const index = args.findIndex((arg) => arg === name);
  if (index === -1 || index + 1 >= args.length) {
    return null;
  }
  return args[index + 1];
}

function showUsage() {
  console.log('Usage:');
  console.log('  node scripts/derive-watch-only-xpubs.js --generate [--testnet]');
  console.log('  node scripts/derive-watch-only-xpubs.js [--testnet]');
  console.log('  node scripts/derive-watch-only-xpubs.js --mnemonic "word1 ... word12" [--testnet]');
  console.log('');
  console.log('Notes:');
  console.log('  - Do not run this on a shared computer.');
  console.log('  - Prefer running on an offline/air-gapped device.');
  console.log('  - Only xpub values are printed. Private keys are never printed.');
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  let mnemonic = getArgValue('--mnemonic');
  if (!mnemonic && shouldGenerateMnemonic) {
    mnemonic = bip39.generateMnemonic(256);
    console.log('Generated new mnemonic phrase (write this offline and keep it secret):');
    console.log(mnemonic);
    console.log('');
  }

  if (!mnemonic) {
    mnemonic = await ask('Enter your mnemonic phrase: ');
  }

  mnemonic = String(mnemonic || '').trim().replace(/\s+/g, ' ');
  if (!bip39.validateMnemonic(mnemonic)) {
    console.error('Invalid mnemonic phrase. Check spelling/order and try again.');
    process.exitCode = 1;
    return;
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const btcRoot = bip32.fromSeed(seed, btcNetwork);
  const ethRoot = bip32.fromSeed(seed, ethXpubNetwork);

  const btcAccount = btcRoot.derivePath(btcPath);
  const ethAccountExternal = ethRoot.derivePath(ethPath);

  const btcXpub = btcAccount.neutered().toBase58();
  const ethXpub = ethAccountExternal.neutered().toBase58();

  console.log('');
  console.log('Set these values in your server env file:');
  console.log(`CRYPTO_CUSTODY_MODE=watch_only`);
  console.log(`BITCOIN_NETWORK=${useTestnet ? 'testnet' : 'mainnet'}`);
  console.log(`CRYPTO_BTC_ACCOUNT_XPUB=${btcXpub}`);
  console.log(`CRYPTO_ETH_ACCOUNT_XPUB=${ethXpub}`);
  console.log('');
  console.log('Derived paths:');
  console.log(`BTC: ${btcPath}`);
  console.log(`ETH: ${ethPath}`);
}

main().catch((error) => {
  console.error('Failed to derive xpub values:', error.message);
  process.exitCode = 1;
});
