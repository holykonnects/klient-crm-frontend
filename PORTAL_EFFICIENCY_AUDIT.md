# Portal Efficiency Audit

This audit maps the main performance issues seen across the CRM portal and the safest order to improve them.

## Primary Issues

1. Many modules fetch full Google Sheet data on page load.
   - Impact: slow first paint, repeated GAS calls, browser table rendering cost.
   - Fix: add server-side paging, summary fields, and filters in GAS endpoints.

2. Fetch logic is duplicated across components.
   - Impact: inconsistent caching, timeouts, loading states, error handling, and retries.
   - Fix: create shared `src/utils/gasClient.js` for fetch, JSONP, cache, timeout, and no-cors POST helpers.

3. Hardcoded Apps Script URLs are scattered through components.
   - Impact: deployments are hard to rotate, test, or audit.
   - Fix: centralize endpoint constants in `src/config/gasEndpoints.js` or environment variables.

4. Large tables render too many rows at once.
   - Impact: browser freezes even after network fetch completes.
   - Fix: paginate tables, use render limits, or migrate high-volume tables to `@mui/x-data-grid`.

5. Validation/dropdown data is refetched independently.
   - Impact: repeated network calls for stable metadata.
   - Fix: cache validation/dropdown responses with a TTL and invalidate only after mutations.

6. POST mutations often refresh entire modules.
   - Impact: every save can trigger expensive reloads.
   - Fix: optimistic local updates plus targeted refresh of the changed row/page.

## Priority Order

1. Costing and Expense Requests
   - Already started.
   - Continue with backend paging, active-only exports, and date formatting in GAS.

2. Inventory and Stock Management
   - Both use the same GAS endpoint and JSONP patterns.
   - Add paged list endpoints and shared inventory cache.

3. Leads, Accounts, Deals, Orders
   - Similar table/form patterns.
   - Centralize validation endpoints and add server-side filtering/search.

4. Projects, Travel, Tenders, Sales Tracker
   - Add common cached fetch and reduce full-sheet reloads after mutations.

5. Email, Calendar, Existence Search, Quotations
   - Smaller surface area, but endpoints should still be centralized and documented.

## Recommended Shared Utilities

- `src/config/gasEndpoints.js`
  - Single map of module names to GAS URLs.

- `src/utils/gasClient.js`
  - `getJson(url, { signal, timeoutMs })`
  - `jsonpGet(url, { timeoutMs, cacheKey, ttlMs })`
  - `postNoCors(url, payload)`
  - `cachedGet(cacheKey, ttlMs, fetcher)`

- `src/utils/dateFormat.js`
  - Shared `DD/MM/YYYY` display/export helpers.

## Backend GAS Standards

Every Apps Script list endpoint should support:

- `limit`
- `offset`
- `q`
- `sortBy`
- `sortDir`
- `fields`
- `activeOnly`
- `updatedSince` where useful

Every export endpoint should support:

- `dateFormat=DD/MM/YYYY`
- `activeOnly=true`
- selected `fields`

## Apps Script Folder Map

Apps Script sources should live under `apps-script/<module>/`.

When the current deployed GAS source is available, add it as `Code.gs` or a descriptive `.gs` file inside the matching module folder.
