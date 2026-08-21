# Loyalty-dashboard — Tareas de Roberto

**Leer primero `docs/pos-integration/00_CONTEXTO.md`.**

Este es el dashboard web (`src/pages/`) que usa el dueño del negocio para configurar programas/recompensas y ver analíticas. No toca base de datos — consume la API del backend de `Loyalty-app/backend`.

## 1. Pantalla de vinculación ("Conectar Copo POS") — no existe hoy

Verificado: no hay ningún archivo en `src/pages/` relacionado con pairing/POS/integraciones. El backend para esto **ya está completo** (ver `00_CONTEXTO.md`) — falta solo la pantalla. Construir en `src/pages/Settings.tsx` (o una pantalla nueva enlazada desde ahí):

- Botón "Generar código" → `POST /api/v1/integrations/pos/code` → muestra el código de 8 dígitos grande, con countdown de expiración (10 min por default, ver `LOYALTY_POS_LINK_CODE_TTL_MIN` del lado backend).
- Al cargar la pantalla, consultar `GET /api/v1/integrations/pos/status` para saber si ya está vinculado (`linked: true/false`, `since`).
- Si está vinculado: mostrar desde cuándo, botón "Desvincular" → `DELETE /api/v1/integrations/pos/link`.
- Copy explicando qué pasa con la app Mostrador al vincular (ver `Loyalty-app`, `02_ROBERTO_APP_MOSTRADOR.md`, punto 3) — deja de ser el punto de canje para esa sucursal.

## 2. Formulario de reglas de recompensa

`src/pages/Rewards.tsx` ya existe — **revisar qué tan completo está antes de rehacer nada**. Los campos que el backend ya soporta hoy (`rewardSchema` en `backend/src/routes/rewards.ts`): `type`, `name`, `description`, `pointsRequired`, `startsAt`/`expiresAt`, `usageLimit`, `perUserLimit`, `minTierId`, `config`. Confirmar cuáles de estos ya tiene UI antes de asumir que faltan.

Agregar (cuando Bernardo exponga los campos nuevos, ver su doc en `Loyalty-app/backend`, no antes):

- Selector de disparador: "por conteo de visitas" (el actual) / "por día de la visita" (nuevo, con selector de días de la semana).
- Si es por día: switch "¿se gana más de una vez?" (una sola vez / recurrente) y, si recurrente, switch "si ya tiene uno sin usar: reemplaza / se acumulan".
- Campo de expiración: "¿caduca? ¿en cuántos días después de ganarlo?" (no confundir con `startsAt`/`expiresAt` que ya existen — esos son fechas calendario fijas de la regla, esto es un plazo relativo a cuándo cada cliente la ganó).
- Ventana de canje por día/horario (opcional) — revisar si ya existe un componente de selección de días reusable en el dashboard (`LoyaltyCampaign` ya usa `daysOfWeek`/`timeWindowStart`/`timeWindowEnd`, puede que ya haya un picker construido para campañas que se pueda reusar aquí en vez de construir uno nuevo).
- Contenido del premio: **para v1, dejarlo en texto libre** (ya cubierto por `description`). Se puede dejar preparado el selector de tipo (descuento general / producto o lista) en la UI, pero sin conectar todavía la selección real de catálogo — eso depende de que el negocio tenga POS vinculado y de que Bernardo extienda `PUT /rewards/:rewardId/map` a lista de productos. No construir un selector de catálogo en esta fase.

## 3. Advertencia de UX

Si el dueño configura expiración corta (ej. 5 días) junto con una ventana de canje angosta (ej. solo martes), mostrar un aviso explícito de que esa combinación puede dejar premios prácticamente imposibles de usar a tiempo para el cliente — no dejar que lo descubra por quejas.
