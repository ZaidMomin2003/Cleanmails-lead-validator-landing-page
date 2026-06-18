/**
 * CleanMails License Validation — Vercel Serverless Function
 * Endpoint: POST /api/validate-license
 *
 * Environment variables (set in Vercel dashboard):
 *   DODO_API_KEY    - Your DodoPayments Bearer token
 *   DODO_PRODUCT_ID - Your product ID in Dodo
 */

const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    RATE_LIMIT_MAP.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIP)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in 1 minute.' });
  }

  // Parse body
  const { license_key } = req.body || {};

  if (!license_key || typeof license_key !== 'string' || license_key.length < 5) {
    return res.status(400).json({ error: 'license_key is required' });
  }

  // Call DodoPayments API
  try {
    const dodoRes = await fetch('https://api.dodopayments.com/licenses/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DODO_API_KEY}`,
      },
      body: JSON.stringify({
        license_key: license_key,
        product_id: process.env.DODO_PRODUCT_ID,
      }),
    });

    if (!dodoRes.ok) {
      return res.status(200).json({ valid: false, error: 'License key not found or invalid' });
    }

    const data = await dodoRes.json();

    return res.status(200).json({
      valid: data.valid === true,
      customer_name: data.customer_name || '',
      email: data.customer_email || '',
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach license server. Try again.' });
  }
}
