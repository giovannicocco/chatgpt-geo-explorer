// Cloudflare Worker: Fetch Google Earth Engine sensor data by lat/lon
// Requires: npm install jose

import { importPKCS8, SignJWT } from 'jose';

// Environment bindings (set via Wrangler secrets or env vars):
// - SA_PRIVATE_KEY: Complete service account JSON or just the private key
// - EE_PROJECT: (optional) GCP project for Earth Engine - will be extracted from JSON if not provided
// - SA_CLIENT_EMAIL: (optional) service account email - will be extracted from JSON if not provided

interface Environment {
  EE_PROJECT?: string;
  SA_CLIENT_EMAIL?: string;
  SA_PRIVATE_KEY: string; // Can be JSON string or just the private key
}

interface EarthEngineGeometry {
  type: 'Point';
  coordinates: [number, number];
}

interface EarthEngineRequestBody {
  expression: {
    function: string;
    arguments: {
      geometry: EarthEngineGeometry;
      sensors: string[];
    };
  };
  format: string;
}

interface GoogleOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ServiceAccountJSON {
  client_email: string;
  private_key: string;
  project_id: string;
}

// Extract credentials from service account JSON or individual env vars
function extractCredentials(env: Environment): { clientEmail: string; privateKey: string; projectId: string } {
  try {
    // Try to parse SA_PRIVATE_KEY as JSON first
    const serviceAccount = JSON.parse(env.SA_PRIVATE_KEY) as ServiceAccountJSON;
    return {
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
      projectId: serviceAccount.project_id
    };
  } catch (e) {
    // If parsing fails, assume SA_PRIVATE_KEY is just the private key
    if (!env.SA_CLIENT_EMAIL || !env.EE_PROJECT) {
      throw new Error('SA_CLIENT_EMAIL and EE_PROJECT are required when SA_PRIVATE_KEY is not a JSON');
    }
    return {
      clientEmail: env.SA_CLIENT_EMAIL,
      privateKey: env.SA_PRIVATE_KEY,
      projectId: env.EE_PROJECT
    };
  }
}

export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    try {
      const url = new URL(request.url);
      
      // Handle routing - only accept POST requests to /sensor-data
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
      }
      
      if (url.pathname !== '/sensor-data' && url.pathname !== '/') {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      }
      
      // Parse JSON body
      let requestBody: any;
      try {
        requestBody = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
      }
      
      const { lat, lon } = requestBody;
      
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        return new Response(JSON.stringify({ error: 'Missing or invalid lat/lon parameters' }), { status: 400 });
      }
      
      if (isNaN(lat) || isNaN(lon)) {
        return new Response(JSON.stringify({ error: 'Invalid lat/lon values' }), { status: 400 });
      }

      // Extract credentials from service account JSON or use individual env vars
      const { clientEmail, privateKey, projectId } = extractCredentials(env);

      // Authenticate and get access token
      const token = await getAccessToken(clientEmail, privateKey);

      // Build request body for EE
      const geometry: EarthEngineGeometry = {
        type: 'Point',
        coordinates: [lon, lat]
      };
      const eeRequestBody: EarthEngineRequestBody = {
        expression: {
          function: 'ANALYZE_SENSOR_DATA',
          arguments: {
            geometry,
            sensors: ['NDVI', 'SRTM', 'VV']
          }
        },
        format: 'json'
      };

      // Call Earth Engine compute endpoint
      const eeRes = await fetch(
        `https://earthengine.googleapis.com/v1/projects/${projectId}/value:compute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(eeRequestBody)
        }
      );

      if (!eeRes.ok) {
        const err = await eeRes.text();
        return new Response(JSON.stringify({ error: 'EE compute failed', details: err }), { status: 502 });
      }
      const data = await eeRes.json();

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
  }
};

// Generate OAuth2 JWT Bearer and fetch access token
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1h expiration
  const privateKeyImported = await importPKCS8(privateKey, 'RS256');

  const jwt = await new SignJWT({
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
    scope: 'https://www.googleapis.com/auth/earthengine.readonly'
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKeyImported);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to obtain access token');
  }

  const tokenData = await tokenRes.json() as GoogleOAuthTokenResponse;
  return tokenData.access_token;
}
