import math

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardizedPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        page = self.page.number
        total_pages = self.page.paginator.num_pages
        total_items = self.page.paginator.count
        page_size = self.get_page_size(self.request) or self.page_size

        request_id = getattr(self.request, 'request_id', None) if self.request else None

        return Response({
            'success': True,
            'message': 'Records loaded successfully.',
            'data': {
                'results': data,
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total_pages': total_pages,
                    'total_items': total_items,
                    'has_next': page < total_pages,
                    'has_previous': page > 1,
                },
            },
            'errors': None,
            'meta': {'request_id': request_id} if request_id else None,
        })
