/**
 * Laboratorio de Rampas Stellar — Off-ramp USDC real on-chain (Testnet)
 * Envía 20 USDC de Circle desde cuenta persistente a segunda cuenta testnet
 * con trustline a USDC. Transacción on-chain verificable en Stellar Expert.
 */
import { Keypair, Networks, TransactionBuilder, Asset, Horizon, Operation, TimeoutInfinite, Memo } from '@stellar/stellar-sdk';
import * as fs from 'fs';

const HORIZON = 'https://horizon-testnet.stellar.org';
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET = new Asset('USDC', USDC_ISSUER);
const server = new Horizon.Server(HORIZON);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED_FIJA = 'SCQNLSLDBNYGBVEHX26H476HZRFC74LFOH6H2FSKDWRLRQ6ONVIAZAJZ';
const pairOrigen = Keypair.fromSecret(SEED_FIJA);
const PUBLICA_ORIGEN = pairOrigen.publicKey();

console.log('🔑 Cuenta origen:', PUBLICA_ORIGEN);

const results = [];
function addResult(row) { results.push(row); console.log(`[${row.event}]`, JSON.stringify(row)); }

async function main() {
  try {
    // ---------- 1. Crear cuenta destino ----------
    const destino = Keypair.random();
    console.log('🔑 Cuenta destino:', destino.publicKey());
    console.log('🔑 Seed destino:', destino.secret());

    await fetch(`https://friendbot.stellar.org?addr=${destino.publicKey()}`);
    await sleep(4000);
    const cuentaDestino = await server.loadAccount(destino.publicKey());
    console.log('✅ Cuenta destino fondeada');

    // ---------- 2. Trustline USDC en destino ----------
    const tx1 = new TransactionBuilder(cuentaDestino, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.changeTrust({ asset: USDC_ASSET, limit: '1000' }))
      .setTimeout(TimeoutInfinite)
      .build();
    tx1.sign(destino);
    const res1 = await server.submitTransaction(tx1);
    console.log('✅ Trustline USDC en destino. Hash:', res1.hash);
    addResult({
      event: 'TRUSTLINE_USDC_DESTINO',
      asset: 'USDC',
      issuer: USDC_ISSUER,
      account: destino.publicKey(),
      tx_hash: res1.hash,
      timestamp: new Date().toISOString(),
    });

    // ---------- 3. Enviar USDC on-chain ----------
    const fresh = await server.loadAccount(PUBLICA_ORIGEN);
    const usdcBalance = fresh.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER);
    const disponible = usdcBalance ? usdcBalance.balance : '0';
    console.log('💰 Saldo USDC origen:', disponible);

    if (Number(disponible) < 20) {
      throw new Error(`Saldo USDC insuficiente: ${disponible} < 20`);
    }

    const tx2 = new TransactionBuilder(fresh, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: destino.publicKey(),
          asset: USDC_ASSET,
          amount: '20',
        }))
      .addMemo(Memo.text('LAB-OFFRAMP-USDC-REAL'))
      .setTimeout(TimeoutInfinite)
      .build();
    tx2.sign(pairOrigen);

    const res2 = await server.submitTransaction(tx2);
    console.log('✅ USDC enviado on-chain. Hash:', res2.hash);
    console.log('   De:', PUBLICA_ORIGEN);
    console.log('   Para:', destino.publicKey());
    console.log('   Monto: 20 USDC');

    addResult({
      event: 'OFFRAMP_USDC_ONCHAIN',
      asset: 'USDC',
      amount: '20',
      source_account: PUBLICA_ORIGEN,
      destination: destino.publicKey(),
      memo: 'LAB-OFFRAMP-USDC-REAL',
      tx_hash: res2.hash,
      timestamp: new Date().toISOString(),
    });

    // ---------- 4. Verificar saldos ----------
    await sleep(3000);
    const origenFinal = await server.loadAccount(PUBLICA_ORIGEN);
    const destinoFinal = await server.loadAccount(destino.publicKey());

    const usdcOrigenFinal = origenFinal.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER);
    const usdcDestinoFinal = destinoFinal.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER);

    console.log('\n💰 Saldo USDC origen final:', usdcOrigenFinal ? usdcOrigenFinal.balance : '0');
    console.log('💰 Saldo USDC destino final:', usdcDestinoFinal ? usdcDestinoFinal.balance : '0');

    addResult({
      event: 'SALDOS_FINALES',
      origen_usdc: usdcOrigenFinal ? usdcOrigenFinal.balance : '0',
      destino_usdc: usdcDestinoFinal ? usdcDestinoFinal.balance : '0',
      timestamp: new Date().toISOString(),
    });

    // ---------- 5. Exportar ----------
    const jsonPath = './lab-rampa-stellar-usdc-offramp-real-results.json';
    const csvPath = './lab-rampa-stellar-usdc-offramp-real-results.csv';

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
    console.log('\n✅ Off-ramp USDC on-chain real finalizado.');
    console.log('   Stellar Expert: https://stellar.expert/explorer/testnet/tx/' + res2.hash);

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  }
}

main();
