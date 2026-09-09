# CRM Email Notification Audit

This checklist tracks email senders that must use the updated Klient Konnect / Rido Sports branded email format and avoid duplicate sends during the GAS-to-Vercel cutover.

## Server-side Vercel email senders

- `/api/email`
  - Communication engine single-send emails.
  - Uses branded HTML wrapper, Montserrat-first font stack, Rido header logo, Klient Konnect footer logo, and clearer table styling.
  - Sends through Gmail API using `GMAIL_SENDER_EMAIL` or `GOOGLE_DELEGATED_USER_EMAIL`.

- `/api/leads`
  - Lead added operational notification plus quotation status transitions.
  - Owner recipient lookup matches the old GAS rule: `Lead Owner` in `Validation Tables` column A, recipient email in column E.
  - Persists `Sent`, `Quotation Update Sent`, or `Quotation Prepared & Update sent` on the exact appended row.
  - `Pre-Qualified - Prepare Quote` emails the sales team; `Pre-Qualified - Quote Ready` emails the owner with an optional quotation link.
  - Guarded by `ENABLE_OPERATIONAL_EMAILS=true`.

- `/api/deals`
  - Deal added operational notification.
  - Create-order path also sends order notification after order row save.
  - Guarded by `ENABLE_OPERATIONAL_EMAILS=true`.
  - Skips rows whose `Notification Status` is already populated and marks successful new notifications as `Sent`.

- `/api/orders`
  - Order updated operational notification.
  - Guarded by `ENABLE_OPERATIONAL_EMAILS=true`.
  - Adds the order-only CC recipient and marks successful new notifications as `Sent`.

- Qualified account transfer
  - A newly qualified lead copied into Accounts sends the Account notification through the same server-side Gmail sender.
  - Marks the appended Account row as `Sent` after a successful send.

## Remaining Apps Script email senders

These must be disabled or migrated before `ENABLE_OPERATIONAL_EMAILS=true` is enabled in Vercel if they overlap with the same event.

- `apps-script/leads/Code.gs`
  - `onFormSubmit(e)` is retained as a non-sending compatibility stub.
  - The installed trigger must remain deleted after `/api/leads` is enabled.

- Legacy `notifyCRMEntry` / `notifyQuotation` Apps Script
  - Its Lead, Deal, Account, Order, and quotation state behavior is now handled at the corresponding server write.
  - Delete its time-driven trigger after deploying the server migration; do not run it alongside the server notifications.

- `apps-script/deals/Code.gs`
  - `onFormSubmit(e)` sends deal notification through `GmailApp.sendEmail`.
  - Disable this trigger once `/api/deals` operational email is confirmed.

- `apps-script/inventory/Code.gs`
  - Sends inventory booking update emails and new booking requirement emails.
  - Still GAS-based and should be migrated separately if inventory notifications need the same Vercel Gmail sender and branded wrapper.

- `apps-script/tenders/Tender Notification/Code.gs`
  - Sends new/update tender notifications and tender reminder emails.
  - Still GAS-based and should be migrated separately if tender emails need the same Vercel Gmail sender and branded wrapper.

- `apps-script/email/Rido - Monthly Report Card/Code.gs`
  - Sends quarterly billing managed summaries and monthly CRM summaries.
  - Still GAS-based and should be migrated separately if report emails need the same Vercel Gmail sender and branded wrapper.

## Cutover rule

Keep `ENABLE_OPERATIONAL_EMAILS` unset or false while old Apps Script event triggers are active.
Enable `ENABLE_OPERATIONAL_EMAILS=true` only after the matching Apps Script trigger is deleted, or during a controlled duplicate-send test.

## Logo requirements

Set `PUBLIC_APP_URL=https://crm.klientkonnect.com` in Vercel so email logos resolve from deployed public assets.
Alternatively set direct public URLs with `RIDO_LOGO_URL` and `KLIENT_KONNECT_LOGO_URL`.
