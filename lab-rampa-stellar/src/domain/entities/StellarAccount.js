/**
 * Entidad de dominio: StellarAccount
 * Representa una cuenta de Stellar con su balance de un activo específico.
 */
class StellarAccount {
  constructor({ publicKey, secretKey, network = 'testnet' }) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
    this.network = network;
    this.balances = [];
  }

  setBalances(balances) {
    this.balances = balances;
  }

  getBalance(assetCode, assetIssuer) {
    const balance = this.balances.find(
      (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer
    );
    return balance ? parseFloat(balance.balance) : 0;
  }

  hasTrustline(assetCode, assetIssuer) {
    return this.balances.some(
      (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer
    );
  }

  toPlainObject() {
    return {
      publicKey: this.publicKey,
      network: this.network,
      balances: this.balances,
    };
  }
}

module.exports = { StellarAccount };
