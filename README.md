# 🧪 LabRAMP — Laboratorio de Rampas Stellar (On-Ramp / Off-Ramp)

> **Estado:** Completado y validado con transacciones on-chain reales en Stellar Testnet.
> **Arquitectura:** Hexagonal (Puertos y Adaptadores / Clean Architecture)
> **Propósito:** Validar el flujo de conversión fiat ↔ USDC sobre Stellar, aislando la lógica de negocio de la infraestructura (SDK, APIs de anchor, exportación).

---

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura Hexagonal](#arquitectura-hexagonal)
   - [Diagrama de Capas](#diagrama-de-capas)
   - [Capa de Dominio (Domain)](#capa-de-dominio-domain)
   - [Capa de Aplicación (Application)](#capa-de-aplicacion-application)
   - [Capa de Infraestructura (Infrastructure)](#capa-de-infraestructura-infrastructure)
   - [Entry Points](#entry-points)
   - [Regla de Dependencias](#regla-de-dependencias)
3. [Estructura del Repositorio](#estructura-del-repositorio)
4. [Entorno de Pruebas](#entorno-de-pruebas)
5. [Cuentas y Credenciales de Testnet](#cuentas-y-credenciales-de-testnet)
6. [Evidencia On-Chain (Transacciones Reales)](#evidencia-on-chain-transacciones-reales)
7. [🔗 Enlaces de Verificación en Stellar Expert (Testnet)](#enlaces-de-verificación-en-stellar-expert-testnet)
8. [Todo lo Verificado (Checklist de Evidencia)](#todo-lo-verificado-checklist-de-evidencia)
9. [Resultados por Fase](#resultados-por-fase)
8. [Cómo Ejecutar el Laboratorio](#cómo-ejecutar-el-laboratorio)
9. [Consideraciones Arquitectónicas](#consideraciones-arquitectónicas)
10. [Consideraciones de Cumplimiento (KYC/AML)](#consideraciones-de-cumplimiento-kyc-aml)
11. [Consideraciones de Riesgo (Ramp Gap)](#consideraciones-de-riesgo-ramp-gap)
12. [Limitaciones Encontradas](#limitaciones-encontradas)
13. [API de Puertos (Interfaces)](#api-de-puertos-interfaces)
14. [Licencia y Uso](#licencia-y-uso)

---

## 🎯 Resumen Ejecutivo

Este laboratorio valida el ciclo completo de una rampa cripto-fiat sobre **Stellar Testnet** usando arquitectura hexagonal, lo que permite intercambiar adaptadores (MockProvider, Anchor SDF real, Horizon SDK) sin modificar la lógica de negocio.

| Flujo | Dirección | Estado | Evidencia |
|-------|-----------|--------|-----------|
| On-Ramp | Fiat simulado → USDC | URL SEP-24 generada | `src/entrypoints/lab-onramp-sdf.js` |
| Off-Ramp | USDC → Cuenta testnet (on-chain real) | ✅ **Ejecutado y verificado** | `src/entrypoints/lab-offramp-usdc-real.js` |
| Off-Ramp Demo | XLM nativo → Anchor SDF | ✅ Ejecutado | `src/entrypoints/lab-onramp-sdf.js` |
| Off-Ramp Mock | USDC → BRL/MXN/ARS | ✅ `settled` (3 monedas) | `src/entrypoints/lab-multimoneda.js` |

**Conclusión clave:** La conversión fiat ↔ USDC sobre Stellar es técnicamente viable usando SEP-6/SEP-24 y trustlines. El punto crítico no es la blockchain, sino la configuración del anchor (trustlines, KYC, rieles fiat).

---

## 🏗️ Arquitectura Hexagonal

El repositorio sigue el patrón **Puertos y Adaptadores** (Hexagonal Architecture), separando la lógica de negocio del dominio de las preocupaciones de infraestructura.

### Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS (Scripts de Lab)                        │
│  lab-offramp-usdc-real.js   lab-onramp-sdf.js   lab-multimoneda.js          │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (usa)
┌─────────────────────────────────────────────────────────────────────────────┐
│                      APLICACIÓN (Casos de Uso)                              │
│  OnRampUseCase.js   OffRampUseCase.js                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (depende de puertos)
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DOMINIO (Entidades y Puertos)                          │
│  Entidades: RampOrder, RampQuote, StellarAccount                            │
│  Puertos:   RampProvider, StellarGateway, AuthProvider                      │
│  Servicio:  RampService (lógica pura)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (implementa puertos)
┌─────────────────────────────────────────────────────────────────────────────┐
│                 INFRAESTRUCTURA (Adaptadores concretos)                     │
│  • StellarHorizonAdapter  (@stellar/stellar-sdk → Horizon)                 │
│  • MockRampAdapter        (@ramp-kit/core → MockProvider)                  │
│  • SdfRampAdapter         (REST → testanchor.stellar.org SEP-10/6/24)      │
│  • CsvJsonExporter        (fs → archivos JSON/CSV)                         │
│  • NetworkConfig          (configuración de redes y activos)               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Regla de Dependencias

```
Domain  →  no depende de nada (puros JS)
Application → depende solo de Domain (puertos)
Infrastructure → depende de Domain e Application (implementa puertos)
Entry Points → depende de Application e Infrastructure (ensambla todo)
```

**Nunca** el dominio importa de infraestructura. **Nunca** la aplicación importa de un adaptador concreto.

---

### Capa de Dominio (Domain)

Contiene las entidades de negocio y los puertos (interfaces). Es independiente de cualquier librería externa.

#### Entidades

| Entidad | Archivo | Responsabilidad |
|---------|---------|-----------------|
| `RampOrder` | `src/domain/entities/RampOrder.js` | Orden de rampa (on-ramp/off-ramp), estados, métodos de consulta (`isSettled`, `isPending`, `isFailed`). |
| `RampQuote` | `src/domain/entities/RampQuote.js` | Cotización de rampa (tipo de cambio, fee, monto objetivo, expiración). |
| `StellarAccount` | `src/domain/entities/StellarAccount.js` | Cuenta Stellar con balances, verificación de trustlines y saldo por activo. |

#### Puertos (Interfaces de Salida)

| Puerto | Archivo | Contrato |
|--------|---------|----------|
| `RampProvider` | `src/domain/ports/RampProvider.js` | `listAssets`, `getQuote`, `createOrder`, `getOrder`, `simulateFiatReceived`, `simulateFiatPayout`, `cancelOrder`. |
| `StellarGateway` | `src/domain/ports/StellarGateway.js` | `fundAccount`, `createTrustline`, `getTrustlineBalance`, `sendPayment`, `loadAccount`. |
| `AuthProvider` | `src/domain/ports/AuthProvider.js` | `authenticate` (SEP-10). |

#### Servicio de Dominio

| Servicio | Archivo | Responsabilidad |
|----------|---------|-----------------|
| `RampService` | `src/domain/services/RampService.js` | Lógica pura: cálculo de monto neto, validación de estados, cálculo de Ramp Gap, validación de montos. |

---

### Capa de Aplicación (Application)

Contiene los casos de uso que orquestan el flujo de negocio usando únicamente puertos.

| Caso de Uso | Archivo | Flujo |
|-------------|---------|-------|
| `OnRampUseCase` | `src/application/usecases/OnRampUseCase.js` | Cotización → creación de orden → simulación de fiat → polling hasta `settled`. |
| `OffRampUseCase` | `src/application/usecases/OffRampUseCase.js` | Cotización → creación de orden → envío on-chain → simulación de payout fiat → polling. |

---

### Capa de Infraestructura (Infrastructure)

Implementa los puertos con tecnología concreta.

| Adaptador | Archivo | Puerto Implementado | Tecnología |
|-----------|---------|---------------------|------------|
| `StellarHorizonAdapter` | `src/infrastructure/adapters/stellar/StellarHorizonAdapter.js` | `StellarGateway` | `@stellar/stellar-sdk` + Horizon Testnet |
| `MockRampAdapter` | `src/infrastructure/adapters/ramp/MockRampAdapter.js` | `RampProvider` | `@ramp-kit/core` (MockProvider) |
| `SdfRampAdapter` | `src/infrastructure/adapters/ramp/SdfRampAdapter.js` | `AuthProvider` | REST → `testanchor.stellar.org` (SEP-10) |
| `CsvJsonExporter` | `src/infrastructure/adapters/export/CsvJsonExporter.js` | (exportación) | Node.js `fs` |
| `NetworkConfig` | `src/infrastructure/config/NetworkConfig.js` | (config) | Constantes de red, assets, límites |

---

### Entry Points

| Script | Archivo | Propósito |
|--------|---------|-----------|
| Off-Ramp USDC Real | `src/entrypoints/lab-offramp-usdc-real.js` | Envía 20 USDC on-chain de cuenta origen a cuenta destino con trustline. |
| On-Ramp SDF | `src/entrypoints/lab-onramp-sdf.js` | Autenticación SEP-10 + generación de URL SEP-24 interactiva. |
| Multi-Moneda Mock | `src/entrypoints/lab-multimoneda.js` | BRL, MXN, ARS → USDC en sandbox (`settled`). |

---

## 📁 Estructura del Repositorio

```
LabRAMPS/
├── README.md                                          # Documentación completa
├── .gitignore                                         # node_modules, logs, etc.
├── package.json                                       # Dependencias (@stellar/stellar-sdk, @ramp-kit/core, node-fetch)
├── package-lock.json
├── lab-rampa-stellar/                                 # Laboratorio refactorizado (arquitectura hexagonal)
│   ├── src/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── RampOrder.js
│   │   │   │   ├── RampQuote.js
│   │   │   │   └── StellarAccount.js
│   │   │   ├── ports/
│   │   │   │   ├── RampProvider.js
│   │   │   │   ├── StellarGateway.js
│   │   │   │   └── AuthProvider.js
│   │   │   └── services/
│   │   │       └── RampService.js
│   │   ├── application/
│   │   │   ├── dto/
│   │   │   └── usecases/
│   │   │       ├── OnRampUseCase.js
│   │   │       └── OffRampUseCase.js
│   │   ├── infrastructure/
│   │   │   ├── adapters/
│   │   │   │   ├── stellar/
│   │   │   │   │   └── StellarHorizonAdapter.js
│   │   │   │   ├── ramp/
│   │   │   │   │   ├── MockRampAdapter.js
│   │   │   │   │   └── SdfRampAdapter.js
│   │   │   │   └── export/
│   │   │   │       └── CsvJsonExporter.js
│   │   │   └── config/
│   │   │       └── NetworkConfig.js
│   │   └── entrypoints/
│   │       ├── lab-offramp-usdc-real.js
│   │       ├── lab-onramp-sdf.js
│   │       └── lab-multimoneda.js
│   └── *.csv / *.json                                 # Resultados exportados por ejecución
└── lab-rampa-stellar/ (versión anterior, raíz)        # Scripts originales (referencia)
    ├── lab.js
    ├── lab-multimoneda.js
    ├── lab-sdf-real.js
    ├── lab-usdc-offramp-real.js
    ├── lab-srt-offramp.js
    └── *.csv / *.json
```

---

## 🌐 Entorno de Pruebas

| Elemento | Valor |
|----------|-------|
| Red | Stellar Testnet |
| Horizon | `https://horizon-testnet.stellar.org` |
| Friendbot | `https://friendbot.stellar.org?addr=<public_key>` |
| Anchor SDF | `https://testanchor.stellar.org` |
| Explorador | `https://stellar.expert/explorer/testnet` |
| Passphrase | `Test SDF Network ; September 2015` |
| SDK | `@stellar/stellar-sdk` (Node.js) |
| Ramp Kit | `@ramp-kit/core` (MockProvider) |

### Activos Soportados

| Asset | Code | Issuer | Red |
|-------|------|--------|-----|
| USDC (Circle) | `USDC` | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | Testnet |
| SRT (SDF) | `SRT` | `GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B` | Testnet |
| XLM (nativo) | `native` | — | Testnet |

---

## 🔑 Cuentas y Credenciales de Testnet

### Cuenta Persistente (Origen)

| Campo | Valor |
|-------|-------|
| Pública | `GA67L2Q2P57MNL6SMDWIVKZVGQN7KN4N43IHM6EHQ3YYWNY2B753C7EW` |
| Seed (privada) | `SCQNLSLDBNYGBVEHX26H476HZRFC74LFOH6H2FSKDWRLRQ6ONVIAZAJZ` |
| Uso | Cuenta de origen para off-ramp USDC real |

> ⚠️ **Nota:** Esta cuenta se usó para enviar 20 USDC en la validación on-chain. Para reejecutar el off-ramp real, debe fondearse nuevamente con USDC de Circle (testnet faucet).

### Cuenta Anchor SDF (Destino original)

| Campo | Valor |
|-------|-------|
| Pública | `GCSGSR6KQQ5BP2FXVPWRL6SWPUSFWLVONLIBJZUKTVQB5FYJFVL6XOXE` |
| Origen | `stellar.toml` de `testanchor.stellar.org` |
| Nota | Cuenta pública del anchor. **No se tiene su seed privada.** |

---

## 🔗 Evidencia On-Chain (Transacciones Reales)

Todas las transacciones son verificables en [Stellar Expert Testnet](https://stellar.expert/explorer/testnet).

### 1. Off-Ramp USDC On-Chain (Validación Principal)

| Campo | Valor |
|-------|-------|
| **Tx Hash** | `89fb30c0e86a6e6b96a2c72f716588214f249e7bf46c724c88322e062a204378` |
| **Origen** | `GA67L2Q2P57MNL6SMDWIVKZVGQN7KN4N43IHM6EHQ3YYWNY2B753C7EW` |
| **Destino** | `GDSASZROO2FMJ3J2W6XRGFRUNWHNFE3SFAAA2HC2UVEZRFZGZDTEECLV` |
| **Activo** | USDC (Circle) |
| **Monto** | 20.0000000 USDC |
| **Memo** | `LAB-OFFRAMP-USDC-REAL` |
| **Saldo origen (antes)** | 20.0000000 USDC |
| **Saldo origen (después)** | 0.0000000 USDC |
| **Saldo destino (después)** | 20.0000000 USDC |
| **Explorador** | https://stellar.expert/explorer/testnet/tx/89fb30c0e86a6e6b96a2c72f716588214f249e7bf46c724c88322e062a204378 |

### 2. Off-Ramp XLM Nativo al Anchor SDF (Demo)

| Campo | Valor |
|-------|-------|
| **Tx Hash** | `8e0f8e57318410807eeba8a829d83af471457a8d23569cfcb01e9fc4afbc713f` |
| **Origen** | `GA67L2Q2P57MNL6SMDWIVKZVGQN7KN4N43IHM6EHQ3YYWNY2B753C7EW` |
| **Destino** | `GCSGSR6KQQ5BP2FXVPWRL6SWPUSFWLVONLIBJZUKTVQB5FYJFVL6XOXE` (Anchor SDF) |
| **Activo** | XLM (nativo) |
| **Monto** | 1.0000000 XLM |

### 3. Trustline USDC (Cuenta Destino Off-Ramp)

| Campo | Valor |
|-------|-------|
| **Tx Hash** | `0ab8e45f9a446f6bfafe42079d8c5c5101c10aeccfed94458b3ab5e8922a3b0c` |
| **Cuenta** | `GDSASZROO2FMJ3J2W6XRGFRUNWHNFE3SFAAA2HC2UVEZRFZGZDTEECLV` |
| **Activo** | USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 |

### 4. Trustline SRT (Cuenta Origen)

| Campo | Valor |
|-------|-------|
| **Tx Hash** | `7dac7d2b20038a832791a3cb2626af16e38202f5f73ed87fa3f989d39cf45922` |
| **Cuenta** | `GA67L2Q2P57MNL6SMDWIVKZVGQN7KN4N43IHM6EHQ3YYWNY2B753C7EW` |
| **Activo** | SRT:GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B |

---

## 🔗 Enlaces de Verificación en Stellar Expert (Testnet)

Todos los links apuntan a **Stellar Expert Testnet** (`https://stellar.expert/explorer/testnet`) y son verificables públicamente.

### Transacciones On-Chain

| # | Transacción | Descripción | Link |
|---|-------------|-------------|------|
| 1 | `89fb30c0e86a6e6b96a2c72f716588214f249e7bf46c724c88322e062a204378` | **Off-Ramp USDC Real** – Envío de 20 USDC (Circle) desde cuenta origen a cuenta destino con trustline USDC. | [Ver en Stellar Expert](https://stellar.expert/explorer/testnet/tx/89fb30c0e86a6e6b96a2c72f716588214f249e7bf46c724c88322e062a204378) |
| 2 | `8e0f8e57318410807eeba8a829d83af471457a8d23569cfcb01e9fc4afbc713f` | **Off-Ramp XLM Demo** – Envío de 1 XLM nativo desde cuenta origen al Anchor SDF (`GCSGSR6KQQ5BP2FXVPWRL6SWPUSFWLVONLIBJZUKTVQB5FYJFVL6XOXE`). | [Ver en Stellar Expert](https://stellar.expert/explorer/testnet/tx/8e0f8e57318410807eeba8a829d83af471457a8d23569cfcb01e9fc4afbc713f) |
| 3 | `0ab8e45f9a446f6bfafe42079d8c5c5101c10aeccfed94458b3ab5e8922a3b0c` | **Trustline USDC (Cuenta Destino)** – Creación de trustline a USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 en la cuenta destino del off-ramp. | [Ver en Stellar Expert](https://stellar.expert/explorer/testnet/tx/0ab8e45f9a446f6bfafe42079d8c5c5101c10aeccfed94458b3ab5e8922a3b0c) |
| 4 | `7dac7d2b20038a832791a3cb2626af16e38202f5f73ed87fa3f989d39cf45922` | **Trustline SRT (Cuenta Origen)** – Creación de trustline a SRT:GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B en la cuenta persistente. | [Ver en Stellar Expert](https://stellar.expert/explorer/testnet/tx/7dac7d2b20038a832791a3cb2626af16e38202f5f73ed87fa3f989d39cf45922) |

### Cuentas en el Explorador

| # | Cuenta Pública | Descripción | Link |
|---|---------------|-------------|------|
| 1 | `GA67L2Q2P57MNL6SMDWIVKZVGQN7KN4N43IHM6EHQ3YYWNY2B753C7EW` | **Cuenta Origen (Persistente)** – Cuenta de testnet con XLM y USDC, usada como origen en el off-ramp real. | [Ver cuenta](https://stellar.expert/explorer/testnet/account/GA67L2Q2P57MNL6SMDWIVKZVGQN7KN4N43IHM6EHQ3YYWNY2B753C7EW) |
| 2 | `GDSASZROO2FMJ3J2W6XRGFRUNWHNFE3SFAAA2HC2UVEZRFZGZDTEECLV` | **Cuenta Destino (Off-Ramp USDC)** – Cuenta creada con Friendbot, trustline USDC, recibió 20 USDC en el off-ramp real. | [Ver cuenta](https://stellar.expert/explorer/testnet/account/GDSASZROO2FMJ3J2W6XRGFRUNWHNFE3SFAAA2HC2UVEZRFZGZDTEECLV) |
| 3 | `GCSGSR6KQQ5BP2FXVPWRL6SWPUSFWLVONLIBJZUKTVQB5FYJFVL6XOXE` | **Anchor SDF** – Cuenta pública del Anchor de referencia de SDF en testnet (según su `stellar.toml`). | [Ver cuenta](https://stellar.expert/explorer/testnet/account/GCSGSR6KQQ5BP2FXVPWRL6SWPUSFWLVONLIBJZUKTVQB5FYJFVL6XOXE) |

---

## ✅ Todo lo Verificado (Checklist de Evidencia)

### On-Chain (Transacciones Reales en Testnet)

- [x] **Creación de cuenta destino** vía Friendbot (fondado con XLM de testnet)
- [x] **Trustline USDC en cuenta destino** – tx: `0ab8e45f...` (ver arriba)
- [x] **Off-ramp USDC on-chain real** – 20 USDC enviados de `GA67L2Q...` a `GDSASZR...`, tx: `89fb30c0...` (ver arriba)
- [x] **Saldo origen USDC:** 20.0000000 → 0.0000000 (verificado en cuenta origen)
- [x] **Saldo destino USDC:** 0.0000000 → 20.0000000 (verificado en cuenta destino)
- [x] **Off-ramp XLM nativo al Anchor SDF** – 1 XLM enviado, tx: `8e0f8e57...` (ver arriba)
- [x] **Trustline SRT en cuenta origen** – tx: `7dac7d2b...` (ver arriba)
- [x] **Autenticación SEP-10 con Anchor SDF** – Token recibido correctamente de `testanchor.stellar.org`

### Off-Chain / Lógica de Negocio (MockProvider Sandbox)

- [x] **On-Ramp BRL → USDC** – 100 BRL → 18.8212927 USDC, estado `settled`
- [x] **Off-Ramp USDC → BRL** – 10 USDC → 52.07 BRL, estado `settled`
- [x] **On-Ramp MXN → USDC** – 100 MXN → 5.4395604 USDC, estado `settled`
- [x] **Off-Ramp USDC → MXN** – 10 USDC → 180.18 MXN, estado `settled`
- [x] **On-Ramp ARS → USDC** – 100 ARS → 0.0782608 USDC, estado `settled`
- [x] **Off-Ramp USDC → ARS** – 10 USDC → 12523.50 ARS, estado `settled`

### Arquitectura y Código

- [x] **Arquitectura Hexagonal implementada** – Domain (entidades, puertos, servicio), Application (use cases), Infrastructure (adaptadores), Entry Points
- [x] **Separación de dependencias** – Domain no depende de infraestructura; Application depende solo de Domain
- [x] **Exportación de resultados** – CSV y JSON generados para cada ejecución
- [x] **README completo** – Documentación de arquitectura, cuentas, evidencia, consideraciones KYC/AML y Ramp Gap

---

## 📊 Resultados por Fase

### Fase 1: Anchor Real SDF (SEP-10 + SEP-6/SEP-24)

Archivo: `src/entrypoints/lab-onramp-sdf.js`

| Evento | Resultado |
|--------|-----------|
| Trustline USDC | ✅ Existente (saldo 20.0000000) |
| SEP-10 Auth | ✅ Token recibido |
| On-Ramp SEP-24 | ⏳ URL generada (pendiente acción manual en navegador) |
| Off-Ramp USDC → Anchor | ❌ 400 Bad Request (anchor no tiene trustline a USDC de Circle) |
| Off-Ramp XLM Demo | ✅ Tx: `8e0f8e57...` |

### Fase 2: Off-Ramp USDC Real On-Chain

Archivo: `src/entrypoints/lab-offramp-usdc-real.js`

| Evento | Resultado |
|--------|-----------|
| Cuenta destino + Friendbot | ✅ Creada y fondeada |
| Trustline USDC destino | ✅ Creada |
| Envío 20 USDC on-chain | ✅ Tx: `89fb30c0...` |
| Saldo origen final | 0.0000000 USDC |
| Saldo destino final | 20.0000000 USDC |

### Fase 3: MockProvider (BRL, MXN, ARS)

Archivo: `src/entrypoints/lab-multimoneda.js`

| Moneda | On-Ramp (Fiat → USDC) | Off-Ramp (USDC → Fiat) |
|--------|----------------------|------------------------|
| BRL | 100 BRL → 18.8212927 USDC (fee 1.00 BRL) | 10 USDC → 52.07 BRL (fee 0.10 BRL) |
| MXN | 100 MXN → 5.4395604 USDC (fee 1.00 MXN) | 10 USDC → 180.18 MXN (fee 0.10 MXN) |
| ARS | 100 ARS → 0.0782608 USDC (fee 1.00 ARS) | 10 USDC → 12523.50 ARS (fee 0.10 ARS) |

**Tasa efectiva:** 0.190114 USDC/BRL, 0.054945 USDC/MXN, 0.000790 USDC/ARS  
**Estado:** Todas las órdenes alcanzaron `settled`.

---

## 🚀 Cómo Ejecutar el Laboratorio

### Prerrequisitos

```bash
cd lab-rampa-stellar
npm install
```

### 1. Off-Ramp USDC Real On-Chain

```bash
node src/entrypoints/lab-offramp-usdc-real.js
```

**Requisito previo:** La cuenta origen debe tener XLM (fees) y USDC (Circle testnet).
- XLM: `https://friendbot.stellar.org?addr=GA67L2Q2P57MNL6SMDWIVKZVGQN7KN4N43IHM6EHQ3YYWNY2B753C7EW`
- USDC: Faucet oficial de Circle testnet → enviar a la cuenta origen.

### 2. On-Ramp con Anchor SDF

```bash
node src/entrypoints/lab-onramp-sdf.js
```

**Resultado:** Se imprime una URL SEP-24 interactiva. El usuario debe abrirla en el navegador, completar KYC (SEP-12) si es requerido, y simular el depósito fiat.

### 3. MockProvider (3 Monedas LATAM)

```bash
node src/entrypoints/lab-multimoneda.js
```

**Resultado:** Ejecuta on-ramp y off-ramp para BRL, MXN y ARS en sandbox, exportando CSV/JSON.

---

## 🏛️ Consideraciones Arquitectónicas

### 1. Separación de Preocupaciones

- **Dominio:** No sabe de Stellar SDK, HTTP, ni archivos. Solo conoce entidades y puertos.
- **Aplicación:** Orquestra casos de uso pero no implementa detalles de red ni persistencia.
- **Infraestructura:** Contiene toda la tecnología concreta (SDK, HTTP, filesystem). Es reemplazable sin tocar dominio ni aplicación.

### 2. Inversión de Dependencias

Los entrypoints ensamblan adaptadores concretos e inyectan dependencias en los casos de uso a través de sus constructores, respetando el principio de inversión de dependencias.

### 3. Testabilidad

Cada capa puede probarse de forma aislada:
- Dominio: pruebas unitarias de `RampService` sin mocks de red.
- Aplicación: pruebas con stubs de puertos.
- Infraestructura: pruebas de integración contra testnet o mocks HTTP.

### 4. Trustlines como Prerrequisito

Tanto remitente como destinatario deben tener una **trustline activa** al activo transferido. Sin ella, el pago falla en Horizon.

### 5. El Anchor es el Punto de Confianza

En producción, el anchor emite/acepta el activo anclado, gestiona rieles fiat (PIX, SPEI, SEPA, SWIFT), implementa KYC/AML (SEP-12) y opera servidores SEP-6/SEP-24.

---

## 🔒 Consideraciones de Cumplimiento (KYC/AML)

| Consideración | Implementación en el Lab | Producción Real |
|---------------|-------------------------|-----------------|
| Identidad de usuario | Simulado (pre-aprobado) | SEP-12, verificación de identidad |
| Límite por transacción | 5-20 USD (controlado por script) | Políticas del anchor, límites regulatorios |
| Memo para trazabilidad | `LAB-ONRAMP-SDF`, `LAB-OFFRAMP-USDC-REAL` | Referencia de pago, ID de orden |
| Registro de transacciones | CSV/JSON exportados | Ledger del anchor, reportes regulatorios |
| PEP/Sanctions | No aplicado en sandbox | Listas de sanciones, screening |

> **Nota:** El KYC se omitió intencionalmente en el sandbox para aislar la validación de la conversión pura. En producción, el orden quedaría bloqueado en `pending_user_transfer_start` hasta aprobación de identidad.

---

## ⚠️ Consideraciones de Riesgo (Ramp Gap)

| Riesgo | Descripción | Mitigación en el Lab |
|--------|-------------|----------------------|
| Fiat reversible vs. Cripto irreversible | El fiat puede devolverse (chargeback), el USDC no | Simulado como "pre-aprobado" |
| Anchor sin trustline al activo | El anchor no puede recibir el activo | Detectado (fallo 400 USDC → SDF) |
| Saldo insuficiente | Cuenta sin fondos para el envío | Verificado antes del envío |
| Webhook duplicado | Notificaciones duplicadas del anchor | Idempotencia por ID de orden |

El **Ramp Gap** es el lapso entre la confirmación fiat (reversible, lenta) y la entrega on-chain (irreversible, rápida). Es donde se concentra el riesgo operativo.

---

## ❌ Limitaciones Encontradas

1. **Anchor SDF sin trustline a USDC de Circle:** No se pudo completar el off-ramp USDC directo al anchor SDF. Se envió XLM nativo como demo en su lugar.
2. **KYC no automatizado:** El on-ramp requiere acción manual en el navegador del anchor (SEP-24 interactivo).
3. **SRT sin saldo:** Se creó trustline a SRT pero no había saldo para enviar.
4. **No hay faucet público de SRT testnet** encontrado durante el lab.

---

## 📁 Archivos Generados (Resultados)

Todos los archivos se encuentran en `lab-rampa-stellar/`:

| Archivo | Contenido |
|---------|-----------|
| `lab-rampa-stellar-sdf-results.json` | Resultados SEP-10 auth + on-ramp URL (JSON) |
| `lab-rampa-stellar-sdf-results.csv` | Resultados SEP-10 auth + on-ramp URL (CSV) |
| `lab-rampa-stellar-usdc-offramp-real-results.json` | Off-ramp USDC on-chain (JSON) |
| `lab-rampa-stellar-usdc-offramp-real-results.csv` | Off-ramp USDC on-chain (CSV) |
| `lab-rampa-stellar-srt-results.json` | Trustline SRT + intento off-ramp (JSON) |
| `lab-rampa-stellar-srt-results.csv` | Trustline SRT + intento off-ramp (CSV) |
| `lab-rampa-stellar-multimoneda-results.json` | MockProvider BRL/MXN/ARS (JSON) |
| `lab-rampa-stellar-multimoneda-results.csv` | MockProvider BRL/MXN/ARS (CSV) |

---

## 📄 Licencia y Uso

Este laboratorio es de uso educativo y de tesis. Todas las claves y cuentas son de **Testnet** (no mainnet). No usar claves de producción en este entorno.

---

**Generado:** 2026-11-10  
**Red:** Stellar Testnet  
**Arquitectura:** Hexagonal (Puertos y Adaptadores)  
**SDK:** `@stellar/stellar-sdk` + `@ramp-kit/core`  
**Evidencia:** Transacciones on-chain verificables en Stellar Expert Testnet
