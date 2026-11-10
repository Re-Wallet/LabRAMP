/**
 * Entidad de dominio: RampQuote
 * Representa una cotización de rampa (tipo de cambio, fee, monto objetivo).
 */
class RampQuote {
  constructor({ id, provider, request, targetAmount, rate, fees, expiresAt, raw }) {
    this.id = id;
    this.provider = provider;
    this.request = request;
    this.targetAmount = targetAmount;
    this.rate = rate;
    this.fees = fees;
    this.expiresAt = expiresAt;
    this.raw = raw;
  }

  isExpired() {
    return new Date() > new Date(this.expiresAt);
  }

  toPlainObject() {
    return {
      id: this.id,
      provider: this.provider,
      request: this.request,
      targetAmount: this.targetAmount,
      rate: this.rate,
      fees: this.fees,
      expiresAt: this.expiresAt,
      raw: this.raw,
    };
  }
}

module.exports = { RampQuote };
