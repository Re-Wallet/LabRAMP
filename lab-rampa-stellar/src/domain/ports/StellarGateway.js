/**
 * Puerto de salida: StellarGateway
 * Define el contrato para interactuar con la red Stellar (Horizon, Friendbot, transacciones).
 * Cualquier adaptador de Stellar (SDK nativo, REST, etc.) debe implementar esto.
 */
class StellarGateway {
  /**
   * Crea y fondea una cuenta de prueba mediante Friendbot.
   * @param {string} publicKey
   * @returns {Promise<void>}
   */
  async fundAccount(publicKey) {
    throw new Error('Method fundAccount() must be implemented by adapter');
  }

  /**
   * Crea una trustline a un activo emitido.
   * @param {Object} account - { publicKey, secretKey, assetCode, assetIssuer, limit }
   * @returns {Promise<{ txHash }>}
   */
  async createTrustline(account) {
    throw new Error('Method createTrustline() must be implemented by adapter');
  }

  /**
   * Verifica si existe una trustline y obtiene el balance.
   * @param {string} publicKey
   * @param {string} assetCode
   * @param {string} assetIssuer
   * @returns {Promise<{ exists, balance }>}
   */
  async getTrustlineBalance(publicKey, assetCode, assetIssuer) {
    throw new Error('Method getTrustlineBalance() must be implemented by adapter');
  }

  /**
   * Envía un pago de activo emitido o XLM nativo.
   * @param {Object} payment - { sourceSecretKey, destination, assetCode, assetIssuer, amount, memo }
   * @returns {Promise<{ txHash, status }>}
   */
  async sendPayment(payment) {
    throw new Error('Method sendPayment() must be implemented by adapter');
  }

  /**
   * Carga el estado de una cuenta desde Horizon.
   * @param {string} publicKey
   * @returns {Promise<{ sequenceNumber, balances }>}
   */
  async loadAccount(publicKey) {
    throw new Error('Method loadAccount() must be implemented by adapter');
  }
}

module.exports = { StellarGateway };
