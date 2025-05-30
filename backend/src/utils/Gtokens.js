import { OAuth2Client } from 'google-auth-library';
import fetch from 'node-fetch';
import users from '../models/user.cache.model.js';

// Helper: Refresh access token
async function refreshAccessToken(user) {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  
  client.setCredentials({ refresh_token: user.refreshToken });

  try {
   
    const { credentials } = await client.refreshAccessToken();
    user.accessToken = credentials.access_token;
    users.set(user.id, user); // Update in-memory store
    return credentials.access_token;
  } catch (err) {
    console.error('Error refreshing token:', err);
    return null;
  }
}


async function validateGoogleAccessTokenDetailed(accessToken) {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data.error_description && data.error_description.toLowerCase().includes('expired')) {
        return { valid: false, reason: 'expired' };
      }
      return { valid: false, reason: 'invalid' };
    }
    return { valid: true };
  } catch (err) {
    console.error('Error validating access token:', err);
    return { valid: false, reason: 'invalid' };
  }
}


export{ refreshAccessToken, validateGoogleAccessTokenDetailed };