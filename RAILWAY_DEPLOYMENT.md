# TireScan - Railway Deployment Guide

## Overview
TireScan adalah aplikasi Django untuk analisis ban menggunakan machine learning. Aplikasi ini sudah dikonfigurasi untuk berjalan di Railway dengan PostgreSQL database.

## Architecture
```
┌─────────────────────────────────────────┐
│         Railway Platform                │
├─────────────────────────────────────────┤
│ ┌─────────────┐      ┌──────────────┐   │
│ │   Django    │◄────►│  PostgreSQL  │   │
│ │  Gunicorn   │      │   Railway    │   │
│ │             │      │              │   │
│ └─────────────┘      └──────────────┘   │
│  ▼ Static Files                         │
│  (WhiteNoise)                           │
└─────────────────────────────────────────┘
```

## Prerequisites
- Railway Account (railway.app)
- PostgreSQL Database on Railway
- Environment variables configured

## Setup Instructions

### 1. Database Connection
Railway automatically provides these environment variables:
- `DATABASE_URL` - Complete PostgreSQL connection string
- `PGHOST` - Database host
- `PGPORT` - Database port
- `PGDATABASE` - Database name
- `PGUSER` - Database user
- `PGPASSWORD` - Database password

The app supports both `DATABASE_URL` and individual environment variables.

### 2. Railway Variables to Set
Create these environment variables in Railway:

```env
DEBUG=False
SECRET_KEY=<generate-a-secure-key>
ALLOWED_HOSTS=yourdomain.railway.app,localhost

EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

To generate a SECRET_KEY:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 3. Deployment Process

#### Option A: Using Railway CLI
```bash
# Login to Railway
railway login

# Link to your Railway project
railway link

# Deploy
railway up
```

#### Option B: Using GitHub Integration
1. Push code to GitHub
2. Connect GitHub to Railway
3. Set environment variables in Railway dashboard
4. Railway auto-deploys on push

### 4. Post-Deployment Commands
The `Procfile` automatically runs:
```bash
release: python manage.py migrate && python manage.py createcachetable
web: gunicorn tirescan.wsgi --log-file -
```

### 5. Database Setup
First time only (done in release phase):
```bash
python manage.py migrate
python manage.py createcachetable
python manage.py createsuperuser
```

## Features Configured for Railway

✅ **Environment Variables**
- Supports Railway's DATABASE_URL
- Fallback to individual PGUSER, PGHOST, etc.
- Auto-detect SSL requirements

✅ **Static Files**
- WhiteNoise middleware for production
- Compressed manifest storage
- No separate CDN needed

✅ **Security**
- HTTPS enforcement
- CSRF protection
- XSS filter enabled
- HSTS preload ready

✅ **Sessions**
- Development: In-memory (fast)
- Production: Database (reliable)

✅ **Caching**
- Development: LocMemCache
- Production: Database cache table

✅ **Logging**
- Console output for Railway logs
- Structured logging format
- Configurable log levels

## Troubleshooting

### Static Files Not Loading
1. Collect static files: `python manage.py collectstatic --noinput`
2. Check STATIC_URL and STATIC_ROOT in settings.py
3. Verify WhiteNoise middleware is in MIDDLEWARE list

### Database Connection Failed
1. Verify DATABASE_URL is set correctly
2. Check PGHOST ends with `.railway.internal` (internal) or `.up.railway.app` (external)
3. Ensure SSL mode is correct

### Cache Table Not Created
```bash
python manage.py createcachetable
```

### Migration Errors
```bash
python manage.py migrate --noinput
```

## Performance Tips

1. **Connection Pooling**
   - Set `CONN_MAX_AGE=600` in DATABASES

2. **Caching**
   - Production uses database cache
   - Reduces database queries

3. **Static Files**
   - WhiteNoise compresses & caches
   - Serve via Railway CDN

4. **Workers**
   - Default: 4 workers
   - Adjust based on memory: `workers = (2 * CPU_COUNT) + 1`

## Monitoring

### View Logs
```bash
railway logs
```

### Database Health
```bash
railway run python manage.py dbshell
```

### Check Environment
```bash
railway run python manage.py check
```

## Important Files

- `settings.py` - Django configuration (auto-detects Railway)
- `Procfile` - Process definition (migrations + web)
- `.env.railway` - Template for environment variables
- `requirements.txt` - Python dependencies
- `deploy.sh` - Optional deployment script

## Database Schema

### Tables Created
- `auth_user` - User accounts
- `core_userprofile` - User profiles with avatars
- `analysis_tireanalysis` - Tire analysis results
- `django_session` - User sessions
- `django_cache_table` - Cache storage
- Plus Django admin & auth tables

## Environment Variables Reference

```bash
# Core
DEBUG=False
SECRET_KEY=your-secret-key

# Database (Railway provides these)
DATABASE_URL=postgresql://user:pass@host:port/db

# Application
ALLOWED_HOSTS=yourdomain.railway.app,localhost
LANGUAGE_CODE=id

# Email
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Logging
DJANGO_LOG_LEVEL=INFO
```

## Next Steps

1. ✅ Set environment variables in Railway dashboard
2. ✅ Deploy application
3. ✅ Create superuser for admin panel
4. ✅ Test login and dashboard
5. ✅ Configure email notifications
6. ✅ Monitor logs and performance

## Support

For issues:
1. Check Railway logs: `railway logs`
2. Run health check: `railway run python manage.py check`
3. Review settings.py for auto-configuration
4. Check database connectivity

## License

This project is configured to run on Railway with PostgreSQL.
