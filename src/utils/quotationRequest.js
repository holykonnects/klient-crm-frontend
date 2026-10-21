export async function readQuotationResponse(response) {
  const text = await response.text();
  if (response.status === 504 || /FUNCTION_INVOCATION_TIMEOUT/.test(text)) {
    throw new Error('The quotation request exceeded the server time limit. Your entered details have not been cleared. Check Saved Quotes and the quotation folder before retrying an export.');
  }
  try {
    const parsed = JSON.parse(text);
    if (!response.ok && parsed && !parsed.error) parsed.error = `Request failed with status ${response.status}`;
    return parsed;
  } catch {
    throw new Error(`The quotation service returned an unexpected response (HTTP ${response.status}). Please try again after checking the quotation folder.`);
  }
}

export async function runQuotationPdfExport(payload, user, request, onProgress = () => {}) {
  const step = async (action, token, currentPayload) => {
    const result = await request({ action, user, payload: currentPayload, ...(token ? { exportToken: token } : {}) });
    if (!result?.ok) throw new Error(result?.error || 'Quotation export failed');
    return result;
  };
  onProgress('Preparing files');
  const started = await step('startPdfExport', null, payload);
  const canonicalPayload = started.payload;
  onProgress('Preparing quote');
  const prepared = await step('preparePdfExport', started.exportToken, canonicalPayload);
  onProgress('Generating PDF');
  const output = await step('finishPdfExport', prepared.exportToken, canonicalPayload);
  if (canonicalPayload.attach?.leadDisplay) {
    onProgress('Linking quote');
    try { await step('linkExportedPdf', output.exportToken, canonicalPayload); }
    catch { output.linkWarning = 'The PDF was created, but its lead link was not updated. Open the saved PDF before attempting another export.'; }
  }
  return output;
}
