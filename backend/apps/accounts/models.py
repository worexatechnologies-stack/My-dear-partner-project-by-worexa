import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models import Q
from django.utils import timezone


class AccountType(models.TextChoices):
    MEMBER = 'MEMBER', 'Member'
    SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
    ADMIN = 'ADMIN', 'Admin'


class RoleCode(models.TextChoices):
    SUPER_ADMIN = AccountType.SUPER_ADMIN, 'Super Admin'
    ADMIN = AccountType.ADMIN, 'Admin'


SUPER_ADMIN = RoleCode.SUPER_ADMIN
ADMIN = RoleCode.ADMIN




class AdminRole(models.Model):
    code = models.CharField(max_length=30, choices=RoleCode.choices, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_system_role = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    permissions = models.ManyToManyField(
        'AdminPermission',
        through='AdminRolePermission',
        related_name='roles',
        blank=True,
    )

    class Meta:
        db_table = 'admin_roles'
        ordering = ('code',)

    def __str__(self):
        return self.name


class AdminPermission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    module = models.CharField(max_length=50, db_index=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'admin_permissions'
        ordering = ('module', 'code')

    def __str__(self):
        return self.code


class AdminRolePermission(models.Model):
    role = models.ForeignKey(AdminRole, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(
        AdminPermission,
        on_delete=models.CASCADE,
        related_name='role_permissions',
    )
    is_allowed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'admin_role_permissions'
        constraints = [
            models.UniqueConstraint(
                fields=('role', 'permission'),
                name='unique_admin_role_permission',
            ),
        ]
        ordering = ('role__code', 'permission__code')

    def __str__(self):
        return f'{self.role.code}: {self.permission.code}={self.is_allowed}'


class UserPermission(models.Model):
    user_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name='user_permissions_ct',
    )
    user_object_id = models.UUIDField(db_index=True)
    user = GenericForeignKey('user_content_type', 'user_object_id')

    permission = models.ForeignKey(
        AdminPermission,
        on_delete=models.CASCADE,
        related_name='user_permissions',
    )
    is_allowed = models.BooleanField(default=True)  # True = explicit grant, False = explicit deny

    assigned_by_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_permissions_ct',
    )
    assigned_by_object_id = models.UUIDField(null=True, blank=True)
    assigned_by = GenericForeignKey('assigned_by_content_type', 'assigned_by_object_id')

    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_permissions'
        constraints = [
            models.UniqueConstraint(
                fields=('user_content_type', 'user_object_id', 'permission'),
                name='unique_user_permission_override',
            )
        ]
        ordering = ('permission__code',)

    def __str__(self):
        type_str = 'ALLOW' if self.is_allowed else 'DENY'
        return f'{self.user_object_id}: {self.permission.code}={type_str}'


class PermissionAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name='permission_audit_logs_ct',
    )
    user_object_id = models.UUIDField(db_index=True)
    user = GenericForeignKey('user_content_type', 'user_object_id')

    actor_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='permission_actor_logs_ct',
    )
    actor_object_id = models.UUIDField(null=True, blank=True)
    actor = GenericForeignKey('actor_content_type', 'actor_object_id')

    previous_permissions = models.JSONField(default=dict, blank=True)
    new_permissions = models.JSONField(default=dict, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'permission_audit_logs'
        ordering = ('-created_at',)

    def __str__(self):
        actor_str = self.actor.email if self.actor else 'System'
        user_str = self.user.email if self.user else 'Unknown'
        return f'{actor_str} changed permissions of {user_str} at {self.created_at}'


class AccountManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required.')
        email = self.normalize_email(email).lower()
        account = self.model(email=email, **extra_fields)
        if password:
            account.set_password(password)
        else:
            account.set_unusable_password()
        account.save(using=self._db)
        return account

    def create_superuser(self, email, password=None, **extra_fields):
        raise ValueError(
            'Django superusers are disabled. Use create_super_admin for the separate super_admins table.'
        )


class BaseAccount(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    mobile_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_email_verified = models.BooleanField(default=False)
    token_version = models.PositiveIntegerField(default=0)
    password_changed_at = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Durable last-seen timestamp. Updated only on disconnect or at controlled intervals, never on every heartbeat.",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    chat_public_key = models.TextField(null=True, blank=True)

    objects = AccountManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.email = self.__class__.objects.normalize_email(self.email).lower()
        if self.mobile_number == '':
            self.mobile_number = None
        super().save(*args, **kwargs)

    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    def get_short_name(self):
        return self.first_name or self.email

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    @property
    def is_staff(self):
        return False

    @property
    def is_superuser(self):
        return False

    def has_perm(self, _perm, _obj=None):
        return False

    def has_module_perms(self, _app_label):
        return False


class Member(BaseAccount):
    class Gender(models.TextChoices):
        MALE = 'Male', 'Male'
        FEMALE = 'Female', 'Female'
        OTHER = 'Other', 'Other'

    class ProfileCreatedBy(models.TextChoices):
        SELF = 'Self', 'Self'
        PARENT = 'Parent', 'Parent'
        SIBLING = 'Sibling', 'Sibling'
        RELATIVE = 'Relative', 'Relative'
        FRIEND = 'Friend', 'Friend'

    class ReviewStatus(models.TextChoices):
        NOT_SUBMITTED = 'NOT_SUBMITTED', 'Not submitted'
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    class AccountStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        SUSPENDED = 'SUSPENDED', 'Suspended'
        ARCHIVED = 'ARCHIVED', 'Archived'
        DELETED = 'DELETED', 'Deleted'

    class VerificationStatus(models.TextChoices):
        """Standardized verification status for all verification types"""
        NOT_STARTED = 'not_started', 'Not Started'
        DRAFT = 'draft', 'Draft'
        PENDING_REVIEW = 'pending_review', 'Pending Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CHANGES_REQUESTED = 'changes_requested', 'Changes Requested'
    
    # Aliases for backwards compatibility
    ProfileStatus = VerificationStatus
    PhotoStatus = VerificationStatus
    DocumentStatus = VerificationStatus

    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    profile_created_by = models.CharField(
        max_length=20,
        choices=ProfileCreatedBy.choices,
        blank=True,
    )
    is_mobile_verified = models.BooleanField(default=False)
    is_premium = models.BooleanField(default=False)
    account_status = models.CharField(
        max_length=20,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
        db_index=True,
    )
    profile_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.NOT_STARTED,
        db_index=True,
    )
    photo_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.NOT_STARTED,
        db_index=True,
    )
    document_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.NOT_STARTED,
        db_index=True,
    )
    
    # Rejection/change request reasons
    profile_rejection_reason = models.TextField(blank=True, default='')
    photo_rejection_reason = models.TextField(blank=True, default='')
    document_rejection_reason = models.TextField(blank=True, default='')
    
    # Timestamps for tracking
    profile_submitted_at = models.DateTimeField(null=True, blank=True)
    profile_reviewed_at = models.DateTimeField(null=True, blank=True)
    photo_submitted_at = models.DateTimeField(null=True, blank=True)
    photo_reviewed_at = models.DateTimeField(null=True, blank=True)
    document_submitted_at = models.DateTimeField(null=True, blank=True)
    document_reviewed_at = models.DateTimeField(null=True, blank=True)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)

    country = models.ForeignKey('Country', on_delete=models.SET_NULL, null=True, blank=True, related_name='members')
    state = models.ForeignKey('State', on_delete=models.SET_NULL, null=True, blank=True, related_name='members')
    city = models.ForeignKey('City', on_delete=models.SET_NULL, null=True, blank=True, related_name='members')
    branch = models.ForeignKey('Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='members')

    is_seed_data = models.BooleanField(
        default=False,
        db_index=True,
        help_text='True only for development seed members. Never set in production.',
    )
    is_hidden = models.BooleanField(default=False)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'members'
        ordering = ('-created_at',)

    @property
    def account_type(self):
        return AccountType.MEMBER

    @property
    def admin_role_code(self):
        return None

    @property
    def is_verified(self):
        return self.is_email_verified or self.is_mobile_verified

    @property
    def is_account_locked(self):
        return bool(self.locked_until and self.locked_until > timezone.now())

    @property
    def are_verification_checks_passed(self):
        """Check if all verification requirements are met"""
        # 1. Profile approved
        profile_ok = self.profile_status == self.VerificationStatus.APPROVED
        # 2. Contact (email and mobile) verified
        contact_ok = self.is_email_verified and self.is_mobile_verified
        # 3. Primary photo approved
        from apps.profiles.models import ProfilePhoto
        primary_photo_ok = ProfilePhoto.objects.filter(
            user_id=self.pk,
            is_primary=True,
            status=ProfilePhoto.Status.APPROVED,
        ).exists()
        # 4. Documents approved
        documents_ok = (
            self.document_status == self.VerificationStatus.APPROVED 
            or self.documents.filter(status='APPROVED').exists()
        )
        
        return profile_ok and contact_ok and primary_photo_ok and documents_ok

    @property
    def date_joined(self):
        return self.created_at

    def __str__(self):
        return self.email


class User(Member):
    """Public compatibility name for the platform's established member user.

    ``Member`` remains the configured auth model so existing foreign keys and
    authentication sessions are not invalidated.  This proxy exposes the
    conventional ``accounts.User`` import expected by standalone clients.
    """

    class Meta:
        proxy = True
        verbose_name = 'user'
        verbose_name_plural = 'users'


class Country(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'countries'
        ordering = ('name',)

    def __str__(self):
        return self.name


class State(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    country = models.ForeignKey(Country, on_delete=models.PROTECT, related_name='states')
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'states'
        ordering = ('name',)
        constraints = [
            models.UniqueConstraint(fields=('country', 'code'), name='unique_country_state_code')
        ]

    def __str__(self):
        return f"{self.name} ({self.country.code})"


class City(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    state = models.ForeignKey(State, on_delete=models.PROTECT, related_name='cities')
    code = models.CharField(max_length=10)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'cities'
        ordering = ('name',)
        constraints = [
            models.UniqueConstraint(fields=('state', 'code'), name='unique_state_city_code')
        ]

    def __str__(self):
        return f"{self.name} ({self.state.code})"


class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name='branches')
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'branches'
        ordering = ('name',)

    def __str__(self):
        return self.name


class AdministrativeAccount(BaseAccount):
    role = models.ForeignKey(
        AdminRole,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='%(class)s_accounts',
    )
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    admin_id = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    bio = models.TextField(blank=True, default='')
    photo = models.TextField(blank=True, default='')

    class Meta:
        abstract = True

    @property
    def is_staff(self):
        return True

    @property
    def admin_role_code(self):
        return self.role.code if self.role_id else self.account_type

    @property
    def admin_role_display(self):
        return self.role.name if self.role_id else dict(AccountType.choices).get(
            str(self.account_type), str(self.account_type)
        )

    @property
    def is_super_admin(self):
        return self.account_type == AccountType.SUPER_ADMIN

    @property
    def is_platform_admin(self):
        return True

    @property
    def is_account_locked(self):
        return bool(self.locked_until and self.locked_until > timezone.now())

    @property
    def can_access_admin(self):
        return self.is_active and not self.is_deleted and not self.is_account_locked

    def get_effective_admin_permissions(self):
        if not self.can_access_admin:
            return set()
        if self.is_super_admin:
            return set(AdminPermission.objects.values_list('code', flat=True))
        
        # Load from role
        role_permissions = set()
        if self.role_id:
            role_permissions = set(
                self.role.role_permissions.filter(is_allowed=True).values_list(
                    'permission__code', flat=True
                )
            )
            
        # Apply user overrides
        from django.contrib.contenttypes.models import ContentType
        from .models import UserPermission
        
        ct = ContentType.objects.get_for_model(self.__class__)
        overrides = UserPermission.objects.filter(
            user_content_type=ct,
            user_object_id=self.id
        ).select_related('permission')
        
        allowed_overrides = set()
        denied_overrides = set()
        for op in overrides:
            if op.is_allowed:
                allowed_overrides.add(op.permission.code)
            else:
                denied_overrides.add(op.permission.code)
                
        # Final set: (role_permissions | explicit_grants) - explicit_denials
        return (role_permissions | allowed_overrides) - denied_overrides

    def has_admin_permission(self, permission_code):
        if not self.can_access_admin or not permission_code:
            return False
        return self.is_super_admin or permission_code in self.get_effective_admin_permissions()


class SuperAdmin(AdministrativeAccount):
    two_factor_enabled = models.BooleanField(default=False)

    class Meta:
        db_table = 'super_admins'
        ordering = ('-created_at',)

    @property
    def account_type(self):
        return AccountType.SUPER_ADMIN

    @property
    def is_superuser(self):
        return True

    def has_perm(self, _perm, _obj=None):
        return self.can_access_admin

    def has_module_perms(self, _app_label):
        return self.can_access_admin

    def __str__(self):
        return self.email


class Admin(AdministrativeAccount):
    created_by_super_admin = models.ForeignKey(
        SuperAdmin,
        on_delete=models.PROTECT,
        related_name='created_admins',
        null=True,
        blank=True,
    )
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True, related_name='admins')
    state = models.ForeignKey(State, on_delete=models.SET_NULL, null=True, blank=True, related_name='admins')
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True, related_name='admins')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='admins')
    employee_code = models.CharField(max_length=50, unique=True, null=True, blank=True)

    class Meta:
        db_table = 'admins'
        ordering = ('-created_at',)

    @property
    def account_type(self):
        return AccountType.ADMIN

    def __str__(self):
        return self.email


class Staff(AdministrativeAccount):
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_members')
    state = models.ForeignKey(State, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_members')
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_members')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_members')
    specializations = models.ManyToManyField(
        'core.Specialization',
        blank=True,
        related_name='staff_members',
    )
    employee_code = models.CharField(max_length=50, unique=True, null=True, blank=True)
    manager_admin = models.ForeignKey(
        Admin,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_staff',
    )
    created_by_admin = models.ForeignKey(
        Admin,
        on_delete=models.PROTECT,
        related_name='created_staff',
        null=True,
        blank=True,
    )

    class Meta:
        db_table = 'staff'
        ordering = ('-created_at',)

    @property
    def account_type(self):
        return AccountType.ADMIN

    def __str__(self):
        return self.email




class AuthSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account_id = models.UUIDField(db_index=True)
    account_type = models.CharField(max_length=30, choices=AccountType.choices, db_index=True)
    token_family_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    token_version = models.PositiveIntegerField()
    refresh_jti_digest = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField(db_index=True)
    absolute_expires_at = models.DateTimeField(db_index=True, null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True, db_index=True)
    revocation_reason = models.CharField(max_length=100, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent_summary = models.CharField(max_length=255, blank=True, default='')
    device_name = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'account_sessions'
        indexes = [
            models.Index(
                fields=('account_type', 'account_id', 'revoked_at'),
                name='account_session_owner_idx',
            ),
            models.Index(
                fields=('token_family_id',),
                name='account_session_family_idx',
            ),
        ]

    @property
    def is_usable(self):
        now = timezone.now()
        if self.revoked_at is not None or self.expires_at <= now:
            return False
        if self.absolute_expires_at and self.absolute_expires_at <= now:
            return False
        return True


class AuthChallenge(models.Model):
    class Purpose(models.TextChoices):
        REGISTRATION = 'REGISTRATION', 'Registration verification'
        PHONE_VERIFY = 'PHONE_VERIFY', 'Phone verification'
        PASSWORD_RESET = 'PASSWORD_RESET', 'Password reset'
        PASSWORDLESS_LOGIN = 'PASSWORDLESS_LOGIN', 'Passwordless login'
        TWO_FACTOR = 'TWO_FACTOR', 'Two-factor authentication'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account_type = models.CharField(max_length=30, choices=AccountType.choices, db_index=True)
    identifier = models.CharField(max_length=254, db_index=True)
    purpose = models.CharField(max_length=30, choices=Purpose.choices, db_index=True)
    code_digest = models.CharField(max_length=128)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    requested_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'auth_challenges'
        ordering = ('-created_at',)
        indexes = [
            models.Index(
                fields=('account_type', 'identifier', 'purpose', 'created_at'),
                name='auth_challenge_lookup',
            ),
        ]

    @property
    def is_usable(self):
        return (
            self.consumed_at is None
            and self.expires_at > timezone.now()
            and self.attempts < self.max_attempts
        )


class LoginStatus(models.TextChoices):
    SUCCESS = 'SUCCESS', 'Success'
    FAILED = 'FAILED', 'Failed'
    LOCKED = 'LOCKED', 'Locked'
    BLOCKED = 'BLOCKED', 'Blocked'
    TWO_FACTOR_FAILED = 'TWO_FACTOR_FAILED', 'Two-factor failed'
    LOGGED_OUT = 'LOGGED_OUT', 'Logged out'
    TOKEN_REVOKED = 'TOKEN_REVOKED', 'Token revoked'


class BaseLoginActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    device_name = models.CharField(max_length=100, blank=True)
    browser = models.CharField(max_length=100, blank=True)
    operating_system = models.CharField(max_length=100, blank=True)
    login_status = models.CharField(max_length=30, choices=LoginStatus.choices, db_index=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    logged_in_at = models.DateTimeField(default=timezone.now, db_index=True)
    logged_out_at = models.DateTimeField(null=True, blank=True)
    session_id = models.UUIDField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ('-created_at',)


class MemberLoginActivity(BaseLoginActivity):
    member = models.ForeignKey(
        Member,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='login_activity',
    )
    login_identifier = models.CharField(max_length=254)

    class Meta(BaseLoginActivity.Meta):
        db_table = 'member_login_activity'


class SuperAdminLoginActivity(BaseLoginActivity):
    super_admin = models.ForeignKey(
        SuperAdmin,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='login_activity',
    )
    email_used = models.EmailField()
    two_factor_status = models.CharField(max_length=30, blank=True)

    class Meta(BaseLoginActivity.Meta):
        db_table = 'super_admin_login_activity'


class AdminLoginActivity(BaseLoginActivity):
    admin = models.ForeignKey(
        Admin,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='login_activity',
    )
    email_used = models.EmailField()

    class Meta(BaseLoginActivity.Meta):
        db_table = 'admin_login_activity'


class StaffLoginActivity(BaseLoginActivity):
    staff = models.ForeignKey(
        Staff,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='login_activity',
    )
    email_used = models.EmailField()

    class Meta(BaseLoginActivity.Meta):
        db_table = 'staff_login_activity'



class BaseOperationalActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor_id = models.UUIDField(db_index=True)
    action = models.CharField(max_length=100, db_index=True)
    module = models.CharField(max_length=60, db_index=True)
    target_type = models.CharField(max_length=100, blank=True)
    target_id = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    old_data = models.JSONField(default=dict, blank=True)
    new_data = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    city = models.CharField(max_length=100, blank=True, default='')
    country = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        abstract = True
        ordering = ('-created_at',)


class SuperAdminActivityLog(BaseOperationalActivityLog):
    actor_name = models.CharField(max_length=255, blank=True, default='')
    actor_role = models.CharField(max_length=60, blank=True, default='')

    class Meta(BaseOperationalActivityLog.Meta):
        db_table = 'super_admin_activity_logs'


class AdminActivityLog(BaseOperationalActivityLog):
    actor_name = models.CharField(max_length=255, blank=True, default='')
    actor_role = models.CharField(max_length=60, blank=True, default='')

    class Meta(BaseOperationalActivityLog.Meta):
        db_table = 'admin_activity_logs'


class StaffActivityLog(BaseOperationalActivityLog):
    class Meta(BaseOperationalActivityLog.Meta):
        db_table = 'staff_activity_logs'



class MemberActivityLog(BaseOperationalActivityLog):
    """Audit trail for actions a member performs on their own account/profile."""

    actor_name = models.CharField(max_length=255, blank=True, default='')
    actor_role = models.CharField(max_length=60, blank=True, default='')

    class Meta(BaseOperationalActivityLog.Meta):
        db_table = 'member_activity_logs'


class MemberProfile(models.Model):
    member = models.OneToOneField(Member, on_delete=models.CASCADE, related_name='profile')
    marital_status = models.CharField(max_length=30, blank=True)
    height = models.CharField(max_length=20, blank=True)
    weight = models.CharField(max_length=20, blank=True)
    blood_group = models.CharField(max_length=10, blank=True)
    complexion = models.CharField(max_length=30, blank=True)
    religion = models.CharField(max_length=50, blank=True)
    mother_tongue = models.CharField(max_length=50, blank=True)
    caste = models.CharField(max_length=80, blank=True)
    sub_caste = models.CharField(max_length=80, blank=True)
    gothra = models.CharField(max_length=80, blank=True)
    star_nakshatra = models.CharField(max_length=50, blank=True)
    manglik_status = models.CharField(max_length=20, blank=True)
    highest_education = models.CharField(max_length=100, blank=True)
    education_detail = models.CharField(max_length=200, blank=True)
    occupation = models.CharField(max_length=100, blank=True)
    employed_in = models.CharField(max_length=80, blank=True)
    company = models.CharField(max_length=150, blank=True)
    annual_income = models.CharField(max_length=50, blank=True)
    work_location = models.CharField(max_length=150, blank=True)
    father_status = models.CharField(max_length=100, blank=True)
    mother_status = models.CharField(max_length=100, blank=True)
    num_brothers = models.PositiveSmallIntegerField(default=0)
    num_sisters = models.PositiveSmallIntegerField(default=0)
    family_type = models.CharField(max_length=30, blank=True)
    family_status = models.CharField(max_length=50, blank=True)
    family_location = models.CharField(max_length=150, blank=True)
    about = models.TextField(blank=True)
    hobbies = models.JSONField(default=list, blank=True)
    compatibility = models.PositiveSmallIntegerField(default=0)
    submitted_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'member_profiles'

    def __str__(self):
        return f'Profile of {self.member.email}'

    @property
    def user(self):
        """Compatibility alias for integrations that call the member a user."""
        return self.member

    @property
    def age(self):
        if not self.member.date_of_birth:
            return None
        today = timezone.localdate()
        born = self.member.date_of_birth
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


class MemberPreference(models.Model):
    member = models.OneToOneField(Member, on_delete=models.CASCADE, related_name='preferences')
    preferred_age_min = models.PositiveSmallIntegerField(default=21)
    preferred_age_max = models.PositiveSmallIntegerField(default=40)
    preferred_height_min = models.CharField(max_length=20, blank=True)
    preferred_height_max = models.CharField(max_length=20, blank=True)
    preferred_religion = models.CharField(max_length=100, blank=True)
    preferred_caste = models.CharField(max_length=100, blank=True)
    preferred_location = models.CharField(max_length=200, blank=True)
    preferred_education = models.CharField(max_length=150, blank=True)
    preferred_occupation = models.CharField(max_length=150, blank=True)
    preferred_marital_status = models.CharField(max_length=100, blank=True)
    additional_expectations = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'member_preferences'
        constraints = [
            models.CheckConstraint(
                check=Q(preferred_age_min__lte=models.F('preferred_age_max')),
                name='member_preference_age_order',
            ),
        ]


class MemberDocument(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    class DocumentType(models.TextChoices):
        AADHAAR = 'AADHAAR', 'Aadhaar Card'
        PAN = 'PAN', 'PAN Card'
        PASSPORT = 'PASSPORT', 'Passport'
        DRIVING_LICENCE = 'DRIVING_LICENCE', 'Driving Licence'
        VOTER_ID = 'VOTER_ID', 'Voter ID'
        BIRTH_CERTIFICATE = 'BIRTH_CERTIFICATE', 'Birth Certificate'
        ADDRESS_PROOF = 'ADDRESS_PROOF', 'Address Proof'
        INCOME_CERTIFICATE = 'INCOME_CERTIFICATE', 'Income Certificate'
        DEGREE_CERTIFICATE = 'DEGREE_CERTIFICATE', 'Degree Certificate'
        TENTH_MARKSHEET = 'TENTH_MARKSHEET', '10th Marks Card'
        TWELFTH_MARKSHEET = 'TWELFTH_MARKSHEET', '12th Marks Card'
        DIPLOMA_CERTIFICATE = 'DIPLOMA_CERTIFICATE', 'Diploma Certificate'
        EMPLOYMENT_PROOF = 'EMPLOYMENT_PROOF', 'Employment Proof'
        SALARY_SLIP = 'SALARY_SLIP', 'Salary Slip'
        DIVORCE_CERTIFICATE = 'DIVORCE_CERTIFICATE', 'Divorce Certificate'
        DEATH_CERTIFICATE = 'DEATH_CERTIFICATE', 'Death Certificate'
        OTHER = 'OTHER', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=30, choices=DocumentType.choices)
    custom_document_name = models.CharField(max_length=255, blank=True)
    original_file_name = models.CharField(max_length=255)
    file_data = models.BinaryField(null=True, blank=True, help_text='Gzip-compressed document bytes stored in the database.')
    mime_type = models.CharField(max_length=100)
    file_size = models.PositiveBigIntegerField(help_text='Original uncompressed file size in bytes.')
    compressed_size = models.PositiveBigIntegerField(null=True, blank=True, help_text='Size of the stored compressed bytes.')
    file_hash = models.CharField(max_length=64, blank=True, null=True, help_text='SHA-256 checksum of the original file bytes.')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    admin_comment = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by_id = models.UUIDField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def reviewed_by(self):
        if not self.reviewed_by_id:
            return None
        from .models import Admin, SuperAdmin
        return (Admin.objects.filter(pk=self.reviewed_by_id).first()
                or SuperAdmin.objects.filter(pk=self.reviewed_by_id).first())

    @reviewed_by.setter
    def reviewed_by(self, value):
        self.reviewed_by_id = value.pk if value else None

    @property
    def display_name(self):
        if self.document_type == self.DocumentType.OTHER and self.custom_document_name:
            return self.custom_document_name
        return self.get_document_type_display()

    @property
    def can_delete(self):
        return True

    @property
    def can_reupload(self):
        return self.status == self.Status.REJECTED

    @property
    def raw_file_bytes(self):
        """Return the decompressed document bytes, or None if no data."""
        if self.file_data is None:
            return None
        import gzip
        try:
            return gzip.decompress(self.file_data)
        except (OSError, gzip.BadGzipFile):
            return bytes(self.file_data)

    class Meta:
        db_table = 'member_documents'
        ordering = ('-uploaded_at',)


class DuplicateAccountFlag(models.Model):
    class FlagType(models.TextChoices):
        EMAIL_EXACT = 'EMAIL_EXACT', 'Exact email match'
        MOBILE_EXACT = 'MOBILE_EXACT', 'Exact mobile match'
        PHOTO_HASH = 'PHOTO_HASH', 'Photo hash match'
        NAME_DOB_GENDER = 'NAME_DOB_GENDER', 'Name + DOB + gender match'
        DOCUMENT_HASH = 'DOCUMENT_HASH', 'Document hash match'
        DEVICE_FINGERPRINT = 'DEVICE_FINGERPRINT', 'Device fingerprint match'

    class ReviewStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending review'
        CONFIRMED = 'CONFIRMED', 'Confirmed duplicate'
        DISMISSED = 'DISMISSED', 'Dismissed (false positive)'
        MERGED = 'MERGED', 'Merged / resolved'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    primary_member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='duplicate_flags_as_primary',
    )
    duplicate_member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='duplicate_flags_as_duplicate',
    )
    flag_type = models.CharField(max_length=30, choices=FlagType.choices, db_index=True)
    review_status = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.PENDING,
        db_index=True,
    )
    similarity_score = models.FloatField(
        default=1.0,
        help_text='Confidence score 0.0-1.0 (1.0 = exact match).',
    )
    match_detail = models.JSONField(
        default=dict,
        blank=True,
        help_text='Structured details about the matched fields.',
    )
    reviewed_by_admin = models.ForeignKey(
        'Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_duplicate_flags',
    )
    reviewed_by_super_admin = models.ForeignKey(
        'SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_duplicate_flags',
    )
    review_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    auto_detected = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'duplicate_account_flags'
        ordering = ('-created_at',)
        constraints = [
            models.CheckConstraint(
                check=~Q(primary_member=models.F('duplicate_member')),
                name='duplicate_flag_different_members',
            ),
            models.UniqueConstraint(
                fields=('primary_member', 'duplicate_member', 'flag_type'),
                name='unique_duplicate_flag_per_type',
            ),
        ]

    def __str__(self):
        return f'[{self.flag_type}] {self.primary_member_id} ↔ {self.duplicate_member_id}'


class BaseAccessScope(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)
    state = models.ForeignKey(State, on_delete=models.SET_NULL, null=True, blank=True)
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Permission Scope Type, e.g. "GEOGRAPHIC", "DEPARTMENTAL", "GLOBAL"
    permission_scope_type = models.CharField(max_length=50, default='BRANCH')
    
    can_view = models.BooleanField(default=True)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_assign = models.BooleanField(default=False)
    can_approve = models.BooleanField(default=False)
    can_escalate = models.BooleanField(default=False)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AdminAccessScope(BaseAccessScope):
    account = models.ForeignKey(Admin, on_delete=models.CASCADE, related_name='access_scopes')

    class Meta:
        db_table = 'admin_access_scopes'


class StaffAccessScope(BaseAccessScope):
    account = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='access_scopes')

    class Meta:
        db_table = 'staff_access_scopes'



