# 📊 Geo-Explorer API Examples

## Overview

This document provides practical examples for using the Geo-Explorer API endpoints for archaeological and environmental remote sensing analysis.

## Sensor Data Examples

### 1. Basic Multi-Sensor Data Request

```bash
curl -X POST https://geo-explorer.heg-business.workers.dev/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": -2.8, "lon": -60.3}'
```

**Use Case**: Get quantitative data from all 7 Earth observation datasets at default resolutions for initial site assessment.

### 2. High-Resolution Custom Scale Request

```bash
curl -X POST https://geo-explorer.heg-business.workers.dev/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": -23.5505, "lon": -46.6333, "scale": 10}'
```

**Use Case**: Urban archaeology in São Paulo with 10m resolution for all datasets to identify subtle anthropogenic features.

### 3. Archaeological Site in Peru

```bash
curl -X POST https://geo-explorer.heg-business.workers.dev/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": -13.1639, "lon": -72.5450, "scale": 30}'
```

**Use Case**: Machu Picchu area analysis - combining elevation data with vegetation indices to identify potential archaeological structures.

## Image Visualization Examples

### 1. Sentinel-2 True Color Composite

```bash
curl -X POST https://geo-explorer.heg-business.workers.dev/image \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -2.8,
    "lon": -60.3,
    "dataset": "Sentinel-2 Surface Reflectance",
    "width": 1024,
    "height": 1024
  }'
```

**Expected Response**:
```json
{
  "coordinates": {"lat": -2.8, "lon": -60.3},
  "dataset": "Sentinel-2 Surface Reflectance",
  "imageUrl": "https://earthengine.googleapis.com/v1/projects/earthengine-legacy/thumbnails?...",
  "visualization": {
    "bands": ["B4", "B3", "B2"],
    "min": 0,
    "max": 3000,
    "gamma": 1.4
  },
  "dimensions": {"width": 1024, "height": 1024}
}
```

### 2. Elevation Terrain Visualization

```bash
curl -X POST https://geo-explorer.heg-business.workers.dev/image \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -13.1639,
    "lon": -72.5450,
    "dataset": "SRTM Digital Elevation",
    "width": 800,
    "height": 600
  }'
```

**Use Case**: Topographic analysis for understanding site accessibility and defensive positions in ancient settlements.

### 3. Forest Canopy Height Analysis

```bash
curl -X POST https://geo-explorer.heg-business.workers.dev/image \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -2.8,
    "lon": -60.3,
    "dataset": "Global Forest Canopy Height",
    "width": 512,
    "height": 512
  }'
```

**Use Case**: Identifying forest-covered archaeological sites through canopy height variations that might indicate buried structures.

## Archaeological Analysis Workflow

### Step 1: Initial Site Survey
```bash
# Get comprehensive sensor data
curl -X POST https://geo-explorer.heg-business.workers.dev/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": -15.8, "lon": -70.2, "scale": 20}'
```

### Step 2: Visual Analysis
```bash
# Generate Sentinel-2 true color image
curl -X POST https://geo-explorer.heg-business.workers.dev/image \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -15.8,
    "lon": -70.2,
    "dataset": "Sentinel-2 Surface Reflectance",
    "width": 1024,
    "height": 1024
  }'

# Generate elevation map
curl -X POST https://geo-explorer.heg-business.workers.dev/image \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -15.8,
    "lon": -70.2,
    "dataset": "SRTM Digital Elevation",
    "width": 1024,
    "height": 1024
  }'
```

### Step 3: Quantitative Analysis

Extract key metrics from sensor data response:

- **NDVI Values**: Vegetation health indicators
- **Scene IDs**: For temporal analysis and data traceability
- **Elevation**: Topographic context
- **SAR Data**: Weather-independent surface analysis
- **Forest Height**: Canopy structure analysis

## Response Data Interpretation

### Scene ID Extraction for Temporal Analysis

From Sentinel-2 data:
```json
{
  "dataset": "Sentinel-2 Surface Reflectance",
  "sceneId": "20170328T083601_20170328T084228_T35RNK",
  "data": {
    "status": "success",
    "result": {
      "B04": 0.2345,
      "B08": 0.6789,
      "ndvi": 0.5432
    }
  }
}
```

**Scene ID Breakdown**:
- `20170328T083601`: Acquisition date and time (March 28, 2017, 08:36:01 UTC)
- `20170328T084228`: End time
- `T35RNK`: MGRS tile identifier

### Vegetation Analysis

**NDVI Interpretation**:
- `NDVI > 0.6`: Dense vegetation
- `NDVI 0.3-0.6`: Moderate vegetation
- `NDVI < 0.3`: Sparse vegetation/bare soil
- `NDVI < 0`: Water or built surfaces

### Archaeological Indicators

1. **Crop Marks**: NDVI variations indicating subsurface features
2. **Soil Marks**: Spectral differences in bare soil areas
3. **Shadow Marks**: Elevation differences creating shadows
4. **Vegetation Stress**: Lower NDVI over buried structures

## Custom GPT Integration

When using this API with custom GPTs for archaeological analysis, include these requirements:

### Required Data Points in Analysis

1. **Quantitative Values**: Always report specific NDVI, elevation, and spectral values
2. **Scene IDs**: Include for data traceability
3. **Spatial Context**: Reference coordinate precision and scale
4. **Temporal Information**: Use timestamps for change detection

### Example GPT Prompt Response

```
Archaeological Analysis Report

Location: 13°09'50.0"S 72°32'42.0"W (Machu Picchu area)
Analysis Date: 2024-01-15T10:30:00Z

Quantitative Data:
- NDVI: 0.742 (dense vegetation, potential masking of structures)
- Elevation: 2,430m (consistent with historical records)
- Scene ID: 20170328T083601_20170328T084228_T35RNK
- Forest Canopy Height: 15.3m (moderate canopy cover)

Archaeological Interpretation:
The high NDVI values (0.742) suggest dense vegetation cover that may be masking archaeological features. The elevation data (2,430m) confirms the mountainous terrain typical of Inca settlements. SAR data shows geometric patterns potentially indicating terraced agriculture structures.

Recommendations:
1. Conduct seasonal analysis using multiple scene IDs
2. Apply vegetation penetration techniques using SAR data
3. Focus on areas with NDVI < 0.5 for potential exposed structures
```

## Error Handling Examples

### Invalid Coordinates

```bash
curl -X POST https://geo-explorer.heg-business.workers.dev/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": 100, "lon": -60.3}'
```

Response:
```json
{
  "error": "Invalid coordinates",
  "message": "Latitude must be between -90 and 90"
}
```

### Invalid Dataset for Image Request

```bash
curl -X POST https://geo-explorer.heg-business.workers.dev/image \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -2.8,
    "lon": -60.3,
    "dataset": "Invalid Dataset Name",
    "width": 512,
    "height": 512
  }'
```

Response:
```json
{
  "error": "Dataset not found",
  "availableDatasets": [
    "MODIS Vegetation Indices",
    "Sentinel-2 Surface Reflectance",
    "Sentinel-1 SAR",
    "SRTM Digital Elevation",
    "Global Forest Canopy Height"
  ]
}
```

## Best Practices

### 1. Resolution Selection
- **10m**: Detailed analysis (Sentinel-2, building detection)
- **30m**: Regional analysis (SRTM, land use)
- **500m**: Continental monitoring (MODIS, climate)

### 2. Dataset Combinations
- **Sentinel-2 + SRTM**: Comprehensive site analysis
- **Sentinel-1 + Sentinel-2**: All-weather monitoring
- **GEDI + Global Forest Height**: Vegetation structure analysis

### 3. Temporal Analysis
- Use scene IDs to track changes over time
- Combine multiple acquisition dates for seasonal analysis
- Monitor NDVI variations for crop mark detection

### 4. Quality Control
- Check data status for each dataset
- Verify scene IDs for data provenance
- Cross-reference coordinates with ground truth data
