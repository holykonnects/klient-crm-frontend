// A lost response does not establish whether the server committed the write.
// Never retry a costing mutation automatically.
export async function postCosting(payload) {
  let response;
  try {
    response = await fetch("/api/costing", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Save could not be confirmed. Refresh and check the records before submitting again.");
  }
  let data;
  try { data = await response.json(); } catch {
    throw new Error(`Save could not be confirmed (${response.status}). Refresh and check the records before submitting again.`);
  }
  if (!response.ok || data?.success !== true) throw new Error(data?.error || "Save could not be confirmed. Refresh and check the records before submitting again.");
  return data;
}
