/**
 * Laboratorio de Rampas Stellar — Off-ramp SRT real → Anchor SDF (Testnet)
 * Cuenta persistente: GA67L2Q2P57MNL6SMDWIVKZVGQN7KN4N43IHM6EHQ3YYWNY2B753C7EW
 *
 * Pasos:
 * 1. Trustline a SRT (issuer: GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B)
 * 2. Verificar saldo SRT
 * 3. Enviar SRT on-chain al anchor SDF
 * 4. Exportar CSV/JSON
 */
import { Keypair, Networks, TransactionBuilder, Asset, Horizon, Operation, TimeoutInfinite, Memo } from '@stellar/stellar-sdk';
import * as fs from 'fs';

const HORIZON = 'https://horizon-testnet.stellar.org';
const ANCHOR_ACCOUNT = 'GCSGSR6KQQ5BP2FXVPWRL6SWPUSFWLVONLIBJZUKTVQB5FYJFVL6XOXE';
const SRT_ISSUER = 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B';
const SRT_ASSET = new Asset('SRT', SRT_ISSUER);
const server = new Horizon.Server(HORIZON);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED_FIJA = 'SCQNLSLDBNYGBVEHX26H476HZRFC74LFOH6H2FSKDWRLRQ6ONVIAZAJZ';
const pair = Keypair.fromSecret(SEED_FIJA);
const PUBLICA = pair.publicKey();

console.log('🔑 Cuenta persistente:', PUBLICA);

const results = [];
function addResult(row) { results.push(row); console.log(`[${row.event}]`, JSON.stringify(row)); }

async function loadAccount() {
  return await server.loadAccount(PUBLICA);
}

async function addSRTTrustline(account) {
  const existing = account.balances.find(b => b.asset_code === 'SRT' && b.asset_issuer === SRT_ISSUER);
  if (existing) {
    console.log('✅ Trustline SRT ya existe. Saldo:', existing.balance);
    addResult({ event: 'TRUSTLINE_SRT_EXISTING', asset: 'SRT', issuer: SRT_ISSUER, account: PUBLICA, balance: existing.balance, timestamp: new Date().toISOString() });
    return null;
  }
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: SRT_ASSET, limit: '1000' }))
    .setTimeout(TimeoutInfinite)
    .build();
  tx.sign(pair);
  const res = await server.submitTransaction(tx);
  console.log('✅ Trustline SRT creado. Hash:', res.hash);
  addResult({ event: 'TRUSTLINE_SRT', asset: 'SRT', issuer: SRT_ISSUER, account: PUBLICA, tx_hash: res.hash, timestamp: new Date().toISOString() });
  return res.hash;
}

async function sendSRTToAnchor(account, amount = '5') {
  const fresh = await server.loadAccount(PUBLICA);
  const srtBalance = fresh.balances.find(b => b.asset_code === 'SRT' && b.asset_issuer === SRT_ISSUER);
  const available = srtBalance ? srtBalance.balance : '0';

  if (Number(available) < Number(amount)) {
    console.log(`⚠️ Saldo SRT insuficiente (${available} < ${amount}). Se omite envío SRT.`);
    addResult({
      event: 'OFF-RAMP_SRT_SKIPPED', asset: 'SRT', amount, available,
      destination: ANCHOR_ACCOUNT, reason: 'insufficient_srt_balance',
      source_account: PUBLICA, timestamp: new Date().toISOString(),
    });
    return null;
  }

  const tx = new TransactionBuilder(fresh, { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: ANCHOR_ACCOUNT, asset: SRT_ASSET, amount }))
    .addMemo(Memo.text('LAB-OFFRAMP-SRT'))
    .setTimeout(TimeoutInfinite)
    .build();
  tx.sign(pair);
  const res = await server.submitTransaction(tx);
  console.log('✅ SRT enviado on-chain al anchor. Hash:', res.hash);
  addResult({ event: 'OFF-RAMP_SRT_ONCHAIN', asset: 'SRT', amount, destination: ANCHOR_ACCOUNT, tx_hash: res.hash, source_account: PUBLICA, timestamp: new Date().toISOString() });
  return res.hash;
}

function exportResults() {
  const jsonPath = './lab-rampa-stellar-srt-results.json';
  const csvPath = './lab-rampa-stellar-srt-results.csv';
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  if (results.length > 0) {
    const headers = Object.keys(results[0]);
    const lines = [headers.join(',')];
    for (const row of results) {
      lines.push(headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
    }
    fs.writeFileSync(csvPath, lines.join('\n'));
  }
  console.log('\n📁 Exportado:');
  console.log('   JSON:', jsonPath);
  console.log('   CSV :', csvPath);
}

async function main() {
  try {
    const account = await loadAccount();
    await addSRTTrustline(account);
    await sendSRTToAnchor(account, '5');
    exportResults();
    console.log('\n✅ Laboratorio SRT off-ramp finalizado.');
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    exportResults();
    process.exit(1);
  }
}

main();
