/**
 * Puerto de salida: RampProvider
 * Define el contrato que cualquier adaptador de rampa (Mock, SDF, Etherfuse, etc.)
 * debe implementar para cotizar y ejecutar órdenes de rampa.
 */
class RampProvider {
  /**
   * Descubre activos negociables en la red.
   * @param {string} network - Red blockchain (stellar, solana, etc.)
   * @returns {Promise<Array<{identifier, symbol, network, directions}>>}
   */
  async listAssets(network = 'stellar') {
    throw new Error('Method listAssets() must be implemented by adapter');
  }

  /**
   * Solicita una cotización de rampa.
   * @param {Object} request - { direction, fiatCurrency, assetIdentifier, network, sourceAmount, customerId, walletAddress, payoutDestination }
   * @returns {Promise<{ id, provider, request, targetAmount, rate, fees, expiresAt }>}
   */
  async getQuote(request) {
    throw new Error('Method getQuote() must be implemented by adapter');
  }

  /**
   * Crea una orden a partir de una cotización.
   * @param {Object} quote - Cotización obtenida previamente.
   * @returns {Promise<{ id, direction, status, depositInstructions, ... }>}
   */
  async createOrder(quote) {
    throw new Error('Method createOrder() must be implemented by adapter');
  }

  /**
   * Consulta el estado actual de una orden.
   * @param {string} orderId - ID de la orden.
   * @returns {Promise<{ id, status, txHash, ... }>}
   */
  async getOrder(orderId) {
    throw new Error('Method getOrder() must be implemented by adapter');
  }

  /**
   * Simula la recepción de fiat (sandbox).
   * @param {string} orderId
   */
  async simulateFiatReceived(orderId) {
    throw new Error('Method simulateFiatReceived() must be implemented by adapter');
  }

  /**
   * Simula el pago de fiat de salida (sandbox).
   * @param {string} orderId
   */
  async simulateFiatPayout(orderId) {
    throw new Error('Method simulateFiatPayout() must be implemented by adapter');
  }

  /**
   * Cancela una orden.
   * @param {string} orderId
   */
  async cancelOrder(orderId) {
    throw new Error('Method cancelOrder() must be implemented by adapter');
  }
}

module.exports = { RampProvider };
