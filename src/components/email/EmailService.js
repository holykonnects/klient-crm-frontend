// src/components/email/EmailService.js

const BASE_URL =
  "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

const EmailService = {
  // 🔹 Get Leads – simple GET, no custom headers, then sort by timestamp desc
  async getLeads() {
    const res = await fetch(`${BASE_URL}?action=getLeads`); // simple GET
    const data = await res.json();

    // sort by timestamp: latest on top
    const sorted = [...data].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    return sorted;
  },

  // 🔹 Get Templates – also simple GET
  async getTemplates() {
    const res = await fetch(`${BASE_URL}?action=getTemplates`);
    const data = await res.json();
    return data;
  },

  // 🔹 Send Email – POST with no-cors to avoid preflight
  async sendEmail(payload) {
    await fetch(BASE_URL, {
      method: "POST",
      mode: "no-cors", // ⬅ avoids OPTIONS preflight
      body: JSON.stringify({
        action: "sendEmail",
        ...payload,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    // no-cors => you won't get a JSON response; just fire-and-forget
    return { status: "queued" };
  },
};

export default EmailService;
