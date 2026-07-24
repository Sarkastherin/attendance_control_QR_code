# AGENTS.md

## Project overview

FichaDoor - QR attendance scanner for factory workers. Single-component React app (`src/App.tsx`) that scans QR codes via tablet front camera and sends attendance events to Google Apps Script backend.

## Commands

```bash
npm run dev       # Dev server with HTTPS (basic-ssl plugin), host: true
npm run build     # tsc -b && vite build → dist/
npm run lint      # ESLint (no type-checking)
npm run preview   # Preview production build
```

No test framework configured. No typecheck script (use `npx tsc -b --noEmit` manually).

## Critical: env var mismatch

`src/App.tsx:5` references `import.meta.env.VITE_APPS_SCRIPT_URL` but `.env` defines `VITE_APPS_SCRIPT_URL`. The variable name in code must match `.env`. This is a known discrepancy - verify which is correct before modifying.

## Architecture

- **Frontend**: Single file `src/App.tsx` (~270 lines). No routing, no state management library.
- **Backend**: Google Apps Script `doGet()` - NOT in this repo. Lives at script.google.com. Accepts `?qrId=...&tipoEvento=...` via GET, returns `{ ok, message }`.
- **Database**: Google Sheets with two sheets: `Fichajes_Raw` (full history) and `Estado_Fichajes` (1 row per employee for fast validation).
- **CORS**: Apps Script must be deployed as "Anyone" (anonymous), NOT "Anyone with Google account". POST doesn't work due to CORS redirect - use GET.

## iPad camera (important)

The QR scanner uses `{ facingMode: { exact: "user" } }` (front camera, strict constraint) with `aspectRatio: 1.0`. This configuration is critical for iPad detection - changing `exact` to a plain string or removing `aspectRatio` breaks QR scanning on iPad (iOS 15+) silently (no errors, just no detection).

## Code conventions

- TypeScript with React 19 + React Compiler (babel plugin)
- Tailwind CSS v4 (utility classes only, `@import "tailwindcss"` in index.css)
- No component files - everything in App.tsx
- Version read from `package.json` via `import { version } from "../package.json"`
- Google Fonts loaded in index.html: Space Grotesk (title) + Dancing Script ( Door suffix)
- Language: Spanish (UI text, variable names, commit messages)

## Backend reference (Apps Script)

The `doGet` function is documented in `DOCUMENTACION.md`. Key validation rule: no two consecutive events of same type per employee (entrada must be followed by salida, and vice versa). The script maintains `Estado_Fichajes` for O(1) lookups instead of scanning full history.

## Pending features

See `DOCUMENTACION.md` section 11. Key upcoming: monthly archive to Historial/, absence tracking, labor calendar (Argentine holidays), attendance summary reports.
