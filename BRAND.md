# Identidad visual Copo

## Fuente de verdad

Los archivos maestros viven en `C:\Users\Roberto1\Desktop\CopoBrand`.

## Tokens

- Azul Copo: `#2563EB` — acciones primarias, enlaces y foco.
- Azul oscuro: `#1D4ED8` — hover de acciones primarias.
- Tinta: `#0B132B` — texto de alta jerarquía sobre superficies claras.
- Superficie: `#FFFFFF` — navegación, formularios y placas para logos.
- Fondo: `#F7F9FC` — fondo general.

## Logos

- `public/brand/copo-logo-horizontal.png`: navegación y autenticación, siempre sobre blanco.
- `public/brand/copo-mark.png`: favicon e isotipo compacto.
- Los logos de comercios nunca se colocan directamente sobre su color configurable: usan una placa blanca con borde y padding.

## Contraste

El azul Copo pertenece a la interfaz administrativa. `brandColor` pertenece al comercio y solo debe dominar la vista previa/tarjeta. Todo texto sobre `brandColor` debe usar `getTextColorForBg`.
