# Plan vigente

## Objetivo

Mantener el dashboard administrativo alineado con Loyalty API, con sesiones seguras, personalización de tarjetas y controles de calidad automatizados.

## Criterios de aceptación

- Un token almacenado solo autentica después de validar `/api/v1/merchant`.
- Cualquier respuesta `401`, incluidos uploads, limpia almacenamiento y estado de sesión.
- Respuestas tardías de sesiones anteriores y fallos transitorios no cierran una sesión nueva o válida.
- La impresión del QR construye nodos DOM y nunca interpola datos del comercio como HTML.
- El selector de color y el diseño de sellos conservan todos los campos existentes del programa.
- `npm run lint`, `npm run typecheck`, `npm run test:run` y `npm run build` pasan localmente y en CI.
- Los artefactos `*.tsbuildinfo` no se versionan.

## Pendientes externos

- Confirmar que Loyalty API persiste `progressDisplay` y `stampImageUrl`.
- Ejecutar smoke test conectado al ambiente de staging antes de promover a producción.
