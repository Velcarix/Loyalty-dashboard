# Copo Loyalty — Dashboard

Panel web de administración para negocios con Copo Loyalty: login/signup, programas de lealtad (puntos/visitas), recompensas (6 tipos: producto gratis, descuento %, descuento fijo, compra X lleva Y, puntos bonus, exclusivo VIP), clientes, transacciones, detección de anomalías, y vinculación con Copo POS.

Complementa a [Loyalty-app](https://github.com/Velcarix/Loyalty-app) (la app móvil/desktop con la pantalla Mostrador para operar sin POS) — este dashboard es solo administración, no opera cobros ni acumula/canjea en el mostrador.

## Stack

- Vite + React + TypeScript
- React Router v6
- Zustand (estado)
- Tailwind CSS

## Variables de entorno

Copia `.env.example` a `.env`:

```
VITE_LOYALTY_API_URL=https://api-loyalty.copopos.com
```

## Comandos

```bash
npm install
npm run dev        # servidor de desarrollo
npm run build       # build de producción
npm run typecheck
```

## Estructura

```
src/
  pages/       → Login, Signup, ProgramsList, ProgramEditor, ProgramDetailLayout (tabs),
                 Dashboard/Customers/CustomerDetail/Rewards/Transactions/Anomalies, Settings
  store/       → zustand: authStore (merchant), programsStore (programas/clientes/rewards/analytics)
  lib/         → cliente API (fetch + Bearer token en localStorage)
  components/  → Layout (sidebar), ProtectedRoute, WalletPassPreview
```

Backend: el servicio standalone `loyalty-api` (mismo que usa Loyalty-app), endpoints `merchantAuth` bajo `/api/v1/loyalty/programs/*`, `/api/v1/merchant`, `/api/v1/integrations/pos/*`.
