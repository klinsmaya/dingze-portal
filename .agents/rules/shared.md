# Shared domain rules

Read this when adding or changing code under `shared/`: the artifact catalog, lifecycle, validators, coherence checks, or other domain rules used by both the browser and the server.

## Why this directory exists

The three-responsibility method (catalog, unlock order, states, hard validation, coherence) must be identical in the Portal and on the API. Putting that logic only in `client/` or only in `server/` would duplicate it; wrapping it in a plugin would add a package boundary this application does not need. `shared/` is application-owned isomorphic TypeScript with no Node, DOM, or React imports.

The template's default layout has no `shared/` folder. A future upgrade that recopies `tsconfig.server.json` must keep `shared/**/*.ts` in its `include` list, and must keep `shared/tsconfig.json`. Without the nested config, ESLint's TypeScript project service walks up to the root `tsconfig.json` (client-only) and reports every file as "not found by the project service".

## TypeScript and the build

- `shared/tsconfig.json` exists so ESLint and the editor attach these files to a project, the same way `server/tsconfig.json` and `database/tsconfig.json` do.
- `tsconfig.server.json` includes `shared/**/*.ts` so `pnpm typecheck` and `pnpm build` emit `dist/shared/`. Server imports use a relative specifier with the `.js` extension (`../shared/catalog.js`), matching the rest of `server/`.
- The client TypeScript project stays `client/`-only. Browser code that needs a rule imports the same relative module; Vite bundles it. Do not add a `#shared` specifier unless the existing `#components/` / `#extensions/` pattern is being extended in `package.json` `imports` as well.

## Tests

Tests for shared rules live under `tests/`, never beside the source. Import from `../../shared/...` in those tests.
