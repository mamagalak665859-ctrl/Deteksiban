from django.urls import path
from . import views

urlpatterns = [
    path('',              views.dashboard,       name='dashboard'),
    path('dashboard/',    views.dashboard,       name='dashboard'),
    path('history/',      views.history,         name='history'),
    path('detail/',       views.detail,          name='detail'),

    # JSON API endpoints
    path('api/analyze/',                   views.analyze_api,    name='analyze_api'),
    path('api/delete/<int:pk>/',           views.delete_analysis, name='delete_analysis'),
    path('api/clear-history/',             views.clear_history,   name='clear_history'),
]
