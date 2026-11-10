/**
 * Caso de uso: OffRampUseCase
 * Orquesta el flujo de venta de cripto por fiat (Crypto → Fiat).
 * Depende únicamente de puertos (interfaces), no de implementaciones concretas.
 */
class OffRampUseCase {
  constructor({ rampProvider, stellarGateway, rampService }) {
    this.rampProvider = rampProvider;
    this.stellarGateway = stellarGateway;
    this.rampService = rampService;
  }

  /**
   * Ejecuta el flujo completo de off-ramp.
   * @param {Object} params
   * @param {string} params.fiatCurrency - Moneda fiat de destino
   * @param {string} params.assetIdentifier - "USDC:ISSUER"
   * @param {string} params.network - "stellar"
   * @param {string} params.sourceAmount - Monto USDC a vender
   * @param {string} params.customerId
   * @param {string} params.walletAddress - Dirección Stellar origen
   * @param {Object} params.payoutDestination - { address, ... }
   * @param {string} params.sourceSecretKey - Clave secreta para firmar envío on-chain
   * @param {boolean} params.simulatePayout - Si se simula el pago fiat de salida (sandbox)
   * @returns {Promise<{ quote, order, onChainTx, result }>}
   */
  async execute(params) {
    const { fiatCurrency, assetIdentifier, network, sourceAmount, customerId, walletAddress, payoutDestination, sourceSecretKey, simulatePayout = true } = params;

    // 1. Solicitar cotización de venta
    const quote = await this.rampProvider.getQuote({
      direction: 'offramp',
      fiatCurrency,
      assetIdentifier,
      network,
      sourceAmount,
      customerId,
      walletAddress,
      payoutDestination,
    });

    // 2. Crear orden de retiro
    const order = await this.rampProvider.createOrder(quote);

    // 3. Enviar cripto on-chain (si hay saldo y clave secreta)
    let onChainTx = null;
    if (sourceSecretKey) {
      const [assetCode, assetIssuer] = assetIdentifier.split(':');
      onChainTx = await this.stellarGateway.sendPayment({
        sourceSecretKey,
        destination: order.depositInstructions?.address || walletAddress,
        assetCode,
        assetIssuer,
        amount: sourceAmount,
        memo: 'LAB-OFFRAMP-REAL',
      });
    }

    // 4. Simular pago fiat de salida (sandbox)
    if (simulatePayout && order.status !== 'failed') {
      await this.rampProvider.simulateFiatPayout(order.id);
    }

    // 5. Polling hasta settlement
    let currentOrder = await this.rampProvider.getOrder(order.id);
    while (currentOrder.status !== 'settled' && currentOrder.status !== 'failed' && currentOrder.status !== 'cancelled') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      currentOrder = await this.rampProvider.getOrder(order.id);
    }

    const result = {
      success: currentOrder.isSettled ? currentOrder.isSettled() : false,
      quote,
      order: currentOrder,
      onChainTx,
      rampGapMs: currentOrder.isSettled ? this.rampService.calculateRampGap(quote.expiresAt, new Date()) : null,
    };

    return { quote, order: currentOrder, onChainTx, result };
  }
}

module.exports = { OffRampUseCase };
