// Cloudflare Worker: Fetch Google Earth Engine sensor data by lat/lon
// Requires: npm install jose

import { importPKCS8, SignJWT } from 'jose';

// Environment bindings (set via Wrangler secrets or env vars):
// - SA_PRIVATE_KEY: Full service account JSON used to authenticate with Earth Engine

interface Environment {
  SA_PRIVATE_KEY: string; // Service account JSON
}

interface EarthEngineRequestBody {
  expression: object; // Earth Engine expression object
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
function extractCredentials(env: Environment): ServiceAccountJSON {
  let serviceAccount: ServiceAccountJSON;
  try {
    serviceAccount = JSON.parse(env.SA_PRIVATE_KEY) as ServiceAccountJSON;
  } catch (error) {
    throw new Error("Invalid JSON in SA_PRIVATE_KEY environment variable: " + (error instanceof Error ? error.message : String(error)));
  }
  return serviceAccount;
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

      // Authenticate using service account credentials (REST API approach)
      const serviceAccount = extractCredentials(env);
      const token = await authenticateViaPrivateKey(serviceAccount);
      const projectId = serviceAccount.project_id;

      // Build Earth Engine expression to get NDVI pixel value at coordinates
      const eeRequestBody: EarthEngineRequestBody = {
        expression: {
          values: {
            "1": {
              functionInvocationValue: {
                functionName: 'Image.load',
                arguments: {
                  id: {
                    constantValue: 'MODIS/006/MOD13A1/2023_01_01'
                  }
                }
              }
            },
            "2": {
              functionInvocationValue: {
                functionName: 'Image.select',
                arguments: {
                  input: {
                    valueReference: "1"
                  },
                  bandSelectors: {
                    constantValue: ['NDVI']
                  }
                }
              }
            }
          },
          result: "2"
        }
      };

      // Call Earth Engine value:compute endpoint
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
      const data = await eeRes.json() as { result: object };

      // Extract the result from Earth Engine response
      return new Response(JSON.stringify(data.result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
  }
};

// Authenticate using service account private key (REST API approach)
async function authenticateViaPrivateKey(serviceAccount: ServiceAccountJSON): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1h expiration
  const privateKeyImported = await importPKCS8(serviceAccount.private_key, 'RS256');

  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
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
    const errorText = await tokenRes.text();
    throw new Error(`Authentication error: ${errorText}`);
  }

  const tokenData = await tokenRes.json() as GoogleOAuthTokenResponse;
  return tokenData.access_token;
}
