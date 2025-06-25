// Cloudflare Worker: Fetch Google Earth Engine sensor data by lat/lon
// Requires: npm install @google/earthengine

import ee from '@google/earthengine';

// Environment bindings (set via Wrangler secrets or env vars):
// - SA_PRIVATE_KEY: Full service account JSON used to authenticate with Earth Engine

interface Environment {
  SA_PRIVATE_KEY: string; // Service account JSON
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

      // Extract credentials and authenticate using the Earth Engine client
      const serviceAccount = extractCredentials(env);
      await authenticateEE(serviceAccount);
      const token = ee.data.getAuthToken();
      const projectId = serviceAccount.project_id;

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
            Authorization: token || ''
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

// Authenticate the Earth Engine client library with a service account key
function authenticateEE(privateKey: ServiceAccountJSON): Promise<void> {
  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(privateKey, () => {
      ee.initialize(null, null, resolve, reject);
    }, reject);
  });
}
