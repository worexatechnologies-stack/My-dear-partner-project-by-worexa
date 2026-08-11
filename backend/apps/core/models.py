import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone



class MembershipPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    slug = models.SlugField(max_length=50, unique=True, db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration = models.CharField(max_length=50)
    features = models.JSONField(default=list)
    highlighted = models.BooleanField(default=False)
    badge = models.CharField(max_length=50, blank=True)
    color = models.CharField(max_length=200, blank=True)
    
    # New fields requested for database-driven entitlements
    display_name = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    currency = models.CharField(max_length=10, default='INR')
    duration_days = models.IntegerField(default=30)
    entitlements = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    display_order = models.IntegerField(default=0)
    rank = models.IntegerField(default=99, help_text='Numeric rank for upgrade ordering (1=Free, 2=Gold, 3=Platinum, 4=Elite)')
    
    # Entitlement parameters (compat and detailed)
    profile_view_limit_daily = models.IntegerField(default=10)
    interest_limit_daily = models.IntegerField(default=3)
    message_limit_daily = models.IntegerField(null=True, blank=True, default=0, help_text='Null = unlimited')
    
    daily_profile_unlock_limit = models.IntegerField(null=True, blank=True)
    interest_limit = models.IntegerField(null=True, blank=True)
    
    can_send_interest = models.BooleanField(default=True)
    can_message = models.BooleanField(default=False)
    can_view_contact = models.BooleanField(default=False)
    can_view_private_photos = models.BooleanField(default=False)
    can_view_profile_visitors = models.BooleanField(default=False)
    can_view_received_interests = models.BooleanField(default=False)
    can_get_priority_listing = models.BooleanField(default=False)
    can_use_profile_boost = models.BooleanField(default=False)
    
    # Access choices
    contact_access_mode = models.CharField(
        max_length=20, 
        choices=[('NONE', 'None'), ('MUTUAL_ONLY', 'Mutual Only'), ('FULL', 'Full')], 
        default='NONE'
    )
    photo_access_mode = models.CharField(
        max_length=20, 
        choices=[('PRIMARY_ONLY', 'Primary Only'), ('ALL_APPROVED', 'All Approved')], 
        default='PRIMARY_ONLY'
    )
    messaging_mode = models.CharField(
        max_length=20,
        choices=[('DISABLED', 'disabled'), ('MUTUAL_ONLY', 'mutual_only'), ('ENABLED', 'enabled')],
        default='DISABLED'
    )
    
    # Flags & Priorities
    can_use_advanced_search = models.BooleanField(default=False)
    can_use_horoscope = models.BooleanField(default=False)
    profile_boost_level = models.CharField(max_length=20, default='NONE') # e.g. NONE, MEDIUM, STRONG
    support_priority = models.CharField(max_length=20, default='STANDARD') # e.g. STANDARD, HIGH
    
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    # Multi-month pricing options
    price_3m = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_6m = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_1y = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discount_3m = models.CharField(max_length=50, blank=True)
    discount_6m = models.CharField(max_length=50, blank=True)
    discount_1y = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'membership_plans'

    def __str__(self):
        return f'{self.name} ({self.currency} {self.price})'


class MemberMembership(models.Model):
    class MembershipStatus(models.TextChoices):
        PENDING_PAYMENT = 'PENDING_PAYMENT', 'Pending Payment'
        ACTIVE = 'ACTIVE', 'Active'
        EXPIRING_SOON = 'EXPIRING_SOON', 'Expiring Soon'
        EXPIRED = 'EXPIRED', 'Expired'
        CANCELLED = 'CANCELLED', 'Cancelled'
        PAYMENT_FAILED = 'PAYMENT_FAILED', 'Payment Failed'
        FAILED = 'FAILED', 'Failed'
        # Legacy values remain readable for rows created before the payment
        # flow was restored. New code never creates them.
        FREE = 'FREE', 'Free (legacy)'
        PAYMENT_PENDING = 'PAYMENT_PENDING', 'Payment Pending (legacy)'
        PENDING_VERIFICATION = 'PENDING_VERIFICATION', 'Pending Verification (legacy)'
        REFUNDED = 'REFUNDED', 'Refunded (legacy)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    plan = models.ForeignKey(MembershipPlan, on_delete=models.SET_NULL, null=True, blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    status = models.CharField(
        max_length=30,
        choices=MembershipStatus.choices,
        default=MembershipStatus.FREE,
        db_index=True,
    )
    razorpay_order_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    razorpay_payment_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=255, blank=True)
    auto_renew = models.BooleanField(default=False)
    created_by = models.CharField(max_length=50, blank=True, help_text='Source of activation: member_request, admin_direct, payment_verified, free_activation, system')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'member_memberships'


class NotificationDeliveryLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey(MemberMembership, on_delete=models.CASCADE, related_name='notification_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notification_delivery_logs')
    notification_type = models.CharField(max_length=50, db_index=True)
    milestone = models.CharField(max_length=50, blank=True)
    channel = models.CharField(max_length=30, default='in_app')
    sent_at = models.DateTimeField(auto_now_add=True)
    delivery_status = models.CharField(max_length=30, default='sent')
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notification_delivery_logs'
        ordering = ('-sent_at',)


class SupportExpiringMembership(models.Model):
    class ContactStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONTACTED = 'contacted', 'Contacted'
        FOLLOW_UP = 'follow_up', 'Follow Up'
        RESOLVED = 'resolved', 'Resolved'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.OneToOneField(MemberMembership, on_delete=models.CASCADE, related_name='support_tracking')
    contact_status = models.CharField(max_length=30, choices=ContactStatus.choices, default=ContactStatus.PENDING)
    assigned_agent_id = models.UUIDField(null=True, blank=True)
    assigned_agent_name = models.CharField(max_length=255, blank=True)
    last_contacted_at = models.DateTimeField(null=True, blank=True)
    follow_up_notes = models.TextField(blank=True)
    contacted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'support_expiring_memberships'
        ordering = ('-created_at',)


class MembershipRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        ACTIVE = 'active', 'Active'
        EXPIRED = 'expired', 'Expired'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='membership_requests',
    )
    selected_plan = models.ForeignKey(
        MembershipPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='membership_requests',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by_id = models.UUIDField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejected_by_id = models.UUIDField(null=True, blank=True)

    @property
    def approved_by(self):
        from apps.accounts.models import Admin, SuperAdmin
        if not self.approved_by_id:
            return None
        return Admin.objects.filter(pk=self.approved_by_id).first() or SuperAdmin.objects.filter(pk=self.approved_by_id).first()

    @approved_by.setter
    def approved_by(self, value):
        self.approved_by_id = value.pk if value else None

    @property
    def rejected_by(self):
        from apps.accounts.models import Admin, SuperAdmin
        if not self.rejected_by_id:
            return None
        return Admin.objects.filter(pk=self.rejected_by_id).first() or SuperAdmin.objects.filter(pk=self.rejected_by_id).first()

    @rejected_by.setter
    def rejected_by(self, value):
        self.rejected_by_id = value.pk if value else None
    rejection_reason = models.TextField(blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    expiry_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        db_table = 'membership_requests'
        ordering = ['-requested_at']





class Interest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        DECLINED = 'DECLINED', 'Declined'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_interests',
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_interests',
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'interests'
        constraints = [
            models.UniqueConstraint(
                fields=('sender', 'receiver'),
                name='unique_sender_receiver_interest',
            ),
            models.CheckConstraint(
                check=~Q(sender=models.F('receiver')),
                name='interest_sender_not_receiver',
            ),
        ]


class ChatMessage(models.Model):
    objects = models.Manager()
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_messages',
    )
    text = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'chat_messages'
        ordering = ('created_at',)
        indexes = [
            models.Index(
                fields=('sender', 'receiver', 'created_at'),
                name='chat_sender_recv_created_idx',
            ),
        ]



class FAQ(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.CharField(max_length=255)
    answer = models.TextField()

    class Meta:
        db_table = 'faqs'


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SUCCESS = 'SUCCESS', 'Successful'
        FAILED = 'FAILED', 'Failed'
        REFUNDED = 'REFUNDED', 'Refunded'
        PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED', 'Partially refunded'

    class RefundStatus(models.TextChoices):
        NONE = 'NONE', 'None'
        REQUESTED = 'REQUESTED', 'Requested'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payments',
    )
    membership = models.ForeignKey(
        MemberMembership,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
    )
    plan = models.ForeignKey(MembershipPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    client_reference = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING, db_index=True)
    gateway = models.CharField(max_length=50, blank=True)
    gateway_reference = models.CharField(max_length=120, blank=True, null=True, unique=True)
    refunded_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    refund_status = models.CharField(
        max_length=12,
        choices=RefundStatus.choices,
        default=RefundStatus.NONE,
        db_index=True,
    )
    refund_reason = models.TextField(blank=True)
    refund_reference = models.CharField(max_length=120, blank=True)
    refund_requested_at = models.DateTimeField(null=True, blank=True)
    refunded_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_refunds',
    )
    refunded_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_refunds',
    )
    refunded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'
        ordering = ('-created_at',)


class LegacyRefundRequest(models.Model):
    class Status(models.TextChoices):
        REQUESTED = 'REQUESTED', 'Requested'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name='refund_requests')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.REQUESTED, db_index=True)
    idempotency_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    gateway_reference = models.CharField(max_length=120, blank=True)
    error_message = models.TextField(blank=True)
    requested_by_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='refund_requests',
    )
    processed_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='refund_requests_processed',
    )
    processed_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='refund_requests_processed',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'refund_requests'
        ordering = ('-created_at',)


class SupportCategory(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'support_categories'
        ordering = ('name',)

    def __str__(self):
        return self.name


class SupportSlaRule(models.Model):
    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        NORMAL = 'NORMAL', 'Normal'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    category = models.ForeignKey(SupportCategory, on_delete=models.CASCADE, related_name='sla_rules')
    priority = models.CharField(max_length=10, choices=Priority.choices)
    first_response_minutes = models.PositiveIntegerField(default=240)
    resolution_minutes = models.PositiveIntegerField(default=2880)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'support_sla_rules'
        constraints = [
            models.UniqueConstraint(
                fields=('category', 'priority'),
                name='unique_support_sla_category_priority',
            ),
        ]


class SupportTicket(models.Model):
    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        NORMAL = 'NORMAL', 'Normal'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        UNASSIGNED = 'UNASSIGNED', 'Unassigned'
        ASSIGNED = 'ASSIGNED', 'Assigned'
        IN_PROGRESS = 'IN_PROGRESS', 'In progress'
        WAITING_FOR_MEMBER = 'WAITING_FOR_MEMBER', 'Waiting for member'
        WAITING_FOR_INTERNAL = 'WAITING_FOR_INTERNAL', 'Waiting for internal'
        ESCALATED = 'ESCALATED', 'Escalated'
        RESOLVED = 'RESOLVED', 'Resolved'
        CLOSED = 'CLOSED', 'Closed'
        REOPENED = 'REOPENED', 'Reopened'

    class Source(models.TextChoices):
        WEB = 'WEB', 'Web'
        PHONE = 'PHONE', 'Phone'
        SYSTEM = 'SYSTEM', 'System'
        EMAIL = 'EMAIL', 'Email (disabled)'
        WHATSAPP = 'WHATSAPP', 'WhatsApp (disabled)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number = models.CharField(max_length=40, unique=True, db_index=True, blank=True)
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='support_tickets',
    )
    category = models.ForeignKey(SupportCategory, on_delete=models.PROTECT, related_name='tickets')
    subject = models.CharField(max_length=255)
    description = models.TextField()
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.UNASSIGNED, db_index=True)
    source = models.CharField(max_length=12, choices=Source.choices, default=Source.WEB)
    is_read = models.BooleanField(default=False)
    is_resolved = models.BooleanField(default=False)

    created_by_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='support_tickets_created',
    )

    related_payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True)
    related_profile = models.ForeignKey(
        'accounts.MemberProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    first_response_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    last_reply_at = models.DateTimeField(null=True, blank=True, db_index=True)
    sla_deadline = models.DateTimeField(null=True, blank=True, db_index=True)
    reopened_count = models.PositiveIntegerField(default=0)
    resolution_summary = models.TextField(blank=True)
    resolver_id = models.UUIDField(null=True, blank=True)
    resolver_name = models.CharField(max_length=150, blank=True, default='')
    resolver_email = models.CharField(max_length=254, blank=True, default='')
    resolver_phone = models.CharField(max_length=30, blank=True, default='')
    resolver_custom_id = models.CharField(max_length=50, blank=True, default='')
    version = models.PositiveIntegerField(default=0, help_text='Optimistic lock for concurrent updates')

    claimed_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='claimed_tickets',
    )
    claimed_by_admin = models.ForeignKey(
        'accounts.Admin', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='claimed_tickets',
    )

    resolved_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_tickets',
    )
    resolved_by_admin = models.ForeignKey(
        'accounts.Admin', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_tickets',
    )

    closed_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='closed_tickets',
    )
    closed_by_admin = models.ForeignKey(
        'accounts.Admin', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='closed_tickets',
    )


    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'support_tickets'
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=['status', 'priority'], name='ticket_status_priority_idx'),
            models.Index(fields=['status', 'last_reply_at'], name='ticket_status_lastreply_idx'),
            models.Index(fields=['sla_deadline'], name='ticket_sla_idx'),
            models.Index(fields=['member', 'status'], name='ticket_member_status_idx'),
            models.Index(fields=['ticket_number'], name='ticket_number_lookup_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            prefix = 'MAT'
            if self.source == self.Source.PHONE:
                prefix = 'PHN'
            elif self.source == self.Source.SYSTEM:
                prefix = 'SYS'
            self.ticket_number = f'{prefix}-{timezone.now():%Y%m%d}-{str(self.id).split("-")[0].upper()}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.ticket_number}: {self.subject}'


class TicketAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='assignments')
    assigned_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_assignments_made',
    )
    assigned_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_assignments_made',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    unassigned_at = models.DateTimeField(null=True, blank=True)
    assignment_reason = models.TextField(blank=True)
    is_current = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = 'ticket_assignments'
        ordering = ('-assigned_at',)
        constraints = [
            models.UniqueConstraint(
                fields=('ticket',),
                condition=Q(is_current=True),
                name='one_current_ticket_assignment',
            ),
            models.CheckConstraint(
                check=(
                    Q(assigned_by_admin__isnull=False, assigned_by_super_admin__isnull=True)
                    | Q(assigned_by_admin__isnull=True, assigned_by_super_admin__isnull=False)
                ),
                name='ticket_assignment_exactly_one_assigner',
            ),
        ]


class SupportTicketReply(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='replies')
    member_sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='support_replies',
    )
    admin_sender = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='support_replies',
    )
    super_admin_sender = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='support_replies',
    )
    message = models.TextField()
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'support_ticket_replies'
        ordering = ('created_at',)
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(member_sender__isnull=False, admin_sender__isnull=True, super_admin_sender__isnull=True)
                    | Q(member_sender__isnull=True, admin_sender__isnull=False, super_admin_sender__isnull=True)
                    | Q(member_sender__isnull=True, admin_sender__isnull=True, super_admin_sender__isnull=False)
                ),
                name='support_reply_exactly_one_sender',
            ),
        ]


class TicketInternalNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='internal_notes')
    admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_internal_notes',
    )
    super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_internal_notes',
    )
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ticket_internal_notes'
        ordering = ('created_at',)
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(admin__isnull=False, super_admin__isnull=True)
                    | Q(admin__isnull=True, super_admin__isnull=False)
                ),
                name='ticket_note_exactly_one_author',
            ),
        ]


class TicketStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=30, choices=SupportTicket.Status.choices)
    new_status = models.CharField(max_length=30, choices=SupportTicket.Status.choices)
    changed_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_status_changes',
    )
    changed_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_status_changes',
    )
    changed_by_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_status_changes',
    )
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ticket_status_history'
        ordering = ('created_at',)
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(changed_by_admin__isnull=False, changed_by_super_admin__isnull=True, changed_by_member__isnull=True)
                    | Q(changed_by_admin__isnull=True, changed_by_super_admin__isnull=False, changed_by_member__isnull=True)
                    | Q(changed_by_admin__isnull=True, changed_by_super_admin__isnull=True, changed_by_member__isnull=False)
                ),
                name='ticket_history_exactly_one_actor',
            ),
        ]


class SupportTicketAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='attachments')
    reply = models.ForeignKey(
        SupportTicketReply,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments',
    )
    uploaded_by_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='support_attachments',
    )
    uploaded_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='support_attachments',
    )
    uploaded_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='support_attachments',
    )
    file_bytes = models.BinaryField(null=True, blank=True, editable=False)
    compression = models.CharField(max_length=10, default='gzip', blank=True)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    file_size = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'support_ticket_attachments'
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(uploaded_by_member__isnull=False, uploaded_by_admin__isnull=True, uploaded_by_super_admin__isnull=True)
                    | Q(uploaded_by_member__isnull=True, uploaded_by_admin__isnull=False, uploaded_by_super_admin__isnull=True)
                    | Q(uploaded_by_member__isnull=True, uploaded_by_admin__isnull=True, uploaded_by_super_admin__isnull=False)
                ),
                name='support_attachment_exactly_one_uploader',
            ),
        ]


class TicketFeedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.OneToOneField(SupportTicket, on_delete=models.CASCADE, related_name='feedback')
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ticket_feedback',
    )
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    feedback_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ticket_feedback'


class AdminTicketReadState(models.Model):
    admin_id = models.UUIDField(db_index=True)
    admin_type = models.CharField(max_length=30, choices=[
        ('SUPER_ADMIN', 'Super Admin'),
        ('ADMIN', 'Admin'),
    ])
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='read_states')
    last_read_message_id = models.UUIDField(null=True, blank=True)
    last_read_at = models.DateTimeField(auto_now=True)
    unread_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'admin_ticket_read_states'
        constraints = [
            models.UniqueConstraint(
                fields=('admin_id', 'admin_type', 'ticket'),
                name='unique_admin_ticket_read_state',
            ),
        ]
        indexes = [
            models.Index(fields=['admin_id', 'admin_type'], name='readstate_admin_idx'),
            models.Index(fields=['ticket', 'unread_count'], name='readstate_ticket_unread_idx'),
        ]


class TicketAuditLog(models.Model):
    class Action(models.TextChoices):
        TICKET_CREATED = 'TICKET_CREATED', 'Ticket created'
        TICKET_CLAIMED = 'TICKET_CLAIMED', 'Ticket claimed'
        TICKET_ASSIGNED = 'TICKET_ASSIGNED', 'Ticket assigned'
        TICKET_REASSIGNED = 'TICKET_REASSIGNED', 'Ticket reassigned'
        TICKET_UNASSIGNED = 'TICKET_UNASSIGNED', 'Ticket unassigned'
        TICKET_RESOLVED = 'TICKET_RESOLVED', 'Ticket resolved'
        TICKET_REOPENED = 'TICKET_REOPENED', 'Ticket reopened'
        TICKET_CLOSED = 'TICKET_CLOSED', 'Ticket closed'
        STATUS_CHANGED = 'STATUS_CHANGED', 'Status changed'
        PRIORITY_CHANGED = 'PRIORITY_CHANGED', 'Priority changed'
        REPLY_SENT = 'REPLY_SENT', 'Reply sent'
        INTERNAL_NOTE_ADDED = 'INTERNAL_NOTE_ADDED', 'Internal note added'
        ATTACHMENT_ADDED = 'ATTACHMENT_ADDED', 'Attachment added'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='audit_logs')
    actor_id = models.UUIDField(null=True, blank=True, db_index=True)
    actor_name = models.CharField(max_length=255, blank=True)
    actor_role = models.CharField(max_length=30, blank=True)
    action = models.CharField(max_length=30, choices=Action.choices, db_index=True)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    reason = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'ticket_audit_logs'
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=['ticket', 'created_at'], name='auditlog_ticket_created_idx'),
            models.Index(fields=['actor_id', 'action'], name='auditlog_actor_action_idx'),
            models.Index(fields=['action', 'created_at'], name='auditlog_action_created_idx'),
        ]


class ProfileVerificationRequest(models.Model):
    class VerificationType(models.TextChoices):
        FULL_PROFILE = 'FULL_PROFILE', 'Full profile'
        PROFILE_PHOTO = 'PROFILE_PHOTO', 'Profile photo'
        IDENTITY_DOCUMENT = 'IDENTITY_DOCUMENT', 'Identity document'
        PHONE = 'PHONE', 'Phone'
        EMAIL = 'EMAIL', 'Email'
        EDUCATION = 'EDUCATION', 'Education'
        EMPLOYMENT = 'EMPLOYMENT', 'Employment'

    class Status(models.TextChoices):
        """Standardized status for verification requests"""
        PENDING_REVIEW = 'pending_review', 'Pending Review'
        IN_REVIEW = 'in_review', 'In Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CHANGES_REQUESTED = 'changes_requested', 'Changes Requested'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        NORMAL = 'NORMAL', 'Normal'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='verification_requests',
    )
    verification_type = models.CharField(max_length=30, choices=VerificationType.choices)
    status = models.CharField(
        max_length=20, 
        choices=Status.choices, 
        default=Status.PENDING_REVIEW, 
        db_index=True
    )
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    submitted_at = models.DateTimeField(default=timezone.now)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    escalation_reason = models.TextField(blank=True)
    
    # Track who reviewed (for audit trail)
    reviewed_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_verifications',
    )
    reviewed_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_verifications',
    )
    reviewed_by_staff = models.ForeignKey(
        'accounts.Staff',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_verifications',
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'profile_verification_requests'
        ordering = ('-created_at',)


class ProfileVerificationAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    verification_request = models.ForeignKey(
        ProfileVerificationRequest,
        on_delete=models.CASCADE,
        related_name='assignments',
    )
    assigned_to_staff = models.ForeignKey(
        'accounts.Staff',
        on_delete=models.PROTECT,
        related_name='verification_assignments',
    )
    assigned_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verification_assignments_made',
    )
    assigned_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verification_assignments_made',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_current = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = 'profile_verification_assignments'
        ordering = ('-assigned_at',)
        constraints = [
            models.UniqueConstraint(
                fields=('verification_request',),
                condition=Q(is_current=True),
                name='one_current_verification_assignment',
            ),
            models.CheckConstraint(
                check=(
                    Q(assigned_by_admin__isnull=False, assigned_by_super_admin__isnull=True)
                    | Q(assigned_by_admin__isnull=True, assigned_by_super_admin__isnull=False)
                    | Q(assigned_by_admin__isnull=True, assigned_by_super_admin__isnull=True)
                ),
                name='verification_assignment_exactly_one_assigner_or_system',
            ),
        ]


class ProfileVerificationHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    verification_request = models.ForeignKey(
        ProfileVerificationRequest,
        on_delete=models.CASCADE,
        related_name='history',
    )
    old_status = models.CharField(max_length=20, choices=ProfileVerificationRequest.Status.choices)
    new_status = models.CharField(max_length=20, choices=ProfileVerificationRequest.Status.choices)
    changed_by_staff = models.ForeignKey(
        'accounts.Staff',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verification_status_changes',
    )
    changed_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verification_status_changes',
    )
    changed_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verification_status_changes',
    )
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'profile_verification_history'
        ordering = ('created_at',)
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(
                        changed_by_staff__isnull=False,
                        changed_by_admin__isnull=True,
                        changed_by_super_admin__isnull=True,
                    )
                    | Q(
                        changed_by_staff__isnull=True,
                        changed_by_admin__isnull=False,
                        changed_by_super_admin__isnull=True,
                    )
                    | Q(
                        changed_by_staff__isnull=True,
                        changed_by_admin__isnull=True,
                        changed_by_super_admin__isnull=False,
                    )
                ),
                name='verification_history_exactly_one_actor',
            ),
        ]


class ProfileVerificationDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    verification_request = models.ForeignKey(
        ProfileVerificationRequest,
        on_delete=models.CASCADE,
        related_name='verification_documents',
    )
    member_document = models.ForeignKey(
        'accounts.MemberDocument',
        on_delete=models.PROTECT,
        related_name='verification_links',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'profile_verification_documents'
        constraints = [
            models.UniqueConstraint(
                fields=('verification_request', 'member_document'),
                name='unique_verification_document_link',
            ),
        ]


class Notification(models.Model):
    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        NORMAL = 'NORMAL', 'Normal'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member_recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
    )
    super_admin_recipient = models.ForeignKey(
        'accounts.SuperAdmin', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications'
    )
    admin_recipient = models.ForeignKey(
        'accounts.Admin', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications'
    )
    staff_recipient = models.ForeignKey(
        'accounts.Staff', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications'
    )
    notification_type = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    link_url = models.CharField(max_length=500, blank=True)
    related_object_type = models.CharField(max_length=64, blank=True)
    related_object_id = models.CharField(max_length=100, blank=True)
    priority = models.CharField(max_length=12, choices=Priority.choices, default=Priority.NORMAL)
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'notifications'
        ordering = ('-created_at',)
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(member_recipient__isnull=False, super_admin_recipient__isnull=True, admin_recipient__isnull=True, staff_recipient__isnull=True)
                    | Q(member_recipient__isnull=True, super_admin_recipient__isnull=False, admin_recipient__isnull=True, staff_recipient__isnull=True)
                    | Q(member_recipient__isnull=True, super_admin_recipient__isnull=True, admin_recipient__isnull=False, staff_recipient__isnull=True)
                    | Q(member_recipient__isnull=True, super_admin_recipient__isnull=True, admin_recipient__isnull=True, staff_recipient__isnull=False)
                ),
                name='notification_exactly_one_recipient',
            ),
        ]


class ContactEnquiry(models.Model):
    class Status(models.TextChoices):
        NEW = 'NEW', 'New'
        CONTACTED = 'CONTACTED', 'Contacted'
        PENDING = 'PENDING', 'Pending'
        RESOLVED = 'RESOLVED', 'Resolved'
        CLOSED = 'CLOSED', 'Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contact_enquiries',
    )
    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW, db_index=True)
    internal_notes = models.TextField(blank=True)
    contacted_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contact_enquiries'
        ordering = ('-created_at',)


class Complaint(models.Model):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under review'
        ESCALATED = 'ESCALATED', 'Escalated'
        RESOLVED = 'RESOLVED', 'Resolved'
        CLOSED = 'CLOSED', 'Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='complaints')
    subject = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN, db_index=True)
    assigned_to_staff = models.ForeignKey(
        'accounts.Staff', on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints'
    )
    escalated_to_admin = models.ForeignKey(
        'accounts.Admin', on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'complaints'
        ordering = ('-created_at',)


class ProfileReport(models.Model):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under review'
        ACTIONED = 'ACTIONED', 'Actioned'
        DISMISSED = 'DISMISSED', 'Dismissed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reported_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile_reports_received',
    )
    reported_by_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='profile_reports_made',
    )
    reason = models.CharField(max_length=120)
    details = models.TextField(blank=True)
    evidence_file = models.CharField(max_length=500, blank=True, null=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN, db_index=True)
    reviewed_by_staff = models.ForeignKey(
        'accounts.Staff', on_delete=models.SET_NULL, null=True, blank=True, related_name='profile_reports'
    )
    reviewed_by_admin = models.ForeignKey(
        'accounts.Admin', on_delete=models.SET_NULL, null=True, blank=True, related_name='profile_reports'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'profile_reports'
        ordering = ('-created_at',)


class PlatformSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    updated_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin', on_delete=models.SET_NULL, null=True, blank=True, related_name='settings_updates'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'platform_settings'
        ordering = ('key',)


class BackupRecord(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requested_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin', on_delete=models.SET_NULL, null=True, related_name='backup_requests'
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    storage_path = models.CharField(max_length=500, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'backup_records'
        ordering = ('-created_at',)


# Compatibility alias used only by older display components; no user table is created.
UserMembership = MemberMembership


class PaymentWebhookLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.CharField(max_length=50)
    event_id = models.CharField(max_length=150, unique=True, null=True, blank=True)
    event_type = models.CharField(max_length=100)
    payload = models.JSONField()
    status = models.CharField(max_length=20, default='PENDING')  # PENDING, PROCESSED, FAILED, DUPLICATE
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_webhook_logs'
        ordering = ('-created_at',)

    def __str__(self):
        return f"{self.provider} Webhook: {self.event_type} ({self.status})"


class WorkAssignment(models.Model):
    class AssignmentType(models.TextChoices):
        PROFILE_VERIFICATION = 'PROFILE_VERIFICATION', 'Profile verification'
        PHOTO_VERIFICATION = 'PHOTO_VERIFICATION', 'Photo verification'
        DOCUMENT_VERIFICATION = 'DOCUMENT_VERIFICATION', 'Document verification'
        COMPLAINT_REVIEW = 'COMPLAINT_REVIEW', 'Complaint review'
        PROFILE_REPORT_REVIEW = 'PROFILE_REPORT_REVIEW', 'Profile report review'
        MODERATION_TASK = 'MODERATION_TASK', 'Moderation task'

    class Status(models.TextChoices):
        UNASSIGNED = 'UNASSIGNED', 'Unassigned'
        ASSIGNED = 'ASSIGNED', 'Assigned'
        IN_PROGRESS = 'IN_PROGRESS', 'In progress'
        WAITING = 'WAITING', 'Waiting'
        ESCALATED = 'ESCALATED', 'Escalated'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        NORMAL = 'NORMAL', 'Normal'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment_type = models.CharField(max_length=40, choices=AssignmentType.choices)
    assigned_to_staff = models.ForeignKey(
        'accounts.Staff',
        on_delete=models.PROTECT,
        related_name='work_assignments',
        null=True,
        blank=True,
    )
    assigned_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_assignments_made',
    )
    assigned_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_assignments_made',
    )
    related_profile_verification = models.ForeignKey(
        'core.ProfileVerificationRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_assignments',
    )
    related_document_verification = models.ForeignKey(
        'accounts.MemberDocument',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_assignments',
    )
    related_complaint = models.ForeignKey(
        'core.Complaint',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_assignments',
    )
    related_profile_report = models.ForeignKey(
        'core.ProfileReport',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_assignments',
    )
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.UNASSIGNED, db_index=True)
    due_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'work_assignments'
        ordering = ('-created_at',)

    def clean(self):
        from django.core.exceptions import ValidationError
        targets = [
            self.related_profile_verification_id,
            self.related_document_verification_id,
            self.related_complaint_id,
            self.related_profile_report_id,
        ]
        populated = sum(1 for t in targets if t is not None)
        if populated != 1:
            raise ValidationError('Exactly one target (profile, document, complaint, or profile report) must be associated with the WorkAssignment.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ProfileViewLog(models.Model):
    """
    Tracks every time a member views another member's profile.
    Used to enforce daily profile-view limits per membership plan.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile_views_made',
    )
    viewed = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile_views_received',
    )
    viewed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    view_date = models.DateField(db_index=True, help_text='UTC calendar date of the view.')

    class Meta:
        db_table = 'profile_view_logs'
        ordering = ('-viewed_at',)
        indexes = [
            models.Index(fields=('viewer', 'view_date'), name='profile_view_log_viewer_date'),
            models.Index(fields=('viewed', '-viewed_at'), name='profile_view_log_viewed_recent'),
        ]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(viewer=models.F('viewed')),
                name='profile_view_log_viewer_not_viewed',
            ),
        ]

    def __str__(self):
        return f'{self.viewer_id} viewed {self.viewed_id} on {self.view_date}'


class ProfileUnlock(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile_unlocks_made',
    )
    profile = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile_unlocks_received',
    )
    membership = models.ForeignKey(
        'core.MemberMembership',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='profile_unlocks',
    )
    unlocked_at = models.DateTimeField(auto_now_add=True)
    usage_date = models.DateField(db_index=True)
    consumed_limit = models.BooleanField(default=True)
    source = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'profile_unlocks'
        ordering = ('-unlocked_at',)
        constraints = [
            models.UniqueConstraint(
                fields=('viewer', 'profile', 'usage_date'),
                name='unique_viewer_profile_usage_date',
            ),
            models.CheckConstraint(
                check=~models.Q(viewer=models.F('profile')),
                name='profile_unlock_viewer_not_profile',
            ),
        ]

    def __str__(self):
        return f'{self.viewer_id} unlocked {self.profile_id} on {self.usage_date}'


class ProfileBlock(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocks_sent',
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocks_received',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'profile_blocks'
        constraints = [
            models.UniqueConstraint(fields=('blocker', 'blocked'), name='unique_blocker_blocked'),
            models.CheckConstraint(
                check=~models.Q(blocker=models.F('blocked')),
                name='block_blocker_not_blocked',
            ),
        ]

    def __str__(self):
        return f'{self.blocker_id} blocked {self.blocked_id}'


class Specialization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'specializations'
        ordering = ('name',)

    def __str__(self):
        return self.name


class Queue(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'queues'
        ordering = ('name',)

    def __str__(self):
        return self.name


class AssignmentStrategy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assignment_strategies'
        ordering = ('name',)

    def __str__(self):
        return self.name


class EmployeeAvailability(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = 'AVAILABLE', 'Available'
        BUSY = 'BUSY', 'Busy'
        OFFLINE = 'OFFLINE', 'Offline'
        LEAVE = 'LEAVE', 'On Leave'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff_member = models.OneToOneField(
        'accounts.Staff',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='availability',
    )
    is_online = models.BooleanField(default=True)
    is_suspended = models.BooleanField(default=False)
    availability_status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )
    timezone = models.CharField(max_length=50, default='UTC')
    last_active_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_availabilities'

    @property
    def employee(self):
        return self.staff_member

    def __str__(self):
        emp = self.employee
        email = emp.email if emp else 'Unknown'
        return f'{email} - {self.availability_status}'


class Workload(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff_member = models.OneToOneField(
        'accounts.Staff',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='workload',
    )
    open_tickets_count = models.IntegerField(default=0)
    urgent_tickets_count = models.IntegerField(default=0)
    open_verifications_count = models.IntegerField(default=0)
    avg_resolution_time_minutes = models.FloatField(default=0.0)
    avg_response_time_minutes = models.FloatField(default=0.0)
    current_workload_score = models.IntegerField(default=0)
    capacity = models.IntegerField(default=10)
    last_assigned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'workloads'

    @property
    def employee(self):
        return self.staff_member

    def __str__(self):
        emp = self.employee
        email = emp.email if emp else 'Unknown'
        return f'{email} Workload: {self.current_workload_score}'


class AssignmentRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    category = models.ForeignKey(
        SupportCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assignment_rules',
    )
    verification_type = models.CharField(max_length=30, null=True, blank=True)
    priority = models.CharField(max_length=15, null=True, blank=True)
    strategy = models.ForeignKey(
        AssignmentStrategy,
        on_delete=models.PROTECT,
        related_name='rules',
    )
    queue = models.ForeignKey(
        Queue,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rules',
    )
    priority_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assignment_rules'
        ordering = ('-priority_order', 'name')

    def __str__(self):
        return self.name


class TicketAssignmentHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name='assignment_history',
    )
    assigned_by_admin = models.ForeignKey(
        'accounts.Admin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_assignments_delegated',
    )
    assigned_by_super_admin = models.ForeignKey(
        'accounts.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_assignments_delegated',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    unassigned_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.FloatField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'ticket_assignment_history'
        ordering = ('-assigned_at',)


class AssignmentAudit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    related_object_id = models.UUIDField()
    related_object_type = models.CharField(max_length=30)  # TICKET, VERIFICATION
    rule_applied = models.ForeignKey(
        AssignmentRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    strategy_applied = models.CharField(max_length=50)
    assigned_staff = models.ForeignKey(
        'accounts.Staff',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assignment_audits',
    )
    success = models.BooleanField(default=True)
    failure_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assignment_audits'
        ordering = ('-created_at',)


class PaymentOrder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_orders')
    membership_plan = models.ForeignKey(MembershipPlan, on_delete=models.CASCADE, related_name='payment_orders')
    internal_order_number = models.CharField(max_length=100, unique=True)
    razorpay_order_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_subunits = models.IntegerField()  # amount in paise
    currency = models.CharField(max_length=10, default='INR')
    plan_name_snapshot = models.CharField(max_length=255)
    plan_price_snapshot = models.DecimalField(max_digits=12, decimal_places=2)
    duration_days_snapshot = models.IntegerField()
    receipt = models.CharField(max_length=100)
    status = models.CharField(max_length=50, default='created')  # created, checkout_opened, attempted, authorized, captured, paid, failed, cancelled, expired, partially_refunded, refunded, disputed
    attempt_number = models.IntegerField(default=1)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_orders'
        ordering = ('-created_at',)
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gt=0), name='payment_order_amount_gt_zero')
        ]

    def __str__(self):
        return f'{self.internal_order_number} ({self.status})'


class PaymentTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment_order = models.ForeignKey(PaymentOrder, on_delete=models.CASCADE, related_name='transactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_transactions')
    razorpay_payment_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    razorpay_order_id = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    status = models.CharField(max_length=50)
    method = models.CharField(max_length=50, null=True, blank=True)
    bank = models.CharField(max_length=100, null=True, blank=True)
    wallet = models.CharField(max_length=100, null=True, blank=True)
    vpa_masked = models.CharField(max_length=100, null=True, blank=True)
    card_network = models.CharField(max_length=50, null=True, blank=True)
    card_last4 = models.CharField(max_length=10, null=True, blank=True)
    error_code = models.CharField(max_length=100, null=True, blank=True)
    error_description = models.TextField(null=True, blank=True)
    error_source = models.CharField(max_length=100, null=True, blank=True)
    error_step = models.CharField(max_length=100, null=True, blank=True)
    error_reason = models.CharField(max_length=100, null=True, blank=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    safe_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_transactions'
        ordering = ('-created_at',)
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gt=0), name='payment_transaction_amount_gt_zero')
        ]

    def __str__(self):
        return f'{self.razorpay_payment_id or self.pk} ({self.status})'


class RefundRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment_transaction = models.ForeignKey(PaymentTransaction, on_delete=models.CASCADE, related_name='refund_requests')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_refund_requests')
    requested_amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=255)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=50, default='requested')  # requested, approved, rejected, processing, processed, failed, cancelled
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_refunds')
    admin_note = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'payment_refund_requests'
        ordering = ('-requested_at',)
        constraints = [
            models.CheckConstraint(check=models.Q(requested_amount__gt=0), name='refund_request_amount_gt_zero')
        ]

    def __str__(self):
        return f'Refund Request {self.id} ({self.status})'


class RefundTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    refund_request = models.ForeignKey(RefundRequest, on_delete=models.CASCADE, related_name='transactions')
    payment_transaction = models.ForeignKey(PaymentTransaction, on_delete=models.CASCADE, related_name='refund_transactions')
    razorpay_refund_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    internal_refund_number = models.CharField(max_length=100, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    status = models.CharField(max_length=50, default='processing')  # processing, processed, failed
    failure_reason = models.TextField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    safe_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'refund_transactions'
        ordering = ('-created_at',)
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gt=0), name='refund_transaction_amount_gt_zero')
        ]

    def __str__(self):
        return f'{self.internal_refund_number} ({self.status})'


class RazorpayWebhookEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    razorpay_event_id = models.CharField(max_length=100, unique=True)
    event_type = models.CharField(max_length=100)
    signature = models.CharField(max_length=255)
    payload = models.JSONField()
    status = models.CharField(max_length=50, default='received')  # received, processing, processed, ignored, failed
    processing_attempts = models.IntegerField(default=0)
    last_error = models.TextField(null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'razorpay_webhook_events'
        ordering = ('-received_at',)

    def __str__(self):
        return f'{self.razorpay_event_id} ({self.event_type})'


class MembershipPurchase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='membership_purchases')
    membership_plan = models.ForeignKey(MembershipPlan, on_delete=models.CASCADE, related_name='membership_purchases')
    payment_transaction = models.OneToOneField(PaymentTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='membership_purchases')
    price_snapshot = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    duration_days_snapshot = models.IntegerField()
    starts_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=50, default='pending')  # pending, active, expired, replaced, cancelled, partially_refunded, refunded
    activated_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'membership_purchases'
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.user_id} - {self.membership_plan.name} ({self.status})'

    @property
    def plan(self):
        return self.membership_plan

    @property
    def start_date(self):
        return self.starts_at

    @property
    def end_date(self):
        return self.expires_at

    @property
    def started_at(self):
        return self.starts_at

    @property
    def is_active(self):
        return self.status == 'active' and (self.expires_at is None or self.expires_at > timezone.now())
