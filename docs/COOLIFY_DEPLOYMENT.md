# WorkChat Coolify Deployment Guide

## Server Details
- **OVH VPS**: vps-6df1739c.vps.ovh.net
- **Server IP**: 51.195.46.40
- **Coolify URL**: http://51.195.46.40:8000
- **GitHub Repo**: https://github.com/arsalan507/workchat.git

---

## Step-by-Step Deployment

### Step 1: Connect GitHub Repository

1. Go to Coolify Dashboard → **Sources**
2. Click **Add New Source** → Select **GitHub**
3. Authorize Coolify to access your GitHub account
4. Select repository: `arsalan507/workchat`

---

### Step 2: Set Up PostgreSQL Database

1. In your Coolify project, click **+ New Resource**
2. Select **Database** → **PostgreSQL**
3. Configure:
   - **Name**: `workchat-db`
   - **Version**: `16` (Alpine)
   - **Database Name**: `workchat`
   - **Username**: `workchat`
   - **Password**: Generate a secure password (save it!)
4. Click **Deploy**
5. Wait for database to be ready (green status)
6. **Copy the connection URL** - you'll need it for the API

**Connection URL format**:
```
postgresql://workchat:YOUR_PASSWORD@workchat-db:5432/workchat
```

---

### Step 3: Set Up Redis

1. Click **+ New Resource**
2. Select **Database** → **Redis**
3. Configure:
   - **Name**: `workchat-redis`
   - **Version**: `7` (Alpine)
4. Click **Deploy**
5. Wait for Redis to be ready

**Redis URL**: `redis://workchat-redis:6379`

---

### Step 4: Deploy API Service

1. Click **+ New Resource**
2. Select **Application** → **Docker Image** (or Dockerfile)
3. Configure:
   - **Name**: `workchat-api`
   - **Source**: GitHub → `arsalan507/workchat`
   - **Branch**: `main`
   - **Build Pack**: Dockerfile
   - **Dockerfile Location**: `packages/api/Dockerfile`
   - **Port**: `3000`

4. Add **Environment Variables**:

```env
# Server
NODE_ENV=production
PORT=3000

# Database (use internal Coolify URL)
DATABASE_URL=postgresql://workchat:YOUR_DB_PASSWORD@workchat-db:5432/workchat

# Redis (use internal Coolify URL)
REDIS_URL=redis://workchat-redis:6379

# JWT (generate a secure 32+ character secret)
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Twilio (for OTP - optional for testing)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_VERIFY_SERVICE_SID=your-verify-sid

# CORS (your web app URL)
CORS_ORIGIN=http://51.195.46.40:3001

# Upload directory
UPLOAD_DIR=./uploads
API_BASE_URL=http://51.195.46.40:3000
```

5. Click **Deploy**
6. After deployment, note the **API URL**: `http://51.195.46.40:3000`

---

### Step 5: Run Database Migrations

After the API is deployed, you need to run Prisma migrations:

1. Go to your API service in Coolify
2. Click **Terminal** or **Execute Command**
3. Run:
```bash
npx prisma migrate deploy
```

Or SSH into your server and run:
```bash
docker exec -it workchat-api npx prisma migrate deploy
```

---

### Step 6: Deploy Web Frontend

1. Click **+ New Resource**
2. Select **Application** → **Docker Image**
3. Configure:
   - **Name**: `workchat-web`
   - **Source**: GitHub → `arsalan507/workchat`
   - **Branch**: `main`
   - **Build Pack**: Dockerfile
   - **Dockerfile Location**: `apps/web/Dockerfile`
   - **Port**: `80`

4. Add **Build Arguments**:

```env
VITE_API_URL=http://51.195.46.40:3000
VITE_WS_URL=ws://51.195.46.40:3000
```

5. Click **Deploy**
6. After deployment, access your app at: `http://51.195.46.40:3001`

---

### Step 7: Configure Domain & SSL (Optional)

If you have a domain:

1. Point your domain DNS to `51.195.46.40`:
   - `workchat.yourdomain.com` → A record → `51.195.46.40`
   - `api.workchat.yourdomain.com` → A record → `51.195.46.40`

2. In Coolify, for each service:
   - Go to **Settings** → **Domain**
   - Add your domain
   - Enable **SSL** (Let's Encrypt)

3. Update environment variables:
   - API: `CORS_ORIGIN=https://workchat.yourdomain.com`
   - Web:
     - `VITE_API_URL=https://api.workchat.yourdomain.com`
     - `VITE_WS_URL=wss://api.workchat.yourdomain.com`

---

## Quick Reference: All Environment Variables

### API Service (`workchat-api`)

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` | API port |
| `DATABASE_URL` | `postgresql://workchat:PASS@workchat-db:5432/workchat` | PostgreSQL connection |
| `REDIS_URL` | `redis://workchat-redis:6379` | Redis connection |
| `JWT_SECRET` | `your-32-char-secret` | JWT signing secret |
| `JWT_EXPIRES_IN` | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiry |
| `CORS_ORIGIN` | `http://51.195.46.40:3001` | Web app URL |
| `UPLOAD_DIR` | `./uploads` | File upload directory |
| `API_BASE_URL` | `http://51.195.46.40:3000` | API public URL |

### Web Service (`workchat-web`) - Build Args

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `http://51.195.46.40:3000` | API URL for frontend |
| `VITE_WS_URL` | `ws://51.195.46.40:3000` | WebSocket URL |

---

## Troubleshooting

### Database Connection Failed
1. Ensure PostgreSQL is running (green status)
2. Check `DATABASE_URL` uses internal network name (`workchat-db`)
3. Verify password matches

### API Returns 500
1. Check API logs in Coolify
2. Run migrations: `npx prisma migrate deploy`
3. Verify all environment variables are set

### WebSocket Not Connecting
1. Ensure `VITE_WS_URL` uses `ws://` (not `wss://` without SSL)
2. Check API is running and accessible

### Build Fails
1. Check Dockerfile path is correct
2. Ensure `pnpm-lock.yaml` is committed to git
3. Check build logs for specific errors

---

## Deployment Checklist

- [ ] PostgreSQL deployed and running
- [ ] Redis deployed and running
- [ ] API deployed with all environment variables
- [ ] Database migrations run
- [ ] Web frontend deployed with build args
- [ ] Test OTP flow (or use dev mode)
- [ ] Test chat functionality
- [ ] Test file uploads

---

## Useful Commands

```bash
# SSH into server
ssh root@51.195.46.40

# Check container logs
docker logs workchat-api
docker logs workchat-web
docker logs workchat-db

# Restart a service
docker restart workchat-api

# Run database migrations manually
docker exec -it workchat-api npx prisma migrate deploy

# Create database backup
docker exec workchat-db pg_dump -U workchat workchat > backup.sql
```
