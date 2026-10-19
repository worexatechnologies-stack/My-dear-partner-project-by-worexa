"""
Dynamic compatibility bridge for MyDearPartner.

Delegates to MatchmakingService which implements bidirectional compatibility scoring,
Gemini AI semantic insights, data completeness evaluation, and caching.
"""

from typing import Any, Dict


def calculate_profile_compatibility(viewer: Any, target: Any) -> Dict[str, Any]:
    """Calculate personalized compatibility score and insights between viewer and target."""
    from apps.matching.services import MatchmakingService

    result = MatchmakingService.get_or_calculate_compatibility(viewer, target, use_ai=True)
    score = result.get('compatibility_score', 0)

    # Maintain full backward compatibility for existing consumers
    return {
        'score': score,
        'label': f"{score}% Match",
        'explanations': result.get('shared_strengths') or ([result.get('summary')] if result.get('summary') else []),
        'confidence': result.get('confidence', 'medium'),
        'data_completeness': result.get('data_completeness', 50),
        'shared_strengths': result.get('shared_strengths', []),
        'considerations': result.get('considerations', []),
        'summary': result.get('summary', ''),
        'explanation': result.get('explanation', ''),
        'factors': result.get('factors', {}),
        'ai_generated': result.get('ai_generated', False),
        'last_calculated': result.get('last_calculated'),
    }
