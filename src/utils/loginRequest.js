export function createLoginRequest(fetcher = (...args) => fetch(...args)) {
  let pending = false;
  return async function submitLogin(email, password) {
    if (pending) return null;
    pending = true;
    try {
      let response;
      try {
        response = await fetcher('/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
      } catch {
        throw new Error('Unable to reach sign-in. Check your connection and try again.');
      }
      let result;
      try { result = await response.json(); } catch {
        throw new Error('Sign-in returned an unexpected response. Please try again later.');
      }
      if (response.status === 401) throw new Error('Invalid email, username or password.');
      if (!response.ok || result?.success !== true) {
        throw new Error(response.status >= 500
          ? 'Sign-in is temporarily unavailable. Please try again later.'
          : result?.error || 'Unable to sign in. Please try again.');
      }
      return result;
    } finally {
      pending = false;
    }
  };
}
