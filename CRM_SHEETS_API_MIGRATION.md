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
- `ORDER_UPLOAD_FOLDER_ID`
- `ORDER_PO_FOLDER_ID`
- `ORDER_DRAWING_FOLDER_ID`
- `ORDER_BOQ_FOLDER_ID`
- `ORDER_PROFORMA_FOLDER_ID`

The service account must have access to the relevant Google Sheets and Drive folders.
Enable Google Sheets API and Google Drive API in the Google Cloud project.

## New API Routes

- `/api/leads`
- `/api/accounts`
- `/api/deals`
- `/api/orders`
- `/api/sales-tracker`
- `/api/order-invoices?orderId=...`

The frontend modules for Leads, Lead Form, Accounts, Deals, Orders, and Sales Tracker now call these same-origin routes instead of deployed Apps Script URLs.
