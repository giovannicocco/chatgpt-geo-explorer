# Deployment Guide - Geo Explorer API

## 🚀 Quick Deployment

### 1. Prerequisites
- Cloudflare Workers account
- Google Earth Engine service account
- Wrangler CLI installed (`npm install -g wrangler`)

### 2. Google Earth Engine Setup

1. **Create a Service Account:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable the Earth Engine API
   - Create a service account with Earth Engine access
   - Download the JSON key file

2. **Register with Earth Engine:**
   - Go to [Earth Engine](https://code.earthengine.google.com/)
   - Register your service account email

### 3. Configure Secrets

Set your Google Earth Engine credentials as Cloudflare Workers secrets:

```bash
# Set service account email
wrangler secret put GEE_SERVICE_ACCOUNT_EMAIL
# Enter: your-service-account@your-project.iam.gserviceaccount.com

# Set private key (from downloaded JSON file)
wrangler secret put GEE_PRIVATE_KEY
# Enter: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

### 4. Deploy

```bash
# Install dependencies
npm install

# Deploy to Cloudflare Workers
npm run deploy
# or
wrangler deploy
```

### 5. Test Your Deployment

```bash
curl -X POST https://geo-explorer.YOUR_SUBDOMAIN.workers.dev/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": -2.8, "lon": -60.3}'
```

## 🔧 Local Development

```bash
# Set environment variables for local development
export GEE_SERVICE_ACCOUNT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
export GEE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Start development server
npm run dev

# Test locally
curl -X POST http://localhost:8787/sensor \
  -H "Content-Type: application/json" \
  -d '{"lat": -23.5505, "lon": -46.6333}'
```

## 📊 Monitoring

The API includes observability features enabled in `wrangler.jsonc`. Monitor your deployment through:
- Cloudflare Workers dashboard
- Real-time logs with `wrangler tail`
- Analytics and metrics

## 🔒 Security Notes

- Never commit service account credentials to version control
- Use Cloudflare Workers secrets for sensitive data
- Rotate service account keys regularly
- Monitor API usage and set appropriate rate limits

## 🌍 Custom Domain (Optional)

To use a custom domain:

1. Add your domain to Cloudflare
2. Configure DNS
3. Add route in `wrangler.jsonc`:

```jsonc
{
  "routes": [
    {
      "pattern": "api.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

## 📈 Scaling Considerations

- Google Earth Engine has usage quotas
- Cloudflare Workers have execution time limits (10s for free tier)
- Consider implementing caching for frequently accessed data
- Monitor and optimize cold start times
