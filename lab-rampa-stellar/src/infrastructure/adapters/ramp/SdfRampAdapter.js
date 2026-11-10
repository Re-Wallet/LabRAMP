/**
 * Adaptador de infraestructura: SdfRampAdapter
 * Implementa el puerto AuthProvider y parcialmente RampProvider usando la API REST
 * del Anchor de referencia de SDF (testanchor.stellar.org) en Testnet.
 *
 * Nota: SEP-6/SEP-24 endpoints de este anchor requieren interacción manual
 * en el navegador para flujos interactivos (SEP-24), por lo que este adaptador
 * cubre autenticación SEP-10 y consulta de información.
 */
const fetch = require('node-fetch');

class SdfRampAdapter {
  constructor({ baseUrl = 'https://testanchor.stellar.org', homeDomain = 'testanchor.stellar.org' } = {}) {
    this.baseUrl = baseUrl;
    this.homeDomain = homeDomain;
  }

  async authenticate(publicKey, clientDomain = this.homeDomain) {
    // Paso 1: obtener challenge SEP-10
    let url = `${this.baseUrl}/auth?account=${publicKey}&home_domain=${this.homeDomain}`;
    let res = await fetch(url);
    let data = await res.json();

    if (!data.transaction) {
      url = `${this.baseUrl}/auth?account=${publicKey}&home_domain=${this.homeDomain}&client_domain=${clientDomain}`;
      res = await fetch(url);
      data = await res.json();
    }

    if (!data.transaction) {
      throw new Error(`No SEP-10 challenge: ${JSON.stringify(data)}`);
    }

    // Paso 2: firmar challenge con la clave del usuario (debe hacerse fuera con stellar-sdk)
    // Este adaptador devuelve el challenge XDR para que el caller lo firme.
    return {
      challengeTransaction: data.transaction,
      authUrl: url,
      homeDomain: this.homeDomain,
      publicKey,
    };
  }

  async verifySignedTransaction(signedXDR) {
    const res = await fetch(`${this.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: signedXDR }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`SEP-10 verify failed: ${res.status} ${errText}`);
    }

    return res.json();
  }

  async getInfo() {
    const res = await fetch(`${this.baseUrl}/info`);
    if (!res.ok) throw new Error(`Anchor info failed: ${res.status}`);
    return res.json();
  }

  async getSep24Info() {
    const res = await fetch(`${this.baseUrl}/sep24/info`);
    if (!res.ok) throw new Error(`SEP-24 info failed: ${res.status}`);
    return res.json();
  }

  async getSep6Info() {
    const res = await fetch(`${this.baseUrl}/sep6/info`);
    if (!res.ok) throw new Error(`SEP-6 info failed: ${res.status}`);
    return res.json();
  }
}

module.exports = { SdfRampAdapter };
