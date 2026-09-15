# Native costing API

## Scope

The costing module keeps the existing Google Sheets workbook and uses the existing service account through `/api/costing`. Apps Script is no longer a runtime dependency. Other CRM modules and external script consumers are outside this migration.

Supported operations:

- Cost sheet creation, details, search, linked-entity lists, validation, totals refresh.
- Single/batch line additions, soft deletion, audit-preserving edits, and combined sheet-plus-items creation (including the frontend's `createCostSheetAndAddLineItems` action).
- Advance recording, usage and balances.
- Expense request submission, review queues, individual/bulk approvals, mapping and individual/bulk sync.
- CSV, Excel and PDF extraction with filters, selected columns and finance subtotals. Downloads are generated on the API server without creating temporary Drive spreadsheets.

## Writes and performance

A mutation reads workbook metadata and batches its required ranges, then submits one `spreadsheets.batchUpdate`. Line-item additions read line headers rather than the full historical ledger. AppendCells assigns append positions server-side. User text is written as literal values, not interpreted as formulas.

Line append, summary formula updates, advance balance formulas, and expense-request sync markers commit together. Audit edits deactivate the original and append its replacement in that same commit. Bulk sync validates every selected request before committing; any invalid request prevents the entire batch from saving.

Touched cost sheets receive live SUMIFS formulas in their head totals and Grand Total. Touched advances receive live usage/balance formulas. This avoids application-side scan/recompute/write races. Existing untouched summaries are retained; `recomputeTotals` installs formulas for a specified existing sheet. The Last Calculated At field records the last API mutation to that cost sheet, not every manual spreadsheet recalculation.

New line items have a UUID-based Line Item ID; legacy rows use timestamp and particular together, and ambiguous matches are rejected. Deterministic `CostingConsumed_*` named ranges prevent two competing API edits or syncs from consuming the same original row/request. Do not remove those markers while their records remain relevant. Spreadsheet users can still change records outside the API; this is not a general-purpose transactional database.

Mutable costing reads bypass process caches and send Cache-Control: no-store. Validation and linked-entity lookups retain short caches. Successful mutation responses include Server-Timing for measuring end-to-end server time. Production latency has not been benchmarked by the local tests.

## Failure behavior

Forms close or clear only after an explicit success response. A connection loss or malformed response is reported as an unconfirmed save; the client never automatically resubmits. Manual additions do not have an exactly-once retry guarantee: refresh and inspect the records before retrying an unconfirmed save.

Schema additions and writes are in one atomic batch. Concurrent first-use schema changes may cause one request to fail; refresh after the other request finishes. Requests against already configured sheets do not perform schema writes.

## Deployment

Deploy the frontend and API together; the export contract now returns file bytes for all formats rather than an XLSX download URL. Required existing configuration:

- GOOGLE_SERVICE_ACCOUNT_EMAIL (or GOOGLE_CLIENT_EMAIL), GOOGLE_PRIVATE_KEY.
- COSTING_SHEET_ID and VALIDATION_SHEET_ID if overriding configured workbook IDs.
- Google Sheets API enabled, and service account editor access to the costing workbook; validation and linked-entity workbooks readable.

ExcelJS and PDFKit are server dependencies declared in package.json. The old COSTING_GAS_URL is unused and can be removed from deployment configuration. The repository ignores pnpm-lock.yaml; that policy is unchanged.

The native API adds missing schema columns in-place and does not delete or migrate historical rows. Before retiring the old GAS deployment, inspect its independent triggers and external consumers; these cannot be determined from the frontend repository alone.

## Verification

Run `npm run test:costing` on Node 22.7+ (the repository uses ESM syntax in API files without a package type declaration), and `npm run build`. Tests use mocked Sheets transport, exercise atomic batches and failure paths, and round-trip Excel output. They do not modify the production workbook.

After deploying, verify one controlled create/add/edit/delete, an advance-funded item, approval and sync, and all export formats against a test cost sheet. Confirm sheet formulas calculate and the service account can write. Local checks do not establish deployment credentials, Google authorization or production latency.
