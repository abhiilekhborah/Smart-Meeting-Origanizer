export function invitationUrl(code: string, publicBaseUrl: string, origin: string): string {
  const base = new URL(publicBaseUrl.trim() || origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new Error('Configure a valid HTTP or HTTPS application address without credentials, a query, or a fragment.');
  return `${base.href.replace(/\/$/, '')}/join/${encodeURIComponent(code)}`;
}
export function isLocalInvitation(url: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
}
