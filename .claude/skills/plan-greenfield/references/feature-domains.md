# Feature Domain Checklist

Walk every domain. For each, ask: **"At this product's scale + monetization, does it need anything here?"** Skip *deliberately*, not by forgetting. The non-obvious domains (audit, soft-delete, plan limits, empty states) are where this skill earns its keep.

---

## 1. Identity & access
- Sign up / sign in (email+password, magic link, OAuth providers)
- Email verification
- Password reset / forgot password
- Session management (logout, "log out all devices")
- Account deletion / data export (GDPR)
- Two-factor / MFA
- SSO / SAML (enterprise scale)
- Roles & permissions (admin, owner, member, viewer)
- Invitations (email invites, accept/decline, link invites)
- Workspace / org / team membership

## 2. Core entity lifecycle
- The product's primary noun: create, read, update, archive, delete
- Soft delete + restore + permanent delete
- Drafts vs published states
- Versioning / history / "view changes"
- Duplicate / clone
- Bulk operations (bulk delete, bulk move, bulk tag)
- Templates / starting from a template

## 3. Organization & navigation
- List view, detail view, dashboard
- Folders / collections / projects / spaces
- Tags / labels / categories
- Pinning / favoriting / starring
- Sorting & view preferences (saved per user)
- Breadcrumbs / navigation history

## 4. Search & filter
- Keyword search
- Filter by tag/status/date/owner
- Saved filters / saved searches
- Recently viewed / recently edited
- Global search across entity types
- Advanced search syntax (`status:open author:me`)

## 5. Collaboration
- Sharing (public link, password-protected, expiring)
- Permissions per resource (view/comment/edit)
- Comments / threaded comments / @mentions
- Reactions / emoji
- Real-time presence ("X is viewing")
- Real-time co-editing
- Activity feed per resource

## 6. Notifications
- In-app notification center
- Email notifications + per-type preferences
- Push (mobile/web)
- Digest emails (daily/weekly summary)
- Mute / snooze / do-not-disturb
- @mention notifications
- Watch / subscribe to a resource

## 7. Onboarding & empty states
- First-run welcome / tour
- Sample data / demo workspace
- Empty state CTAs (every list view)
- Setup checklist / progress
- Tooltips & contextual help
- "What's new" / changelog

## 8. Settings & preferences
- Profile (name, avatar, bio)
- Account settings (email, password, connected accounts)
- Notification preferences
- Theme / appearance (light/dark)
- Language / locale / timezone
- Keyboard shortcuts (and customization)
- Data export (JSON, CSV)

## 9. Billing & monetization (skip if free/none-yet)
- Plan tiers (free/pro/team/enterprise)
- Plan limits & usage meters
- Upgrade / downgrade / cancel
- Payment method management
- Invoices / receipts / billing history
- Trial / trial expiration handling
- Coupons / discounts / referrals
- Tax handling (VAT, regional)
- Dunning / failed payment retry

## 10. Admin (workspace-level)
- Member list & role management
- Workspace settings (name, logo, domain)
- Audit log (who did what when)
- Usage dashboard
- Billing as workspace admin
- Domain claim / SSO setup
- Data retention policy

## 11. Platform admin (you, the operator)
- Internal admin panel
- User lookup / impersonate
- Feature flags
- System health dashboard
- Customer support tools
- Refund / credit issuance

## 12. Integrations & API
- REST API / GraphQL
- API keys / personal access tokens
- Webhooks (outgoing events)
- OAuth provider for 3rd parties
- Native integrations (Slack, Zapier, Google, etc.)
- Import from competitors / common formats (CSV, JSON)
- Export (CSV, JSON, PDF)
- Embed / iframe support

## 13. Content-product domains (apply if relevant)
- Rich-text editor (formatting, images, links, code blocks)
- File upload + storage
- Image processing (resize, crop, optimize)
- Video upload / streaming
- Attachments / preview
- AI-assist / suggestions
- Spellcheck / grammar

## 14. Public-facing surfaces
- Marketing landing page
- Pricing page
- Public profile / portfolio page
- Public-facing share pages
- SEO meta + sitemap + structured data
- OG images / link previews
- Custom domains / subdomains

## 15. Reliability & scale
- Rate limiting (per-user, per-IP, per-API-key)
- Soft delete + 30-day recovery window
- Background jobs / async processing
- Email deliverability (SPF/DKIM, bounce handling)
- Backups & restore
- Multi-region / data residency
- Status page

## 16. Analytics & observability
- Per-user analytics ("your stats this month")
- Workspace analytics
- Operator analytics (cohorts, retention, funnels)
- Error tracking integration
- Audit log (security events)
- Activity log (user-facing recent activity)

## 17. Compliance & trust
- Privacy policy / terms / cookie banner
- GDPR data export (user-initiated)
- GDPR deletion (right to be forgotten)
- Data processing agreement (B2B)
- SOC2 / ISO surfaces (security page)
- Consent management

## 18. Mobile / multi-platform (skip if web-only)
- Responsive web
- iOS / Android native
- Desktop (Electron / native)
- Offline mode / sync conflict resolution
- Deep links

## 19. Accessibility & i18n
- Keyboard navigation
- Screen reader support
- Translations (locales)
- RTL languages
- Date/number/currency formatting per locale

---

## How to use this list

1. For each domain, decide *include* or *deliberately skip*.
2. Within an included domain, pick the specific features that match the user's scale + breadth choice.
3. MVP breadth = ~3–5 features per included domain. Exhaustive = ~all of them.
4. A skipped domain should still be mentioned in the final summary ("intentionally deferred: SSO, multi-region, mobile native") so the user can flag if you skipped wrong.
