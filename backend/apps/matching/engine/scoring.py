"""
Dynamic Deterministic Matchmaking Scoring Engine for MyDearPartner.

Calculates personalized, bidirectional compatibility scores based on actual
profile data, mutual partner preferences, configurable weights, and data completeness.
"""

from datetime import date
from typing import Any, Dict, List, Optional, Tuple
from django.conf import settings
from django.utils import timezone


DEFAULT_MATCHMAKING_WEIGHTS: Dict[str, float] = {
    'age': 0.15,
    'education': 0.10,
    'profession': 0.10,
    'location': 0.10,
    'community': 0.10,
    'lifestyle': 0.10,
    'family': 0.10,
    'timeline': 0.10,
    'mutual_alignment': 0.10,
    'shared_interests': 0.05,
}


def get_weights() -> Dict[str, float]:
    """Retrieve weights from Django settings or fallback to standard defaults."""
    configured = getattr(settings, 'MATCHMAKING_WEIGHTS', None)
    if isinstance(configured, dict) and configured:
        return {k: float(configured.get(k, DEFAULT_MATCHMAKING_WEIGHTS.get(k, 0.1))) for k in DEFAULT_MATCHMAKING_WEIGHTS}
    return DEFAULT_MATCHMAKING_WEIGHTS.copy()


def calculate_age(dob: Optional[date]) -> Optional[int]:
    """Calculate integer age in years from date of birth."""
    if not dob:
        return None
    today = timezone.localdate()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def normalize_str(val: Any) -> str:
    """Normalize string for case-insensitive and whitespace-trimmed comparison."""
    if val is None:
        return ""
    return str(val).strip().lower()


def text_contains(needle: str, haystack: str) -> bool:
    """Check if normalized needle is in normalized haystack."""
    n = normalize_str(needle)
    h = normalize_str(haystack)
    return bool(n and h and (n in h or h in n))


class CompatibilityCalculator:
    """Calculates personalized compatibility between viewer and candidate."""

    def __init__(self, viewer: Any, candidate: Any, weights: Optional[Dict[str, float]] = None):
        self.viewer = viewer
        self.candidate = candidate
        self.weights = weights or get_weights()

        self.viewer_profile = getattr(viewer, 'profile', None)
        self.viewer_prefs = getattr(viewer, 'preferences', None)
        self.candidate_profile = getattr(candidate, 'profile', None)
        self.candidate_prefs = getattr(candidate, 'preferences', None)

    def calculate(self) -> Dict[str, Any]:
        """Execute full bidirectional scoring and return structured result."""
        # Check if viewer and candidate are identical
        if str(getattr(self.viewer, 'pk', '')) == str(getattr(self.candidate, 'pk', '')):
            return {
                'compatibility_score': 100,
                'confidence': 'high',
                'data_completeness': 100,
                'shared_strengths': ['This is your own profile'],
                'considerations': [],
                'summary': 'Viewing your own profile.',
                'explanation': 'Own profile comparison.',
                'factors': {},
            }

        factor_results: Dict[str, Dict[str, Any]] = {}
        shared_strengths: List[str] = []
        considerations: List[str] = []

        # 1. Age (15%)
        age_res = self._eval_age()
        factor_results['age'] = age_res
        if age_res['strength']:
            shared_strengths.append(age_res['strength'])
        if age_res['consideration']:
            considerations.append(age_res['consideration'])

        # 2. Education (10%)
        edu_res = self._eval_education()
        factor_results['education'] = edu_res
        if edu_res['strength']:
            shared_strengths.append(edu_res['strength'])
        if edu_res['consideration']:
            considerations.append(edu_res['consideration'])

        # 3. Profession & Career (10%)
        prof_res = self._eval_profession()
        factor_results['profession'] = prof_res
        if prof_res['strength']:
            shared_strengths.append(prof_res['strength'])
        if prof_res['consideration']:
            considerations.append(prof_res['consideration'])

        # 4. Location & Relocation (10%)
        loc_res = self._eval_location()
        factor_results['location'] = loc_res
        if loc_res['strength']:
            shared_strengths.append(loc_res['strength'])
        if loc_res['consideration']:
            considerations.append(loc_res['consideration'])

        # 5. Community & Culture (10%)
        comm_res = self._eval_community()
        factor_results['community'] = comm_res
        if comm_res['strength']:
            shared_strengths.append(comm_res['strength'])
        if comm_res['consideration']:
            considerations.append(comm_res['consideration'])

        # 6. Lifestyle (10%)
        life_res = self._eval_lifestyle()
        factor_results['lifestyle'] = life_res
        if life_res['strength']:
            shared_strengths.append(life_res['strength'])
        if life_res['consideration']:
            considerations.append(life_res['consideration'])

        # 7. Family Expectations (10%)
        fam_res = self._eval_family()
        factor_results['family'] = fam_res
        if fam_res['strength']:
            shared_strengths.append(fam_res['strength'])
        if fam_res['consideration']:
            considerations.append(fam_res['consideration'])

        # 8. Marriage Timeline (10%)
        time_res = self._eval_timeline()
        factor_results['timeline'] = time_res
        if time_res['strength']:
            shared_strengths.append(time_res['strength'])
        if time_res['consideration']:
            considerations.append(time_res['consideration'])

        # 9. Mutual Partner Preference Alignment (10%)
        mut_res = self._eval_mutual_alignment(factor_results)
        factor_results['mutual_alignment'] = mut_res
        if mut_res['strength']:
            shared_strengths.append(mut_res['strength'])
        if mut_res['consideration']:
            considerations.append(mut_res['consideration'])

        # 10. Shared Interests & Values (5%)
        intr_res = self._eval_shared_interests()
        factor_results['shared_interests'] = intr_res
        if intr_res['strength']:
            shared_strengths.append(intr_res['strength'])
        if intr_res['consideration']:
            considerations.append(intr_res['consideration'])

        # Calculate data completeness
        applicable_count = sum(1 for res in factor_results.values() if res['applicable'])
        total_factors = len(factor_results)
        data_completeness = round((applicable_count / total_factors) * 100) if total_factors > 0 else 50

        # Confidence rating based on data completeness
        if data_completeness >= 75:
            confidence = "high"
        elif data_completeness >= 45:
            confidence = "medium"
        else:
            confidence = "low"

        # Weighted score normalization across applicable factors
        earned_weight = 0.0
        applicable_weight = 0.0

        for key, res in factor_results.items():
            factor_weight = self.weights.get(key, 0.10)
            if res['applicable']:
                applicable_weight += factor_weight
                earned_weight += factor_weight * res['score']

        if applicable_weight > 0:
            normalized_score = (earned_weight / applicable_weight) * 100.0
        else:
            normalized_score = 50.0

        # Apply minor penalty for hard conflicts if identified
        has_major_age_conflict = factor_results.get('age', {}).get('hard_conflict', False)
        has_major_location_conflict = factor_results.get('location', {}).get('hard_conflict', False)
        if has_major_age_conflict:
            normalized_score -= 8.0
        if has_major_location_conflict:
            normalized_score -= 5.0

        final_score = int(round(min(100.0, max(15.0, normalized_score))))

        # Generate summary and detailed explanation
        candidate_name = getattr(self.candidate, 'first_name', '') or 'Candidate'
        summary = self._generate_summary(final_score, shared_strengths, considerations)
        explanation = self._generate_explanation(candidate_name, final_score, shared_strengths, considerations)

        return {
            'compatibility_score': final_score,
            'confidence': confidence,
            'data_completeness': data_completeness,
            'shared_strengths': shared_strengths[:5],
            'considerations': considerations[:4],
            'summary': summary,
            'explanation': explanation,
            'factors': {k: round(v['score'] * 100) for k, v in factor_results.items()},
            'ai_generated': False,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Individual Factor Evaluators
    # ──────────────────────────────────────────────────────────────────────────

    def _eval_age(self) -> Dict[str, Any]:
        """Age preference evaluation (15%)."""
        v_dob = getattr(self.viewer, 'date_of_birth', None)
        c_dob = getattr(self.candidate, 'date_of_birth', None)
        v_age = calculate_age(v_dob)
        c_age = calculate_age(c_dob)

        v_min = getattr(self.viewer_prefs, 'preferred_age_min', None) if self.viewer_prefs else None
        v_max = getattr(self.viewer_prefs, 'preferred_age_max', None) if self.viewer_prefs else None
        c_min = getattr(self.candidate_prefs, 'preferred_age_min', None) if self.candidate_prefs else None
        c_max = getattr(self.candidate_prefs, 'preferred_age_max', None) if self.candidate_prefs else None

        if not v_age and not c_age:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None, 'hard_conflict': False}

        scores = []
        hard_conflict = False

        # Direction 1: Viewer preferences -> Candidate age
        if c_age and (v_min is not None or v_max is not None):
            low = v_min if v_min is not None else 18
            high = v_max if v_max is not None else 70
            if low <= c_age <= high:
                scores.append(1.0)
            elif abs(c_age - low) <= 2 or abs(c_age - high) <= 2:
                scores.append(0.65)
            else:
                diff = min(abs(c_age - low), abs(c_age - high))
                scores.append(max(0.1, 1.0 - (0.2 * diff)))
                if diff >= 5:
                    hard_conflict = True

        # Direction 2: Candidate preferences -> Viewer age
        if v_age and (c_min is not None or c_max is not None):
            low = c_min if c_min is not None else 18
            high = c_max if c_max is not None else 70
            if low <= v_age <= high:
                scores.append(1.0)
            elif abs(v_age - low) <= 2 or abs(v_age - high) <= 2:
                scores.append(0.65)
            else:
                diff = min(abs(v_age - low), abs(v_age - high))
                scores.append(max(0.1, 1.0 - (0.2 * diff)))
                if diff >= 5:
                    hard_conflict = True

        if not scores:
            # Stated preferences absent, but ages known: evaluate natural age gap
            if v_age and c_age:
                gap = abs(v_age - c_age)
                if gap <= 4:
                    return {'score': 0.9, 'applicable': True, 'strength': 'Close age alignment', 'consideration': None, 'hard_conflict': False}
                elif gap <= 7:
                    return {'score': 0.75, 'applicable': True, 'strength': None, 'consideration': None, 'hard_conflict': False}
                else:
                    return {'score': 0.55, 'applicable': True, 'strength': None, 'consideration': f'Age gap is {gap} years', 'hard_conflict': gap >= 12}
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None, 'hard_conflict': False}

        avg_score = sum(scores) / len(scores)
        if avg_score >= 0.85:
            strength = "Both fall comfortably within each other's preferred age range"
            consideration = None
        elif avg_score >= 0.6:
            strength = "Age preference is largely compatible"
            consideration = None
        else:
            strength = None
            consideration = "Age is outside preferred range"

        return {'score': avg_score, 'applicable': True, 'strength': strength, 'consideration': consideration, 'hard_conflict': hard_conflict}

    def _eval_education(self) -> Dict[str, Any]:
        """Education compatibility evaluation (10%)."""
        v_edu = normalize_str(getattr(self.viewer_profile, 'highest_education', ''))
        c_edu = normalize_str(getattr(self.candidate_profile, 'highest_education', ''))
        v_pref_edu = normalize_str(getattr(self.viewer_prefs, 'preferred_education', ''))
        c_pref_edu = normalize_str(getattr(self.candidate_prefs, 'preferred_education', ''))

        if not v_edu and not c_edu and not v_pref_edu and not c_pref_edu:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        scores = []
        # Tier groups
        postgrad = ('master', 'm.', 'mtech', 'mba', 'ms', 'md', 'phd', 'doctorate', 'post graduate', 'mca', 'mcom', 'ma', 'msc')
        grad = ('bachelor', 'b.', 'btech', 'be', 'mbbs', 'llb', 'bba', 'bca', 'bcom', 'ba', 'bsc', 'graduate')

        def tier_score(edu: str, pref: str) -> float:
            if not pref:
                return 0.8  # neutral/open
            if not edu:
                return 0.5
            if pref in edu or edu in pref:
                return 1.0
            edu_is_pg = any(p in edu for p in postgrad)
            pref_is_pg = any(p in pref for p in postgrad)
            if edu_is_pg and pref_is_pg:
                return 0.95
            edu_is_grad = any(g in edu for g in grad)
            pref_is_grad = any(g in pref for g in grad)
            if edu_is_grad and pref_is_grad:
                return 0.90
            if edu_is_pg and pref_is_grad:
                return 0.90  # Exceeds expectation
            return 0.60

        if v_pref_edu:
            scores.append(tier_score(c_edu, v_pref_edu))
        if c_pref_edu:
            scores.append(tier_score(v_edu, c_pref_edu))

        if not scores:
            if v_edu and c_edu:
                if v_edu == c_edu or (any(p in v_edu for p in postgrad) and any(p in c_edu for p in postgrad)):
                    return {'score': 0.9, 'applicable': True, 'strength': 'Similar higher education background', 'consideration': None}
                return {'score': 0.75, 'applicable': True, 'strength': None, 'consideration': None}
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        avg = sum(scores) / len(scores)
        strength = "Education expectations align well" if avg >= 0.8 else None
        consideration = "Educational background differs from stated preference" if avg < 0.65 else None
        return {'score': avg, 'applicable': True, 'strength': strength, 'consideration': consideration}

    def _eval_profession(self) -> Dict[str, Any]:
        """Profession and career compatibility (10%)."""
        v_occ = normalize_str(getattr(self.viewer_profile, 'occupation', ''))
        c_occ = normalize_str(getattr(self.candidate_profile, 'occupation', ''))
        v_pref_occ = normalize_str(getattr(self.viewer_prefs, 'preferred_occupation', ''))
        c_pref_occ = normalize_str(getattr(self.candidate_prefs, 'preferred_occupation', ''))
        v_emp = normalize_str(getattr(self.viewer_profile, 'employed_in', ''))
        c_emp = normalize_str(getattr(self.candidate_profile, 'employed_in', ''))

        if not v_occ and not c_occ and not v_pref_occ and not c_pref_occ:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        scores = []
        if v_pref_occ:
            if not c_occ:
                scores.append(0.5)
            elif text_contains(v_pref_occ, c_occ) or 'any' in v_pref_occ:
                scores.append(1.0)
            else:
                scores.append(0.6)

        if c_pref_occ:
            if not v_occ:
                scores.append(0.5)
            elif text_contains(c_pref_occ, v_occ) or 'any' in c_pref_occ:
                scores.append(1.0)
            else:
                scores.append(0.6)

        if not scores:
            if v_occ and c_occ:
                if v_occ == c_occ:
                    return {'score': 0.95, 'applicable': True, 'strength': f'Both work in {v_occ.title()}', 'consideration': None}
                if v_emp and c_emp and v_emp == c_emp:
                    return {'score': 0.85, 'applicable': True, 'strength': f'Both employed in {v_emp.title()} sector', 'consideration': None}
                return {'score': 0.75, 'applicable': True, 'strength': 'Both are working professionals', 'consideration': None}
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        avg = sum(scores) / len(scores)
        strength = "Career and professional expectations match" if avg >= 0.8 else None
        consideration = "Profession differs from specified partner preference" if avg < 0.65 else None
        return {'score': avg, 'applicable': True, 'strength': strength, 'consideration': consideration}

    def _eval_location(self) -> Dict[str, Any]:
        """Location and relocation preferences (10%)."""
        v_loc = normalize_str(getattr(self.viewer_profile, 'work_location', '') or getattr(self.viewer, 'city', ''))
        c_loc = normalize_str(getattr(self.candidate_profile, 'work_location', '') or getattr(self.candidate, 'city', ''))
        v_pref_loc = normalize_str(getattr(self.viewer_prefs, 'preferred_location', ''))
        c_pref_loc = normalize_str(getattr(self.candidate_prefs, 'preferred_location', ''))

        v_relo = normalize_str(getattr(self.viewer_profile, 'relocation_preference', '') or getattr(self.viewer_prefs, 'preferred_relocation', ''))
        c_relo = normalize_str(getattr(self.candidate_profile, 'relocation_preference', '') or getattr(self.candidate_prefs, 'preferred_relocation', ''))

        if not v_loc and not c_loc and not v_pref_loc and not c_pref_loc:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None, 'hard_conflict': False}

        # Check same city
        same_city = bool(v_loc and c_loc and (v_loc in c_loc or c_loc in v_loc))
        matches_v_pref = bool(v_pref_loc and c_loc and (v_pref_loc in c_loc or c_loc in v_pref_loc))
        matches_c_pref = bool(c_pref_loc and v_loc and (c_pref_loc in v_loc or v_loc in c_pref_loc))

        if same_city:
            return {'score': 1.0, 'applicable': True, 'strength': 'Located in the same city/region', 'consideration': None, 'hard_conflict': False}

        if matches_v_pref and matches_c_pref:
            return {'score': 0.95, 'applicable': True, 'strength': 'Matches preferred location criteria', 'consideration': None, 'hard_conflict': False}

        if matches_v_pref or matches_c_pref:
            return {'score': 0.85, 'applicable': True, 'strength': 'Location matches stated preference', 'consideration': None, 'hard_conflict': False}

        # Check relocation flexibility
        v_open = 'open' in v_relo or 'willing' in v_relo or 'yes' in v_relo
        c_open = 'open' in c_relo or 'willing' in c_relo or 'yes' in c_relo

        if v_open or c_open:
            return {'score': 0.75, 'applicable': True, 'strength': 'Flexible with relocation plans', 'consideration': None, 'hard_conflict': False}

        # Different locations without explicit relocation willingness
        return {
            'score': 0.40,
            'applicable': True,
            'strength': None,
            'consideration': 'Different locations; discuss relocation expectations',
            'hard_conflict': False,
        }

    def _eval_community(self) -> Dict[str, Any]:
        """Community and cultural preferences, voluntarily provided (10%)."""
        v_rel = normalize_str(getattr(self.viewer_profile, 'religion', ''))
        c_rel = normalize_str(getattr(self.candidate_profile, 'religion', ''))
        v_lang = normalize_str(getattr(self.viewer_profile, 'mother_tongue', ''))
        c_lang = normalize_str(getattr(self.candidate_profile, 'mother_tongue', ''))
        v_caste = normalize_str(getattr(self.viewer_profile, 'caste', ''))
        c_caste = normalize_str(getattr(self.candidate_profile, 'caste', ''))

        v_pref_rel = normalize_str(getattr(self.viewer_prefs, 'preferred_religion', ''))
        c_pref_rel = normalize_str(getattr(self.candidate_prefs, 'preferred_religion', ''))
        v_pref_caste = normalize_str(getattr(self.viewer_prefs, 'preferred_caste', ''))
        c_pref_caste = normalize_str(getattr(self.candidate_prefs, 'preferred_caste', ''))

        if not v_rel and not c_rel and not v_lang and not c_lang:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        scores = []
        # Religion matching
        if v_pref_rel and 'any' not in v_pref_rel:
            scores.append(1.0 if c_rel and v_pref_rel in c_rel else 0.3)
        elif v_rel and c_rel:
            scores.append(1.0 if v_rel == c_rel else 0.6)

        if c_pref_rel and 'any' not in c_pref_rel:
            scores.append(1.0 if v_rel and c_pref_rel in v_rel else 0.3)

        # Mother tongue
        if v_lang and c_lang:
            scores.append(1.0 if v_lang == c_lang else 0.7)

        # Caste if specified voluntarily in preferences
        if v_pref_caste and 'any' not in v_pref_caste and c_caste:
            scores.append(1.0 if v_pref_caste in c_caste else 0.5)

        if not scores:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        avg = sum(scores) / len(scores)
        strength = "Shared cultural values and background" if avg >= 0.85 else None
        consideration = None
        return {'score': avg, 'applicable': True, 'strength': strength, 'consideration': consideration}

    def _eval_lifestyle(self) -> Dict[str, Any]:
        """Lifestyle compatibility (10%)."""
        v_life = getattr(self.viewer_profile, 'lifestyle', {}) or {}
        c_life = getattr(self.candidate_profile, 'lifestyle', {}) or {}
        v_pref_life = getattr(self.viewer_prefs, 'preferred_lifestyle', {}) or {}
        c_pref_life = getattr(self.candidate_prefs, 'preferred_lifestyle', {}) or {}

        v_about = normalize_str(getattr(self.viewer_profile, 'about', '') or '')
        c_about = normalize_str(getattr(self.candidate_profile, 'about', '') or '')
        v_extra = normalize_str(getattr(self.viewer_prefs, 'additional_expectations', '') or '')
        c_extra = normalize_str(getattr(self.candidate_prefs, 'additional_expectations', '') or '')

        if not v_life and not c_life and not v_pref_life and not c_pref_life:
            # Check dietary cues in bio
            veg_terms = ('vegetarian', 'pure veg', 'jain', 'vegan')
            v_is_veg = any(t in v_about or t in v_extra for t in veg_terms)
            c_is_veg = any(t in c_about or t in c_extra for t in veg_terms)
            if v_is_veg and c_is_veg:
                return {'score': 0.9, 'applicable': True, 'strength': 'Both share vegetarian dietary preferences', 'consideration': None}
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        match_count = 0
        total_checks = 0

        for key in ('diet', 'smoking', 'drinking', 'fitness'):
            v_val = normalize_str(v_life.get(key) or v_pref_life.get(key))
            c_val = normalize_str(c_life.get(key) or c_pref_life.get(key))
            if v_val and c_val:
                total_checks += 1
                if v_val == c_val:
                    match_count += 1
                elif 'never' in v_val and ('regular' in c_val or 'yes' in c_val):
                    match_count += 0.2  # significant difference
                else:
                    match_count += 0.6  # moderate alignment

        if total_checks == 0:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        score = match_count / total_checks
        strength = "Compatible daily habits and lifestyle" if score >= 0.8 else None
        consideration = "Lifestyle habits or dietary preferences differ" if score < 0.6 else None
        return {'score': score, 'applicable': True, 'strength': strength, 'consideration': consideration}

    def _eval_family(self) -> Dict[str, Any]:
        """Family expectations (10%)."""
        v_type = normalize_str(getattr(self.viewer_profile, 'family_type', ''))
        c_type = normalize_str(getattr(self.candidate_profile, 'family_type', ''))
        v_pref_fam = normalize_str(getattr(self.viewer_prefs, 'preferred_family_type', ''))
        c_pref_fam = normalize_str(getattr(self.candidate_prefs, 'preferred_family_type', ''))
        v_exp = normalize_str(getattr(self.viewer_profile, 'family_expectations', ''))
        c_exp = normalize_str(getattr(self.candidate_profile, 'family_expectations', ''))

        if not v_type and not c_type and not v_pref_fam and not c_pref_fam and not v_exp and not c_exp:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        scores = []
        if v_type and c_type:
            scores.append(1.0 if v_type == c_type else 0.7)
        if v_pref_fam and c_type:
            scores.append(1.0 if v_pref_fam in c_type else 0.5)
        if c_pref_fam and v_type:
            scores.append(1.0 if c_pref_fam in v_type else 0.5)

        avg = sum(scores) / len(scores) if scores else 0.75
        strength = "Similar family values and structure expectations" if avg >= 0.8 else None
        consideration = "Family structure preferences (nuclear vs joint) differ" if avg < 0.65 else None
        return {'score': avg, 'applicable': True, 'strength': strength, 'consideration': consideration}

    def _eval_timeline(self) -> Dict[str, Any]:
        """Marriage timeline evaluation (10%)."""
        v_time = normalize_str(getattr(self.viewer_profile, 'marriage_timeline', '') or getattr(self.viewer_prefs, 'preferred_marriage_timeline', ''))
        c_time = normalize_str(getattr(self.candidate_profile, 'marriage_timeline', '') or getattr(self.candidate_prefs, 'preferred_marriage_timeline', ''))

        # Check bio for timeline cues
        v_extra = normalize_str(getattr(self.viewer_prefs, 'additional_expectations', '') or '')
        c_extra = normalize_str(getattr(self.candidate_prefs, 'additional_expectations', '') or '')

        def extract_timeline(text: str) -> Optional[int]:
            if '6 month' in text or 'immediate' in text or 'soon' in text:
                return 1
            if '1 year' in text or 'next year' in text:
                return 2
            if '2 year' in text or 'take time' in text:
                return 3
            return None

        v_t_idx = extract_timeline(v_time + " " + v_extra)
        c_t_idx = extract_timeline(c_time + " " + c_extra)

        if v_t_idx is None or c_t_idx is None:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        diff = abs(v_t_idx - c_t_idx)
        if diff == 0:
            return {'score': 1.0, 'applicable': True, 'strength': 'Both share a similar marriage timeline', 'consideration': None}
        elif diff == 1:
            return {'score': 0.8, 'applicable': True, 'strength': 'Marriage timelines are compatible', 'consideration': None}
        else:
            return {'score': 0.4, 'applicable': True, 'strength': None, 'consideration': 'Marriage timelines differ (urgent vs later)'}

    def _eval_mutual_alignment(self, factors: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Mutual partner preference alignment (10%)."""
        # Evaluates overall reciprocity across applicable factor scores
        applicable = [res['score'] for res in factors.values() if res['applicable']]
        if not applicable:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        avg = sum(applicable) / len(applicable)
        # Check if there is severe imbalance
        if min(applicable) >= 0.70:
            return {'score': min(1.0, avg + 0.1), 'applicable': True, 'strength': 'High mutual preference alignment across all criteria', 'consideration': None}
        elif avg >= 0.75:
            return {'score': avg, 'applicable': True, 'strength': 'Strong mutual compatibility across preferences', 'consideration': None}
        elif avg >= 0.55:
            return {'score': avg, 'applicable': True, 'strength': None, 'consideration': None}
        else:
            return {'score': avg, 'applicable': True, 'strength': None, 'consideration': 'Several core preferences have divergence'}

    def _eval_shared_interests(self) -> Dict[str, Any]:
        """Shared interests and personal values (5%)."""
        v_hobbies = getattr(self.viewer_profile, 'hobbies', []) or []
        c_hobbies = getattr(self.candidate_profile, 'hobbies', []) or []

        v_norm = {normalize_str(h) for h in v_hobbies if h}
        c_norm = {normalize_str(h) for h in c_hobbies if h}

        overlap = v_norm.intersection(c_norm)
        if not v_norm and not c_norm:
            return {'score': 0.5, 'applicable': False, 'strength': None, 'consideration': None}

        if len(overlap) >= 2:
            items = ", ".join(sorted(overlap)[:3]).title()
            return {'score': 1.0, 'applicable': True, 'strength': f'Shared interests in {items}', 'consideration': None}
        elif len(overlap) == 1:
            item = next(iter(overlap)).title()
            return {'score': 0.85, 'applicable': True, 'strength': f'Both enjoy {item}', 'consideration': None}
        else:
            return {'score': 0.55, 'applicable': True, 'strength': None, 'consideration': None}

    # ──────────────────────────────────────────────────────────────────────────
    # Content & Explanation Generators
    # ──────────────────────────────────────────────────────────────────────────

    def _generate_summary(self, score: int, strengths: List[str], considerations: List[str]) -> str:
        if score >= 85:
            if strengths:
                return f"Exceptional alignment. {strengths[0]}."
            return "Exceptional overall alignment across core partner expectations."
        elif score >= 75:
            if strengths:
                return f"Strong compatibility. {strengths[0]}."
            return "Strong mutual compatibility across partner preferences."
        elif score >= 60:
            if considerations:
                return f"Moderate compatibility. {considerations[0]}."
            return "Balanced alignment with some distinct partner expectations."
        else:
            if considerations:
                return f"Lower compatibility. {considerations[0]}."
            return "Noticeable differences between mutual partner criteria."

    def _generate_explanation(self, candidate_name: str, score: int, strengths: List[str], considerations: List[str]) -> str:
        parts = []
        if score >= 80:
            parts.append(f"Compatibility Analysis indicates that you and {candidate_name} share a high degree of mutual compatibility ({score}%).")
        elif score >= 60:
            parts.append(f"Compatibility Analysis indicates that you and {candidate_name} share moderate compatibility ({score}%).")
        else:
            parts.append(f"Compatibility Analysis indicates that you and {candidate_name} have lower compatibility ({score}%).")

        if strengths:
            parts.append("Key matching factors include: " + "; ".join(strengths[:3]) + ".")

        if considerations:
            parts.append("Areas worth discussing early: " + "; ".join(considerations[:2]) + ".")

        return " ".join(parts)


def calculate_compatibility(viewer: Any, candidate: Any, weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """Top-level entrypoint for deterministic compatibility calculations."""
    calculator = CompatibilityCalculator(viewer, candidate, weights=weights)
    return calculator.calculate()
