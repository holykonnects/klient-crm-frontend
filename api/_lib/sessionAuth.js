import crypto from "crypto";

const SESSION_COOKIE = "kk_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

const base64Url = (value) => Buffer.from(value).toString("base64url");
const clean = (value) => String(value ?? "").trim();

function sessionSecret() {
  const secret = process.env.CRM_SESSION_SECRET || process.env.GOOGLE_PRIVATE_KEY || "";
  if (!secret) throw new Error("CRM session signing is not configured");
  return secret;
}

export function createSignedToken(payload, { secret = sessionSecret(), now = Date.now() } = {}) {
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySignedToken(token, { secret = sessionSecret(), now = Date.now() } = {}) {
  const [body, suppliedSignature] = clean(token).split(".");
  if (!body || !suppliedSignature) throw new Error("Invalid signed token");
  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw new Error("Invalid signed token");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && Number(payload.exp) <= Math.floor(now / 1000)) throw new Error("Signed token has expired");
  return payload;
}

export function createSessionToken(user, options = {}) {
  const now = options.now ?? Date.now();
  return createSignedToken({
    type: "session",
    sub: clean(user?.username || user?.email).toLowerCase(),
    email: clean(user?.email).toLowerCase(),
    role: clean(user?.role),
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  }, { ...options, now });
}

function cookies(req) {
  return Object.fromEntries(String(req?.headers?.cookie || "").split(";").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0
      ? [part.trim(), ""]
      : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1))];
  }).filter(([key]) => key));
}

export function requireSession(req, options = {}) {
  const token = cookies(req)[SESSION_COOKIE];
  if (!token) throw Object.assign(new Error("Please sign in again before uploading attachments"), { status: 401 });
  try {
    const session = verifySignedToken(token, options);
    if (session.type !== "session" || !session.sub) throw new Error("Invalid CRM session");
    return session;
  } catch (error) {
    throw Object.assign(new Error("Your CRM session has expired. Please sign in again"), { status: 401, cause: error });
  }
}

export function setSessionCookie(res, user, options = {}) {
  const token = createSessionToken(user, options);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}
