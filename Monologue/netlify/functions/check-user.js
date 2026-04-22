// netlify/functions/check-user.js
// Checks whether a given email exists in Auth0 and whether they have a password.
// Returns: { exists: bool, hasPassword: bool }
//
// SETUP: In Netlify Dashboard → Site → Environment Variables, add:
//   AUTH0_DOMAIN        = dev-l32518uugzfqq57h.us.auth0.com
//   AUTH0_M2M_CLIENT_ID = (your Machine-to-Machine app client ID)
//   AUTH0_M2M_SECRET    = (your Machine-to-Machine app client secret)

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid body' }) };
  }

  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };
  }

  const domain    = process.env.AUTH0_DOMAIN;
  const clientId  = process.env.AUTH0_M2M_CLIENT_ID;
  const secret    = process.env.AUTH0_M2M_SECRET;

  try {
    // 1. Get a Management API token
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

    // 2. Search for the user by email
    const searchRes = await fetch(
      `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const users = await searchRes.json();

    if (!users || users.length === 0) {
      // No account — brand new user
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ exists: false, hasPassword: false }),
      };
    }

    // Check if any of their accounts is in the password connection
    const passwordUser = users.find(u =>
      u.identities?.some(i => i.connection === 'Username-Password-Authentication')
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        exists:      true,
        hasPassword: !!passwordUser,
      }),
    };

  } catch (err) {
    console.error('check-user error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};
