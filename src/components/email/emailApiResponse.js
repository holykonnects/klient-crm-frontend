export async function readEmailResponse(response) {
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch {
    throw new Error(/<!doctype|<html/i.test(text)
      ? 'The email API returned a web page instead of JSON. The local native API is not running or the API deployment route is incorrect.'
      : `The email service returned an unreadable response (HTTP ${response.status}).`);
  }
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `Email service request failed (HTTP ${response.status}).`);
  return data;
}
