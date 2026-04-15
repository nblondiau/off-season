# Off-Season

Off-Season is a static React web app for browsing public holidays and school holidays across supported European countries.

## What it does

- Shows public holidays and school holidays on a calendar
- Lets users filter the calendar by country
- Shows holiday coverage details for the selected day and source freshness in the footer
- Publishes as a static site on GitHub Pages

## Source

The app uses a single aggregated provider:

- https://www.openholidaysapi.org

This is not a per-country official government source. It is a third-party open-data aggregation service that provides public holidays and school holidays across many European countries.

## Data sync

`npm run build:data` runs a live-first sync:

- fetches `Countries`, `Subdivisions`, `Groups`, `PublicHolidays`, and `SchoolHolidays` from `OpenHolidays API`
- normalizes the Europe-wide response into `src/generated/dataset.json` and `public/generated/dataset.json`
- writes a cached snapshot to `data/snapshots/openholidays-europe.json`
- falls back to that snapshot if live fetching fails

## Local development

```bash
npm install
npm run build:data
npm run dev
```

## Test and build

```bash
npm test
npm run build
```

`npm run build` refreshes the generated dataset first by running `npm run build:data`, then builds the static site with Vite.

## GitHub Pages

The repository deploys to GitHub Pages through GitHub Actions.

One-time repository setup:

- Enable GitHub Pages and set the source to `GitHub Actions`
- Point your DNS to the custom domain in `public/CNAME`

Deployment flow:

- pushes to `main` run tests and build the static site
- the generated `dist/` artifact is published to GitHub Pages
- the custom domain is kept by shipping `public/CNAME` in the build output

## Repository layout

- `src/`: React app
- `scripts/`: data sync and normalization
- `data/snapshots/`: cached API snapshot for offline rebuilds
- `src/generated/`: generated dataset plus source review build metadata
- `public/generated/`: generated dataset served by the static app at runtime
- `public/CNAME`: custom domain for GitHub Pages
- `.github/workflows/`: GitHub Pages deployment automation
