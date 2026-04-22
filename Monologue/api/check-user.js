// api/check-user.js
// Vercel serverless function — checks if a user exists and has a password in Auth0
//
// SETUP: In Vercel Dashboard → your project → Settings → Environment Variables, add:
//   AUTH0_DOMAIN        = dev-l32518uugzfqq57h.us.auth0.com
//   AUTH0_M2M_CLIENT_ID = (your M2M client ID)
//   AUTH0_M2M_SECRET    = (your M2M client secret)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  const domain   = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_M2M_CLIENT_ID;
  const secret   = process.env.AUTH0_M2M_SECRET;

  try {
    // 1. Get Management API token
    const tokenRes = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'client_credentials',
        client_id:     clientId,
        client_secret: secret,
        audience:      `https://${domain}/api/v2/`,
      }),
    });
    const { access_token } = await tokenRes.json();

    // 2. Search for user by email
    const searchRes = await fetch(
      `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const users = await searchRes.json();

    if (!users || users.length === 0) {
      return res.status(200).json({ exists: false, hasPassword: false });
    }

    const hasPassword = users.some(u =>
      u.identities?.some(i => i.connection === 'Username-Password-Authentication')
    );

    return res.status(200).json({ exists: true, hasPassword });

  } catch (err) {
    console.error('check-user error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
