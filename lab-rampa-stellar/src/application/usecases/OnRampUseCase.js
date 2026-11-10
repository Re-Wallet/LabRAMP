/**
 * Caso de uso: OnRampUseCase
 * Orquesta el flujo de compra de cripto con fiat (Fiat → Crypto).
 * Depende únicamente de puertos (interfaces), no de implementaciones concretas.
 */
class OnRampUseCase {
  constructor({ rampProvider, stellarGateway, authProvider, rampService }) {
    this.rampProvider = rampProvider;
    this.stellarGateway = stellarGateway;
    this.authProvider = authProvider;
    this.rampService = rampService;
  }

  /**
   * Ejecuta el flujo completo de on-ramp.
   * @param {Object} params
   * @param {string} params.fiatCurrency - BRL, MXN, ARS, etc.
   * @param {string} params.assetIdentifier - "USDC:ISSUER"
   * @param {string} params.network - "stellar"
   * @param {string} params.sourceAmount - Monto fiat a convertir
   * @param {string} params.customerId
   * @param {string} params.walletAddress - Dirección Stellar destino
   * @param {boolean} params.simulateFiat - Si se simula la recepción de fiat (sandbox)
   * @returns {Promise<{ quote, order, result }>}
   */
  async execute(params) {
    const { fiatCurrency, assetIdentifier, network, sourceAmount, customerId, walletAddress, simulateFiat = true } = params;

    // 1. Solicitar cotización
    const quote = await this.rampProvider.getQuote({
      direction: 'onramp',
      fiatCurrency,
      assetIdentifier,
      network,
      sourceAmount,
      customerId,
      walletAddress,
    });

    // 2. Crear orden
    const order = await this.rampProvider.createOrder(quote);

    // 3. Simular recepción de fiat (sandbox)
    if (simulateFiat && order.status === 'awaiting_deposit') {
      await this.rampProvider.simulateFiatReceived(order.id);
    }

    // 4. Polling hasta settlement
    let currentOrder = await this.rampProvider.getOrder(order.id);
    while (currentOrder.status !== 'settled' && currentOrder.status !== 'failed' && currentOrder.status !== 'cancelled') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      currentOrder = await this.rampProvider.getOrder(order.id);
    }

    const result = {
      success: currentOrder.isSettled ? currentOrder.isSettled() : false,
      quote,
      order: currentOrder,
      rampGapMs: currentOrder.isSettled ? this.rampService.calculateRampGap(quote.expiresAt, new Date()) : null,
    };

    return { quote, order: currentOrder, result };
  }
}

module.exports = { OnRampUseCase };
