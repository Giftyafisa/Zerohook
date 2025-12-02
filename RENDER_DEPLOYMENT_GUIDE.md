# Zerohook Render.com Deployment Guide

## Architecture Overview

You'll deploy **2 separate services** on Render:

1. **Backend API** (Web Service) - `zerohook-api.onrender.com`
2. **Frontend Web App** (Static Site) - `zerohook.onrender.com`

The **Mobile App** will connect directly to the Backend API URL.

---

## Step 1: Prepare Your Repository

### Option A: Single Repository (Recommended)
Your current structure works - Render can deploy from subdirectories.

### Option B: Separate Repositories
Split into `zerohook-api` and `zerohook-web` repos.

---

## Step 2: Deploy Backend API (Web Service)

### 2.1 Create New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `zerohook-api` |
| **Region** | Oregon (US West) - same as your DB |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter $7/mo for production) |

### 2.2 Set Environment Variables

In Render Dashboard → Your Service → **Environment**:

```env
NODE_ENV=production
PORT=10000

# Database (Your existing Render PostgreSQL)
DATABASE_URL=postgresql://zerohook:9gc8nNYOUAWP6fwcnogoANkLleKLcFYA@dpg-d4m9bqili9vc73emk150-a.oregon-postgres.render.com/zerohookdb

# JWT
JWT_SECRET=your-secure-random-string-change-this-in-production
JWT_EXPIRE=7d

# CORS - Update after frontend is deployed
CLIENT_URL=https://zerohook.onrender.com

# Paystack
PAYSTACK_SECRET_KEY=sk_test_9c8ed29806799887814242571899edf82071ac09
PAYSTACK_PUBLIC_KEY=pk_test_7f3cabce055cc9cb562103752d9348c39d7fde9b

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Country
DEFAULT_COUNTRY=NG
SUPPORTED_COUNTRIES=NG,GH,KE,ZA,UG,TZ,RW,BW,ZM,MW

# Security
ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

### 2.3 Your Backend URL will be:
```
https://zerohook-api.onrender.com
```

---

## Step 3: Deploy Frontend (Static Site)

### 3.1 Create New Static Site on Render

1. Click **"New +"** → **"Static Site"**
2. Connect same repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `zerohook` |
| **Branch** | `main` |
| **Root Directory** | `client` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `build` |

### 3.2 Set Environment Variables

```env
REACT_APP_API_URL=https://zerohook-api.onrender.com/api
REACT_APP_SOCKET_URL=https://zerohook-api.onrender.com
REACT_APP_DEFAULT_COUNTRY=NG
REACT_APP_SUPPORTED_COUNTRIES=NG,GH,KE,ZA,UG,TZ,RW,BW,ZM,MW
REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_7f3cabce055cc9cb562103752d9348c39d7fde9b
REACT_APP_ENABLE_VIDEO_CALLS=true
REACT_APP_ENABLE_CRYPTO_PAYMENTS=true
REACT_APP_ENABLE_TRUST_SYSTEM=true
```

### 3.3 Add Rewrite Rules for React Router

Create a file `client/public/_redirects`:
```
/* /index.html 200
```

Or create `client/render.yaml`:
```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

### 3.4 Your Frontend URL will be:
```
https://zerohook.onrender.com
```

---

## Step 4: Update Backend CORS for Production

After both are deployed, update the backend `CLIENT_URL` environment variable:

```env
CLIENT_URL=https://zerohook.onrender.com
```

---

## Step 5: Mobile App Configuration

In your mobile app, set the API URL:

### React Native / Expo:
```javascript
// mobile/src/config/api.js
export const API_URL = 'https://zerohook-api.onrender.com/api';
export const SOCKET_URL = 'https://zerohook-api.onrender.com';
```

### For Development (local testing):
```javascript
// Use your computer's local IP, not localhost
export const API_URL = __DEV__ 
  ? 'http://192.168.x.x:5000/api'  // Your local IP
  : 'https://zerohook-api.onrender.com/api';
```

---

## Step 6: Update CORS for Mobile App

The backend needs to accept requests from mobile apps. Update `server/index.js`:

```javascript
app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    'https://zerohook.onrender.com',
    'http://localhost:3000',
    'http://localhost:19006', // Expo web
    // Mobile apps don't send Origin header, so they work by default
  ].filter(Boolean),
  credentials: true
}));
```

---

## Summary URLs

| Service | URL | Used By |
|---------|-----|---------|
| **Backend API** | `https://zerohook-api.onrender.com` | Frontend + Mobile |
| **Frontend Web** | `https://zerohook.onrender.com` | Desktop browsers |
| **Database** | Internal Render connection | Backend only |

---

## Testing After Deployment

### Test Backend:
```bash
curl https://zerohook-api.onrender.com/api/health
```

### Test Frontend:
Visit `https://zerohook.onrender.com` in browser

### Test Mobile:
Update your mobile app's API_URL and test login/registration

---

## Troubleshooting

### "CORS Error" on Frontend
- Verify `CLIENT_URL` in backend environment matches your frontend URL exactly
- Check for trailing slashes (should be `https://zerohook.onrender.com` not `https://zerohook.onrender.com/`)

### "502 Bad Gateway" on Backend
- Check Render logs for startup errors
- Ensure `PORT` is not hardcoded - Render assigns it dynamically
- Use `process.env.PORT || 5000`

### "API calls fail" on Mobile
- Mobile apps don't send CORS headers - should work by default
- Check if backend is accepting the request (check Render logs)
- Ensure HTTPS is used (not HTTP)

### Database Connection Fails
- Use the **External** Database URL from Render dashboard
- Ensure `?sslmode=require` is in the connection string

---

## Cost Estimate (Render.com)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Backend (Web Service) | Free (spins down after 15min inactivity) | $7/mo Starter |
| Frontend (Static Site) | Free | Free |
| PostgreSQL | Free 90 days, then $7/mo | $7/mo |
| **Total** | Free (90 days) | ~$14/mo |

---

## Quick Deploy Checklist

- [ ] Push code to GitHub
- [ ] Create Backend Web Service on Render
- [ ] Set backend environment variables
- [ ] Wait for backend to deploy
- [ ] Test backend health endpoint
- [ ] Create Frontend Static Site on Render
- [ ] Set frontend environment variables
- [ ] Add `_redirects` file for React Router
- [ ] Wait for frontend to deploy
- [ ] Update backend `CLIENT_URL` to frontend URL
- [ ] Test full login flow on web
- [ ] Update mobile app API_URL
- [ ] Test mobile app
