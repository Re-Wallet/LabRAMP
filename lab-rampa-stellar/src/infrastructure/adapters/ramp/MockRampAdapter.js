/**
 * Adaptador de infraestructura: MockRampAdapter
 * Implementa el puerto RampProvider usando @ramp-kit/core (MockProvider).
 * Simula BRL, MXN, ARS → USDC en sandbox sin dinero real.
 */
const { MockProvider } = require('@ramp-kit/core');

class MockRampAdapter {
  constructor({ region = 'BR', simulateDelayMs = 1000 } = {}) {
    this.provider = new MockProvider({ region, simulateDelayMs });
    this.name = 'mock';
  }

  async listAssets(network = 'stellar') {
    return this.provider.listAssets(network);
  }

  async getQuote(request) {
    return this.provider.getQuote(request);
  }

  async createOrder(quote) {
    return this.provider.createOrder(quote);
  }

  async getOrder(orderId) {
    return this.provider.getOrder(orderId);
  }

  async simulateFiatReceived(orderId) {
    await this.provider.simulateFiatReceived(orderId);
  }

  async simulateFiatPayout(orderId) {
    await this.provider.simulateFiatPayout(orderId);
  }

  async cancelOrder(orderId) {
    return this.provider.cancelOrder(orderId);
  }
}

module.exports = { MockRampAdapter };
