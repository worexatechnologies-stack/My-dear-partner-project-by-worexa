from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateMediaStorage(FileSystemStorage):
    """Filesystem storage with no public URL.

    Private files are opened only by authenticated download views after an
    ownership/assignment check.  A production deployment can replace this
    class with a private S3-compatible backend without changing the models.
    """

    def __init__(self, *args, **kwargs):
        kwargs.setdefault('location', settings.PRIVATE_MEDIA_ROOT)
        kwargs.setdefault('base_url', None)
        super().__init__(*args, **kwargs)

    def url(self, name):
        raise ValueError('Private files do not have a public URL.')


private_media_storage = PrivateMediaStorage()
