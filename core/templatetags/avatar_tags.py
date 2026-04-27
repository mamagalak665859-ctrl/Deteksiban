from django import template
from django.conf import settings
import os

register = template.Library()

@register.filter
def avatar_exists(user_profile):
    """Check if avatar file exists on filesystem"""
    if not user_profile or not user_profile.avatar:
        return False

    avatar_path = os.path.join(settings.MEDIA_ROOT, str(user_profile.avatar))
    return os.path.exists(avatar_path)