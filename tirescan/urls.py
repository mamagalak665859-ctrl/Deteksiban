from django.urls import path, include
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.conf.urls.i18n import i18n_patterns
from django.http import HttpResponse
from django.shortcuts import render
from core.views import set_language_view
import os


def serve_manifest(request):
    manifest_path = os.path.join(settings.BASE_DIR, 'manifest.json')
    try:
        with open(manifest_path, 'rb') as f:
            return HttpResponse(f.read(), content_type='application/manifest+json')
    except FileNotFoundError:
        return HttpResponse(status=404)


def serve_service_worker(request):
    sw_path = os.path.join(settings.BASE_DIR, 'service-worker.js')
    try:
        with open(sw_path, 'rb') as f:
            return HttpResponse(f.read(), content_type='application/javascript')
    except FileNotFoundError:
        return HttpResponse(status=404)


def offline_view(request):
    return render(request, 'offline.html')


urlpatterns = [
    path('i18n/', include('django.conf.urls.i18n')),
    path('admin/', admin.site.urls),
    path('api/language/', set_language_view, name='set_language'),
    path('manifest.json', serve_manifest, name='manifest'),
    path('service-worker.js', serve_service_worker, name='service_worker'),
    path('offline/', offline_view, name='offline'),
    path('', include('core.urls')),
    path('', include('analysis.urls')),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
