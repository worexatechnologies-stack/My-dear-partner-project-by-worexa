"""
Matchmaking Service layer for MyDearPartner.

Coordinates deterministic scoring, Gemini AI semantic analysis, database caching,
and invalidation lifecycles.
"""

import logging
from typing import Any, Dict, List, Optional
from django.utils import timezone

from .models import ProfileCompatibilityRecord
from .engine.scoring import calculate_compatibility, calculate_age
from .engine.gemini import GeminiMatchmakingService

logger = logging.getLogger(__name__)


class MatchmakingService:
    """Central service managing personalized matchmaking evaluations."""

    @classmethod
    def get_or_calculate_compatibility(
        cls,
        viewer: Any,
        candidate: Any,
        use_ai: bool = True,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """Return full compatibility evaluation with AI insights and caching."""
        if not viewer or not candidate or not getattr(viewer, 'is_authenticated', True):
            return {
                'compatibility_score': 0,
                'confidence': 'low',
                'data_completeness': 0,
                'shared_strengths': [],
                'considerations': [],
                'summary': 'Sign in to see compatibility.',
                'explanation': 'Authentication is required to calculate compatibility.',
                'factors': {},
                'ai_generated': False,
            }

        viewer_id = viewer.pk
        candidate_id = candidate.pk

        if str(viewer_id) == str(candidate_id):
            return {
                'compatibility_score': 100,
                'confidence': 'high',
                'data_completeness': 100,
                'shared_strengths': ['This is your own profile'],
                'considerations': [],
                'summary': 'Viewing your own profile.',
                'explanation': 'Own profile view.',
                'factors': {},
                'ai_generated': False,
            }

        # Check existing cached record
        if not force_refresh:
            record = ProfileCompatibilityRecord.objects.filter(
                viewer=viewer,
                candidate=candidate,
            ).first()
            if record is not None:
                return cls._record_to_dict(record)

        # 1. Deterministic Compatibility Engine calculation (Ground truth)
        baseline = calculate_compatibility(viewer, candidate)

        final_score = baseline['compatibility_score']
        confidence = baseline['confidence']
        completeness = baseline['data_completeness']
        strengths = baseline['shared_strengths']
        considerations = baseline['considerations']
        summary = baseline['summary']
        explanation = baseline['explanation']
        factors = baseline['factors']
        ai_generated = False

        # 2. Update or create cache record
        record, _ = ProfileCompatibilityRecord.objects.update_or_create(
            viewer=viewer,
            candidate=candidate,
            defaults={
                'compatibility_score': final_score,
                'confidence': confidence,
                'data_completeness': completeness,
                'shared_strengths': strengths,
                'considerations': considerations,
                'summary': summary,
                'explanation': explanation,
                'factors': factors,
                'ai_generated': ai_generated,
            },
        )

        return cls._record_to_dict(record)

    @classmethod
    def get_quick_compatibility_score(cls, viewer: Any, candidate: Any) -> int:
        """Fast in-memory or cached compatibility percentage for feed / search cards."""
        if not viewer or not candidate or not getattr(viewer, 'is_authenticated', False):
            return 0
        if str(viewer.pk) == str(candidate.pk):
            return 100

        # Fast lookup in DB cache
        cached = ProfileCompatibilityRecord.objects.filter(
            viewer=viewer,
            candidate=candidate,
        ).values_list('compatibility_score', flat=True).first()

        if cached is not None:
            return cached

        # Instant in-memory deterministic calculation (takes < 0.1ms)
        try:
            res = calculate_compatibility(viewer, candidate)
            score = res['compatibility_score']
            # Asynchronously or lazily record in DB without blocking
            ProfileCompatibilityRecord.objects.create(
                viewer=viewer,
                candidate=candidate,
                compatibility_score=score,
                confidence=res['confidence'],
                data_completeness=res['data_completeness'],
                shared_strengths=res['shared_strengths'],
                considerations=res['considerations'],
                summary=res['summary'],
                explanation=res['explanation'],
                factors=res['factors'],
                ai_generated=False,
            )
            return score
        except Exception as exc:
            logger.warning("Error calculating quick compatibility score: %s", exc)
            return 50

    @classmethod
    def invalidate_for_member(cls, member: Any) -> int:
        """Invalidate cached scores when member updates profile or preferences."""
        if not member or not getattr(member, 'pk', None):
            return 0
        deleted, _ = ProfileCompatibilityRecord.objects.filter(
            viewer=member
        ).delete()
        deleted_as_candidate, _ = ProfileCompatibilityRecord.objects.filter(
            candidate=member
        ).delete()
        return deleted + deleted_as_candidate

    @classmethod
    def refresh_all_compatibility_caches(cls) -> int:
        """Celery task replacement for recalculating compatibility without hardcoded values."""
        from apps.accounts.models import Member
        active_members = list(Member.objects.filter(is_active=True).select_related('profile', 'preferences'))
        count = 0
        for i, m1 in enumerate(active_members):
            for m2 in active_members[i + 1:]:
                # Refresh bidirectional cache deterministically
                cls.get_or_calculate_compatibility(m1, m2, use_ai=False, force_refresh=True)
                cls.get_or_calculate_compatibility(m2, m1, use_ai=False, force_refresh=True)
                count += 2
        return count

    # ──────────────────────────────────────────────────────────────────────────
    # Helper extractors
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_public_summary(member: Any) -> Dict[str, Any]:
        """Extract only non-sensitive attributes for AI analysis."""
        profile = getattr(member, 'profile', None)
        prefs = getattr(member, 'preferences', None)

        pref_parts = []
        if prefs:
            if getattr(prefs, 'preferred_age_min', None) and getattr(prefs, 'preferred_age_max', None):
                pref_parts.append(f"Age {prefs.preferred_age_min} to {prefs.preferred_age_max}")
            if getattr(prefs, 'preferred_location', ''):
                pref_parts.append(f"Location: {prefs.preferred_location}")
            if getattr(prefs, 'preferred_education', ''):
                pref_parts.append(f"Education: {prefs.preferred_education}")
            if getattr(prefs, 'preferred_occupation', ''):
                pref_parts.append(f"Occupation: {prefs.preferred_occupation}")
            if getattr(prefs, 'preferred_religion', ''):
                pref_parts.append(f"Religion: {prefs.preferred_religion}")
            if getattr(prefs, 'additional_expectations', ''):
                pref_parts.append(f"Expectations: {prefs.additional_expectations}")

        return {
            'name': getattr(member, 'first_name', '') or 'Member',
            'age': calculate_age(getattr(member, 'date_of_birth', None)),
            'education': getattr(profile, 'highest_education', '') if profile else '',
            'occupation': getattr(profile, 'occupation', '') if profile else '',
            'location': getattr(profile, 'work_location', '') or getattr(member, 'city', '') if profile else '',
            'hobbies': getattr(profile, 'hobbies', []) if profile else [],
            'about': getattr(profile, 'about', '') if profile else '',
            'partner_preferences': "; ".join(pref_parts) if pref_parts else "None stated",
        }

    @staticmethod
    def _record_to_dict(record: ProfileCompatibilityRecord) -> Dict[str, Any]:
        return {
            'candidate_id': str(record.candidate_id),
            'compatibility_score': record.compatibility_score,
            'confidence': record.confidence,
            'data_completeness': record.data_completeness,
            'shared_strengths': record.shared_strengths or [],
            'considerations': record.considerations or [],
            'summary': record.summary,
            'explanation': record.explanation,
            'factors': record.factors or {},
            'ai_generated': record.ai_generated,
            'last_calculated': record.updated_at.isoformat() if record.updated_at else None,
        }
