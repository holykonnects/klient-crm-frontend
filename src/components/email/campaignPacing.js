export const EMAIL_INTERVAL_MS = 10000;
export const MAX_QUOTA_RETRIES = 3;

// Short waits allow Pause to interrupt both normal pacing and quota cooldowns.
export async function waitForCampaign(ms, paused, sleep = delay => new Promise(resolve => setTimeout(resolve, delay))) {
  let remaining = ms;
  while (remaining > 0) {
    if (paused()) return false;
    const step = Math.min(remaining, 500);
    await sleep(step);
    remaining -= step;
  }
  return !paused();
}

export async function sendWithQuotaRetry(send, { paused, onRetry = () => {}, wait = waitForCampaign }) {
  for (let attempt = 0; ; attempt += 1) {
    if (paused()) return null;
    try { return await send(); }
    catch (error) {
      // Network errors and uncertain Gmail/ledger outcomes must never be retried.
      if (!error.retryable || attempt >= MAX_QUOTA_RETRIES) throw error;
      const delay = Math.max(60000, Number(error.retryAfterSeconds || 0) * 1000) * (2 ** attempt);
      onRetry(delay, attempt + 1);
      if (!await wait(delay, paused)) return null;
    }
  }
}
