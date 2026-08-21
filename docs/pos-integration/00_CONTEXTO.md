# Integración Loyalty ↔ POS — Contexto compartido

**Fecha:** 2026-08-17. Este archivo es idéntico (o casi) en los 3 repos involucrados, para que cualquier sesión de Claude Code que abra cualquiera de los tres tenga el mismo contexto sin tener que leer los otros dos.

## Decisión de arquitectura

Un solo motor de Loyalty (el standalone, repo `Loyalty-app/backend`) sirve tanto a negocios sin POS (usan la app Mostrador completa) como a negocios con POS de Copo (usan el POS como punto de canje, la app Mostrador deja de ser necesaria para esa sucursal). No hay dos motores ni migración de datos al pasar de uno a otro — un negocio que empieza sin POS y luego lo contrata solo agrega una vinculación (`PosLink`), su cuenta/clientes/puntos siguen intactos.

## Lo que YA ESTÁ CONSTRUIDO (verificado leyendo el código el 2026-08-17 — no reconstruir esto)

Todo esto vive en `Loyalty-app/backend/`:

- **Modelos Prisma** (`prisma/schema.prisma`): `PosLink` (vínculo activo: `merchantId`, `posBusinessId`, `linkTokenHash`, `revokedAt`) y `PosLinkCode` (código de un solo uso: `code`, `expiresAt`, `usedAt`).
- **Generación y canje del código de pairing**: `src/services/pos-link.service.ts` (`generatePairingCode`, `generateLinkToken`, `hashLinkToken`).
- **Endpoints de vinculación**: `src/routes/pos-integrations.ts`
  - `POST /api/v1/integrations/pos/code` (merchantAuth) — genera código de 8 dígitos, TTL 10 min.
  - `POST /api/v1/integrations/pos/link` (sin auth, rate-limited) — lo llama el **backend del POS** con `{ code, posBusinessId, posBusinessName }`, regresa el `linkToken` **una sola vez**.
  - `DELETE /api/v1/integrations/pos/link` — revoca, desde cualquiera de los dos lados.
  - `GET /api/v1/integrations/pos/status` — si está vinculado y desde cuándo.
- **Auth cross-service**: `src/middleware/pos-link-auth.middleware.ts` — header `x-loyalty-link-token`, valida contra `PosLink.linkTokenHash`.
- **Endpoints de operación** (`src/routes/pos.ts`, todos bajo `/api/v1/loyalty/pos/`, autenticados con el link token): `GET /programs`, `POST /lookup`, `GET /rewards`, `POST /accumulate`, `POST /redeem`, `POST /claim-reward`, `POST /reverse`, `POST /reverse-by-order`, `PUT /rewards/:rewardId/map`.
- **Idempotencia de `accumulate`**: vía `eventUuid` + `verificationGrant` (`src/services/verification-grant.service.ts`) — un reintento de red no vuelve a acumular.
- **Reversión por orden**: `POST /reverse-by-order` — ya resuelve el caso "el POS solo conoce el `orderId`, no el `eventUuid` de Loyalty" (comentario textual en el código).
- **Mapeo de recompensa a producto del POS**: `PUT /rewards/:rewardId/map` — el POS empuja `posProductId` + `productName` hacia Loyalty (no al revés — Loyalty no necesita leer el catálogo del POS). **Ojo: hoy solo soporta un producto, no una lista** — ver tareas nuevas.
- **Catálogo de recompensas maduro para modo puntos**: vigencia (`startsAt`/`expiresAt`), `minTierId`, `usageLimit`, `perUserLimit` — todo validado en `redeemReward`.

**Quién inicia el pairing — ya está decidido y construido, no es una pregunta abierta**: se inicia del lado de Loyalty (comentario en el código: "Ajustes → Conectar Copo POS" en la app/dashboard de Loyalty). El backend del POS es quien llama `/link` con el código.

**Corrección importante a versiones previas de esta conversación**: el pairing es **por negocio completo** (`posBusinessId`, `@@unique`), no por sucursal. Si más adelante se necesita granularidad por sucursal, es un cambio de diseño nuevo, no algo ya soportado.

**Lo que NO está construido en ningún lado todavía**: el repo del POS (`Desktop\Copo`) no tiene ninguna integración con este backend standalone. Su `backend/src/index.ts` todavía registra `@copo/loyalty-backend`, el módulo viejo pre-pivot (mismo proceso/DB que el POS) — es código legacy, no construir nada nuevo sobre él.

## Scope actual

Solo recompensas por visitas (no puntos, no bxgy). Se agrega un segundo disparador de recompensa —por día de la visita, además del ya existente por conteo— con recurrencia y expiración configurables por el dueño. **v1 lanza con el contenido del premio en texto libre**, sin automatizar todavía la selección de producto del catálogo ni el descuento aplicado al ticket — eso es una fase posterior.

## División de trabajo

Regla acordada: si toca base de datos, lo ve Bernardo; si no, Roberto; si se puede partir, se parte. En la práctica, casi todo lo fundacional (schema, endpoints, proxy) es Bernardo; Roberto construye las pantallas que consumen esas APIs.

## Dónde está cada pieza

| Repo | Qué hace | Docs de esta integración |
|---|---|---|
| `Desktop\Copo\Copo` | Backend + frontend del POS | `docs/loyalty-integration/` |
| `Nueva carpeta (3)\Loyalty-app` | App Mostrador (sin POS) + backend standalone de Loyalty (motor real) | `docs/pos-integration/` |
| `Nueva carpeta (3)\Loyalty\Loyalty-dashboard` | Dashboard web del dueño de Loyalty (config/analytics) | `docs/pos-integration/` |
