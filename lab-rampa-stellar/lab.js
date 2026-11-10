import { MockProvider } from '@ramp-kit/core';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollOrder(provider, orderId, label) {
  while (true) {
    const order = await provider.getOrder(orderId);
    console.log(`   [${label}] ${order.id} -> ${order.status}`);
    if (order.status === 'settled') return order;
    if (order.status === 'failed' || order.status === 'cancelled') {
      throw new Error(`Orden ${label} terminó en ${order.status}`);
    }
    await sleep(1000);
  }
}

async function main() {
  const provider = new MockProvider({ region: 'BR' });

  // ---- Descubrir activos ----
  const assets = await provider.listAssets('stellar');
  const usdcAsset = assets.find((a) => a.symbol === 'USDC');
  console.log('Activo USDC descubierto:', usdcAsset.identifier);

  const customerId = 'lab-user-001';
  const walletAddress = 'GA5ZSE...'; // wallet Stellar testnet del usuario (ya creada en labs previos)

  // =========================================================================
  // ON-RAMP: BRL -> USDC
  // =========================================================================
  console.log('\n=== ON-RAMP: BRL -> USDC ===');

  const buyQuote = await provider.getQuote({
    direction: 'onramp',
    fiatCurrency: 'BRL',
    assetIdentifier: usdcAsset.identifier,
    network: 'stellar',
    sourceAmount: '100',
    customerId,
    walletAddress,
  });
  console.log('Cotización:', buyQuote.targetAmount, 'USDC | tasa:', buyQuote.rate, '| fee:', buyQuote.fees, 'BRL');

  const buyOrder = await provider.createOrder(buyQuote);
  console.log('Orden creada:', buyOrder.id, '| estado:', buyOrder.status);
  console.log('Instrucciones depósito fiat:', JSON.stringify(buyOrder.depositInstructions));

  // Simular llegada del fiat (el banco confirmó el depósito PIX/transferencia)
  await provider.simulateFiatReceived(buyOrder.id);
  console.log('Fiat simulado recibido.');

  const settledBuy = await pollOrder(provider, buyOrder.id, 'ON-RAMP');
  console.log('✅ ON-RAMP completado. txHash:', settledBuy.txHash);

  // =========================================================================
  // OFF-RAMP: USDC -> BRL
  // =========================================================================
  console.log('\n=== OFF-RAMP: USDC -> BRL ===');

  const sellQuote = await provider.getQuote({
    direction: 'offramp',
    fiatCurrency: 'BRL',
    assetIdentifier: usdcAsset.identifier,
    network: 'stellar',
    sourceAmount: '10',
    customerId,
    walletAddress,
    payoutDestination: { address: 'mock-pix-key@rampkit.demo' },
  });
  console.log('Cotización:', sellQuote.targetAmount, 'BRL | tasa:', sellQuote.rate, '| fee:', sellQuote.fees, 'BRL');

  const sellOrder = await provider.createOrder(sellQuote);
  console.log('Orden creada:', sellOrder.id, '| estado:', sellOrder.status);

  // Off-ramp: el envío on-chain de USDC se considera hecho; el proveedor pasa a processing
  // y luego settled tras el ramp gap simulado.
  const settledSell = await pollOrder(provider, sellOrder.id, 'OFF-RAMP');
  console.log('✅ OFF-RAMP completado. txHash:', settledSell.txHash);

  // =========================================================================
  // Resumen
  // =========================================================================
  console.log('\n=== RESUMEN DEL LABORATORIO ===');
  console.log('On-ramp:', buyOrder.id, '->', settledBuy.status, '|', buyQuote.sourceAmount, 'BRL ->', settledBuy.quote.targetAmount, 'USDC');
  console.log('Off-ramp:', sellOrder.id, '->', settledSell.status, '|', sellQuote.sourceAmount, 'USDC ->', settledSell.quote.targetAmount, 'BRL');
  console.log('\nEl flujo de conversión fiat <-> USDC sobre Stellar ha sido validado.');
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
