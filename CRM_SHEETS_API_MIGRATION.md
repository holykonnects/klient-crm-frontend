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

The frontend modules for Leads, Lead Form, Accounts, Deals, Orders, and Sales Tracker now call these same-origin routes instead of deployed Apps Script URLs.

Lead saves through `/api/leads` now generate or reuse `Lead ID` values and copy leads with `Lead Status = Qualified` into the Accounts sheet.
Quick leads created from the communication module use the same `/api/leads` pipeline.

## Communication Engine

The single-send communication module now uses `/api/email` instead of the old Apps Script deployment for templates, preview, template versioning, lead lookup, quick lead creation, email logs, and single email send.
Email sending on Vercel requires Gmail API domain-wide delegation for the service account and `GMAIL_SENDER_EMAIL` or `GOOGLE_DELEGATED_USER_EMAIL`.
Outgoing emails are wrapped in a branded layout. The header uses `/assets/rido-sports-logo.png` from `PUBLIC_APP_URL` or `VERCEL_URL`, unless `RIDO_LOGO_URL` is set. The footer uses `KLIENT_KONNECT_LOGO_URL` when set, otherwise it uses `/assets/kk-logo.png`.
The separate bulk email sender iframe is still a separate Apps Script deployment and needs its own migration pass.

## Nomenclature Manager

The platform route `/nomenclature` lists baseline files from the Drive folder configured by `NOMENCLATURE_FOLDER_ID`.
If that env var is missing, the API searches for a Drive folder named `Nomenclature`.

Only these users can access the module:

- `sandeep@ridosports.com`
- `sidhant@ridosports.com`
- `holy@klientkonnect.com`
