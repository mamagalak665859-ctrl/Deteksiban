from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
import os


class UserProfile(models.Model):
    user   = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    lang   = models.CharField(max_length=5, default='id', choices=[('id', 'Indonesia'), ('en', 'English')])

    def __str__(self):
        return f"Profile: {self.user.username}"

    def get_avatar_initial(self):
        name = self.user.first_name or self.user.username
        return name[0].upper() if name else 'U'


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()


@receiver(post_delete, sender=UserProfile)
def delete_avatar_file(sender, instance, **kwargs):
    """Delete avatar file when UserProfile is deleted"""
    if instance.avatar and instance.avatar.name:
        try:
            # Get the full path to the avatar file
            avatar_path = instance.avatar.path
            if os.path.exists(avatar_path):
                os.remove(avatar_path)
        except (OSError, ValueError):
            # Log the error but don't raise exception
            pass
