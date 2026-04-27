from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path('register/',       views.register_view,    name='register'),
    path('login/',          views.login_view,        name='login'),
    path('logout/',         views.logout_view,       name='logout'),
    path('delete-account/', views.delete_account_view, name='delete_account'),
    path('download-app/',   views.download_app_view, name='download_app'),
    path('api/avatar/',     views.update_avatar,    name='update_avatar'),
    path('api/report/',     views.submit_report,    name='submit_report'),
    path('api/language/',   views.set_language_view, name='set_language'),

    # Password Reset URLs
    path('password-reset/', auth_views.PasswordResetView.as_view(
        template_name='core/password_reset.html',
        email_template_name='core/password_reset_email.html',
        subject_template_name='core/password_reset_subject.txt'
    ), name='password_reset'),
    path('password-reset/done/', auth_views.PasswordResetDoneView.as_view(
        template_name='core/password_reset_done.html'
    ), name='password_reset_done'),
    path('password-reset-confirm/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='core/password_reset_confirm.html'
    ), name='password_reset_confirm'),
    path('password-reset-complete/', auth_views.PasswordResetCompleteView.as_view(
        template_name='core/password_reset_complete.html'
    ), name='password_reset_complete'),
]
