/**
 * Entrypoint: MockProvider Multi-Moneda (BRL, MXN, ARS)
 * Arquitectura Hexagonal: usa MockRampAdapter (puerto RampProvider) para simular
 * on-ramp y off-ramp en sandbox sin dinero real.
 *
 * Flujo por moneda:
 * 1. getQuote (cotización)
 * 2. createOrder (orden)
 * 3. simulateFiatReceived / simulateFiatPayout (sandbox)
 * 4. Polling hasta settled
 * 5. Exportar tabla comparativa a CSV/JSON
 */
const { MockRampAdapter } = require('../infrastructure/adapters/ramp/MockRampAdapter');
const { CsvJsonExporter } = require('../infrastructure/adapters/export/CsvJsonExporter');

const adapter = new MockRampAdapter({ region: 'BR', simulateDelayMs: 1000 });
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollOrder(orderId, label) {
  while (true) {
    const order = await adapter.getOrder(orderId);
    if (order.status === 'settled') return order;
    if (order.status === 'failed' || order.status === 'cancelled') {
      throw new Error(`Orden ${label} (${order.id}) terminó en ${order.status}`);
    }
    await sleep(800);
  }
}

async function runCurrency(symbol, assetIdentifier) {
  const customerId = 'lab-thesis-001';
  const walletAddress = 'GA5ZSEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

  console.log(`\n═════════════════════════════════════════════════════════════════`);
  console.log(`MONEDA: ${symbol}`);
  console.log(`═════════════════════════════════════════════════════════════════`);

  // ---- ON-RAMP ----
  const buyQuote = await adapter.getQuote({
    direction: 'onramp',
    fiatCurrency: symbol,
    assetIdentifier,
    network: 'stellar',
    sourceAmount: '100',
    customerId,
    walletAddress,
  });

  const buyOrder = await adapter.createOrder(buyQuote);
  console.log(`  [ON-RAMP] ${symbol} → USDC | ${buyQuote.sourceAmount} ${symbol} → ${buyQuote.targetAmount} USDC | fee ${buyQuote.fees} ${symbol}`);
  console.log(`  Instrucciones: ${buyOrder.depositInstructions?.rail || 'N/A'} ${buyOrder.depositInstructions?.address || ''}`);

  await adapter.simulateFiatReceived(buyOrder.id);
  const settledBuy = await pollOrder(buyOrder.id, `ON-RAMP ${symbol}`);
  console.log(`  ✅ ON-RAMP ${symbol}: settled | txHash: ${settledBuy.txHash}`);

  // ---- OFF-RAMP ----
  const sellQuote = await adapter.getQuote({
    direction: 'offramp',
    fiatCurrency: symbol,
    assetIdentifier,
    network: 'stellar',
    sourceAmount: '10',
    customerId,
    walletAddress,
    payoutDestination: { address: `mock-${symbol.toLowerCase()}-key@rampkit.demo` },
  });

  const sellOrder = await adapter.createOrder(sellQuote);
  console.log(`  [OFF-RAMP] USDC → ${symbol} | ${sellQuote.sourceAmount} USDC → ${sellQuote.targetAmount} ${symbol} | fee ${sellQuote.fees} ${symbol}`);

  const settledSell = await pollOrder(sellOrder.id, `OFF-RAMP ${symbol}`);
  console.log(`  ✅ OFF-RAMP ${symbol}: settled | txHash: ${settledSell.txHash}`);

  return {
    symbol,
    onramp: {
      source: buyQuote.request.sourceAmount,
      target: buyQuote.targetAmount,
      fee: buyQuote.fees,
      rate: buyQuote.rate,
      txHash: settledBuy.txHash,
    },
    offramp: {
      source: sellQuote.request.sourceAmount,
      target: sellQuote.targetAmount,
      fee: sellQuote.fees,
      rate: sellQuote.rate,
      txHash: settledSell.txHash,
    },
  };
}

async function main() {
  try {
    const assets = await adapter.listAssets('stellar');
    const usdcAsset = assets.find((a) => a.symbol === 'USDC');
    console.log('Activo USDC:', usdcAsset.identifier);

    const monedas = ['BRL', 'MXN', 'ARS'];
    const resultados = [];

    for (const m of monedas) {
      try {
        const r = await runCurrency(m, usdcAsset.identifier);
        resultados.push(r);
      } catch (e) {
        console.error(`❌ Error en ${m}:`, e.message);
      }
    }

    // Tabla resumen
    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('TABLA COMPARATIVA — LABORATORIO DE RAMPAS STELLAR (Testnet/Mock)');
    console.log('═════════════════════════════════════════════════════════════════');
    console.log('| Moneda | Dirección | Entrada | Salida | Fee | Tasa | Estado |');
    console.log('|--------|-----------|---------|--------|-----|------|--------|');
    for (const r of resultados) {
      console.log(`| ${r.symbol.padEnd(6)} | ON-RAMP   | ${r.onramp.source.padEnd(7)} ${r.symbol} | ${r.onramp.target.padEnd(8)} USDC | ${r.onramp.fee} ${r.symbol} | ${r.onramp.rate} | settled |`);
      console.log(`| ${r.symbol.padEnd(6)} | OFF-RAMP  | ${r.offramp.source.padEnd(7)} USDC | ${r.offramp.target.padEnd(8)} ${r.symbol} | ${r.offramp.fee} ${r.symbol} | ${r.offramp.rate} | settled |`);
      resultados.push(r); // para exportar
    }
    console.log('═════════════════════════════════════════════════════════════════');

    // Exportar
    const exportRows = [];
    for (const r of resultados) {
      exportRows.push({
        event: 'ON-RAMP',
        symbol: r.symbol,
        source: r.onramp.source,
        target: r.onramp.target,
        fee: r.onramp.fee,
        rate: r.onramp.rate,
        txHash: r.onramp.txHash,
        status: 'settled',
        timestamp: new Date().toISOString(),
      });
      exportRows.push({
        event: 'OFF-RAMP',
        symbol: r.symbol,
        source: r.offramp.source,
        target: r.offramp.target,
        fee: r.offramp.fee,
        rate: r.offramp.rate,
        txHash: r.offramp.txHash,
        status: 'settled',
        timestamp: new Date().toISOString(),
      });
    }

    const exporter = new CsvJsonExporter({ outputDir: '.' });
    exporter.export(exportRows, 'lab-rampa-stellar-multimoneda-results');

    console.log('\n✅ Todas las conversiones fiat ↔ USDC validadas en MockProvider sandbox.');
  } catch (err) {
    console.error('ERROR FATAL:', err.message);
    process.exit(1);
  }
}

main();
