const API = "/api/email";

function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

const EmailService = {
  async getTemplates(userEmail = "") {
    const params = new URLSearchParams({ action: "getTemplates", user: userEmail });
    const res = await fetch(`${API}?${params.toString()}`);
    const text = await res.text();
    const json = safeJSON(text);

    if (!json || !json.ok) return [];

    return json.data; // <-- EXTRACT ARRAY
  },

  async getLeads(userEmail = "") {
    const params = new URLSearchParams({ action: "getLeads", user: userEmail });
    const res = await fetch(`${API}?${params.toString()}`);
    const text = await res.text();
    const arr = safeJSON(text);

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
    const text = await res.text();
    return safeJSON(text);
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
    const text = await res.text();
    const json = safeJSON(text);
    if (!res.ok || (json && json.ok === false)) {
      throw new Error(json?.error || text || "Lead creation failed");
    }
    return json || { ok: true };
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
  const text = await res.text();
  const json = safeJSON(text);
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || text || "Email send failed");
  }

  return json || { ok: true };
}
};
export default EmailService;
