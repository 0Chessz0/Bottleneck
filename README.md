# Bottleneck

Check your PC against game requirements and get rough FPS estimates.

## Download

Get [Bottleneck-v1.exe](https://github.com/0Chessz0/Bottleneck/releases/latest) from Releases and run it. Windows x64, no installation needed. The executable is unsigned.

## How it works

Scan your hardware, pick a game, and check the overview. Requirements and benchmark details have their own tabs. You can edit the hardware profile, add games outside Steam, choose an install drive, or export a report.

FPS estimates currently support **1080p High, native raster**. They are GPU-based and low confidence. CPU performance, VRAM limits, cooling, drivers and game updates can change the result. The range uses a heuristic 40% allowance, not a statistical confidence interval. Unknown hardware or missing data stays unavailable.

## Data

- Steam storefront: game search and published requirements.
- [PCGameBenchmarks](https://github.com/emilioagustin83/pc-game-fps-dataset): model estimates and GPU scores. Matching reference GPUs use the provider estimate; other recognized GPUs use interpolation between reference scores, without extrapolation.
- [SteamFPS](https://steamfps.com/api): Steam Deck and Steam Machine references, shown separately with their provenance and settings.
- [TechFuelHQ / Lowell K. Wood IV](https://techfuelhq.com/data/gpu/rog-astral-rtx-5080-oc-2026-06-09/): measured RTX 5080 test-system results. Small coverage; these are references, not predictions for your PC.

The three FPS datasets are used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Bottleneck filters and reformats their data, and adds interpolation and a range to the PCGameBenchmarks model. Measured reference values are unchanged.

Hardware stays local unless you export it. Game lookups contact Steam and SteamFPS. Optional browser searches send the selected hardware names and settings to Google or YouTube. No API key or account is needed in the app.

## Build

Node.js 24+ and Windows:

```sh
npm ci
npm start
```

```sh
npm test
npm run test:smoke
npm run release
```

The portable executable is written to `release-v1-ready/`. Smoke tests use live data sources.
