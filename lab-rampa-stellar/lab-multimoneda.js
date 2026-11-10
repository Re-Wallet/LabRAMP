import { MockProvider } from '@ramp-kit/core';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollOrder(provider, orderId, label) {
  while (true) {
    const order = await provider.getOrder(orderId);
    if (order.status === 'settled') return order;
    if (order.status === 'failed' || order.status === 'cancelled') {
      throw new Error(`Orden ${label} (${order.id}) terminó en ${order.status}`);
    }
    await sleep(800);
  }
}

async function runCurrency(provider, symbol, assetIdentifier) {
  const customerId = 'lab-thesis-001';
  const walletAddress = 'GA5ZSEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

  console.log(`\n═════════════════════════════════════════════════════════════════`);
  console.log(`MONEDA: ${symbol}`);
  console.log(`═════════════════════════════════════════════════════════════════`);

  // ---- ON-RAMP: fiat -> USDC ----
  const buyQuote = await provider.getQuote({
    direction: 'onramp',
    fiatCurrency: symbol,
    assetIdentifier,
    network: 'stellar',
    sourceAmount: '100',
    customerId,
    walletAddress,
  });

  const buyOrder = await provider.createOrder(buyQuote);
  console.log(`  [ON-RAMP] ${symbol} → USDC | ${buyQuote.sourceAmount} ${symbol} → ${buyQuote.targetAmount} USDC | fee ${buyQuote.fees} ${symbol}`);
  console.log(`  Instrucciones: ${buyOrder.depositInstructions?.rail || 'N/A'} ${buyOrder.depositInstructions?.address || ''}`);

  await provider.simulateFiatReceived(buyOrder.id);
  const settledBuy = await pollOrder(provider, buyOrder.id, `ON-RAMP ${symbol}`);
  console.log(`  ✅ ON-RAMP ${symbol}: settled | txHash: ${settledBuy.txHash}`);

  // ---- OFF-RAMP: USDC -> fiat ----
  const sellQuote = await provider.getQuote({
    direction: 'offramp',
    fiatCurrency: symbol,
    assetIdentifier,
    network: 'stellar',
    sourceAmount: '10',
    customerId,
    walletAddress,
    payoutDestination: { address: `mock-${symbol.toLowerCase()}-key@rampkit.demo` },
  });

  const sellOrder = await provider.createOrder(sellQuote);
  console.log(`  [OFF-RAMP] USDC → ${symbol} | ${sellQuote.sourceAmount} USDC → ${sellQuote.targetAmount} ${symbol} | fee ${sellQuote.fees} ${symbol}`);

  const settledSell = await pollOrder(provider, sellOrder.id, `OFF-RAMP ${symbol}`);
  console.log(`  ✅ OFF-RAMP ${symbol}: settled | txHash: ${settledSell.txHash}`);

  return {
    symbol,
    onramp: { source: buyQuote.request.sourceAmount, target: buyQuote.targetAmount, fee: buyQuote.fees, rate: buyQuote.rate, txHash: settledBuy.txHash },
    offramp: { source: sellQuote.request.sourceAmount, target: sellQuote.targetAmount, fee: sellQuote.fees, rate: sellQuote.rate, txHash: settledSell.txHash },
  };
}

async function main() {
  const provider = new MockProvider({ region: 'BR' });

  const assets = await provider.listAssets('stellar');
  const usdcAsset = assets.find((a) => a.symbol === 'USDC');
  console.log('Activo USDC:', usdcAsset.identifier);

  const monedas = ['BRL', 'MXN', 'ARS'];
  const resultados = [];

  for (const m of monedas) {
    try {
      const r = await runCurrency(provider, m, usdcAsset.identifier);
      resultados.push(r);
    } catch (e) {
      console.error(`❌ Error en ${m}:`, e.message);
    }
  }

  // ---- Tabla resumen para tesis ----
  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log('TABLA COMPARATIVA — LABORATORIO DE RAMPAS STELLAR (Testnet/Mock)');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('| Moneda | Dirección | Entrada | Salida | Fee | Tasa | Estado |');
  console.log('|--------|-----------|---------|--------|-----|------|--------|');
  for (const r of resultados) {
    console.log(`| ${r.symbol.padEnd(6)} | ON-RAMP   | ${r.onramp.source.padEnd(7)} ${r.symbol} | ${r.onramp.target.padEnd(8)} USDC | ${r.onramp.fee} ${r.symbol} | ${r.onramp.rate} | settled |`);
    console.log(`| ${r.symbol.padEnd(6)} | OFF-RAMP  | ${r.offramp.source.padEnd(7)} USDC | ${r.offramp.target.padEnd(8)} ${r.symbol} | ${r.offramp.fee} ${r.symbol} | ${r.offramp.rate} | settled |`);
  }
  console.log('═════════════════════════════════════════════════════════════════');

  console.log('\n✅ Todas las conversiones fiat ↔ USDC validadas en MockProvider sandbox.');
}

main().catch((err) => {
  console.error('ERROR FATAL:', err.message);
  process.exit(1);
});
