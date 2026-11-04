import { readEmailResponse } from './emailApiResponse';
const API = "/api/email";

const EmailService = {
  async campaign(action, payload = {}, method = 'GET') {
    const response = await fetch(method === 'GET' ? `${API}?${new URLSearchParams({ action, ...payload })}` : API,
      method === 'GET' ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, action }) });
    const result = await readEmailResponse(response);
    if (!result?.ok) throw new Error('The email request could not be confirmed. Refresh the campaign before continuing.');
    return result;
  },
  async getTemplates(userEmail = "") {
    const params = new URLSearchParams({ action: "getTemplates", user: userEmail });
    const res = await fetch(`${API}?${params.toString()}`);
    const json = await readEmailResponse(res);
    return json.data || [];
  },

  async getLeads(userEmail = "") {
    const params = new URLSearchParams({ action: "getLeads", user: userEmail });
    const res = await fetch(`${API}?${params.toString()}`);
    const arr = await readEmailResponse(res);

    if (!Array.isArray(arr)) return [];

    // Map GAS column headers → frontend format
    return arr.map((l) => ({
      firstName: l["First Name"] || "",
      lastName: l["Last Name"] || "",
      email: l["Email ID"] || "",
      leadSource: l["Lead Source"] || "",
      remarks: l["Remarks"] || "",
      raw: l,
    }));
  },

  async previewTemplate(id, userEmail = "") {
    const params = new URLSearchParams({ action: "previewTemplate", id, user: userEmail });
    const res = await fetch(`${API}?${params.toString()}`);
    return readEmailResponse(res);
  },

  async createLead(data, userEmail = "") {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createLead",
        user: userEmail,
        ...data
      }),
    });
    return readEmailResponse(res);
  },

  async sendEmail(payload, userEmail = "") {
  const res = await fetch(API, {
    method: "POST",
    body: JSON.stringify({
      action: "sendEmail",
      user: userEmail,
      ...payload
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });
  return readEmailResponse(res);
}
};
export default EmailService;
