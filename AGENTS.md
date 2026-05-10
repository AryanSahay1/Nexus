# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Nexus is a local-first, privacy-centric AI personal assistant **mobile app** (React Native / Expo SDK 50). There is no backend server — all data stays on-device. The repo also contains a native Android/Kotlin build, but the primary development target is the React Native codebase.

### Package manager

Use **npm** with `--legacy-peer-deps` (required due to Expo SDK 50 peer dependency conflicts). The lockfile is `package-lock.json`.

### Development commands

All three must exit 0 before any commit (see README for details):

| Task | Command |
|---|---|
| Type check | `npx tsc --noEmit` |
| Lint | `npx eslint . --ext .ts,.tsx` |
| Unit tests | `npx jest` |

### Running the app

`npx expo start` launches the Metro bundler. The app requires a physical device or emulator to render — it cannot be tested visually on a headless VM. The bundler itself starts fine headlessly and serves the JS bundle on port 8081.

### Environment variables

Copy `.env.example` to `.env`. The only required runtime values (Google Client ID, OpenAI API key) are entered by end users at runtime on-device; they are not needed for linting, type-checking, or unit tests.

### Codebase conventions

- **No `any`**: strict TypeScript with `@typescript-eslint/no-explicit-any: error`.
- **No `console.log`** in `src/`: use the structured logger at `src/utils/logger.ts`.
- **`Result<T, NexusError>`** pattern: service functions return Result types, never throw across module boundaries.
- **Tests before merging**: every service should ship with ≥ 10 unit tests (see `__tests__/unit/`).
