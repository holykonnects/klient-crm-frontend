// src/components/email/EmailService.js

const BASE_URL =
  "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

const EmailService = {
  // 🔹 Get Leads – simple GET, no custom headers, no preflight
  async getLeads() {
    const res = await fetch(`${BASE_URL}?action=getLeads`); // GET only
    const data = await res.json().catch(() => null);

    // normalise to array
    let leads = [];
    if (Array.isArray(data)) {
      leads = data;
    } else if (data && Array.isArray(data.leads)) {
      leads = data.leads;
    }

    // sort by timestamp desc if present
    const sorted = [...leads].sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    return sorted;
  },

  // 🔹 Get Templates – simple GET, no custom headers, no preflight
  async getTemplates() {
    const res = await fetch(`${BASE_URL}?action=getTemplates`);
    const data = await res.json().catch(() => null);

    let templates = [];
    if (Array.isArray(data)) {
      templates = data;
    } else if (data && Array.isArray(data.templates)) {
      templates = data.templates;
    }

    return templates;
  },

  // 🔹 Send Email – this one *may* need POST; leave as you had it earlier
  // If this wasn’t causing preflight earlier, keep your old pattern here.
  async sendEmail(payload) {
    // If your old sendEmail was working, reuse that.
    // Placeholder safe pattern:
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
  },
};

export default EmailService;
