/**
 * Puerto de salida: AuthProvider
 * Define el contrato de autenticación con el anchor (SEP-10).
 */
class AuthProvider {
  /**
   * Obtiene un token de autenticación SEP-10.
   * @param {string} publicKey
   * @param {string} homeDomain
   * @returns {Promise<{ token, account, homeDomain }>}
   */
  async authenticate(publicKey, homeDomain) {
    throw new Error('Method authenticate() must be implemented by adapter');
  }
}

module.exports = { AuthProvider };
