"""Serializers for the unversioned public matrimony API contract.

They deliberately remain separate from the established portal serializers:
the portal has a richer response envelope and registration flow, while this
contract keeps the small shape consumed by standalone clients.
"""

import re

from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from rest_framework import serializers

from .models import Member, MemberProfile
from .mobile import normalize_mobile_number


class ContractUserSerializer(serializers.ModelSerializer):
    is_verified = serializers.BooleanField(read_only=True)
    date_joined = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Member
        fields = (
            "id",
            "email",
            "mobile_number",
            "first_name",
            "last_name",
            "is_verified",
            "is_premium",
            "is_active",
            "date_joined",
        )
        read_only_fields = fields


class ContractRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    mobile_number = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)

    def validate_email(self, value):
        value = Member.objects.normalize_email(value).lower()
        if Member.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_mobile_number(self, value):
        value = normalize_mobile_number(value)
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        if not re.fullmatch(r'^[6-9]\d{9}$', value):
            raise serializers.ValidationError("Enter a valid 10-digit Indian mobile number.")
        if Member.objects.filter(mobile_number=value).exists():
            raise serializers.ValidationError("A user with this mobile number already exists.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        member = Member.objects.create_user(password=password, **validated_data)
        # A stub is intentionally valid: remaining profile details are filled
        # in through the existing authenticated member profile flow.
        MemberProfile.objects.get_or_create(member=member)
        return member


class ContractLoginSerializer(serializers.Serializer):
    email_or_mobile = serializers.CharField(max_length=254, required=False)
    identifier = serializers.CharField(max_length=254, write_only=True, required=False)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        identifier = (attrs.get("email_or_mobile") or attrs.get("identifier") or "").strip()
        user = Member.objects.filter(
            Q(email__iexact=identifier) | Q(mobile_number=identifier),
            is_active=True,
            deleted_at__isnull=True,
        ).first()
        if user is None or not user.check_password(attrs["password"]):
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs
