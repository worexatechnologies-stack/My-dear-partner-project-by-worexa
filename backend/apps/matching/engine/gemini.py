"""
Gemini API integration decommissioned.
Matchmaking is now handled 100% by the deterministic Compatibility Engine with no external AI dependency.
"""

from typing import Any, Dict, Optional


class GeminiMatchmakingService:
    """Decommissioned Gemini API client kept only for backward import safety."""

    def __init__(self, *args, **kwargs):
        self.is_configured = False

    def analyze_compatibility(
        self,
        viewer_summary: Dict[str, Any],
        candidate_summary: Dict[str, Any],
        deterministic_baseline: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """No-op: AI matching is disabled; returns None to rely purely on the deterministic engine."""
        return None
