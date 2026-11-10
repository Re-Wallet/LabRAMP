/**
 * Entrypoint: Off-Ramp USDC Real On-Chain (Testnet)
 * Arquitectura Hexagonal: usa casos de uso + adaptadores de infraestructura.
 *
 * Flujo:
 * 1. Crea cuenta destino y le añade trustline a USDC (Circle)
 * 2. Envía 20 USDC on-chain desde cuenta origen a cuenta destino
 * 3. Verifica saldos finales
 * 4. Exporta resultados a CSV/JSON
 */
const { Keypair, Networks, TransactionBuilder, Asset, Operation, TimeoutInfinite, Memo, Horizon } = require('@stellar/stellar-sdk');
const fetch = require('node-fetch');
const { StellarHorizonAdapter } = require('../infrastructure/adapters/stellar/StellarHorizonAdapter');
const { CsvJsonExporter } = require('../infrastructure/adapters/export/CsvJsonExporter');
const { NetworkConfig } = require('../infrastructure/config/NetworkConfig');

const HORIZON_URL = NetworkConfig.networks.testnet.horizon;
const FRIENDBOT_URL = NetworkConfig.networks.testnet.friendbot;
const USDC = NetworkConfig.assets.usdcCircle;

const SEED_ORIGEN = 'SCQNLSLDBNYGBVEHX26H476HZRFC74LFOH6H2FSKDWRLRQ6ONVIAZAJZ';
const PUBLICA_ORIGEN = Keypair.fromSecret(SEED_ORIGEN).publicKey();

const stellar = new StellarHorizonAdapter({
  horizonUrl: HORIZON_URL,
  networkPassphrase: NetworkConfig.networks.testnet.networkPassphrase,
  friendbotUrl: FRIENDBOT_URL,
});

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function addResult(row) {
  results.push(row);
  console.log(`[${row.event}]`, JSON.stringify(row));
}

async function main() {
  try {
    // ---------- 1. Crear cuenta destino ----------
    const destino = Keypair.random();
    console.log('🔑 Cuenta destino:', destino.publicKey());
    console.log('🔑 Seed destino:', destino.secret());

    await stellar.fundAccount(destino.publicKey());
    const cuentaDestino = await stellar.loadAccount(destino.publicKey());
    console.log('✅ Cuenta destino fondeada');

    // ---------- 2. Trustline USDC en destino ----------
    await stellar.createTrustline({
      publicKey: destino.publicKey(),
      secretKey: destino.secret(),
      assetCode: USDC.code,
      assetIssuer: USDC.issuer,
    });
    addResult({
      event: 'TRUSTLINE_USDC_DESTINO',
      asset: USDC.code,
      issuer: USDC.issuer,
      account: destino.publicKey(),
      timestamp: new Date().toISOString(),
    });

    // ---------- 3. Verificar saldo USDC origen ----------
    const origenAccount = await stellar.loadAccount(PUBLICA_ORIGEN);
    const usdcBalance = origenAccount.balances.find(
      (b) => b.asset_code === USDC.code && b.asset_issuer === USDC.issuer
    );
    const disponible = usdcBalance ? usdcBalance.balance : '0';
    console.log('💰 Saldo USDC origen:', disponible);

    if (parseFloat(disponible) < 20) {
      throw new Error(`Saldo USDC insuficiente: ${disponible} < 20`);
    }

    // ---------- 4. Enviar USDC on-chain ----------
    const tx = new TransactionBuilder(
      await stellar.loadAccount(PUBLICA_ORIGEN).then((a) => {
        // Reconstruir cuenta para TransactionBuilder
        return Keypair.fromSecret(SEED_ORIGEN);
      }).then(() => {
        // Necesitamos el objeto Account de Horizon. Usamos el server directamente.
        return null;
      })
    );

    // Usamos el servidor Horizon directamente para construir la transacción
    const server = new Horizon.Server(HORIZON_URL);
    const fresh = await server.loadAccount(PUBLICA_ORIGEN);
    const pair = Keypair.fromSecret(SEED_ORIGEN);

    const txBuild = new TransactionBuilder(fresh, {
      fee: '100',
      networkPassphrase: NetworkConfig.networks.testnet.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: destino.publicKey(),
          asset: new Asset(USDC.code, USDC.issuer),
          amount: '20',
        })
      )
      .addMemo(Memo.text('LAB-OFFRAMP-USDC-REAL'))
      .setTimeout(TimeoutInfinite)
      .build();

    txBuild.sign(pair);
    const res = await server.submitTransaction(txBuild);
    console.log('✅ USDC enviado on-chain. Hash:', res.hash);

    addResult({
      event: 'OFFRAMP_USDC_ONCHAIN',
      asset: USDC.code,
      amount: '20',
      source_account: PUBLICA_ORIGEN,
      destination: destino.publicKey(),
      memo: 'LAB-OFFRAMP-USDC-REAL',
      tx_hash: res.hash,
      timestamp: new Date().toISOString(),
    });

    // ---------- 5. Verificar saldos ----------
    await sleep(3000);
    const origenFinal = await server.loadAccount(PUBLICA_ORIGEN);
    const destinoFinal = await server.loadAccount(destino.publicKey());

    const usdcOrigenFinal = origenFinal.balances.find(
      (b) => b.asset_code === USDC.code && b.asset_issuer === USDC.issuer
    );
    const usdcDestinoFinal = destinoFinal.balances.find(
      (b) => b.asset_code === USDC.code && b.asset_issuer === USDC.issuer
    );

    console.log('\n💰 Saldo USDC origen final:', usdcOrigenFinal ? usdcOrigenFinal.balance : '0');
    console.log('💰 Saldo USDC destino final:', usdcDestinoFinal ? usdcDestinoFinal.balance : '0');

    addResult({
      event: 'SALDOS_FINALES',
      origen_usdc: usdcOrigenFinal ? usdcOrigenFinal.balance : '0',
      destino_usdc: usdcDestinoFinal ? usdcDestinoFinal.balance : '0',
      timestamp: new Date().toISOString(),
    });

    // ---------- 6. Exportar ----------
    const exporter = new CsvJsonExporter({ outputDir: '.' });
    exporter.export(results, 'lab-rampa-stellar-usdc-offramp-real-results');

    console.log('\n✅ Off-ramp USDC on-chain real finalizado.');
    console.log('   Stellar Expert:', `${NetworkConfig.networks.testnet.explorer}/tx/${res.hash}`);
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    const exporter = new CsvJsonExporter({ outputDir: '.' });
    exporter.export(results, 'lab-rampa-stellar-usdc-offramp-real-results');
    process.exit(1);
  }
}

main();
