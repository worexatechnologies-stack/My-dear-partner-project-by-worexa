import hashlib
from io import BytesIO

from PIL import Image

from django.core.management.base import BaseCommand

from apps.accounts.models import Member
from apps.profiles.models import ProfilePhoto


def _webp_bytes(width, height, rgb, quality=82):
    img = Image.new("RGB", (width, height), rgb)
    buf = BytesIO()
    img.save(buf, format="WEBP", quality=quality)
    return buf.getvalue()


class Command(BaseCommand):
    help = (
        "Attach a generated placeholder profile photo to every seed member "
        "(is_seed_data=True) that has no primary photo, so photos display in "
        "the admin/super-admin portal."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing seed-member photos before re-adding them.",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            seed_ids = list(Member.objects.filter(is_seed_data=True).values_list("id", flat=True))
            deleted = ProfilePhoto.objects.filter(user_id__in=seed_ids).delete()
            self.stdout.write(f"Cleared {deleted[0]} existing seed photos.")

        members = list(Member.objects.filter(is_seed_data=True))
        self.stdout.write(f"Seeding photos for {len(members)} seed members.")

        created = 0
        for idx, member in enumerate(members):
            if ProfilePhoto.objects.filter(user=member, is_primary=True).exists():
                continue
            gender = (member.gender or "Male").lower()
            # Distinct but stable color per member.
            base = (188, 48, 77) if gender == "female" else (40, 55, 80)
            rgb = tuple((base[i] + (idx * 7)) % 256 for i in range(3))
            image_data = _webp_bytes(600, 750, rgb)
            thumb_data = _webp_bytes(240, 300, rgb, quality=78)
            ProfilePhoto.objects.create(
                user=member,
                image_data=image_data,
                thumbnail_data=thumb_data,
                mime_type="image/webp",
                original_filename=f"{member.first_name or 'member'}_{member.last_name or 'photo'}.webp",
                original_size_bytes=len(image_data),
                compressed_size_bytes=len(image_data),
                thumbnail_size_bytes=len(thumb_data),
                width=600,
                height=750,
                thumbnail_width=240,
                thumbnail_height=300,
                checksum=hashlib.sha256(image_data).hexdigest(),
                is_primary=True,
                display_order=0,
                status=ProfilePhoto.Status.APPROVED,
            )
            Member.objects.filter(pk=member.pk).update(
                photo_status=Member.VerificationStatus.APPROVED
            )
            created += 1
            self.stdout.write(f"  photo added: {member.email}")

        self.stdout.write(self.style.SUCCESS(f"Done: added {created} photos."))