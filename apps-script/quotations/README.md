# Quotations Apps Script

Frontend usage:

- `src/components/QuotationBuilder.js`

## Quote types

- **Standard Sports / Equipment** uses `Quotation Management (Responses)`, its `Equipment BD` catalogue, `tc` terms, and `New Template` PDF layout.
- **Athletic Track / Automatic BOQ** uses `Athletic Quotation Builder`, including its Estimator inputs, Presets, Lists, Rate Library, Automatic BOQ formulas, Printable Quote, and working-copy workflow.

After changing `Quotation API/Code.gs`, deploy a new version of the single standalone Apps Script web app. The CRM server reads both catalogues, while PDF generation creates a script-free spreadsheet and copies the required tabs into it. Do not bind or deploy the API separately from client quotation workbooks.

Avoid `Spreadsheet.copy()` and Drive `makeCopy()` for quotation working files because they can duplicate container-bound Apps Script projects. Existing client copies may be archived after their PDFs and working data are confirmed; disable their triggers/deployments before deletion.
- `api/gas.js`

Detected GAS endpoint:

- `https://script.google.com/macros/s/AKfycbwcV0I1JGLqmDTT_vPgrVOdDbpy4XUbUEi7CD5cujdLydfS9uybkMJ_DCCJRMNDWKbo3g/exec`
