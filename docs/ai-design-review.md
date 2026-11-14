# AI Design Review (Sprint 2)

This document records AI-generated design decisions for the database layer, and what the team reviewed, accepted, or corrected.

## AI tools used

- **GitHub Copilot Agent Mode:** proposed the data model and file structure, then generated the backend files (Express server, Prisma schema, seed script, migration, `.env.example`).

We gave Copilot a detailed prompt that required it to **propose first and wait for approval** before generating any files, and told it not to read or edit `.env` or connect to the database.

## 1. Copilot's proposal and our review

Copilot proposed two models, `User` and `CalendarEvent`, with a one-to-many relationship and an index on `(userId, date)`. We checked it against our existing forms (`signup.js`, `schedule-planner.js`) and `planner-logic.js`. The field names matched, so we accepted the model.

## 2. Decisions we corrected or changed

1. **Migration approach.** An early AI suggestion was to create the first migration with `prisma migrate dev`. That command needs permission to create a temporary shadow database, which our hosted TiDB database does not allow. We switched to generating the migration SQL with `prisma migrate diff` and applying it with `prisma migrate deploy`.
2. **Prisma version.** Newer Prisma versions use a different configuration approach. We pinned Prisma to version 6 so everyone uses the same setup, and told Copilot not to use Prisma 7.
3. **Database name.** TiDB's connect screen defaulted to the `sys` database, which is a built-in system schema. We created a dedicated `milestone` database instead.
4. **Static file serving.** We required the server to serve only `/css`, `/js`, and the four HTML pages. Serving the whole project folder would expose `.env` and `package.json`. We verified that requesting `/.env` in the browser fails.
5. **Health check response.** Our early documentation assumed the health route returned `"database":"connected"` and a `users` field. The generated server actually returns `{"status":"ok","userCount":N}`. We tested the real route and corrected our documentation and pull request description to match.

## 3. Assumptions made by AI that we reviewed

- The seed script uses a fixed development-only demo password. It must not be reused outside development.
- `role` uses `VARCHAR(30)`; allowed values are enforced in the API, not the database.
- The seed's sample events use fixed dates and IDs, and re-running the seed does not overwrite edits.
- Passwords are stored only as bcrypt hashes. We confirmed this by querying the `User` table.

## 4. What we verified ourselves

- Read the generated migration SQL and confirmed the tables, unique email index, `(userId, date)` index, and `ON DELETE CASCADE` foreign key.
- Applied the migration to the shared TiDB database with `prisma migrate deploy` and confirmed the tables in the TiDB SQL Editor.
- Ran the seed script and confirmed the demo user's `passwordHash` is a bcrypt hash.
- Started the server and confirmed `/api/health` returns `ok`.
- Confirmed `.env` is ignored and not tracked by Git.
