# Geo Explorer API

A Cloudflare Worker that integrates with Google Earth Engine REST API to fetch multi-sensor satellite data by latitude/longitude coordinates.

## 🛰️ Supported Datasets

| Dataset | Bands | Default Resolution | Description |
|---------|-------|-------------------|-------------|
| **MODIS Vegetation Indices** | NDVI, EVI | 463.3m | Vegetation health indicators |
| **Sentinel-2 Surface Reflectance** | B4, B8 | 10m | High-resolution optical imagery |
| **Sentinel-1 SAR** | HH, HV | 25m | Radar data for all-weather monitoring |
| **SRTM Digital Elevation** | elevation | 30m | Global topographic data |
| **MapBiomas Pan-Amazonia** | classification_2020 | 30m | Land use/land cover classification |
| **GEDI Canopy Height** | rh98 | 25m | LiDAR-derived forest canopy height |
| **Global Forest Canopy Height** | 1 | 927.7m | Global tree height estimates |

## 🚀 API Usage

### Sensor Data Request (Default Resolutions)

```bash
curl -X POST https://api.giovannicocco.com.br/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": -2.8, "lon": -60.3}'
```

### Custom Resolution Request

```bash
curl -X POST https://api.giovannicocco.com.br/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": -2.8, "lon": -60.3, "scale": 50}'
```

## 📋 Response Formats

### Sensor Data Response

The `/sensor` endpoint returns detailed sensor data from all datasets:

```json
{
  "coordinates": {
    "lat": -2.8,
    "lon": -60.3
  },
  "sensorData": [
    {
      "dataset": "MODIS Terra/Aqua Surface Reflectance",
      "resolution": "500m",
      "data": {
        "status": "success",
        "result": {
          "red": 0.1234,
          "nir": 0.5678,
          "ndvi": 0.4567
        }
      },
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "dataset": "Sentinel-2 Surface Reflectance",
      "resolution": "10m",
      "data": {
        "status": "success",
        "result": {
          "B04": 0.2345,
          "B08": 0.6789,
          "ndvi": 0.5432
        }
      },
      "sceneId": "20170328T083601_20170328T084228_T35RNK",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Legacy Response Structure (Detailed)

```json
{
  "coordinates": {
    "lat": -2.8,
    "lon": -60.3
  },
  "scale": {
    "requested": 50,
    "note": "Custom scale applied to all datasets"
  },
  "datasets": {
    "MODIS Vegetation Indices": {
      "status": "success",
      "id": "MODIS/006/MOD13A1/2023_01_01",
      "type": "image",
      "bands": ["NDVI", "EVI"],
      "scale": 50,
      "defaultScale": 463.3,
      "data": {
        "type": "Image",
        "properties": { ... }
      }
    },
    "Sentinel-2 Surface Reflectance": {
      "status": "success",
      "scale": 50,
      "defaultScale": 10,
      "sceneId": "20170328T083601_20170328T084228_T35RNK",
      ...
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🎯 Available Endpoints

### Sensor Data Endpoint (`/sensor`)

Provides quantitative data from multiple Earth observation datasets:

1. **MODIS Terra/Aqua Surface Reflectance** (500m resolution)
   - Bands: Red, NIR, NDVI values
   - Global coverage, high temporal frequency

2. **Sentinel-1 C-band SAR** (10m resolution)
   - Polarizations: VV, VH
   - Scene ID extraction for specific acquisitions
   - Weather-independent radar imaging

3. **Sentinel-2 Surface Reflectance** (10m resolution) 
   - Multispectral bands (B02-B12)
   - NDVI calculation
   - Scene ID extraction for data traceability

4. **SRTM Digital Elevation Model** (30m resolution)
   - Elevation data worldwide
   - Topographic analysis support

5. **MapBiomas Land Use Classification** (30m resolution)
   - Brazil land cover classification
   - Annual land use maps

6. **GEDI Forest Canopy Height** (25m resolution)
   - Lidar-derived canopy height
   - Forest structure metrics

7. **Global Forest Height Map** (30m resolution)
   - Wall-to-wall forest height estimates
   - Global forest monitoring

## 📖 Parameters

### Sensor Data Endpoint (`/sensor`)

- **lat** (required): Latitude coordinate (-90 to 90)
- **lon** (required): Longitude coordinate (-180 to 180)  
- **scale** (optional): Custom resolution in meters (1-10000)

## 🆔 Scene IDs

For Sentinel datasets, the API automatically extracts and returns scene IDs:

- **Sentinel-2**: Format like `20170328T083601_20170328T084228_T35RNK`
- **Sentinel-1**: Format like `S1A_EW_GRDH_1SDH_20141003T003636_20141003T003740_002658_002F54_ECFA`

These scene IDs are useful for:
- Tracking specific satellite acquisitions
- Cross-referencing with other datasets
- Time series analysis
- Data provenance and quality control

## � Documentation

- **[Examples](./EXAMPLES.md)**: Practical usage examples for archaeological analysis
- **[Deployment Guide](./DEPLOYMENT.md)**: Step-by-step deployment instructions
- **[Custom GPT System Prompt](./CUSTOM_GPT_SYSTEM_PROMPT.md)**: AI integration for archaeological analysis
- **[Data Analysis Instructions](./DATA_ANALYSIS_INSTRUCTIONS.md)**: Technical analysis guidelines
- **[API Specification](./src/openapi:%203.1.yml)**: Complete OpenAPI 3.1 schema

## �🔧 Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test locally
curl -X POST http://localhost:8787/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": -23.5505, "lon": -46.6333}'
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## 🌍 Authentication

The API uses OAuth2 JWT authentication with Google Earth Engine. Service account credentials are configured via Cloudflare Workers environment variables.

## 📊 Use Cases

- **Environmental Monitoring**: Track vegetation changes and deforestation
- **Climate Research**: Analyze multi-temporal satellite data
- **Agriculture**: Monitor crop health with vegetation indices
- **Forest Management**: Assess canopy height and forest structure
- **Land Use Planning**: Understand terrain and land cover patterns

## 🔗 API Documentation

Full OpenAPI 3.1 specification available at `src/openapi: 3.1.yml`

## 📝 License

MIT License
