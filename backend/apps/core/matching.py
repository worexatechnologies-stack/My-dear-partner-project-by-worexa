"""Deterministic compatibility calculations from stored profiles and preferences."""

from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone


def calculate_profile_compatibility(viewer, target) -> dict:
    """Return a transparent compatibility score without external providers."""
    score = 50
    explanations = []
    preferences = _related(viewer, "preferences")
    target_profile = _related(target, "profile")

    if preferences and target.date_of_birth:
        age = _age(target)
        if _within(
            age,
            getattr(preferences, "preferred_age_min", None),
            getattr(preferences, "preferred_age_max", None),
        ):
            score += 5
            explanations.append("Matches your preferred age range")

    if preferences and target_profile and _within(
        getattr(target_profile, "height", None),
        getattr(preferences, "preferred_height_min", None),
        getattr(preferences, "preferred_height_max", None),
    ):
        score += 5
        explanations.append("Matches your preferred height range")

    if preferences and target_profile:
        preferred_location = getattr(preferences, "preferred_location", "")
        target_location = getattr(target_profile, "work_location", "")
        target_city = getattr(target, "city", None)
        viewer_city = getattr(viewer, "city", None)
        if _matches_preference(preferred_location, target_location):
            score += 8
            explanations.append("Lives in your preferred city or location")
        elif target_city and viewer_city and target_city == viewer_city:
            score += 8
            explanations.append("Lives in the same city")

    if preferences and target_profile and _matches_exact(
        getattr(preferences, "preferred_religion", ""),
        getattr(target_profile, "religion", ""),
    ):
        score += 8
        explanations.append("Matches your religion preference")

    if preferences and target_profile and _matches_exact(
        getattr(preferences, "preferred_caste", ""),
        getattr(target_profile, "caste", ""),
    ):
        score += 5
        explanations.append("Matches your community preference")

    if preferences and target_profile and _matches_preference(
        getattr(preferences, "preferred_education", ""),
        getattr(target_profile, "highest_education", ""),
    ):
        score += 5
        explanations.append("Matches your education preference")

    if preferences and target_profile and _matches_preference(
        getattr(preferences, "preferred_occupation", ""),
        getattr(target_profile, "occupation", ""),
    ):
        score += 5
        explanations.append("Matches your profession preference")

    if preferences and target_profile and _matches_exact(
        getattr(preferences, "preferred_marital_status", ""),
        getattr(target_profile, "marital_status", ""),
    ):
        score += 5
        explanations.append("Matches your marital-status preference")

    viewer_profile = _related(viewer, "profile")
    if viewer_profile and target_profile and _matches_exact(
        getattr(viewer_profile, "mother_tongue", ""),
        getattr(target_profile, "mother_tongue", ""),
    ):
        score += 5
        explanations.append("Shares your mother tongue")

    final_score = min(max(score, 0), 100)
    return {
        "score": final_score,
        "label": f"{final_score}% Match",
        "explanations": explanations,
    }


def _related(instance, attribute):
    try:
        return getattr(instance, attribute)
    except ObjectDoesNotExist:
        return None


def _age(member):
    if not member.date_of_birth:
        return None
    today = timezone.localdate()
    born = member.date_of_birth
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def _within(value, minimum, maximum):
    if value is None or minimum is None or maximum is None:
        return False
    try:
        return minimum <= value <= maximum
    except TypeError:
        try:
            return float(minimum) <= float(value) <= float(maximum)
        except (TypeError, ValueError):
            return False


def _normalise(value):
    return str(value or "").strip().casefold()


def _matches_exact(expected, actual):
    expected_value = _normalise(expected)
    actual_value = _normalise(actual)
    return bool(expected_value and actual_value and expected_value == actual_value)


def _matches_preference(expected, actual):
    expected_value = _normalise(expected)
    actual_value = _normalise(actual)
    return bool(
        expected_value
        and actual_value
        and (expected_value in actual_value or actual_value in expected_value)
    )
