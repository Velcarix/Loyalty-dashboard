# 03 — Dashboard: Dispositivos de mostrador

> Repo: `Loyalty-dashboard` · Ejecuta: **Codex** · Lee primero `00_CONTEXTO.md`
> Depende de: doc 01 (endpoints `/mostrador/code`, `/mostrador/devices`).

Añadir a `src/pages/Settings.tsx` una `SectionCard` nueva: **"Dispositivos de mostrador"**.

La página ya tiene todo el patrón resuelto: `SectionCard` (línea 5), `api.post` / `api.delete` (`src/lib/api.ts`), y `handleGenerateCode` (línea 77) que hace **exactamente** esto para vincular el POS. Copiar esa forma; no inventar una nueva.

---

## 1. Ubicación

Justo debajo de la sección "Mostrador de visitas" que ya existe (línea 115) — donde se configura `mostradorSessionSeconds`. Es el mismo tema, y así el dueño ve juntos "cuánto dura la sesión" y "qué teléfonos la usan".

---

## 2. Contenido

### 2.1 Lista de dispositivos activos

`GET /api/v1/integrations/pos/mostrador/devices` al montar.

| Etiqueta | Conectado | Último uso | |
|---|---|---|---|
| iPhone de Ana | 12 ago 2026 | hace 3 min | [Revocar] |
| iPad mostrador | 4 jul 2026 | hace 2 días | [Revocar] |

- **"Último uso" es la columna que importa.** Un dispositivo con `lastUsedAt` de hace 3 meses es un teléfono que alguien dejó de usar y sigue autorizado — que se note a simple vista es el punto de tener la lista.
- Vacío: "Ningún teléfono conectado todavía."
- `lastUsedAt: null` → "Nunca".

### 2.2 Botón "Conectar un teléfono"

Abre un modal:

1. Input opcional de etiqueta ("iPhone de Ana"). Sugerir un default; una lista de cuatro "Teléfono" no sirve de nada.
2. `POST /api/v1/integrations/pos/mostrador/code` con `{ label }`.
3. Muestra el **código de 8 dígitos en grande**, monoespaciado, agrupado `0483 1927` para leerlo en voz alta sin equivocarse.
4. **Cuenta atrás visible** hasta `expiresAt` ("Expira en 9:42"). Al llegar a 0: "Código expirado" + botón "Generar otro".
5. Instrucción literal debajo: *"En el teléfono, abre **mostrador.copopos.com** y teclea este código."*
6. **Opcional — QR de conveniencia:** un QR que codifica `https://mostrador.copopos.com/#code=04831927`, para no teclear. Es el **mismo** riesgo que decir el código en voz alta (un solo uso, TTL 10 min), no uno nuevo — pero etiquetarlo *"Este código autoriza un teléfono. No lo compartas."* para que nadie lo mande por WhatsApp pensando que es inocuo.

Cerrar el modal → refrescar la lista.

### 2.3 Revocar

`DELETE /api/v1/integrations/pos/mostrador/devices/:id`, con confirmación de un paso: *"El teléfono «iPhone de Ana» dejará de poder registrar visitas. Esto no borra ninguna visita ya registrada."*

La segunda frase importa: el dueño necesita saber que revocar es seguro, o no va a revocar nunca.

**No** exponer el botón viejo de "revocar todos" (`DELETE /mostrador/device-token`) en esta UI. Existe para la app; aquí solo confundiría.

---

## 3. Detalles

- Estados de carga y error consistentes con el resto de `Settings.tsx`.
- El código de emparejamiento **nunca** se persiste ni se re-muestra: si el dueño cierra el modal, genera otro. Son gratis.
- Textos en español de México, tuteando, sin jerga técnica: "teléfono", no "device"; "conectar", no "provisionar".

---

## 4. Criterios de aceptación

- [ ] Generar código → emparejar un teléfono real → aparece en la lista con su etiqueta
- [ ] "Último uso" se actualiza tras registrar una visita desde ese teléfono
- [ ] Revocar → el teléfono queda fuera en su siguiente acción (lo manda a la pantalla de emparejamiento)
- [ ] Revocar un teléfono no afecta a los demás
- [ ] Código expirado → mensaje claro y camino obvio para generar otro
- [ ] `npm run build` y los tests del repo en verde
