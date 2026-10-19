# TypeORM migrations

The backend uses TypeORM migrations in production instead of `synchronize`. Local/dev can still use `synchronize` (see `database.config.ts`).

## Commands (from `main-backend-vseeds`)

- **Generate a new migration from entity changes** (after editing entities):
  ```bash
  npm run build
  npm run migration:generate -- src/migrations/YourMigrationName
  ```
  This compares the current DB schema to the entities and creates a new file under `src/migrations/`.

- **Run pending migrations** (e.g. in CI or before starting the app in production):
  ```bash
  npm run build
  npm run migration:run
  ```

Ensure `.env` (or environment) has correct `DB_*` and `DATABASE` so the DataSource can connect.

## DataSource

The TypeORM CLI uses `src/data-source.ts` (compiled to `dist/data-source.js`). It points to:

- `entities`: `dist/**/*.entity.js`
- `migrations`: `dist/migrations/*.js`

So migrations must be in `src/migrations/` and are compiled with the rest of the app.
