/**
 * Adaptador de infraestructura: StellarHorizonAdapter
 * Implementa el puerto StellarGateway usando @stellar/stellar-sdk sobre Horizon Testnet.
 */
const { Keypair, Networks, TransactionBuilder, Asset, Operation, TimeoutInfinite, Memo } = require('@stellar/stellar-sdk');
const fetch = require('node-fetch');

class StellarHorizonAdapter {
  constructor({ horizonUrl, networkPassphrase, friendbotUrl }) {
    this.horizonUrl = horizonUrl;
    this.networkPassphrase = networkPassphrase;
    this.friendbotUrl = friendbotUrl;
    this.server = new (require('@stellar/stellar-sdk').Horizon.Server)(horizonUrl);
  }

  async fundAccount(publicKey) {
    const res = await fetch(`${this.friendbotUrl}?addr=${publicKey}`);
    if (!res.ok) throw new Error(`Friendbot failed: ${res.status}`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  async createTrustline({ publicKey, secretKey, assetCode, assetIssuer, limit = '1000' }) {
    const pair = Keypair.fromSecret(secretKey);
    const account = await this.server.loadAccount(publicKey);
    const asset = new Asset(assetCode, assetIssuer);

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({ asset, limit }))
      .setTimeout(TimeoutInfinite)
      .build();

    tx.sign(pair);
    const res = await this.server.submitTransaction(tx);
    return { txHash: res.hash };
  }

  async getTrustlineBalance(publicKey, assetCode, assetIssuer) {
    const account = await this.server.loadAccount(publicKey);
    const balance = account.balances.find(
      (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer
    );
    return {
      exists: !!balance,
      balance: balance ? balance.balance : '0',
    };
  }

  async sendPayment({ sourceSecretKey, destination, assetCode, assetIssuer, amount, memo }) {
    const pair = Keypair.fromSecret(sourceSecretKey);
    const account = await this.server.loadAccount(pair.publicKey());
    const asset = assetCode === 'native' ? Asset.native() : new Asset(assetCode, assetIssuer);

    const txBuilder = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    }).addOperation(
      Operation.payment({ destination, asset, amount })
    );

    if (memo) {
      txBuilder.addMemo(Memo.text(memo));
    }

    const tx = txBuilder.setTimeout(TimeoutInfinite).build();
    tx.sign(pair);

    const res = await this.server.submitTransaction(tx);
    return { txHash: res.hash, status: 'success' };
  }

  async loadAccount(publicKey) {
    const account = await this.server.loadAccount(publicKey);
    return {
      sequenceNumber: account.sequenceNumber,
      balances: account.balances,
    };
  }
}

module.exports = { StellarHorizonAdapter };
