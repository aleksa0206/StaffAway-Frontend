# StaffAway Frontend

Angular client for [StaffAway-Backend](https://github.com/aleksa0206/StaffAway-Backend): leave requests, approvals and a team calendar.

Live: [staffaway.space](https://staffaway.space)

## Screens

- Home: who is away today, your upcoming leave and balance
- My leave: your requests and the new request form (counts working days)
- Request detail: status history, comments, attachments, approve/reject/cancel
- Team calendar
- Approvals (Manager, Hr)
- People (Manager, Hr): team list, Hr can add and edit people
- Admin (Hr): company settings, departments, leave types, holidays, API keys, audit log
- Notifications, account with 2FA, sign-up with email confirmation

## Running locally

```bash
npm install
npm start          # http://localhost:4200, API on http://localhost:4000
npm test
npm run build
```

Set `FRONTEND_URL=http://localhost:4200` in the backend `.env`. API URL is in `src/environments/`. With the backend demo data (`npm run seed:demo`) you can log in as the HR, manager or employee it prints.

## Structure

```
src/app/
  core/       API services, auth (session, interceptor, guards), notification counters
  shared/     UI components and helpers
  layout/     shell (sidebar + topbar), auth layout, 403/404
  features/   auth, home, my-leave, leave-requests, calendar, approvals, people, admin,
              platform, notifications, account
src/styles/   tokens, mixins, base styles
```

## Notes

- Access token is only in memory, the session is restored from the refresh cookie on reload. Parallel 401s share one refresh.
- No NgRx and no UI library, just `rxResource` and Angular CDK. List filters and page live in the URL.
- Roles in the UI only hide buttons (`leave-request-permissions.ts`), the backend does the real checks.
- Number of leave days is calculated on the frontend (`working-days.ts`, skips weekends and company holidays). The backend only checks it's not bigger than the date range.
- Notifications are polled while the tab is visible, there's no websocket.

## Docker

The `Dockerfile` builds the app and serves it with nginx, which proxies `/api` to the backend. It's started from the backend's `docker-compose.prod.yaml`.
