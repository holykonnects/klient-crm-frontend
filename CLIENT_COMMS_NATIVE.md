# Native Client Comms Sender

The Email Sender opens a CRM component, not an Apps Script web app. Templates and
campaign recipients stay in Google Drive/Sheets; delivery uses the Gmail API.
No Apps Script deployment is required. Scheduler scripts are unchanged.

The local React review server mounts the same native API handlers through
`src/setupProxy.js`. It needs the Google configuration locally (for example in
the git-ignored `.env.local`), not just in Vercel. API source changes require a
review-server restart. Requests are never silently forwarded to the live CRM.
Missing credentials produce an explicit JSON configuration error, not index.html.

## Configuration

- Existing `EMAIL_SHEET_ID`: email events and settings workbook.
- Optional `EMAIL_CAMPAIGN_SHEET_ID`: campaign contacts workbook if different;
  otherwise the sender lists tabs in `EMAIL_SHEET_ID`.
- The existing CRM email template folder is reused. Google Docs and HTML files
  are supported; the template must be in that folder.
- Keep original newsletter `.html` files in that folder without converting them
  into Google Docs. A Docs export cannot recover layout information lost during
  a prior conversion. The CRM keeps the stored source unchanged and inlines its
  CSS only in the preview/delivery copy, preserving existing inline overrides.
- Existing Gmail delegation and `GMAIL_SENDER_EMAIL` are required. The service
  identity needs template read access and campaign workbook edit access.
- CRM sign-in must issue the signed `kk_session` cookie. Bulk routes require
  a valid session and the existing Email page permission.

Campaign tabs need an Email, Email ID or Email Address header within the first
ten rows. First Name/Name and Company Name/Company are optional. If Email Status,
Email Shared Date and Template Sent columns exist, only those cells are updated
after delivery; other columns, row positions and formulas are not rewritten.
The sender does not create missing recipient columns or import contacts silently.

## Sending and recovery

Choose a campaign name, template, subject, reply-to address and recipient source.
Load contacts, select recipients, preview, then confirm the send. Emails are sent
one at a time. Pause stops after the current request; closing is disabled while
sending. Draft saves settings on the current browser, not a shared server draft.

On the first send the CRM creates `CRM_Email_Dispatches` in the campaign workbook.
It records dispatch key, attempt, status, creation time, Gmail ID and error detail.
This is the durable delivery ledger, not a new contact sheet. Existing records
for the same campaign name, source tab, email and template prevent another send;
duplicate addresses within a campaign are also skipped. A genuinely new campaign
uses a new campaign name. Unknown delivery outcomes stop for review in Gmail Sent.
Do not delete ledger entries to retry an uncertain delivery.

Claims are appended before Gmail is called, and the first appended claim for a
dispatch key owns delivery. If a worker stops before/after Gmail returns, the
claim blocks blind retries. This favours avoiding duplicate delivery over retrying
automatically. Gmail success with a logging failure is shown as sent with a warning.

Placeholders: FIRST_NAME, COMPANY, COMPANY_NAME, EMAIL, DATE, QUOTATION_LINK and
QUOTATION_BUTTON. Unknown placeholders block sending. Preview and delivery share
the same HTML renderer. Embedded image data becomes inline MIME image parts;
the CRM does not overwrite the template's styles or add the operational-email wrapper.
Preview image parts use short-lived signed CRM URLs instead of large base64 JSON
responses. Individual embedded images and preview HTML are limited to 3 MB each
to stay below the serverless response ceiling; oversized inputs require resizing.
The signed-in parent page downloads preview image parts before passing them to
the sandbox as data URLs, so private deployment cookies are not lost in an opaque
iframe request. Sending remains disabled if those preview downloads fail.
Mailbox clients can still differ in supported CSS. The 20 MB CRM content budget
and 28 MB encoded MIME budget are preflight guards, not a bypass of Gmail quotas.

## Deployment Verification

No real emails were sent during development. After deployment verify access to the
actual campaign workbook and template folder, then explicitly send a test campaign
to an authorised internal mailbox before using customer recipients. Check received
images and styles, sheet status, ledger and resume behaviour. The old Apps Script
sender is no longer opened by the CRM, but its external deployment is not deleted.
