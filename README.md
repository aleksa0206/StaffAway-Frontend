# StaffAway Frontend

Angular 22 client for [StaffAway-Backend](https://github.com/aleksa0206/StaffAway-Backend): leave requests, approvals and a shared team calendar for a company.

Live: [staffaway.space](https://staffaway.space)

## Screens

- **Home**: who in the company is away today, your upcoming leave and this year's balance.
- **My leave**: your requests and balances, and the new request form, which counts working days.
- **Request detail**: status history, comments, attachments, and approve / reject / cancel depending on who you are.
- **Team calendar**: who is away on which day.
- **Approvals** (Manager, Hr): pending decisions.
- **People** (Manager, Hr): the team list and each person's details; Hr adds and edits people,
  their role, department and manager.
- **Admin** (Hr): company settings, departments, leave types and policies, holidays, API keys,
  audit log.
- **Companies**: the platform view, visible only to the platform administrator.
- **Notifications** and **My account** (profile, two-factor authentication).
- **Sign-up**: create a company, confirm the email, then sign in. Password reset by email.

## Running

```bash
npm install
npm start          # http://localhost:4200, API at http://localhost:4000
npm test           # Vitest (unit)
npm run build      # production build into dist/
```

Set `FRONTEND_URL=http://localhost:4200` in the backend `.env`; it is used for CORS and for the links in verification and password reset emails. The API URL lives in `src/environments/`. With the backend's demo data (`npm run seed:demo` there) you can sign in as the HR, manager or employee it prints.

## Structure

```
src/app/
  core/       api/ (contract models, one service per resource, error normalization), auth/ (session,
              interceptor, guards), unread notification and pending approval counters
  shared/     ui/ (form field, balance table, status badge, pagination, dialogs, toast…), util/
  layout/     shell (sidebar + topbar), auth layout, 403/404
  features/   auth, home, my-leave, leave-requests, calendar, approvals, people, admin, platform,
              notifications, account
src/styles/   _tokens.scss (single source of design values → CSS variables), _mixins, _reset, _base
```

## Decisions that aren't obvious from the code

- **Access token in memory only.** After a page reload the session is restored via the httpOnly
  refresh cookie (`provideAppInitializer` → `POST /auth/refresh` → `GET /auth/me`). On a 401 the
  interceptor does one shared refresh for all parallel requests, because the backend rotates the
  refresh token atomically.
- **No NgRx.** Every page is load → show → change → reload; reads go through `rxResource`, and list
  state (page, filters) lives in the URL and binds to page `input()`s.
- **No UI library.** Only Angular CDK (dialog, menu, clipboard) for accessibility; the look is our
  own, built from the tokens.
- **Roles in the UI only hide actions** (`leave-request-permissions.ts` mirrors the backend rules);
  the backend does the actual enforcement.
- **Leave dates are UTC midnight** and are shown in UTC (`calendarDate`); points in time are shown in
  local time (`timestamp`).
- **The number of request days is computed by the frontend** (working days excluding weekends and
  company holidays, `working-days.ts`); the backend only checks it doesn't exceed the date span.
- **No push channel.** Notification and approval counts are polled while the tab is visible and
  refreshed right after a change.

## Docker

The `Dockerfile` builds the same-origin variant (API under `/api`) and serves it with nginx, which also proxies `/api` to the backend. It is started by the backend's `docker-compose.prod.yaml`. The app is a PWA and can be installed from the browser.
