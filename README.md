# Mailing List

TanStack Start app for managing subscribers, MJML email templates, SES sends, unsubscribe links, and bounce tracking/removals.

## Requirements

- Node 22.12+
- SQLite file available through `DATABASE_URL`

## Development

```sh
npm install
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Environment

```sh
DATABASE_URL=file:./local.db
HOST_NAME=http://localhost:3000
SENDER_EMAIL="WDC SaaS Starter Kit <no-reply@wdcstarterkit.com>"
PASSWORD=yolo
IS_LOCAL=true
SESSION_COOKIE_SECURE=false
```

`IS_LOCAL=true` logs sends instead of calling SES. In production, remove `SESSION_COOKIE_SECURE=false`.

## Database

The existing SQLite schema is preserved and represented in `src/db/schema.ts`. Do not run a generated migration against an existing production database without first testing it against a copy of the DB.

Useful commands:

```sh
npm run db:pull
npm run db:generate
npm run db:migrate
npm run db:studio
```

For Railway, mount a persistent volume and set `DATABASE_URL` to that SQLite file, for example `file:/data/local.db`.

## Deployment

1. Deploy the Node 22 Docker image or Railway Node service.
2. Set the environment variables above.
3. Configure SES identity/domain records.
4. Keep `lambda/bounced-handler.js` pointed at `/api/bounced` with `API_TOKEN` matching `PASSWORD`. Bounce events flag addresses as bounced, exclude them from bulk sends, and show them in the Subscribers UI for confirmed deletion.
