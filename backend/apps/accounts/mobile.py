"""Shared Indian mobile-number normalization for account and OTP flows."""

import re


_MOBILE_INPUT = re.compile(r"^[+\d\s().-]+$")


def normalize_mobile_number(value) -> str:
    """Return the canonical stored form: a 10-digit Indian mobile number."""
    raw = str(value or '').strip()
    if not raw or not _MOBILE_INPUT.fullmatch(raw):
        return raw

    digits = re.sub(r"\D", "", raw)
    if digits.startswith('91') and len(digits) == 12:
        digits = digits[2:]
    return digits


def mobile_identifier_variants(value) -> tuple[str, ...]:
    """Return canonical and legacy forms accepted during lookup."""
    raw = str(value or '').strip()
    canonical = normalize_mobile_number(raw)
    variants = [canonical, raw]
    if len(canonical) == 10 and canonical.isdigit():
        variants.extend((f'91{canonical}', f'+91{canonical}'))
    return tuple(dict.fromkeys(item for item in variants if item))
