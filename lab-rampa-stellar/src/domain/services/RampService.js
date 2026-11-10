/**
 * Servicio de dominio: RampService
 * Contiene la lógica de negocio pura de rampas (cálculos, validaciones de estado)
 * sin depender de infraestructura externa.
 */
class RampService {
  /**
   * Calcula el monto neto después de aplicar fee.
   * @param {string} sourceAmount - Monto en moneda origen (string decimal).
   * @param {string} fee - Fee en moneda origen (string decimal).
   * @returns {string}
   */
  calculateNetAmount(sourceAmount, fee) {
    const net = parseFloat(sourceAmount) - parseFloat(fee);
    return net.toFixed(7);
  }

  /**
   * Determina si una orden de rampa ha completado su ciclo.
   * @param {string} status
   * @returns {boolean}
   */
  isOrderComplete(status) {
    return status === 'settled' || status === 'completed';
  }

  /**
   * Calcula el "Ramp Gap" estimado: diferencia de tiempo entre estados.
   * @param {Date} startedAt
   * @param {Date} settledAt
   * @returns {number} ms transcurridos
   */
  calculateRampGap(startedAt, settledAt) {
    return new Date(settledAt).getTime() - new Date(startedAt).getTime();
  }

  /**
   * Valida que un monto sea positivo.
   * @param {string} amount
   * @returns {boolean}
   */
  isValidAmount(amount) {
    return parseFloat(amount) > 0;
  }
}

module.exports = { RampService };
