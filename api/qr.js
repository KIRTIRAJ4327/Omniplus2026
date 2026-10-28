import QRCode from 'qrcode';
import { networkUrl } from '../lib/config.js';

// /api/qr           -> QR for the join page
// /api/qr?t=mentors  -> QR for this app's own /mentors page (host-edited links)
// /api/qr?t=network  -> QR for NETWORK_URL (a Linktree, if you use one instead)
export default async function handler(req, res) {
  const want = new URL(req.url, 'http://local').searchParams.get('t');
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = (process.env.PUBLIC_URL || `${proto}://${host}`).replace(/\/+$/, '');
  let url;
  if (want === 'network') {
    url = networkUrl();
    if (!url) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify({ error: 'NETWORK_URL is not set on the server.' }));
    }
  } else if (want === 'mentors') {
    url = origin + '/mentors';
  } else {
    url = origin + '/';
  }
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1B2A4E', light: '#FFFFFF' } });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600');
  res.setHeader('X-Join-Url', url);
  res.end(svg);
}
