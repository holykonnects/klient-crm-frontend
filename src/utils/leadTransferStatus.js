const isQualified = (status = '') =>
  String(status).trim().toLowerCase() === 'qualified';

export function getLeadSaveMessage(result, leadStatus, action = 'updated') {
  const successMessage = `Lead ${action} successfully.`;
  if (!isQualified(leadStatus)) {
    return { message: successMessage, confirmed: true };
  }

  if (result?.qualifiedTransfer?.transferred) {
    return {
      message: `${successMessage} The lead has been converted to an Account and added to Qualified Leads (Accounts).`,
      confirmed: true
    };
  }

  if (result?.qualifiedTransfer?.reason === 'already_exists') {
    return {
      message: `${successMessage} The Account is already available in Qualified Leads (Accounts), so no duplicate was created.`,
      confirmed: true
    };
  }

  return {
    message: 'The lead was saved as Qualified, but the Account transfer was not confirmed. Please refresh and check Qualified Leads (Accounts).',
    confirmed: false
  };
}
