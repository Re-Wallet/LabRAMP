/**
 * Laboratorio de Rampas Stellar — Anchor Real SDF (Testnet)
 * Cuenta persistente (seed fija) para fondear y reutilizar.
 *
 * Pasos para completar el lab:
 * 1. Financiar esta cuenta con XLM via Friendbot (testnet).
 * 2. Financiar con USDC de Circle (testnet faucet).
 * 3. Ejecutar este script: crea trustline, SEP-10 auth, URL on-ramp, y off-ramp real.
 */
import { Keypair, Networks, TransactionBuilder, Asset, Horizon, Operation, TimeoutInfinite, Transaction, Memo } from '@stellar/stellar-sdk';
import * as fs from 'fs';

const HORIZON = 'https://horizon-testnet.stellar.org';
const ANCHOR  = 'https://testanchor.stellar.org';
const ANCHOR_ACCOUNT = 'GCSGSR6KQQ5BP2FXVPWRL6SWPUSFWLVONLIBJZUKTVQB5FYJFVL6XOXE';
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET = new Asset('USDC', USDC_ISSUER);
const server = new Horizon.Server(HORIZON);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ════════════════════════════════════════════════════════════════════════════════
// CUENTA PERSISTENTE — Fondear esta dirección antes de ejecutar el script
// ════════════════════════════════════════════════════════════════════════════════
const SEED_FIJA = 'SCQNLSLDBNYGBVEHX26H476HZRFC74LFOH6H2FSKDWRLRQ6ONVIAZAJZ';
const pair = Keypair.fromSecret(SEED_FIJA);
const PUBLICA = pair.publicKey();
// ════════════════════════════════════════════════════════════════════════════════

console.log('🔑 Cuenta persistente:', PUBLICA);

const results = [];

function addResult(row) {
  results.push(row);
  console.log(`[${row.event}]`, JSON.stringify(row));
}

// ---------- 1. Cargar cuenta (financiar con Friendbot si no existe) ----------
async function loadOrCreateAccount() {
  try {
    const account = await server.loadAccount(PUBLICA);
    console.log('✅ Cuenta existe. Secuencia:', account.sequenceNumber());
    return account;
  } catch (e) {
    console.log('⚠️ Cuenta no encontrada en testnet. Fondando con Friendbot...');
    await fetch(`https://friendbot.stellar.org?addr=${PUBLICA}`);
    await sleep(4000);
    const account = await server.loadAccount(PUBLICA);
    console.log('✅ Cuenta fondeada. Secuencia:', account.sequenceNumber());
    return account;
  }
}

// ---------- 2. Trustline a USDC ----------
async function addTrustline(account) {
  const existing = account.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER);
  if (existing) {
    console.log('✅ Trustline USDC ya existe. Saldo:', existing.balance);
    addResult({
      event: 'TRUSTLINE_USDC_EXISTING',
      asset: 'USDC',
      issuer: USDC_ISSUER,
      account: PUBLICA,
      balance: existing.balance,
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: USDC_ASSET, limit: '1000' }))
    .setTimeout(TimeoutInfinite)
    .build();
  tx.sign(pair);
  const res = await server.submitTransaction(tx);
  console.log('✅ Trustline USDC creado. Hash:', res.hash);
  addResult({
    event: 'TRUSTLINE_USDC',
    asset: 'USDC',
    issuer: USDC_ISSUER,
    account: PUBLICA,
    tx_hash: res.hash,
    timestamp: new Date().toISOString(),
  });
  return res.hash;
}

// ---------- 3. SEP-10 Auth ----------
async function sep10Auth() {
  const homeDomain = 'testanchor.stellar.org';

  let authUrl = `${ANCHOR}/auth?account=${PUBLICA}&home_domain=${homeDomain}`;
  let res = await fetch(authUrl);
  let data = await res.json();

  if (!data.transaction) {
    authUrl = `${ANCHOR}/auth?account=${PUBLICA}&home_domain=${homeDomain}&client_domain=${homeDomain}`;
    res = await fetch(authUrl);
    data = await res.json();
  }

  if (!data.transaction) {
    throw new Error('No SEP-10 challenge: ' + JSON.stringify(data));
  }

  let tx;
  try { tx = new Transaction(data.transaction, Networks.TESTNET); }
  catch { tx = new Transaction(data.transaction, Networks.TESTNET); }

  tx.sign(pair);
  const signedXDR = tx.toXDR();

  const verifyRes = await fetch(`${ANCHOR}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedXDR }),
  });

  if (!verifyRes.ok) {
    const errText = await verifyRes.text();
    throw new Error('SEP-10 verify failed: ' + verifyRes.status + ' ' + errText);
  }

  const verifyData = await verifyRes.json();
  console.log('✅ SEP-10 autenticado. Token:', verifyData.token ? 'sí' : 'no');
  addResult({
    event: 'SEP10_AUTH',
    account: PUBLICA,
    home_domain: homeDomain,
    token_received: !!verifyData.token,
    timestamp: new Date().toISOString(),
  });
  return verifyData.token;
}

// ---------- 4. On-ramp: URL interactiva ----------
function documentOnRamp() {
  const url = `${ANCHOR}/sep24/transactions/deposit/interactive?asset_code=USDC&asset_issuer=${USDC_ISSUER}&amount=5&account=${PUBLICA}&memo_type=text&memo=LAB-ONRAMP-SDF`;
  console.log('\n🌐 ON-RAMP — Flujo interactivo manual:');
  console.log('   Abre en el navegador:', url);
  console.log('   1. Completa KYC (SEP-12) si el anchor lo requiere');
  console.log('   2. Simula el depósito fiat (max 10 USD equiv)');
  console.log('   3. Recibe USDC en tu cuenta testnet');

  addResult({
    event: 'ON-RAMP_MANUAL',
    asset: 'USDC',
    amount_fiat: '5',
    anchor_url: url,
    status: 'pending_user_action',
    account: PUBLICA,
    timestamp: new Date().toISOString(),
  });
}

// ---------- 5. Off-ramp real: enviar USDC al anchor ----------
async function sendUSDCToAnchor(account, amount = '5') {
  const fresh = await server.loadAccount(PUBLICA);
  const memo = 'LAB-OFFRAMP-SDF';

  const usdcBalance = fresh.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER);
  const available = usdcBalance ? usdcBalance.balance : '0';

  if (Number(available) < Number(amount)) {
    console.log(`⚠️ Saldo USDC insuficiente (${available} < ${amount}). Se omite envío USDC.`);
    addResult({
      event: 'OFF-RAMP_SKIPPED',
      asset: 'USDC',
      amount,
      available,
      destination: ANCHOR_ACCOUNT,
      memo,
      reason: 'insufficient_usdc_balance',
      source_account: PUBLICA,
      timestamp: new Date().toISOString(),
    });

    // Demo: enviar 1 XLM nativo al anchor
    const fresh2 = await server.loadAccount(PUBLICA);
    const txXLM = new TransactionBuilder(fresh2, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: ANCHOR_ACCOUNT,
          asset: Asset.native(),
          amount: '1',
        }))
      .addMemo(Memo.text(memo))
      .setTimeout(TimeoutInfinite)
      .build();
    txXLM.sign(pair);
    const resXLM = await server.submitTransaction(txXLM);
    console.log('✅ XLM nativo enviado on-chain al anchor (demo). Hash:', resXLM.hash);

    addResult({
      event: 'OFF-RAMP_DEMO_XLM',
      asset: 'XLM (native)',
      amount: '1',
      destination: ANCHOR_ACCOUNT,
      memo,
      tx_hash: resXLM.hash,
      source_account: PUBLICA,
      timestamp: new Date().toISOString(),
    });

    return null;
  }

  const tx = new TransactionBuilder(fresh, {
    fee: '200',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: ANCHOR_ACCOUNT,
        asset: USDC_ASSET,
        amount,
      }))
    .setTimeout(TimeoutInfinite)
    .build();
  tx.sign(pair);

  try {
    const res = await server.submitTransaction(tx);
    console.log('✅ USDC enviado on-chain al anchor (sin memo). Hash:', res.hash);

    addResult({
      event: 'OFF-RAMP_ONCHAIN_USDC',
      asset: 'USDC',
      amount,
      destination: ANCHOR_ACCOUNT,
      tx_hash: res.hash,
      source_account: PUBLICA,
      timestamp: new Date().toISOString(),
    });

    return res.hash;
  } catch (submitErr) {
    console.error('❌ Error enviando USDC al anchor:', submitErr.message);
    addResult({
      event: 'OFF-RAMP_USDC_FAILED',
      asset: 'USDC',
      amount,
      destination: ANCHOR_ACCOUNT,
      error: submitErr.message,
      source_account: PUBLICA,
      timestamp: new Date().toISOString(),
    });

    // Fallback: demo XLM nativo al anchor
    console.log('🔄 Fallback: enviando 1 XLM nativo al anchor (demo)...');
    const fresh2 = await server.loadAccount(PUBLICA);
    const txXLM = new TransactionBuilder(fresh2, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: ANCHOR_ACCOUNT,
          asset: Asset.native(),
          amount: '1',
        }))
      .setTimeout(TimeoutInfinite)
      .build();
    txXLM.sign(pair);
    const resXLM = await server.submitTransaction(txXLM);
    console.log('✅ XLM nativo enviado on-chain al anchor (demo). Hash:', resXLM.hash);

    addResult({
      event: 'OFF-RAMP_DEMO_XLM',
      asset: 'XLM (native)',
      amount: '1',
      destination: ANCHOR_ACCOUNT,
      tx_hash: resXLM.hash,
      source_account: PUBLICA,
      timestamp: new Date().toISOString(),
    });

    return null;
  }
}

// ---------- 6. Exportar CSV y JSON ----------
function exportResults() {
  const jsonPath = './lab-rampa-stellar-sdf-results.json';
  const csvPath = './lab-rampa-stellar-sdf-results.csv';

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  if (results.length > 0) {
    const headers = Object.keys(results[0]);
    const lines = [headers.join(',')];
    for (const row of results) {
      const vals = headers.map(h => {
        const v = String(row[h] ?? '').replace(/"/g, '""');
        return `"${v}"`;
      });
      lines.push(vals.join(','));
    }
    fs.writeFileSync(csvPath, lines.join('\n'));
  }

  console.log('\n📁 Exportado:');
  console.log('   JSON:', jsonPath);
  console.log('   CSV :', csvPath);
}

// ---------- Main ----------
async function main() {
  try {
    const account = await loadOrCreateAccount();
    await addTrustline(account);
    await sep10Auth();
    documentOnRamp();
    await sendUSDCToAnchor(account, '5');

    exportResults();
    console.log('\n✅ Laboratorio SDF real finalizado.');
    console.log('   Explorador: https://stellar.expert/explorer/testnet');
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    exportResults();
    process.exit(1);
  }
}

main();
