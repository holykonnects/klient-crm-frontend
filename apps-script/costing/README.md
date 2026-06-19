# Costing Google Apps Script

This folder contains the Google Apps Script backend used by the CRM costing module.

- `Code.gs` - RIDO Costing Engine master backend.
- `expense-requests/ExpenseRequestBulkActions.gs` - Expense request bulk action helpers that belong to the costing backend.
- `appsscript.json` - Basic Apps Script manifest for version control.

The frontend currently points to the deployed Apps Script web app URL from `src/components/CostingTable.jsx`.
When updating the deployed script, copy or push the contents of `Code.gs` into the corresponding Apps Script project.
