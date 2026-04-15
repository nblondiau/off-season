# AGENTS.md

## Purpose

This repository builds the Off Season web app: a static React application that shows public holidays and school holidays across the supported European countries.

## Working rules

- Treat `scripts/build-data.mjs` as the source of truth for generated calendar data.
- Do not hand-edit `src/generated/dataset.json`, `public/generated/dataset.json`, or `src/generated/source-review.json`.
- When changing source parsing or normalization, rerun `npm run build:data`.
- The app currently uses `OpenHolidays API` as a single aggregated provider.
- Do not describe the current provider as an official government source.

## Commands

- Install dependencies: `npm install`
- Run the dev server: `npm run dev`
- Refresh data: `npm run build:data`
- Run tests: `npm test`
- Build production assets: `npm run build`

## Data refresh expectations

- The build script should fetch live OpenHolidays API data first.
- If the remote API is unavailable, the script should fall back to `data/snapshots/openholidays-europe.json`.
- `npm run build` already runs `npm run build:data` before the Vite production build.
- If you change the normalized dataset shape, update both the generator and the frontend types in `src/types.ts`.

## Implementation notes

- Keep the frontend static-host friendly. Do not introduce a runtime backend unless explicitly requested.
- GitHub Pages is the only supported production hosting target.
