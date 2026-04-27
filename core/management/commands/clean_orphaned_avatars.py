from django.core.management.base import BaseCommand
from django.conf import settings
from core.models import UserProfile
import os


class Command(BaseCommand):
    help = 'Clean up orphaned avatar references in the database'

    def handle(self, *args, **options):
        profiles_with_avatars = UserProfile.objects.exclude(avatar__isnull=True).exclude(avatar='')

        cleaned_count = 0
        for profile in profiles_with_avatars:
            avatar_path = os.path.join(settings.MEDIA_ROOT, str(profile.avatar))
            if not os.path.exists(avatar_path):
                self.stdout.write(
                    self.style.WARNING(
                        f'Removing orphaned avatar reference: {profile.avatar} for user {profile.user.username}'
                    )
                )
                profile.avatar = None
                profile.save()
                cleaned_count += 1

        if cleaned_count > 0:
            self.stdout.write(
                self.style.SUCCESS(f'Successfully cleaned {cleaned_count} orphaned avatar references')
            )
        else:
            self.stdout.write(self.style.SUCCESS('No orphaned avatar references found'))