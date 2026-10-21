import crypto from 'crypto';
import { createSignedToken, verifySignedToken } from './sessionAuth.js';

const payloadHash = payload => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

export function createQuotationExportReceipt(state, payload, user, options = {}) {
  return createSignedToken({ ...state, type: 'quotation-pdf-export', user: String(user || '').toLowerCase(),
    payloadHash: payloadHash(payload), exp: Math.floor((options.now ?? Date.now()) / 1000) + 1800 }, options);
}

export function readQuotationExportReceipt(token, payload, user, phase, options = {}) {
  const state = verifySignedToken(token, options);
  if (state.type !== 'quotation-pdf-export' || state.user !== String(user || '').toLowerCase()
    || state.phase !== phase || state.payloadHash !== payloadHash(payload) || !state.fileId) {
    const error = new Error('Quotation export session is invalid or the quotation changed. Start a new export.');
    error.status = 403;
    throw error;
  }
  return state;
}
