# Budget Tracker

A department budget tracker for the UniKL Royal College of Medicine. It helps departments submit yearly budget requests, get them approved by layers of management, and keep track of invoices (billings) and spending.

Created by the Information Technology Department of UniKL Royal College of Medicine.

## What It Does

- **Budget requests:** Users submit yearly OPEX or CAPEX budget requests with items, costs, and justification. Each request gets an automatic reference number such as `OPX-26-01` or `CPX-26-01`.
- **Approvals:** Requests go through approval steps by the Head of Department (HOD) and Finance. Every action is saved in an activity log.
- **Billings:** Users record supplier invoices, upload the invoice PDF, and track who acknowledged each one.
- **Email invoices:** Invoices can be emailed to recipients from the app.
- **Quotation (RFQ) generator:** Creates request-for-quotation documents as PDF.
- **Reports and calendar:** HOD users can view reports, export them to Excel, and see a calendar of target months.
- **Sign-in:** Users sign in with their email and password, or with Microsoft single sign-on.

## Roles

| Role    | Main pages                                                              |
| ------- | ----------------------------------------------------------------------- |
| User    | Dashboard, Billing, My Department, History, Budget request, RFQ, Calendar |
| HOD     | Dashboard, Billing, Reports, Logs, Settings, Calendar                   |
| Finance | Dashboard, Budget, Billing                                              |

## Tech Stack

- [TanStack Start](https://tanstack.com/start) (React 19 with server functions) and TanStack Router
- TanStack Query for data loading
- TypeScript
- Tailwind CSS and Radix UI components
- MySQL (via `mysql2`)
- Vite, with Nitro for the production build
- Microsoft Graph and Microsoft sign-in, Nodemailer for SMTP, PDFKit and pdf-lib for PDFs, ExcelJS for Excel files

## Project Structure

```
backend/
  core/            Database connection, sessions, auth middleware, env loading
  runtime/         Error capture and error page
  server-functions/ Server logic (budgets, billings, auth, RFQ, reports, etc.)
database/
  schema.sql       Full database schema (use this for a new setup)
  migration/       Changes for databases created before the latest updates
public/            Static images and Lottie animations
src/
  components/      Shared UI and landing page components
  features/        Page content for each role (user, hod, finance)
  lib/             Helpers (auth, PDF stamping, Excel export, route guards)
  routes/          App routes (file-based, managed by TanStack Router)
uploads/           Uploaded invoice PDFs, stored as uploads/{year}/{invoice_ref}.pdf
```

## Getting Started

### Requirements

- Node.js 20 or newer
- npm
- MySQL 8 or newer (or MariaDB)

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

Create an empty database, then load the schema:

```bash
mysql -u root -p -e "CREATE DATABASE money_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p money_tracker < database/schema.sql
```

For an older database that was created before the billing tables were added, run the files in `database/migration/` in date order instead. Do not run them on a database loaded from `schema.sql`, because the tables already exist.

### 3. Set up environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable                   | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `MYSQL_HOST`, `MYSQL_PORT` | Database host and port                                    |
| `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | Database login and name                |
| `SESSION_SECRET`           | Secret used to sign login sessions. Use a long random value. |
| `SMTP_*`                   | Local mail server settings for development                |
| `MICROSOFT_MAIL_FROM`, `MICROSOFT_MAIL_PASSWORD` | Mailbox used to send invoice emails in production |
| `APP_URL`                  | Public address of the app                                 |
| `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI` | Microsoft sign-in settings |

Keep `.env` private. It is listed in `.gitignore`, so it is not committed to Git.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Starts the app in development mode         |
| `npm run build`     | Builds the app for production              |
| `npm run build:dev` | Builds with development settings           |
| `npm run preview`   | Runs the built app locally                 |
| `npm run lint`      | Checks code with ESLint                    |
| `npm run format`    | Formats code with Prettier                 |

## Notes for Developers

- The database design is in `database/schema.sql`. Check it before changing any query or table.
- Server code lives in `backend/`. Browser code must not import from `backend/core` or `backend/runtime`. The build will fail if it does.
- Keep user-facing error messages short, free of technical terms, and include a clear next step.
- Uploaded invoices are saved in `uploads/`. This folder is ignored by Git, so back it up separately.
