# Inventory Apps Script Scheduler

Runtime scope after the native inventory migration:

- Keep the Apps Script project and the installed time trigger for `releaseExpiredBookings`.
- Do not route CRM frontend reads or writes through the Apps Script web app.
- After `/api/inventory` is verified in production, the old web-app deployment may be disabled while the script project and `releaseExpiredBookings` trigger remain active.
- Do not delete the helper functions used by `releaseExpiredBookings`; reservation release and notification code still runs inside this project for the scheduled job.

Source files:

- `Code.gs` - Inventory calculator and booking engine.
- `appsscript.json` - Apps Script manifest.

Former frontend consumers, now served by `/api/inventory`:

- `src/components/InventoryModule.jsx`
- `src/components/StockManagement.jsx`

Legacy GAS web-app endpoint (no longer used by the frontend):

- `https://script.google.com/macros/s/AKfycbzEkxzsVYQWMdI7CmleY53U-O4C58b92wlCZnISqtv11L2YLcaRuiB0WGHWW1HlpsoG/exec`
