/**
 * Entrypoint: On-Ramp con Anchor SDF (Testnet)
 * Arquitectura Hexagonal: SEP-10 auth + generación de URL SEP-24 interactiva.
 *
 * Flujo:
 * 1. Autenticación SEP-10 con testanchor.stellar.org
 * 2. Genera URL interactiva SEP-24 para depósito fiat → USDC
 * 3. Documenta el paso manual de KYC y simulación de fiat
 * 4. Exporta resultados a CSV/JSON
 */
const fetch = require('node-fetch');
const { Keypair, Networks, Transaction } = require('@stellar/stellar-sdk');
const { SdfRampAdapter } = require('../infrastructure/adapters/ramp/SdfRampAdapter');
const { CsvJsonExporter } = require('../infrastructure/adapters/export/CsvJsonExporter');
const { NetworkConfig } = require('../infrastructure/config/NetworkConfig');

const SEED_ORIGEN = 'SCQNLSLDBNYGBVEHX26H476HZRFC74LFOH6H2FSKDWRLRQ6ONVIAZAJZ';
const PUBLICA_ORIGEN = Keypair.fromSecret(SEED_ORIGEN).publicKey();
const USDC = NetworkConfig.assets.usdcCircle;

const adapter = new SdfRampAdapter({
  baseUrl: NetworkConfig.anchor.sdfTestnet,
  homeDomain: NetworkConfig.anchor.homeDomain,
});

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function addResult(row) {
  results.push(row);
  console.log(`[${row.event}]`, JSON.stringify(row));
}

async function main() {
  try {
    // ---------- 1. SEP-10 Challenge ----------
    const challenge = await adapter.authenticate(PUBLICA_ORIGEN);
    console.log('🔐 SEP-10 challenge obtenido:', challenge.challengeTransaction ? 'sí' : 'no');

    // Paso 2: Firmar el challenge con stellar-sdk (el caller debe hacerlo)
    let tx;
    try {
      tx = new Transaction(challenge.challengeTransaction, Networks.TESTNET);
    } catch (e) {
      tx = new Transaction(challenge.challengeTransaction, Networks.TESTNET);
    }

    const pair = Keypair.fromSecret(SEED_ORIGEN);
    tx.sign(pair);
    const signedXDR = tx.toXDR();

    // Paso 3: Verificar transacción firmada
    const verifyData = await adapter.verifySignedTransaction(signedXDR);
    console.log('✅ SEP-10 autenticado. Token:', verifyData.token ? 'sí' : 'no');

    addResult({
      event: 'SEP10_AUTH',
      account: PUBLICA_ORIGEN,
      home_domain: NetworkConfig.anchor.homeDomain,
      token_received: !!verifyData.token,
      timestamp: new Date().toISOString(),
    });

    // ---------- 2. Generar URL SEP-24 interactiva ----------
    const sep24Url = `${NetworkConfig.anchor.sdfTestnet}/sep24/transactions/deposit/interactive` +
      `?asset_code=${USDC.code}` +
      `&asset_issuer=${USDC.issuer}` +
      `&amount=5` +
      `&account=${PUBLICA_ORIGEN}` +
      `&memo_type=text` +
      `&memo=LAB-ONRAMP-SDF`;

    console.log('\n🌐 ON-RAMP — Flujo interactivo manual:');
    console.log('   Abre en el navegador:', sep24Url);
    console.log('   1. Completa KYC (SEP-12) si el anchor lo requiere');
    console.log('   2. Simula el depósito fiat (máx 10 USD equiv)');
    console.log('   3. Recibe USDC en tu cuenta testnet');

    addResult({
      event: 'ON-RAMP_MANUAL',
      asset: USDC.code,
      amount_fiat: '5',
      anchor_url: sep24Url,
      status: 'pending_user_action',
      account: PUBLICA_ORIGEN,
      timestamp: new Date().toISOString(),
    });

    // ---------- 3. Exportar ----------
    const exporter = new CsvJsonExporter({ outputDir: '.' });
    exporter.export(results, 'lab-rampa-stellar-sdf-results');

    console.log('\n✅ Laboratorio SDF real finalizado.');
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    const exporter = new CsvJsonExporter({ outputDir: '.' });
    exporter.export(results, 'lab-rampa-stellar-sdf-results');
    process.exit(1);
  }
}

main();
