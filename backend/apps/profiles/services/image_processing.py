"""Safe, in-memory processing for PostgreSQL-backed profile photos.

The service accepts a Django ``UploadedFile`` and returns only compressed
bytes.  It never creates a media file, writes a temporary permanent file, or
keeps an original upload after the request finishes.
"""

from __future__ import annotations

import hashlib
import warnings
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError
from django.core.files.uploadedfile import UploadedFile


class ProfilePhotoProcessingError(ValueError):
    """A client-safe validation error raised while processing an image."""


@dataclass(frozen=True)
class ProcessedProfilePhoto:
    """The only image representation that reaches the persistence layer."""

    image_bytes: bytes
    thumbnail_bytes: bytes
    mime_type: str
    width: int
    height: int
    thumbnail_width: int
    thumbnail_height: int
    original_size_bytes: int
    compressed_size_bytes: int
    thumbnail_size_bytes: int
    checksum: str

    # Compatibility aliases for the first BYTEA prototype.  They make the
    # transition safe without exposing a second storage shape.
    @property
    def image_data(self) -> bytes:
        return self.image_bytes

    @property
    def thumbnail_data(self) -> bytes:
        return self.thumbnail_bytes


class ImageProcessingService:
    """Validate, normalize, crop, and compress a profile photo in memory."""

    MAX_UPLOAD_BYTES = 10 * 1024 * 1024
    MIN_WIDTH = 600
    MIN_HEIGHT = 750
    MAX_DECODED_PIXELS = 40_000_000

    MAIN_WIDTH = 1200
    MAIN_HEIGHT = 1500
    THUMBNAIL_WIDTH = 240
    THUMBNAIL_HEIGHT = 300

    MAIN_MAX_BYTES = 600 * 1024
    THUMBNAIL_MAX_BYTES = 100 * 1024
    MAIN_QUALITY = 82
    THUMBNAIL_QUALITY = 80
    MIN_QUALITY = 40
    MIME_TYPE = "image/webp"
    SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}
    EXTENSION_FORMATS = {
        ".jpg": "JPEG",
        ".jpeg": "JPEG",
        ".png": "PNG",
        ".webp": "WEBP",
    }

    @classmethod
    def validate_upload(
        cls,
        upload: UploadedFile,
        *,
        enforce_minimum_dimensions: bool = True,
    ) -> tuple[str, tuple[int, int]]:
        """Validate byte size, the actual Pillow format, and decodability.

        ``content_type`` and filename extension are supporting checks only;
        Pillow's parsed format is authoritative.  The image is loaded after
        ``verify`` so corrupted/truncated files are rejected before processing.
        """
        if upload is None:
            raise ProfilePhotoProcessingError("Choose a JPEG, PNG, or WebP image.")

        size = getattr(upload, "size", None)
        if size is None:
            raise ProfilePhotoProcessingError("The uploaded image size is unavailable.")
        if size <= 0:
            raise ProfilePhotoProcessingError("The uploaded image is empty.")
        if size > cls.MAX_UPLOAD_BYTES:
            raise ProfilePhotoProcessingError("Image must be 10 MB or smaller before processing.")

        filename = str(getattr(upload, "name", "") or "")
        suffix = Path(filename).suffix.lower()
        if suffix not in cls.EXTENSION_FORMATS:
            raise ProfilePhotoProcessingError("Only JPEG, PNG, and WebP images are supported.")

        try:
            upload.seek(0)
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(upload) as verification_image:
                    verification_image.verify()

            upload.seek(0)
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(upload) as image:
                    actual_format = image.format
                    if actual_format not in cls.SUPPORTED_FORMATS:
                        raise ProfilePhotoProcessingError("Only JPEG, PNG, and WebP images are supported.")
                    if cls.EXTENSION_FORMATS[suffix] != actual_format:
                        raise ProfilePhotoProcessingError(
                            "The image file extension does not match its actual content."
                        )
                    # Reject our stricter decoded-pixel ceiling before EXIF
                    # transposition or a full decoder pass can allocate the
                    # source raster. Orientation never changes pixel count.
                    source_width, source_height = image.size
                    if source_width * source_height > cls.MAX_DECODED_PIXELS:
                        raise ProfilePhotoProcessingError(
                            "Image dimensions are too large to process safely."
                        )
                    # Measure after EXIF orientation correction so a genuine
                    # 600x750 portrait stored as a rotated JPEG is accepted.
                    width, height = ImageOps.exif_transpose(image).size
                    # Force a full decoder pass; verify() alone intentionally
                    # does not decode image pixels.
                    image.load()
        except ProfilePhotoProcessingError:
            raise
        except (
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
            UnidentifiedImageError,
            OSError,
            ValueError,
        ) as exc:
            raise ProfilePhotoProcessingError(
                "The uploaded file is not a valid, complete JPEG, PNG, or WebP image."
            ) from exc
        finally:
            upload.seek(0)

        if enforce_minimum_dimensions and (
            width < cls.MIN_WIDTH or height < cls.MIN_HEIGHT
        ):
            raise ProfilePhotoProcessingError(
                "Image must be at least 600 × 750 pixels before processing."
            )
        return actual_format, (width, height)

    @classmethod
    def process_profile_photo(
        cls,
        upload: UploadedFile,
        *,
        focal_point: tuple[float, float] | None = None,
        enforce_minimum_dimensions: bool = True,
    ) -> ProcessedProfilePhoto:
        """Return 4:5 main and thumbnail WebPs with no source metadata."""
        cls.validate_upload(upload, enforce_minimum_dimensions=enforce_minimum_dimensions)
        original_size = int(upload.size)

        try:
            upload.seek(0)
            with Image.open(upload) as source:
                # Apply EXIF orientation before dimensions/cropping.  Output is
                # then copied into new RGB images, which strips EXIF/GPS/XMP.
                normalized = ImageOps.exif_transpose(source)
                normalized.load()
                rgb = cls._flatten_to_rgb(normalized)

            centering = cls._validated_centering(focal_point)
            main_image = cls._crop_and_resize(
                rgb, cls.MAIN_WIDTH, cls.MAIN_HEIGHT, centering
            )
            thumbnail_image = cls._crop_and_resize(
                rgb, cls.THUMBNAIL_WIDTH, cls.THUMBNAIL_HEIGHT, centering
            )
            main_data, mime_type = cls._compress_under_limit(
                main_image,
                initial_quality=cls.MAIN_QUALITY,
                maximum_bytes=cls.MAIN_MAX_BYTES,
                label="main image",
            )
            thumbnail_data, _ = cls._compress_under_limit(
                thumbnail_image,
                initial_quality=cls.THUMBNAIL_QUALITY,
                maximum_bytes=cls.THUMBNAIL_MAX_BYTES,
                label="thumbnail",
            )
        except ProfilePhotoProcessingError:
            raise
        except (Image.DecompressionBombError, OSError, ValueError) as exc:
            raise ProfilePhotoProcessingError("Image processing failed safely; upload another image.") from exc
        finally:
            upload.seek(0)

        return ProcessedProfilePhoto(
            image_bytes=main_data,
            thumbnail_bytes=thumbnail_data,
            mime_type=mime_type,
            width=cls.MAIN_WIDTH,
            height=cls.MAIN_HEIGHT,
            thumbnail_width=cls.THUMBNAIL_WIDTH,
            thumbnail_height=cls.THUMBNAIL_HEIGHT,
            original_size_bytes=original_size,
            compressed_size_bytes=len(main_data),
            thumbnail_size_bytes=len(thumbnail_data),
            checksum=hashlib.sha256(main_data).hexdigest(),
        )

    @staticmethod
    def _validated_centering(
        focal_point: tuple[float, float] | None,
    ) -> tuple[float, float]:
        if focal_point is None:
            return (0.5, 0.5)
        if len(focal_point) != 2 or not all(0.0 <= value <= 1.0 for value in focal_point):
            raise ProfilePhotoProcessingError("Focal point values must be between 0 and 1.")
        return focal_point

    @staticmethod
    def _flatten_to_rgb(image: Image.Image) -> Image.Image:
        """Convert transparency to a safe white background and remove metadata."""
        if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.getchannel("A"))
            return background
        return image.convert("RGB")

    @staticmethod
    def _crop_and_resize(
        image: Image.Image,
        width: int,
        height: int,
        centering: tuple[float, float],
    ) -> Image.Image:
        # ImageOps.fit performs a cover resize followed by crop, preserving
        # proportions and preventing any stretching or distortion.
        return ImageOps.fit(
            image,
            (width, height),
            method=Image.Resampling.LANCZOS,
            centering=centering,
        )

    @classmethod
    def get_encoding_config(cls) -> tuple[str, str]:
        from PIL import features
        try:
            Image.init()
            if "WEBP" in Image.SAVE and features.check("webp"):
                return "WEBP", "image/webp"
        except Exception:
            pass
        return "JPEG", "image/jpeg"

    @classmethod
    def _compress_under_limit(
        cls,
        image: Image.Image,
        *,
        initial_quality: int,
        maximum_bytes: int,
        label: str,
    ) -> tuple[bytes, str]:
        fmt, mime_type = cls.get_encoding_config()
        qualities = list(range(initial_quality, 74, -2)) + list(range(70, cls.MIN_QUALITY - 1, -5))
        for quality in qualities:
            data = cls._encode_image(image, quality, fmt=fmt)
            if len(data) <= maximum_bytes:
                return data, mime_type
        raise ProfilePhotoProcessingError(
            f"The {label} could not be compressed below {maximum_bytes // 1024} KB without unacceptable quality loss."
        )

    @staticmethod
    def _encode_image(image: Image.Image, quality: int, fmt: str = "WEBP") -> bytes:
        output = BytesIO()
        if fmt == "WEBP":
            try:
                image.save(
                    output,
                    format="WEBP",
                    quality=quality,
                    method=6,
                    lossless=False,
                    exact=False,
                )
                return output.getvalue()
            except Exception:
                output = BytesIO()
        image.save(
            output,
            format="JPEG",
            quality=quality,
            optimize=True,
        )
        return output.getvalue()

    @staticmethod
    def _encode_webp(image: Image.Image, quality: int) -> bytes:
        return ImageProcessingService._encode_image(image, quality, fmt="WEBP")

    @classmethod
    def check_duplicate(cls, checksum: str, user_id, *, exclude_photo_id=None) -> bool:
        """Check a per-user duplicate without loading either binary field."""
        from apps.profiles.models import ProfilePhoto

        queryset = ProfilePhoto.objects.filter(user_id=user_id, checksum=checksum)
        if exclude_photo_id:
            queryset = queryset.exclude(pk=exclude_photo_id)
        return queryset.exists()


def process_profile_photo(uploaded_file: UploadedFile, **kwargs) -> ProcessedProfilePhoto:
    """Functional entry point used by views, tests, and future callers."""
    return ImageProcessingService.process_profile_photo(uploaded_file, **kwargs)


# Backwards-compatible import name for callers introduced by the earlier
# prototype.  It remains bytes-only and does not reintroduce file storage.
ProcessedImage = ProcessedProfilePhoto
