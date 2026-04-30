#!/bin/bash
# Railway Production Deployment Script

set -e

echo "🚀 TireScan - Railway Deployment Started"

# 1. Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# 2. Collect static files
echo "📁 Collecting static files..."
python manage.py collectstatic --noinput --clear

# 3. Run migrations
echo "🗄️  Running database migrations..."
python manage.py migrate

# 4. Create cache table (for production cache)
echo "💾 Creating cache table..."
python manage.py createcachetable

# 5. Compile messages
echo "🌍 Compiling language messages..."
python manage.py compilemessages

echo "✅ Deployment preparation complete!"
echo "🌐 Starting Gunicorn server..."

# Start the application
exec gunicorn tirescan.wsgi --log-file - --access-logfile - --workers 4 --worker-class sync --timeout 120
