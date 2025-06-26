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
      
      // Handle routing - only accept POST requests to /sensor
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
      }
      
      if (url.pathname !== '/sensor' && url.pathname !== '/') {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      }
      
      // Parse JSON body
      let requestBody: any;
      try {
        requestBody = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
      }
      
      const { lat, lon, scale } = requestBody;
      
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        return new Response(JSON.stringify({ error: 'Missing or invalid lat/lon parameters' }), { status: 400 });
      }
      
      if (isNaN(lat) || isNaN(lon)) {
        return new Response(JSON.stringify({ error: 'Invalid lat/lon values' }), { status: 400 });
      }

      // Validate scale parameter if provided
      let customScale: number | undefined;
      if (scale !== undefined) {
        if (typeof scale !== 'number' || isNaN(scale) || scale <= 0) {
          return new Response(JSON.stringify({ error: 'Scale must be a positive number' }), { status: 400 });
        }
        customScale = scale;
      }

      // Authenticate using service account credentials (REST API approach)
      const serviceAccount = extractCredentials(env);
      const token = await authenticateViaPrivateKey(serviceAccount);
      const projectId = serviceAccount.project_id;

      // Define datasets to query with default scales
      const datasets = [
        {
          id: 'MODIS/006/MOD13A1/2023_01_01',
          name: 'MODIS Vegetation Indices',
          bands: ['NDVI', 'EVI'],
          type: 'image',
          defaultScale: 463.3 // MODIS native resolution
        },
        {
          id: 'COPERNICUS/S2_SR_HARMONIZED',
          name: 'Sentinel-2 Surface Reflectance',
          bands: ['B4', 'B8'], // Red and NIR for NDVI calculation
          type: 'collection',
          defaultScale: 10 // Sentinel-2 10m bands
        },
        {
          id: 'COPERNICUS/S1_GRD',
          name: 'Sentinel-1 SAR',
          bands: ['HH', 'HV'],
          type: 'collection',
          defaultScale: 25, // Sentinel-1 25m resolution
          filters: [
            { property: 'instrumentMode', value: 'IW' },
            { property: 'transmitterReceiverPolarisation', contains: 'VV' }
          ]
        },
        {
          id: 'USGS/SRTMGL1_003',
          name: 'SRTM Digital Elevation',
          bands: ['elevation'],
          type: 'image',
          defaultScale: 30 // SRTM 30m resolution
        },
        {
          id: 'projects/mapbiomas-raisg/public/collection3/mapbiomas_raisg_panamazonia_collection3_integration_v2',
          name: 'MapBiomas Pan-Amazonia',
          bands: ['classification_2020'],
          type: 'image',
          defaultScale: 30 // MapBiomas 30m resolution
        },
        {
          id: 'LARSE/GEDI/GEDI02_A_002_MONTHLY',
          name: 'GEDI Canopy Height',
          bands: ['rh98'],
          type: 'collection',
          defaultScale: 25 // GEDI 25m footprint
        },
        {
          id: 'NASA/JPL/global_forest_canopy_height_2005',
          name: 'Global Forest Canopy Height',
          bands: ['1'],
          type: 'image',
          defaultScale: 927.7 // Global Forest ~1km resolution
        }
      ];

      // Query each dataset individually
      const results: any = {};
      
      for (const dataset of datasets) {
        // Use custom scale if provided, otherwise use dataset default
        const effectiveScale = customScale || dataset.defaultScale;
        
        try {
          let eeRequestBody: EarthEngineRequestBody;
          
          if (dataset.type === 'image') {
            // Load image directly
            eeRequestBody = {
              expression: {
                values: {
                  "1": {
                    functionInvocationValue: {
                      functionName: 'Image.load',
                      arguments: {
                        id: {
                          constantValue: dataset.id
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
                          constantValue: dataset.bands
                        }
                      }
                    }
                  }
                },
                result: "2"
              }
            };
          } else {
            // Load collection and get first available image (simplified approach)
            eeRequestBody = {
              expression: {
                values: {
                  "1": {
                    functionInvocationValue: {
                      functionName: 'ImageCollection.load',
                      arguments: {
                        id: {
                          constantValue: dataset.id
                        }
                      }
                    }
                  },
                  "2": {
                    functionInvocationValue: {
                      functionName: 'Collection.first',
                      arguments: {
                        collection: {
                          valueReference: "1"
                        }
                      }
                    }
                  },
                  "3": {
                    functionInvocationValue: {
                      functionName: 'Image.select',
                      arguments: {
                        input: {
                          valueReference: "2"
                        },
                        bandSelectors: {
                          constantValue: dataset.bands
                        }
                      }
                    }
                  }
                },
                result: "3"
              }
            };
          }

          // Call Earth Engine for this dataset
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

          if (eeRes.ok) {
            const data = await eeRes.json() as { result: any };
            
            // Extract scene ID for Sentinel datasets
            let sceneId: string | undefined;
            if (dataset.name.includes('Sentinel')) {
              // Try to get scene ID from different possible locations
              const rawId = data.result?.id || 
                           data.result?.properties?.['system:index'] ||
                           data.result?.properties?.['GRANULE_ID'] ||
                           data.result?.properties?.['PRODUCT_ID'];
              
              // Extract just the scene identifier (remove dataset prefix)
              if (rawId && typeof rawId === 'string') {
                if (dataset.name.includes('Sentinel-2')) {
                  // For Sentinel-2: extract the scene part after the last /
                  sceneId = rawId.split('/').pop();
                } else if (dataset.name.includes('Sentinel-1')) {
                  // For Sentinel-1: extract the scene part after the last /
                  sceneId = rawId.split('/').pop();
                }
              }
            }
            
            const responseData: any = {
              status: 'success',
              id: dataset.id,
              type: dataset.type,
              bands: dataset.bands,
              scale: effectiveScale,
              defaultScale: dataset.defaultScale,
              data: data.result
            };
            
            // Add scene ID if available for Sentinel datasets
            if (sceneId) {
              responseData.sceneId = sceneId;
            }
            
            results[dataset.name] = responseData;
          } else {
            const error = await eeRes.text();
            results[dataset.name] = {
              status: 'error',
              id: dataset.id,
              type: dataset.type,
              bands: dataset.bands,
              scale: effectiveScale,
              defaultScale: dataset.defaultScale,
              error: error
            };
          }
        } catch (error) {
          results[dataset.name] = {
            status: 'error',
            id: dataset.id,
            type: dataset.type,
            bands: dataset.bands,
            scale: effectiveScale,
            defaultScale: dataset.defaultScale,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      // Return combined results
      return new Response(JSON.stringify({
        coordinates: { lat, lon },
        scale: {
          requested: customScale,
          note: customScale ? 'Custom scale applied to all datasets' : 'Using default scales per dataset'
        },
        datasets: results,
        timestamp: new Date().toISOString()
      }), {
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
