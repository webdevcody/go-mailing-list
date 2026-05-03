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

## SES infrastructure

Terraform for SES lives in `infra/`. It manages the SES domain identity, DKIM, optional MAIL FROM records, SNS bounce topic, Lambda bounce forwarder, Lambda invoke permission, SNS subscription, and SES bounce/complaint notification topics.

The deploy script is designed for the current manually-created setup: it runs `terraform init`, attempts to import existing resources into state, then applies the desired configuration.

```sh
export TF_VAR_aws_region=us-east-1
export TF_VAR_domain_name=wdcstarterkit.com
export TF_VAR_app_url=https://your-production-app.example.com
export TF_VAR_api_token="$PASSWORD"

# Optional, if DNS is hosted in Route53 and should be managed by Terraform.
export TF_VAR_route53_zone_id=Z00000000000000000000

# Optional, if existing manual resources used non-default names.
export TF_VAR_lambda_name=go-mailing-list-bounced-handler
export TF_VAR_sns_topic_name=go-mailing-list-ses-bounces

npm run infra:ses:deploy
```

If `TF_VAR_route53_zone_id` is omitted, Terraform outputs the SES verification and DKIM records so they can be kept wherever DNS is currently managed.
