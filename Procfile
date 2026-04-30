release: python manage.py migrate && python manage.py createcachetable
web: python manage.py collectstatic --no-input && gunicorn tirescan.wsgi --log-file -
