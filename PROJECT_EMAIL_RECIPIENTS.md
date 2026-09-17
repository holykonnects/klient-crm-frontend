# Project notification group

Project notifications are sent by `/api/projects` through the server Gmail API.
They read only `Project CC` and `Project BCC` for group recipients, never the
shared `CC`/`BCC` columns or `OPERATIONAL_EMAIL_CC`. Other modules retain their
existing recipient configuration.

## Sheet setup

In the Lead Management spreadsheet (`VALIDATION_SHEET_ID`, default
`1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ`), open **Validation Tables**.
Append two new columns at the right of the existing table, with these headers:

| Project CC | Project BCC |
| --- | --- |
| sarabjeet@ridosports.com | |
| chanchal@ridosports.com | |
| navneet@ridosports.com | |

Leave Project BCC blank unless private project recipients are needed. These
columns are independent lists: their entries do not need to align with owner
names in the same row. Add/remove entries to manage the fixed project group.
One address per row is easiest to maintain; comma, semicolon and newline lists
are also accepted. Addresses are validated and deduplicated without regard to
case, including across To, CC and BCC.

Clients remain To recipients; when none are valid, project owners/managers are
used instead. Owners/managers and the verified updater remain copied when not
already in To. Assigned Team does not select recipients in this configuration:
the Project CC group receives notifications for all projects.

If the project columns are missing or empty, no group recipients are added.
There is deliberately no fallback to shared lists. Populate the columns before
deploying this change to preserve desired project group coverage.

The legacy GAS EXTRA_CC array is unused by the current server flow. Keep the GAS
email call disabled to avoid duplicate notifications. Server sending still
requires ENABLE_OPERATIONAL_EMAILS=true and configured Gmail delegation.

## Local verification

Run `node --test tests/projectRecipients.test.mjs`. These tests resolve addresses
locally and do not send email or change any Google Sheets.
