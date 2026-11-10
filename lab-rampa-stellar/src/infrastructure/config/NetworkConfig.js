/**
 * Configuración de redes y activos del laboratorio.
 * Centraliza los valores de testnet y los assets soportados.
 */
const NetworkConfig = {
  networks: {
    testnet: {
      horizon: 'https://horizon-testnet.stellar.org',
      friendbot: 'https://friendbot.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      explorer: 'https://stellar.expert/explorer/testnet',
    },
  },
  assets: {
    usdcCircle: {
      code: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      name: 'Circle USDC Token',
      decimals: 7,
    },
    srt: {
      code: 'SRT',
      issuer: 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B',
      name: 'Stellar Reference Token',
      decimals: 7,
    },
    native: {
      code: 'native',
      issuer: null,
      name: 'XLM',
      decimals: 7,
    },
  },
  anchor: {
    sdfTestnet: 'https://testanchor.stellar.org',
    homeDomain: 'testanchor.stellar.org',
    account: 'GCSGSR6KQQ5BP2FXVPWRL6SWPUSFWLVONLIBJZUKTVQB5FYJFVL6XOXE',
  },
  limits: {
    maxAmountPerTransaction: '10', // USD equivalent for testnet anchor
  },
};

module.exports = { NetworkConfig };
