import os
import django
import sqlite3
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tirescan.settings')
django.setup()

from django.contrib.auth.models import User
from core.models import UserProfile
from analysis.models import TireAnalysis
from django.core.files.base import ContentFile
import shutil

def migrate_data():
    # Connect to SQLite
    sqlite_path = Path('db.sqlite3')
    if not sqlite_path.exists():
        print("SQLite database not found")
        return

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_cursor = sqlite_conn.cursor()

    print("Starting data migration from SQLite to Railway PostgreSQL...")

    # Migrate User data first
    print("Migrating User data...")
    sqlite_cursor.execute("""
        SELECT id, password, last_login, is_superuser, username, first_name,
               last_name, email, is_staff, is_active, date_joined
        FROM auth_user
    """)
    users = sqlite_cursor.fetchall()

    migrated_users = 0
    for user_data in users:
        user_id, password, last_login, is_superuser, username, first_name, \
        last_name, email, is_staff, is_active, date_joined = user_data

        try:
            # Check if user already exists
            if User.objects.filter(id=user_id).exists():
                print(f"  User {username} already exists, skipping")
                continue

            # Create user
            user = User.objects.create(
                id=user_id,
                password=password,
                last_login=last_login,
                is_superuser=is_superuser,
                username=username,
                first_name=first_name,
                last_name=last_name,
                email=email,
                is_staff=is_staff,
                is_active=is_active,
                date_joined=date_joined
            )

            migrated_users += 1
            print(f"  Migrated user {username}")

        except Exception as e:
            print(f"  Error migrating user {username}: {e}")

    print(f"Migrated {migrated_users} User records")

    # Migrate UserProfile data
    print("Migrating UserProfile data...")
    sqlite_cursor.execute("""
        SELECT user_id, avatar, lang
        FROM core_userprofile
    """)
    user_profiles = sqlite_cursor.fetchall()

    migrated_profiles = 0
    for user_id, avatar_path, lang in user_profiles:
        try:
            user = User.objects.get(id=user_id)
            profile, created = UserProfile.objects.get_or_create(
                user=user,
                defaults={'lang': lang or 'id'}
            )

            # Copy avatar file if exists
            if avatar_path and os.path.exists(f'media/{avatar_path}'):
                # Copy file to new location
                source_path = Path(f'media/{avatar_path}')
                dest_path = Path(f'media/{avatar_path}')
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source_path, dest_path)
                profile.avatar = avatar_path
                profile.save()

            if created:
                migrated_profiles += 1
                print(f"  Created profile for user {user.username}")
            else:
                print(f"  Profile already exists for user {user.username}")

        except User.DoesNotExist:
            print(f"  User {user_id} not found, skipping profile")
        except Exception as e:
            print(f"  Error migrating profile for user {user_id}: {e}")

    print(f"Migrated {migrated_profiles} UserProfile records")

    # Migrate TireAnalysis data
    print("Migrating TireAnalysis data...")
    sqlite_cursor.execute("""
        SELECT id, user_id, image, condition, label, confidence,
               tire_year, camera_mode, raw_result, created_at
        FROM analysis_tireanalysis
    """)
    analyses = sqlite_cursor.fetchall()

    migrated_analyses = 0
    for analysis_data in analyses:
        analysis_id, user_id, image_path, condition, label, confidence, \
        tire_year, camera_mode, raw_result, created_at = analysis_data

        try:
            user = User.objects.get(id=user_id)

            # Check if analysis already exists
            if TireAnalysis.objects.filter(id=analysis_id).exists():
                print(f"  Analysis {analysis_id} already exists, skipping")
                continue

            # Copy image file if exists
            if image_path and os.path.exists(f'media/{image_path}'):
                source_path = Path(f'media/{image_path}')
                dest_path = Path(f'media/{image_path}')
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source_path, dest_path)

            # Create analysis record
            analysis = TireAnalysis.objects.create(
                id=analysis_id,
                user=user,
                image=image_path,
                condition=condition,
                label=label or '',
                confidence=confidence or 0.0,
                tire_year=tire_year,
                camera_mode=camera_mode or 'front',
                raw_result=raw_result or {},
                created_at=created_at
            )

            migrated_analyses += 1
            print(f"  Migrated analysis {analysis_id} for user {user.username}")

        except User.DoesNotExist:
            print(f"  User {user_id} not found, skipping analysis {analysis_id}")
        except Exception as e:
            print(f"  Error migrating analysis {analysis_id}: {e}")

    sqlite_conn.close()

    print(f"\nMigration completed!")
    print(f"- User records migrated: {migrated_users}")
    print(f"- UserProfile records migrated: {migrated_profiles}")
    print(f"- TireAnalysis records migrated: {migrated_analyses}")

    # Final count check
    print("\nFinal counts in Railway database:")
    print(f"- Users: {User.objects.count()} records")
    print(f"- UserProfile: {UserProfile.objects.count()} records")
    print(f"- TireAnalysis: {TireAnalysis.objects.count()} records")

if __name__ == '__main__':
    migrate_data()