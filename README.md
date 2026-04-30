# Panini Album — Mundial 2026

App móvil offline-first para gestionar el álbum Panini del Mundial 2026.
Construida con Expo (iOS + Android).

## Setup

```bash
npm install
npm start
```

Luego presionar `i` para iOS o `a` para Android.

## Scripts

- `npm test` — corre la suite Jest
- `npm run typecheck` — TypeScript en strict mode
- `npm run lint` — Expo lint

## Estructura

- `app/` — rutas de Expo Router
- `src/` — lógica de dominio, datos, UI primitives, hooks
- `assets/stickers.json` — dataset embebido del álbum
- `docs/superpowers/` — specs y plans del proyecto

## Estado actual: P2

- ✅ Browse del álbum, marcar pegadas/repetidas
- ✅ Progreso por sección
- ✅ Buscador y filtros
- ✅ Auth con Google (y Apple en iOS si tenés Developer account)
- ✅ Sync de tu progreso entre dispositivos vía Supabase
- ⏳ Compartir lista de cambios — P3
- ⏳ Amigos + matches — P4
- ⏳ Pulido visual + release — P5

Variables de entorno: copiá `.env.example` a `.env` y completá los valores
del proyecto Supabase + clientes OAuth.
