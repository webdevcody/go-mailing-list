# Codebase Scanning Playbook

Surfaces to inspect when building the feature inventory. Not every project has every surface — skip what doesn't apply. The goal is breadth: missing a surface means missing features.

## Entry Points (start here)

- **HTTP routes / API endpoints** — group by resource, not by file. One resource often = one feature with multiple operations.
- **GraphQL schema** — types and root resolvers map to capabilities.
- **CLI commands / subcommands** — each top-level command is usually a feature.
- **UI routes / pages** — each top-level page or flow is a candidate feature; modals and shared components usually aren't.
- **Webhook receivers** — each external event handled is a feature ("Receive payment confirmation from <provider>" → "Process payment confirmation").
- **Message/queue consumers** — each topic or queue handler.

## Background & Time-Triggered

- **Cron / scheduled jobs** — each is typically a feature ("Nightly billing reconciliation").
- **Long-running workers** — what work do they do, in business terms?
- **Retry/dead-letter handling** — often reveals reliability requirements.

## Cross-Cutting Capabilities

- **Authentication & session management** — sign up, sign in, sign out, password reset, MFA, SSO, session expiry.
- **Authorization** — roles, permissions, ownership rules, multi-tenancy boundaries.
- **Account / organization / team management** — invites, role changes, removal.
- **Billing & payments** — subscriptions, one-time charges, refunds, dunning, plan changes, proration, invoicing, tax.
- **Notifications** — email, SMS, push, in-app — grouped by *trigger event*, not channel.
- **File uploads / storage** — what does the user do with files?
- **Search / filtering / sorting** — often a feature in itself when prominent.
- **Reporting / exports / analytics surfaces** the user sees.
- **Audit log / activity history** if user-visible.
- **Admin / internal tooling** — operator features count too; mark them clearly.

## Integrations

- **Outbound API calls to third parties** — each integration is usually a feature ("Sync contacts to <CRM category>").
- **Inbound webhooks** — already covered above.
- **Data import / export** — CSV, API sync, migrations.

## Data Lifecycle

- **Soft delete / archive / restore**
- **Data retention / purge jobs** — often a compliance feature.
- **GDPR / data subject requests** — export-my-data, delete-my-account.
- **Backup / disaster recovery** — usually operator-facing features.

## Signals That Indicate a Feature Boundary

- A distinct user goal (the user would name it: "Checkout", "Invite teammate")
- A distinct operator goal ("Reconcile payments", "Suspend abusive account")
- A distinct external contract (a third-party expects this behavior)
- A distinct lifecycle (something is created, transitioned, terminated)

## Signals That Are NOT Feature Boundaries

- A new file or class
- A new function or endpoint that is one step in a larger flow
- A shared utility (validation, logging, rate limiting) — these are non-functional concerns
- A framework convention (middleware, controller, repository) — pure implementation

## Mining Edge Cases

Edge cases hide in:

- `if/else` branches inside business logic — each non-trivial branch is a candidate edge case
- error handlers and `catch` blocks — what does the system do on failure?
- validation rules — translate constraints into "the system rejects X because Y"
- retry/idempotency code — reveals "what if this happens twice?" requirements
- feature flags — current variants of behavior; ask the user which are permanent vs. transitional
- comments containing "TODO", "HACK", "XXX", "workaround" — surface to user as Open Questions
