# Legacy costing Google Apps Script

This directory retains the former costing backend for reference. The CRM costing module now uses the native server API in `api/_handlers/costing.js`; it does not execute these scripts.

Do not deploy these files to update CRM costing. See [the native costing API guide](../../COSTING_NATIVE_API.md). Existing external Apps Script triggers or consumers must be checked separately before retiring the old deployment.
