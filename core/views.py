from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils.translation import gettext_lazy as _, activate, get_language
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.conf import settings

from .forms import RegisterForm, LoginForm, AvatarForm
from .models import UserProfile


# ── Auth ──────────────────────────────────────────────────────────

def register_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    form = RegisterForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        user = form.save()
        login(request, user)
        messages.success(request, _("Akun berhasil dibuat! Selamat datang, %(name)s.") % {
            'name': user.first_name or user.username
        })
        return redirect('dashboard')
    return render(request, 'core/register.html', {
        'form': form,
        'LANGUAGE_CODE': get_language(),
    })


def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    form = LoginForm(request, request.POST or None)
    if request.method == 'POST' and form.is_valid():
        user = form.get_user()
        login(request, user)
        # Set language from user profile if exists
        try:
            lang = user.profile.lang
            if lang in ('id', 'en'):
                activate(lang)
                request.session['django_language'] = lang
        except:
            pass
        nxt = request.GET.get('next', 'dashboard')
        return redirect(nxt)
    return render(request, 'core/login.html', {
        'form': form,
        'LANGUAGE_CODE': get_language(),
    })


@login_required
def logout_view(request):
    logout(request)
    return redirect('login')


@login_required
def delete_account_view(request):
    if request.method == 'POST':
        confirm = request.POST.get('confirm_text', '')
        if confirm == 'HAPUS':
            user = request.user
            logout(request)
            user.delete()
            messages.success(request, _("Akun Anda telah dihapus."))
            return redirect('login')
        else:
            messages.error(request, _("Konfirmasi salah. Ketik HAPUS untuk melanjutkan."))
    return render(request, 'core/delete_account.html', {
        'LANGUAGE_CODE': get_language(),
    })


# ── Profile ───────────────────────────────────────────────────────

@login_required
@require_POST
def update_avatar(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    form = AvatarForm(request.POST, request.FILES, instance=profile)
    if form.is_valid():
        form.save()
        return JsonResponse({'ok': True, 'url': profile.avatar.url if profile.avatar else ''})
    return JsonResponse({'ok': False, 'error': str(form.errors)}, status=400)


@require_POST
@csrf_exempt
def submit_report(request):
    category = request.POST.get('category', '').strip()
    email = request.POST.get('email', '').strip()
    description = request.POST.get('description', '').strip()

    print(f"DEBUG: Report received - Category: {category}, Email: {email}, Description: {description}")

    if not category:
        return JsonResponse({'ok': False, 'error': _('Kategori masalah harus dipilih.')}, status=400)
    if not description:
        return JsonResponse({'ok': False, 'error': _('Deskripsi masalah harus diisi.')}, status=400)

    subject = _('Laporan Pengaduan: %(category)s') % {'category': category}
    body = _(
        'Kategori: %(category)s\n'
        'Email pengguna: %(email)s\n'
        'Deskripsi: %(description)s\n'
    ) % {
        'category': category,
        'email': email or _('[tidak tersedia]'),
        'description': description,
    }

    print(f"DEBUG: Attempting to send email - Subject: {subject}")
    print(f"DEBUG: Email body: {body}")

    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [settings.EMAIL_HOST_USER],
            fail_silently=False,
        )
        print("DEBUG: Email sent successfully!")
    except Exception as exc:
        print(f"DEBUG: Email sending failed: {exc}")
        return JsonResponse({'ok': False, 'error': str(exc)}, status=500)

    return JsonResponse({'ok': True})


# ── Language ──────────────────────────────────────────────────────

@require_POST
def set_language_view(request):
    """AJAX endpoint to switch language + save to user profile."""
    lang = request.POST.get('language', 'id')
    if lang not in ('id', 'en'):
        lang = 'id'
    activate(lang)
    if hasattr(request, 'session'):
        request.session['django_language'] = lang
    response = JsonResponse({'ok': True, 'language': lang})
    response.set_cookie('django_language', lang, path='/')
    if request.user.is_authenticated:
        try:
            request.user.profile.lang = lang
            request.user.profile.save(update_fields=['lang'])
            print(f"Language saved to profile: {lang}")
        except Exception as e:
            print(f"Error saving language to profile: {e}")
    print(f"Language switched to: {lang}, cookie set")
    return response


# ── Download App ──────────────────────────────────────────────────

def download_app_view(request):
    """Serve the APK directly if available, otherwise show a friendly unavailable message."""
    import os

    apk_path = os.path.join(settings.BASE_DIR, 'static', 'downloads', 'tirescan.apk')

    if os.path.exists(apk_path):
        response = FileResponse(
            open(apk_path, 'rb'),
            content_type='application/vnd.android.package-archive'
        )
        response['Content-Disposition'] = 'attachment; filename="tirescan.apk"'
        return response

    return render(request, 'core/download_app_unavailable.html', {
        'LANGUAGE_CODE': get_language(),
    })

