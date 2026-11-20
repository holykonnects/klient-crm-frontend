export const handoffFields = [
  ["contact", "Contact name"], ["mobile", "Mobile number"], ["email", "Email address"],
  ["address", "Address"], ["source", "Lead source"], ["status", "Status / stage"],
  ["requirement", "Requirement / product"], ["dealAmount", "Deal amount"], ["orderAmount", "Order amount"],
  ["nextStep", "Next step"], ["remarks", "Remarks"],
];

const clean = (value) => String(value ?? "").trim();
const first = (...values) => values.map(clean).find(Boolean) || "";

function phone(value) {
  const text = clean(value);
  const digits = text.replace(/\D/g, "");
  return /^\+?[\d\s().-]+$/.test(text) && digits.length >= 7 && digits.length <= 15 ? text : "";
}

function email(value) {
  return [...new Set(clean(value).match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/ig) || [])].join(", ");
}

function contact(row) {
  return {
    contact: [clean(row["First Name"]), clean(row["Last Name"])].filter(Boolean).join(" ") ||
      first(row["Contact Name"], row["Order Onsite Contact Name"]),
    mobile: first(phone(row._handoffMobile ?? row["Mobile Number"]),
      phone(row._handoffOnsiteMobile ?? row["Order Onsite Contact Number"])),
    email: first(email(row["Email ID"]), email(row["Email Address"]), email(row.Email)),
  };
}

export function transferDetails(type, newestFirst) {
  const details = {};
  for (const row of newestFirst) {
    const fields = {
      ...contact(row),
      address: [
        first(row.Street, row["Billing Street"]), first(row.City, row["Billing City"]),
        first(row.State, row["Billing State"]), first(row.PinCode, row["Billing PinCode"]),
        first(row.Country, row["Billing Country"]),
      ].filter(Boolean).join(", "),
      source: clean(row["Lead Source"]),
      status: type === "orders" ? first(row["Order Status"], row.Stage) :
        type === "deals" ? first(row.Stage, row["Deal Stage"]) : clean(row["Lead Status"]),
      requirement: first(row.Requirement, row["Product Required"], row["Order Product Description"]),
      dealAmount: type === "deals" ? clean(row["Deal Amount"]) : "",
      orderAmount: type === "orders" ? clean(row["Order Amount"]) : "",
      nextStep: clean(row["Next Step"]),
      remarks: first(row["Order Remarks"], row.Remarks, row["Additional Description/Remarks"], row["Additional Description"]),
    };
    const matchesContact = compatibleContacts(details, fields);
    for (const [key, value] of Object.entries(fields)) {
      if (value && !details[key] && (matchesContact || !contactFields.includes(key) && key !== "address")) {
        details[key] = value;
      }
    }
  }
  return details;
}

const contactFields = ["contact", "mobile", "email"];
const normalizeContact = (field, value) => {
  const text = clean(value).toLowerCase();
  return field === "mobile" ? text.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "") : text.replace(/\s+/g, " ");
};

function compatibleContacts(a, b) {
  return contactFields.every((field) => {
    const left = normalizeContact(field, a?.[field]);
    const right = normalizeContact(field, b?.[field]);
    return !left || !right || left === right;
  });
}

export function fillLinkedContacts(records) {
  return records.map((record) => {
    const details = { ...record.details };
    const linked = records.filter((other) => other !== record && compatibleContacts(details, other.details));
    if (!contactFields.some((field) => details[field]) && linked.some((other) =>
      linked.some((candidate) => !compatibleContacts(other.details, candidate.details)))) return record;
    for (const field of [...contactFields, "address"]) {
      if (details[field]) continue;
      const values = new Map();
      for (const other of linked) {
        const value = other.details?.[field];
        const key = normalizeContact(field, value);
        if (key) values.set(key, value);
      }
      if (values.size === 1) details[field] = values.values().next().value;
    }
    return { ...record, details };
  });
}
