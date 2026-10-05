import { driveDownloadFile, getDriveAuthSubjects, getSheetsAuthSubjects } from "./googleSheets.js";

export function quotationImageReference(value) {
  let source = String(value || "").trim();
  const formula = source.match(/^=IMAGE\(\s*"([^"]+)"/i);
  if (formula) source = formula[1];
  if (/^[-\w]{25,}$/.test(source)) return { fileId: source, url: `https://drive.google.com/file/d/${source}/view` };
  try {
    const url = new URL(source);
    if (!/^https?:$/.test(url.protocol)) return null;
    const googleHost = ["drive.google.com", "docs.google.com", "drive.usercontent.google.com"].includes(url.hostname);
    const fileId = googleHost ? (url.pathname.match(/\/d\/([-\w]+)/)?.[1] || url.searchParams.get("id") || "") : "";
    if (googleHost && !/^[-\w]{25,}$/.test(fileId)) return null;
    return { url: source, fileId };
  } catch { return null; }
}

export function quotationImageAuthSubjects(env = process.env) {
  return [...new Set([...getDriveAuthSubjects(env), ...getSheetsAuthSubjects(env)])].filter(Boolean).concat("");
}

export async function downloadQuotationImage(value, { download = driveDownloadFile, fetchImage = fetch, subjects = quotationImageAuthSubjects() } = {}) {
  const reference = quotationImageReference(value);
  if (!reference) throw new Error("Quotation image reference is invalid. Select the image again from Equipment BD.");
  let image;
  if (reference.fileId) {
    let lastError;
    for (const subject of subjects) {
      try {
        image = await download(reference.fileId, { scopes: ["https://www.googleapis.com/auth/drive"], subject });
        break;
      } catch (error) { lastError = error; }
    }
    if (!image) throw new Error(`Quotation image could not be downloaded: ${lastError?.message || "access denied"}`);
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetchImage(reference.url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Quotation image download failed (${response.status})`);
      image = { contentType: response.headers.get("content-type") || "", body: Buffer.from(await response.arrayBuffer()) };
    } finally { clearTimeout(timer); }
  }
  if (!String(image.contentType || "").toLowerCase().startsWith("image/") || !image.body?.length) {
    throw new Error("Quotation image link does not reference a readable image");
  }
  return image;
}

export function resolveQuotationImages(payload, catalog) {
  const resolveItem = (item, isSet = false) => {
    const category = isSet ? item.imageCategory : item.category;
    const subCategory = isSet ? item.imageSubCategory : item.subCategory;
    const code = isSet ? item.imageItemCode : item.itemCode;
    const selected = (catalog.items?.[`${category}|||${subCategory}`] || []).find((entry) => entry.code === code);
    const reference = quotationImageReference(item.imageUrl) || quotationImageReference(selected?.imageUrl);
    if ((item.imageUrl || (selected && selected.imageUrl)) && !reference) {
      throw new Error(`Image for ${item.displayItem || item.item || code} is invalid. Select it again from Equipment BD.`);
    }
    return { ...item, imageUrl: reference?.url || "" };
  };
  return {
    ...payload,
    items: (payload.items || []).map((item) => resolveItem(item)),
    ...(payload.setQuotation ? { setQuotation: {
      ...payload.setQuotation,
      sets: (payload.setQuotation.sets || []).map((set) => ({ ...set, items: (set.items || []).map((item) => resolveItem(item, true)) })),
    } } : {}),
  };
}
