from rest_framework.pagination import PageNumberPagination


class ProfilePagination(PageNumberPagination):
    """The response shape used by the frontend contract."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
