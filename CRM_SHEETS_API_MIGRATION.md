# CRM Sheets API Migration

This branch starts moving the core CRM pipeline away from browser-to-Google-Apps-Script calls.

## Vercel Environment Variables

Set these in Vercel before deploying the new API routes:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

Optional overrides:

- `LEADS_SHEET_ID`
- `ACCOUNTS_SHEET_ID`
- `DEALS_SHEET_ID`
- `ORDERS_SHEET_ID`
- `COSTING_SHEET_ID`
- `INVENTORY_SHEET_ID`
- `INVENTORY_BOOKING_REQUIREMENT_TO`
- `INVENTORY_BOOKING_STATUS_CC`
- `SALES_TRACKER_SHEET_ID`
- `VALIDATION_SHEET_ID`
- `EMAIL_SHEET_ID`
- `EMAIL_TEMPLATE_FOLDER_ID`
- `RIDO_LOGO_URL`
- `KLIENT_KONNECT_LOGO_URL`
- `PUBLIC_APP_URL`
- `EMAIL_ASSET_BASE_URL`
- `GMAIL_SENDER_EMAIL`
- `GOOGLE_DELEGATED_USER_EMAIL`
- `GOOGLE_DRIVE_DELEGATED_USER_EMAIL` (optional Drive-specific delegated uploader; otherwise uses `GOOGLE_DELEGATED_USER_EMAIL` or `GMAIL_SENDER_EMAIL`)
- `CRM_SESSION_SECRET` (recommended signing secret for authenticated draft uploads; otherwise the existing Google private key is used)
- `OPERATIONAL_EMAIL_CC`
- `OPERATIONAL_REPLY_TO`
- `CRM_CALENDAR_URL`
- `ENABLE_OPERATIONAL_EMAILS` (`true` enables server-side lead/deal/order/inventory emails)
- `LEAD_UPDATE_FORM_URL`
- `ORDER_UPLOAD_FOLDER_ID`
- `ORDER_PO_FOLDER_ID`
- `ORDER_DRAWING_FOLDER_ID`
- `ORDER_BOQ_FOLDER_ID`
- `ORDER_PROFORMA_FOLDER_ID`
- `NOMENCLATURE_FOLDER_ID`

The service account must have access to the relevant Google Sheets and Drive folders.
Enable Google Sheets API and Google Drive API in the Google Cloud project.

## New API Routes

- `/api/leads`
- `/api/accounts`
- `/api/deals`
- `/api/orders`
- `/api/sales-tracker`
- `/api/order-invoices?orderId=...`
- `/api/nomenclature`
- `/api/email`
- `/api/costing`
- `/api/inventory`

The frontend modules for Leads, Lead Form, Accounts, Deals, Orders, and Sales Tracker now call these same-origin routes instead of deployed Apps Script URLs.

Costing now runs entirely through the server-side Sheets API. `/api/costing` handles cost sheets, line items, advances, expense requests, approvals, mapping, sync, and CSV/XLSX/PDF exports. No costing request uses Apps Script or `COSTING_GAS_URL`. See [COSTING_NATIVE_API.md](COSTING_NATIVE_API.md) for rollout, behavior, and verification details.

Stock Management and Inventory Booking use `/api/inventory` for validation, SKU, calculation configuration, stock, bookings, reservations, releases, dispatches, transfers, stock mutations, and booking notifications. These requests use same-origin JSON and no longer require the inventory Apps Script web app or JSONP callbacks. Keep the old web-app deployment active only until the native route and service-account access have been verified in production, then disable that deployment.

The Apps Script project itself remains active solely for its installed `releaseExpiredBookings` time trigger. Keep that trigger and its supporting functions in place; do not replace or disable the scheduler as part of the frontend/API migration.

Lead saves through `/api/leads` now generate or reuse `Lead ID` values and copy leads with `Lead Status = Qualified` into the Accounts sheet.
Quick leads created from the communication module use the same `/api/leads` pipeline.

Operational lead/deal/order notifications now send from the Vercel API flow instead of Apps Script triggers.
Owner recipient lookup follows the old Apps Script rule: match `Lead Owner` / `Account Owner` against column A of `Validation Tables` and send to column E.
By default, operational emails CC `Holy@klientkonnect.com,Sidhant@ridosports.com,Sandeep@ridosports.com`; override with `OPERATIONAL_EMAIL_CC`.
Project group recipients use separate `Project CC` and `Project BCC` columns in the common Validation Tables sheet. They never fall back to shared CC/BCC lists or `OPERATIONAL_EMAIL_CC`. Order notifications also append the dynamic `Project CC` group to their operational CC list, so that shared recipient list does not need to be hardcoded. See [Project notification group](PROJECT_EMAIL_RECIPIENTS.md) for sheet setup before deployment.
Remove the installed `notifyCRMEntry` trigger from the legacy CRM Notifications Apps Script project after enabling native operational emails. Saving the current script and running `disableLegacyOperationalEmailTriggers` once removes that trigger. In the Deals Apps Script project, run `disableLegacyDealEmailTriggers` once to remove the obsolete `onFormSubmit` mailer. Neither cleanup function accesses the Inventory project or its required `releaseExpiredBookings` scheduler.
Set `ENABLE_OPERATIONAL_EMAILS=true` only after the old Apps Script lead/deal/order email triggers are disabled or you intentionally want to test for duplicates.
When this value is unset, server-side operational emails stay disabled so record saves cannot accidentally create duplicate notifications while Apps Script triggers remain active.

## Communication Engine

The single-send communication module now uses `/api/email` instead of the old Apps Script deployment for templates, preview, template versioning, lead lookup, quick lead creation, email logs, and single email send.
Email sending on Vercel requires Gmail API domain-wide delegation for the service account and `GMAIL_SENDER_EMAIL` or `GOOGLE_DELEGATED_USER_EMAIL`.
Order and tender attachment uploads use the delegated Workspace user configured by `GOOGLE_DRIVE_DELEGATED_USER_EMAIL`, falling back to `GOOGLE_DELEGATED_USER_EMAIL` and then `GMAIL_SENDER_EMAIL`. Authorize the Drive scope for that service account delegation and give the delegated user access to the configured upload folders. Shared Drive folders remain supported.
Order attachments upload individually as soon as they are selected. The authenticated upload route returns a signed draft receipt so users can remove only their own current draft attachment before submitting the order.
Outgoing emails are wrapped in a branded layout. The Vercel Gmail sender embeds `/assets/rido-sports-logo.png` and `/assets/kk-logo.png` as inline email images when those public assets are available in the deployment. Set `RIDO_LOGO_URL` or `KLIENT_KONNECT_LOGO_URL` only when you intentionally want to use externally hosted logo URLs instead.
The separate bulk email sender iframe is still a separate Apps Script deployment and needs its own migration pass.

## Nomenclature Manager

The platform route `/nomenclature` lists baseline files from the Drive folder configured by `NOMENCLATURE_FOLDER_ID`.
If that env var is missing, the API searches for a Drive folder named `Nomenclature`.

Users must have `Nomenclature` in the CRM Login sheet `Page Access` value to see this module.
Users with Nomenclature page access can browse, preview supported files, and download working copies to manage on their own machines.

Only these users get baseline editor controls:

- `sandeep@ridosports.com`
- `sidhant@ridosports.com`
- `holy@klientkonnect.com`
