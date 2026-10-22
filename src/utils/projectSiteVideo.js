export const PROJECT_SITE_VIDEO_HEADER = 'Completed Site Video URL';

export function normalizeProjectSiteVideo(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    const fileId = url.pathname.match(/^\/file\/d\/([-\w]{25,})(?:\/|$)/)?.[1]
      || (['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : '');
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || !/^[-\w]{25,}$/.test(fileId || '')) throw new Error();
    const link = new URL(`https://drive.google.com/file/d/${fileId}/view`);
    if (url.searchParams.has('resourcekey')) link.searchParams.set('resourcekey', url.searchParams.get('resourcekey'));
    return link.href;
  } catch {
    throw new Error('Completed Site Video URL must be a Google Drive file link, not a folder or another website.');
  }
}
