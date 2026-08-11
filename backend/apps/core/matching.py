import os
import datetime
from django.utils import timezone
from django.db.models import Q
from apps.accounts.models import Member, MemberProfile, MemberPreference

class CompatibilityProvider:
    def calculate(self, viewer, target) -> dict:
        raise NotImplementedError()

class RuleBasedCompatibilityProvider(CompatibilityProvider):
    def calculate(self, viewer, target) -> dict:
        score = 50  # base score
        explanations = []
        
        # Load viewer preferences and target profile
        try:
            prefs = viewer.preferences
        except Exception:
            prefs = None

        try:
            target_profile = target.profile
        except Exception:
            target_profile = None

        # 1. Age Range
        if prefs and target.date_of_birth:
            try:
                age = self.get_age(target)
                if age is not None:
                    pref_min = getattr(prefs, 'preferred_age_min', None)
                    pref_max = getattr(prefs, 'preferred_age_max', None)
                    if pref_min is not None and pref_max is not None:
                        if pref_min <= age <= pref_max:
                            score += 5
                            explanations.append("Matches your preferred age range")
            except Exception:
                pass

        # 2. Height Range
        if prefs and target_profile:
            try:
                height = getattr(target_profile, 'height', None)
                if height is not None:
                    pref_min = getattr(prefs, 'preferred_height_min', None)
                    pref_max = getattr(prefs, 'preferred_height_max', None)
                    if pref_min is not None and pref_max is not None:
                        if pref_min <= height <= pref_max:
                            score += 5
                            explanations.append("Matches your preferred height range")
            except Exception:
                pass

        # 3. Location/City/State/Country
        if prefs and target_profile:
            try:
                target_loc = getattr(target_profile, 'work_location', '') or (target.city.name if target.city else '')
                pref_loc = getattr(prefs, 'preferred_location', '')
                if pref_loc and target_loc:
                    if pref_loc.lower() in target_loc.lower() or target_loc.lower() in pref_loc.lower():
                        score += 8
                        explanations.append("Lives in your preferred city / location")
                    elif target.city and viewer.city and target.city == viewer.city:
                        score += 8
                        explanations.append("Lives in the same city")
            except Exception:
                pass

        # 4. Religion
        if prefs and target_profile:
            try:
                target_rel = getattr(target_profile, 'religion', '')
                pref_rel = getattr(prefs, 'preferred_religion', '')
                if pref_rel and target_rel:
                    if pref_rel.lower() == target_rel.lower():
                        score += 8
                        explanations.append("Matches your religion preference")
            except Exception:
                pass

        # 5. Caste/Community
        if prefs and target_profile:
            try:
                target_caste = getattr(target_profile, 'caste', '')
                pref_caste = getattr(prefs, 'preferred_caste', '')
                if pref_caste and target_caste:
                    if pref_caste.lower() == target_caste.lower():
                        score += 5
                        explanations.append("Matches your community/caste preference")
            except Exception:
                pass

        # 6. Education
        if prefs and target_profile:
            try:
                target_edu = getattr(target_profile, 'highest_education', '')
                pref_edu = getattr(prefs, 'preferred_education', '')
                if pref_edu and target_edu:
                    if pref_edu.lower() in target_edu.lower() or target_edu.lower() in pref_edu.lower():
                        score += 5
                        explanations.append("Compatible education preference")
            except Exception:
                pass

        # 7. Profession
        if prefs and target_profile:
            try:
                target_occ = getattr(target_profile, 'occupation', '')
                pref_occ = getattr(prefs, 'preferred_occupation', '')
                if pref_occ and target_occ:
                    if pref_occ.lower() in target_occ.lower() or target_occ.lower() in pref_occ.lower():
                        score += 5
                        explanations.append("Matches your preferred profession")
            except Exception:
                pass

        # 8. Marital Status
        if prefs and target_profile:
            try:
                target_ms = getattr(target_profile, 'marital_status', '')
                pref_ms = getattr(prefs, 'preferred_marital_status', '')
                if pref_ms and target_ms:
                    if pref_ms.lower() == target_ms.lower():
                        score += 5
                        explanations.append("Compatible marital status")
            except Exception:
                pass

        # 9. Mother Tongue
        if target_profile and getattr(viewer, 'profile', None):
            try:
                target_mt = getattr(target_profile, 'mother_tongue', '')
                viewer_mt = getattr(viewer.profile, 'mother_tongue', '')
                if target_mt and viewer_mt and target_mt.lower() == viewer_mt.lower():
                    score += 5
                    explanations.append("Same mother tongue")
            except Exception:
                pass

        # Ensure score bounds
        final_score = min(max(score, 0), 100)
        return {
            'score': final_score,
            'label': f"{final_score}% Match",
            'explanations': explanations
        }

    def get_age(self, member):
        if not member.date_of_birth:
            return None
        today = timezone.localdate()
        born = member.date_of_birth
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def get_compatibility_provider() -> CompatibilityProvider:
    provider_name = os.environ.get('COMPATIBILITY_PROVIDER', 'rule_based')
    if provider_name == 'rule_based':
        return RuleBasedCompatibilityProvider()
    return RuleBasedCompatibilityProvider()
