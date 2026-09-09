export const SHEETS = {
  leads: {
    spreadsheetId: process.env.LEADS_SHEET_ID || "1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0",
    sheetNames: ["Form responses 1", "Form Responses 1"],
  },
  accounts: {
    spreadsheetId: process.env.ACCOUNTS_SHEET_ID || "1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8",
    sheetNames: ["Qualified Leads"],
  },
  deals: {
    spreadsheetId: process.env.DEALS_SHEET_ID || "1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4",
    sheetNames: ["Form responses 1", "Form Responses 1"],
  },
  orders: {
    spreadsheetId: process.env.ORDERS_SHEET_ID || "11hW2rcd5x4gmXFn2AO03FgOQ0Ec8wd3Ot8yTbAh7P2k",
    sheetNames: ["Form responses 1", "Form Responses 1"],
  },
  projects: {
    spreadsheetId: process.env.PROJECTS_SHEET_ID || "1L9yGqk0NCXDYAB7TeyOyXBEhSMs1f1aU0jbDOWzr9_s",
    sheetNames: ["Project"],
    validationSheetNames: ["Validation Tables"],
  },
  costing: {
    spreadsheetId: process.env.COSTING_SHEET_ID || "1S3pMki4TDiCBXdgkBGQ4qjyUUp9uo4mpMwQAUDvul6c",
    costSheetNames: ["Cost Sheet"],
    lineItemSheetNames: ["Cost Line Items"],
    advanceSheetNames: ["Advance Payments"],
    validationSpreadsheetId: process.env.VALIDATION_SHEET_ID || "1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ",
    validationSheetNames: ["Cost Validation"],
  },
  salesTracker: {
    spreadsheetId:
      process.env.SALES_TRACKER_SHEET_ID || "1XV4CJLt8nP512e39YK9RmYFO2llxyNCtmuphXgT8p2E",
    sheetNames: ["Sheet1"],
  },
  validation: {
    spreadsheetId:
      process.env.VALIDATION_SHEET_ID || "1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ",
    leadSheetNames: ["Validation Tables"],
    dealSheetNames: ["Deal Validation Tables"],
    salesTrackerSheetNames: ["Sales Tracker Validation Tables"],
  },
  email: {
    spreadsheetId: process.env.EMAIL_SHEET_ID || "1Ys7WI5ar4N1C6Q3-LeAOOys9q8vd3Bx34bBetYEmxpM",
    eventSheetNames: ["Email_Events"],
    settingsSheetNames: ["Email_Settings"],
  },
  quotations: {
    referenceSpreadsheetId:
      process.env.QUOTATION_REFERENCE_SHEET_ID || "1t-8DRUh4NjRTQhpO6ZTpeYyZUjkwfU6DNoRaIGkdCkc",
    equipmentSheetNames: ["Equipment BD"],
    termsSheetNames: ["tc"],
  },
};

export const DRIVE_FOLDERS = {
  emailTemplates: process.env.EMAIL_TEMPLATE_FOLDER_ID || "1uKApnHOJVkOuXc7ayrxLyrkwgkjuUGt1",
  defaultUpload:
    process.env.ORDER_UPLOAD_FOLDER_ID ||
    "1NxWIZserHmgDu3HpWS1tTy050qh9XW1bgOPrccHMVQ9Vve74t4NWuoUf-DQOT93IU5MyxZ1N",
  attachments: {
    "Attach Purchase Order":
      process.env.ORDER_PO_FOLDER_ID || "17S79ELNAjYSoFxD3lJ-sytYQWGjCClkO37lEC2zACEGpdUVF8EqwA-AUq-V3xANzv4ZyKkls",
    "Attach Drawing":
      process.env.ORDER_DRAWING_FOLDER_ID ||
      "1s8FA4XSOEsfNOq5l_qBqp_ZmjNsky6t3FYXGFGnK9V3kpCKNYDelljSes9irK-QIuKi4FdQM",
    "Attach BOQ":
      process.env.ORDER_BOQ_FOLDER_ID ||
      "1dXI9vWhur61T3jktX_kII0pAmdkj7kVYS7LSNG_6FajzRPIB4d6CArAGMOW53IlhajJ-rxJe",
    "Proforma Invoice": process.env.ORDER_PROFORMA_FOLDER_ID || "1BEqgU_qkd4l5KHfltHZOWHR91go8XZUy",
  },
};
