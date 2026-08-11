"""Public model name mapped to the established chat message table."""

from apps.core.models import ChatMessage


class DirectMessage(ChatMessage):
    class Meta:
        proxy = True
        verbose_name = "direct message"
        verbose_name_plural = "direct messages"
