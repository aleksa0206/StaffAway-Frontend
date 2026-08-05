# StaffAway Frontend

Angular 22 client for [StaffAway-Backend](../StaffAway-Backend) (leave tracking and approval).

## Running

```bash
npm install
npm start          # http://localhost:4200, API at http://localhost:4000
npm test           # Vitest (unit)
npm run build      # production build into dist/
```

Set `FRONTEND_URL=http://localhost:4200` in the backend `.env`; it is used for CORS and for the
link in the password reset email. The API URL lives in `src/environments/`.

## Structure

```
src/app/
  core/       api/ (contract models, one service per resource, error normalization), auth/ (session,
              interceptor, guards), unread notification counter
  shared/     ui/ (form field, balance table, pagination, dialogs, toast…), util/ (pipes, forms)
  layout/     shell (sidebar + topbar), auth layout, 403/404
  features/   auth, leave-requests, approvals, balances, notifications, people, admin, platform, account
src/styles/   _tokens.scss (single source of design values → CSS variables), _mixins, _reset, _base
```

## Decisions that aren't obvious from the code

- **Access token in memory only.** After a page reload the session is restored via the httpOnly
  refresh cookie (`APP_INITIALIZER` → `POST /auth/refresh` → `GET /auth/me`). On a 401 the
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
