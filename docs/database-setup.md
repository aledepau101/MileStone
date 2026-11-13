# Database Setup (Sprint 2)

MileStone stores user accounts and calendar events in a MySQL database instead of the browser's localStorage. This document explains what we chose, how every team member connects, and how we keep credentials out of GitHub.

## 1. Database choice

- **Database:** MySQL, hosted on **TiDB Cloud** (free tier). TiDB is MySQL-compatible.
- **Data access:** **Prisma 6** ORM, with models in `prisma/schema.prisma`.
- **Why:** The team chose MySQL. TiDB Cloud gives us one free, hosted development database that all four members can reach, so a record created by one person is visible to the others. Prisma gives us typed models, versioned migrations, and keeps database code out of the page scripts.
- **Environment:** This is a **development** database. Do not store real user information in it.

## 2. Data model

| Table | Purpose | Key fields |
|---|---|---|
| `User` | Student accounts | `id` (UUID), `name`, `email` (unique), `passwordHash`, `role` (default `student`), `createdAt` |
| `CalendarEvent` | Calendar events and deadlines | `id` (UUID), `userId` (FK to `User`, cascade delete), `title`, `date`, `endDate`, `time`, `endTime`, `location`, `type`, `description`, `createdAt`, `updatedAt` |

One `User` has many `CalendarEvent` rows. There is an index on `(userId, date)`. Passwords are stored only as bcrypt hashes.

## 3. Setting up your computer

You do **not** need a TiDB account to run the app. You only need the connection string.

1. Get the latest code:
   ```
   git checkout main
   git pull
   npm install
   ```
   `npm install` also generates the Prisma client automatically.
2. Create a file named `.env` in the project root (the same folder as `package.json`). Copy `.env.example` and fill in the real value:
   ```
   DATABASE_URL="mysql://USER:PASSWORD@HOST:4000/milestone?sslaccept=strict"
   PORT=3000
   ```
   Ask Alex for the real `DATABASE_URL`. It is shared through a private message only. Save the file as UTF-8 with the quotation marks included.
3. Start the app:
   ```
   npm start
   ```
4. Check the connection by opening `http://localhost:3000/api/health` in your browser. A working setup returns:
   ```
   {"status":"ok","userCount":1}
   ```
   `userCount` is the number of users in the shared database, so it may be higher than 1 as teammates add accounts.

## 4. Keeping credentials out of GitHub

- `.env` is listed in `.gitignore` and must **never** be committed. Only `.env.example`, which contains placeholders, is in the repository.
- The connection string is shared only through a private channel. Do not put it in commits, issues, pull requests, README files, or screenshots.
- Before committing, check what is staged:
  ```
  git status
  git diff --cached --name-only
  ```
  The list must not contain `.env`.
- To confirm `.env` is ignored and not tracked:
  ```
  git check-ignore -v .env
  git ls-files .env
  ```
  The first command should print the `.gitignore` rule. The second should print nothing.
- If a password is ever exposed, reset it immediately in TiDB and send the new connection string to the team. Removing a file from the latest commit does not remove it from Git history.
- Please do not reset the database password unless the team agrees, because it breaks everyone's `.env`.

## 5. Migrations

- The schema is defined in `prisma/schema.prisma`. Migration files are in `prisma/migrations/` and are committed to the repository.
- Apply migrations with:
  ```
  npx prisma migrate deploy
  ```
- We use `migrate deploy` instead of `migrate dev` because `migrate dev` needs permission to create a temporary "shadow" database, which our hosted TiDB database does not allow.
- The initial migration (`0_init`) was generated with `prisma migrate diff` and has already been applied to the shared database. Teammates normally do not need to run it. Only run it after pulling a new migration, and tell the team first, because everyone shares one database.
- If the schema changes, update `schema.prisma`, generate a new migration SQL file with `prisma migrate diff`, review it, commit it, and then apply it.

## 6. Seed data

```
npm run db:seed
```

This creates a demo user (`demo@milestone.example`) and sample events. It uses upserts, so it is safe to run more than once. The demo password is development-only and is defined in `prisma/seed.js`.

## 7. Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `Environment variable not found: DATABASE_URL` | `.env` is missing, is not in the project root, or is saved in the wrong encoding. Recreate it and save as UTF-8. |
| Cannot connect or connection timed out | Your IP address is not allowed in TiDB (Settings > Networking). Ask Alex to add it. |
| Authentication failed | The password in your `.env` is wrong or was reset. Ask Alex for the current string. |
| String is rejected or parsed incorrectly | The string is missing `@` before the host, is missing `/milestone`, or the password contains special characters that need URL encoding. |
| SSL or certificate error | Make sure the string ends with `?sslaccept=strict`. |
| `/api/health` shows `"status":"error"` | Check the terminal running `npm start` for the error message. |

## 8. How this was built

The data model and initial backend files were proposed and generated with GitHub Copilot Agent Mode from our requirements. The team reviewed everything, applied the commands by hand, and verified the result against the real database. The review notes, including what we corrected, are in `docs/ai-design-review.md`.

## 9. Team database verification

Each member runs the setup above and records one database operation they performed. Do not include credentials.

| Member | Connection test performed | Result | Date |
|---|---|---|---|
| Alex | Ran migration, seeded data, checked `/api/health` | Pass: migration applied, demo user seeded, /api/health returned {"status":"ok","userCount":1} | 11/11/26 |
| Zack | | | |
| Lasya | | | |
| Swastik | | | |

For example, a test could be "pulled `main`, created a `.env`, started the app, and `/api/health` returned `ok`", followed later by "signed up a new account and saw it in the database".