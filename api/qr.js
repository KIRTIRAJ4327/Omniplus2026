import QRCode from 'qrcode';

export default async function handler(req, res) {
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = (process.env.PUBLIC_URL || `${proto}://${host}`).replace(/\/+$/, '') + '/';
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1B2A4E', light: '#FFFFFF' } });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600');
  res.setHeader('X-Join-Url', url);
  res.end(svg);
}
