import os
from pathlib import Path

# Load .env only in development (optional)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv not installed (normal in production)
    pass

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-&4ua(ifaqx7_r^ya*!93$(6o*29(#n0vi(yvm0rtqp2@d_w0w+')

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

# Build ALLOWED_HOSTS with support for all Vercel preview domains
_allowed_hosts = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,*.vercel.app,*.railway.app').split(',')
# Add wildcard for Vercel/Railway if any matching hostname is present but wildcard isn't
if any('vercel.app' in h for h in _allowed_hosts) and '*.vercel.app' not in _allowed_hosts:
    _allowed_hosts.append('*.vercel.app')
if any('railway.app' in h for h in _allowed_hosts) and '*.railway.app' not in _allowed_hosts:
    _allowed_hosts.append('*.railway.app')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core',
    'analysis',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'tirescan.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'django.template.context_processors.i18n',
            ],
        },
    },
]

WSGI_APPLICATION = 'tirescan.wsgi.application'

# ── Database ──────────────────────────────────────────────────────
# Railway PostgreSQL Configuration
# Supports both DATABASE_URL and individual environment variables

if os.environ.get('DATABASE_URL'):
    # Use DATABASE_URL if available (Railway format)
    import dj_database_url
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    # Fallback to individual environment variables
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('PGDATABASE', 'railway'),
            'USER': os.environ.get('PGUSER', 'postgres'),
            'PASSWORD': os.environ.get('PGPASSWORD', ''),
            'HOST': os.environ.get('PGHOST', 'localhost'),
            'PORT': os.environ.get('PGPORT', '5432'),
            'OPTIONS': {
                'sslmode': 'require' if os.environ.get('PGHOST', '').endswith('.rlwy.net') else 'prefer',
            },
            'CONN_MAX_AGE': 600,
            'CONN_HEALTH_CHECKS': True,
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── Caching & Sessions ────────────────────────────────────────────
# Production-ready cache configuration for Railway
if DEBUG:
    # Development: use in-memory cache
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    SESSION_CACHE_ALIAS = 'default'
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
else:
    # Production: use database sessions for reliability
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
            'LOCATION': 'django_cache_table',
        }
    }

# ── Internationalisation ──────────────────────────────────────────
LANGUAGE_CODE = 'id'

LANGUAGES = [
    ('id', 'Indonesia'),
    ('en', 'English'),
]

LOCALE_PATHS = [BASE_DIR / 'locale']

USE_I18N = True
USE_L10N = True
USE_TZ   = True

TIME_ZONE = 'Asia/Jakarta'

# ── Static & Media ────────────────────────────────────────────────
STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Include the project-level static directory so download assets are served in development.
STATICFILES_DIRS = [BASE_DIR / 'static']

MEDIA_URL  = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ── Auth ──────────────────────────────────────────────────────────
LOGIN_URL           = '/login/'
LOGIN_REDIRECT_URL  = '/dashboard/'
LOGOUT_REDIRECT_URL = '/login/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── ML Models ─────────────────────────────────────────────────────
# Resolved once at startup; env var overrides for production.
_default_models_dir = BASE_DIR / 'ml_models'
TIRESCAN_MODELS_DIR = os.environ.get(
    'TIRESCAN_MODELS_DIR', str(_default_models_dir)
)

AUTH_USER_MODEL = 'auth.User'

# ── Email Configuration ───────────────────────────────────────────
# Production Gmail SMTP settings
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False') == 'True'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', 'deteksiban@gmail.com')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', 'lvje reni gyps evyb')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)

# ── Production Security Settings ──────────────────────────────────
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_SECURITY_POLICY = {
        'default-src': ("'self'",),
        'script-src': ("'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'),
        'style-src': ("'self'", "'unsafe-inline'", 'fonts.googleapis.com'),
        'img-src': ("'self'", 'data:', 'https:'),
        'font-src': ("'self'", 'fonts.gstatic.com'),
    }
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ── Static Files Configuration (WhiteNoise) ──────────────────────
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ── Logging Configuration ─────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': os.environ.get('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'tirescan': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
