// EmailService.js
const GAS_URL = "https://script.google.com/macros/s/AKfycbzPNVeqRlTRcb_sCa_PU_EGW_EW8uZ9ClevCQRcKfa5KYR5-OpGyzp1Wsw4Sxb_x2vfqg/exec";

const EmailService = {

  async getTemplates() {
    const res = await fetch(`${GAS_URL}?action=getTemplates`, {
      method: "GET"
    });
    return res.json();
  },

  async previewTemplate(id) {
    const res = await fetch(`${GAS_URL}?action=previewTemplate&id=${id}`, {
      method: "GET"
    });
    return res.json();
  },

  async getLeads() {
    const res = await fetch(`${GAS_URL}?action=getLeads`, {
      method: "GET"
    });
    return res.json();
  },

  async getEvents() {
    const res = await fetch(`${GAS_URL}?action=getEvents`, {
      method: "GET"
    });
    return res.json();
  },

  async sendEmail(body) {
    await fetch(`${GAS_URL}?action=sendEmail`, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(body)
    });
  },

  async createLead(body) {
    await fetch(`${GAS_URL}?action=createLead`, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(body)
    });
  }
};

export default EmailService;
