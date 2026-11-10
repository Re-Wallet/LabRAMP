/**
 * Entidad de dominio: RampOrder
 * Representa una orden de rampa (on-ramp u off-ramp) en el sistema.
 * Es independiente de cualquier framework o librería externa.
 */
class RampOrder {
  constructor({ id, direction, assetCode, assetIssuer, amount, sourceAmount, targetAmount, status, provider, walletAddress, payoutDestination, createdAt, updatedAt, txHash, memo, failureReason }) {
    this.id = id;
    this.direction = direction; // 'onramp' | 'offramp'
    this.assetCode = assetCode;
    this.assetIssuer = assetIssuer;
    this.amount = amount;
    this.sourceAmount = sourceAmount;
    this.targetAmount = targetAmount;
    this.status = status; // 'created' | 'awaiting_deposit' | 'processing' | 'settled' | 'failed' | 'cancelled'
    this.provider = provider;
    this.walletAddress = walletAddress;
    this.payoutDestination = payoutDestination;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.txHash = txHash;
    this.memo = memo;
    this.failureReason = failureReason;
  }

  isSettled() {
    return this.status === 'settled';
  }

  isPending() {
    return ['created', 'awaiting_deposit', 'processing'].includes(this.status);
  }

  isFailed() {
    return ['failed', 'cancelled'].includes(this.status);
  }

  toPlainObject() {
    return {
      id: this.id,
      direction: this.direction,
      assetCode: this.assetCode,
      assetIssuer: this.assetIssuer,
      amount: this.amount,
      sourceAmount: this.sourceAmount,
      targetAmount: this.targetAmount,
      status: this.status,
      provider: this.provider,
      walletAddress: this.walletAddress,
      payoutDestination: this.payoutDestination,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      txHash: this.txHash,
      memo: this.memo,
      failureReason: this.failureReason,
    };
  }
}

module.exports = { RampOrder };
