"""Move retired UserProfileImage rows into the moderated ProfilePhoto store."""

import mimetypes

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.profiles.models import ProfilePhoto, UserProfileImage
from apps.profiles.services.photo_management import (
    PrimaryPhotoNotVerifiedError,
    ProfilePhotoProcessingError,
    create_profile_photo,
)


class Command(BaseCommand):
    help = "Move legacy user_profile_images into ProfilePhoto and submit them for review."

    def add_arguments(self, parser):
        parser.add_argument("--member-id", help="Move photos for only this member UUID.")
        parser.add_argument("--dry-run", action="store_true", help="Report rows without changing data.")

    def handle(self, *args, **options):
        queryset = UserProfileImage.objects.select_related("user").order_by(
            "user_id", "display_order", "created_at"
        )
        if options["member_id"]:
            queryset = queryset.filter(user_id=options["member_id"])
        if not queryset.exists():
            self.stdout.write("No legacy user profile images found.")
            return

        moved = skipped = 0
        for legacy in queryset.iterator():
            member = legacy.user
            if ProfilePhoto.objects.filter(user=member, status=ProfilePhoto.Status.PENDING).exists():
                self.stdout.write(self.style.WARNING(
                    f"Skipped {legacy.pk}: {member.email} already has a photo awaiting review."
                ))
                skipped += 1
                continue
            if ProfilePhoto.objects.filter(user=member).count() >= 6:
                self.stdout.write(self.style.WARNING(
                    f"Skipped {legacy.pk}: {member.email} already has six canonical photos."
                ))
                skipped += 1
                continue
            if options["dry_run"]:
                self.stdout.write(f"Would move {legacy.pk} for {member.email} into the approval queue.")
                moved += 1
                continue

            extension = mimetypes.guess_extension(legacy.mime_type or "") or ".webp"
            upload = SimpleUploadedFile(
                name=f"legacy-profile-{legacy.pk}{extension}",
                content=bytes(legacy.image_data),
                content_type=legacy.mime_type or "image/webp",
            )
            try:
                legacy_id = legacy.pk
                with transaction.atomic():
                    photo = create_profile_photo(member=member, uploaded_file=upload, actor=member)
                    # The canonical row now owns the compressed bytes. Removing
                    # the duplicate legacy row prevents a future migration run
                    # from importing the same image again.
                    legacy.delete()
                self.stdout.write(self.style.SUCCESS(
                    f"Moved {legacy_id} for {member.email} to ProfilePhoto {photo.pk} ({photo.status})."
                ))
                moved += 1
            except (PrimaryPhotoNotVerifiedError, ProfilePhotoProcessingError) as exc:
                self.stdout.write(self.style.WARNING(f"Skipped {legacy.pk}: {exc}"))
                skipped += 1
            except Exception as exc:
                raise CommandError(f"Could not migrate legacy image {legacy.pk}: {exc}") from exc

        self.stdout.write(self.style.SUCCESS(f"Migration complete: {moved} moved, {skipped} skipped."))
