import { getSheetsAuthSubjects, getDriveAuthSubjects } from './googleSheets.js';

export async function emailGoogleRead(kind, resource, operation, subjects) {
  const candidates = subjects || (kind === 'Sheets' ? getSheetsAuthSubjects() : [...new Set([...getDriveAuthSubjects(), ...getSheetsAuthSubjects()])]);
  const failures = [];
  for (const subject of candidates) {
    try { return await operation({ scopes: [`https://www.googleapis.com/auth/${kind === 'Sheets' ? 'spreadsheets' : 'drive'}`], subject }); }
    catch (error) {
      if (/Missing Google service account env vars/.test(error.message)) throw Object.assign(new Error('The native email API is missing its Google service account configuration in this environment.'), { status: 503 });
      failures.push(`${subject || 'service account'}: ${error.message}`);
    }
  }
  throw Object.assign(new Error(`Client Comms cannot read ${resource} through Google ${kind}. Check access for the configured delegated user/service account. ${failures.join('; ')}`), { status: 502 });
}

const normalized = value => String(value ?? '').trim().toLowerCase();
const field = (row, names) => names.map(name => Object.entries(row).find(([key]) => normalized(key) === normalized(name))?.[1]).find(value => String(value ?? '').trim()) || '';

export function emailLoginAccess(rows, identifier) {
  const user = normalized(identifier);
  const matches = rows.filter(row => ['Login Username', 'Username', 'Login Email', 'Email', 'Name'].some(name => normalized(field(row, [name])) === user));
  if (!user || matches.length !== 1) throw Object.assign(new Error('Your CRM login could not be uniquely matched. Sign out and sign in again; check duplicate CRM Login identities if this continues.'), { status: 403 });
  const row = matches[0];
  const role = field(row, ['Role', 'User Role']);
  const pageAccess = String(field(row, ['Page Access', 'Pages', 'Access'])).split(',').map(normalized).filter(Boolean);
  if (normalized(role) !== 'admin' && !pageAccess.includes('email')) throw Object.assign(new Error('Email page access is required for Client Comms.'), { status: 403 });
  return { user, role, pageAccess };
}
