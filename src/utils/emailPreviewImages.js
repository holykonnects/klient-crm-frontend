const asDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Unable to read a template preview image.'));
  reader.readAsDataURL(blob);
});

export async function hydrateEmailPreviewImages(html, signal) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const downloads = new Map();
  for (const image of document.querySelectorAll('img[src]')) {
    const source = image.getAttribute('src');
    const url = new URL(source, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== '/api/email' || url.searchParams.get('action') !== 'emailTemplateImage') continue;
    if (!downloads.has(source)) downloads.set(source, (async () => {
      // Fetch in the signed-in parent page, not the opaque sandbox. This also
      // carries Vercel deployment-protection cookies on private preview builds.
      const response = await fetch(url.href, { credentials: 'same-origin', signal });
      if (!response.ok || !/^image\//i.test(response.headers.get('content-type') || '')) throw new Error('Template image could not be loaded. Refresh the preview and check deployment access.');
      return asDataUrl(await response.blob());
    })());
    image.setAttribute('src', await downloads.get(source));
  }
  return `<!doctype html>${document.documentElement.outerHTML}`;
}
