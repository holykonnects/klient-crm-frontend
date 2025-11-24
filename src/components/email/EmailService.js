const BASE_URL =
  "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

function safeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.leads)) return data.leads;
  if (data && Array.isArray(data.templates)) return data.templates;
  return [];
}

function isValidLead(lead) {
  if (!lead) return false;
  if (typeof lead !== "object") return false;

  // Must have at least email OR name
  const hasName =
    (lead.firstName && lead.firstName.trim() !== "") ||
    (lead.lastName && lead.lastName.trim() !== "");

  const hasEmail = lead.email && lead.email.trim() !== "";

  return hasEmail || hasName;
}

const EmailService = {
  // ------------------------
  // GET LEADS (safe, sorted)
  // ------------------------
  async getLeads() {
    try {
      const res = await fetch(`${BASE_URL}?action=getLeads`);

      const data = await res.json().catch(() => []);

      let leads = safeArray(data);

      // Remove blank leads
      leads = leads.filter(isValidLead);

      // Sort descending by timestamp if exists
      leads.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      return leads;
    } catch (err) {
      console.error("EmailService.getLeads ERROR:", err);
      return [];
    }
  },

  // ---------------------------
  // GET TEMPLATES (safe)
  // ---------------------------
  async getTemplates() {
    try {
      const res = await fetch(`${BASE_URL}?action=getTemplates`);
      const data = await res.json().catch(() => []);

      let templates = safeArray(data);

      // Remove blanks (very rare)
      templates = templates.filter(
        (t) => t && t.id && t.name && t.name.trim() !== ""
      );

      return templates;
    } catch (err) {
      console.error("EmailService.getTemplates ERROR:", err);
      return [];
    }
  },

  // ---------------------------
  // SEND EMAIL (use your OLD working pattern)
  // ---------------------------
  async sendEmail(payload) {
    try {
      await fetch(BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "sendEmail",
          ...payload,
        }),
      });

      return { status: "ok" };
    } catch (err) {
      console.error("EmailService.sendEmail ERROR:", err);
      return { status: "fail" };
    }
  },
};

export default EmailService;
