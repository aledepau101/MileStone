# MileStone

MileStone is a web app that helps graduate students plan and track their thesis milestones. The frontend is built with HTML, CSS, and JavaScript. An Express backend and Prisma persistence layer are being added; the existing sign-up, login, and calendar page scripts continue to use localStorage until their API routes are integrated.

## Requirements

- A modern web browser (Chrome, Edge, Firefox, or Safari)
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 18.18 or newer and npm
- A MySQL-compatible TiDB Cloud database with TLS enabled

## Installing Dependencies

Install the Node dependencies from the repository root:
```sh
npm install
```

## Backend setup

1. Copy `.env.example` to `.env` and replace its placeholder values with your TiDB Cloud connection details. Keep `?sslaccept=strict` in `DATABASE_URL`.
2. Generate the Prisma client and apply the checked-in migrations:
   ```sh
   npm run postinstall
   npm run db:migrate
   ```
3. Optionally add the development demo user and two sample events:
   ```sh
   npm run db:seed
   ```
   The seed password is defined in `prisma/seed.js` and is for development only.
4. Start the server:
   ```sh
   npm run dev
   ```
   Open `http://localhost:3000`; `/` redirects to the login page. `GET /api/health` checks the database connection and reports the user count.

The server serves only `/css`, `/js`, and `login.html`, `signup.html`, `dashboard.html`, and `schedule-planner.html`; it does not expose the repository root as static content.

## Database migrations

The initial migration is generated from `prisma/schema.prisma` without a shadow database:
```sh
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/0_init/migration.sql
```

Apply migrations with `npm run db:migrate` (`prisma migrate deploy`). Do not use `prisma migrate dev` with the TiDB Cloud host.

## Running the Application Locally

1. Clone the repo and open it in VS Code:
   ```
   git clone https://github.com/aledepau101/MileStone.git
   cd MileStone
   code .
   ```
2. Complete the [backend setup](#backend-setup).
3. Start the Express server with `npm run dev` and open `http://localhost:3000`.

## Implemented Features
1. **Sign up and log in.** New users can create an account on the signup page and then log in. The signup form checks required fields, email format, an 8-character minimum password, matching passwords, and duplicate emails. Account information is stored in the browser's localStorage. After logging in, the user is taken to the dashboard. Authentication is simulated, and passwords are stored unencrypted, so don't use real passwords.

2. **Schedule Planner.** A logged-in user can create events that appear on both the Month and Week tabs of the calendar. Events can be edited or deleted, and changes show up in both views. Events are saved in localStorage, so they remain after a page refresh.

## Testing the Features

**Automated tests** (sign up, login, and planner logic):
```
node --test
```

**Sign up and log in (manual)**
1. Start the app with `npm run dev` and open `http://localhost:3000/signup.html`.
2. Sign up: enter a name, email, and password (8 or more characters) and submit. You'll be taken to the dashboard.
3. Log in: log in with the same credentials and confirm you reach the dashboard.
4. Invalid login: try a wrong password or an unregistered email. Confirm the app rejects the attempt and shows an error.
5. Validation: submit the signup form with empty fields, a short password, or mismatched passwords. Confirm it shows errors and does not create an account.

**Schedule Planner (manual)**
1. After logging in, open the Schedule Planner page at `http://localhost:3000/schedule-planner.html`.
2. Create: add a new event with a title, date, and time. Confirm it appears on the Month tab on the correct day.
3. Week view: switch to the Week tab and confirm the same event appears on the correct day and time slot.
4. Edit: open the event, change its title or date, and save. Confirm the update shows in both Month and Week views.
5. Delete: delete the event. Confirm it disappears from both views.
6. Persistence: create an event, then refresh the page. Confirm the event is still there.

## AI Usage Disclosure
We used GitHub Copilot (agent mode) and the Figma MCP Server to build the Sprint 1 features. The Figma MCP Server gave Copilot the layout, colors, and components from our Figma frames, and Copilot generated first drafts of the HTML, CSS, JavaScript, and tests from our issues' acceptance criteria. We reviewed all generated code, tested each acceptance criterion by hand and with automated tests (`node --test`), and fixed the problems we found, including a bug where the week view placed early-morning events in the 8 AM row.
