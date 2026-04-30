release: python manage.py migrate && python manage.py createcachetable
web: gunicorn tirescan.wsgi --log-file -
