export const MAX_ORDER_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export const ORDER_ATTACHMENT_FIELD_BY_KEY = {
  purchaseOrder: "Attach Purchase Order",
  drawing: "Attach Drawing",
  boq: "Attach BOQ",
  proforma: "Proforma Invoice",
};

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split("base64,")[1] || "");
    reader.onerror = () => reject(reader.error || new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function responseJson(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    throw new Error(result.error || result.message || `Attachment request failed (${response.status})`);
  }
  return result;
}

export async function uploadOrderAttachment({ file, field, orderId, fetcher = fetch }) {
  if (!file) throw new Error(`${field} file is required`);
  if (file.size > MAX_ORDER_ATTACHMENT_BYTES) throw new Error(`${file.name} exceeds the 2 MB attachment limit.`);
  const base64 = await readAsBase64(file);
  const response = await fetcher("/api/order-attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      field,
      orderId,
      file: {
        name: file.name,
        type: file.type || "application/octet-stream",
        base64,
      },
    }),
  });
  const result = await responseJson(response);
  return { name: file.name, size: file.size || 0, status: "uploaded", url: result.url, receipt: result.receipt };
}

export async function removeOrderAttachment(receipt, fetcher = fetch) {
  if (!receipt) return;
  const response = await fetcher("/api/order-attachments", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receipt }),
  });
  await responseJson(response);
}
