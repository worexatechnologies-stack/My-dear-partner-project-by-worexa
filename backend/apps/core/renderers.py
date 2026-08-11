from rest_framework.renderers import JSONRenderer


def _extract_request_id(renderer_context):
    response = renderer_context.get('response') if renderer_context else None
    if response and hasattr(response, '_request') and hasattr(response._request, 'request_id'):
        return response._request.request_id
    request = renderer_context.get('request') if renderer_context else None
    if request and hasattr(request, 'request_id'):
        return request.request_id
    return None


class StandardizedJSONRenderer(JSONRenderer):
    """
    Standardized API response format for all JSON responses:
    {
      "success": boolean,
      "message": string,
      "data": object | null,
      "code": string | null,
      "errors": object | null,
      "meta": { "request_id": "uuid" } | null
    }
    """
    def render(self, data, accepted_media_type=None, renderer_context=None):
        request_id = _extract_request_id(renderer_context)
        meta = {'request_id': request_id} if request_id else None

        response = renderer_context.get('response') if renderer_context else None
        status_code = response.status_code if response else 200
        exception = response.exception if response else False

        if exception or status_code >= 400:
            success = False
            if isinstance(data, dict):
                payload = {
                    'success': data.get('success', False),
                    'message': data.get('message', 'An error occurred.'),
                    'code': data.get('code', None),
                    'errors': data.get('errors', None),
                    'data': data.get('data', None),
                    'meta': data.get('meta', meta),
                }
            else:
                payload = {
                    'success': False,
                    'message': str(data) if data else 'An error occurred.',
                    'code': None,
                    'errors': None,
                    'data': None,
                    'meta': meta,
                }
            return super().render(payload, accepted_media_type, renderer_context)

        if isinstance(data, dict):
            payload = {
                'success': data.get('success', True) if 'success' in data else True,
                'message': data.get('message', 'Request completed successfully.'),
                'code': data.get('code', None),
                'errors': data.get('errors', None),
                'data': data.get('data', None),
                'meta': data.get('meta', meta),
            }
            if payload['data'] is None and 'data' not in data:
                payload['data'] = data
        elif data is None:
            payload = {
                'success': True,
                'message': 'Request completed successfully.',
                'code': None,
                'errors': None,
                'data': None,
                'meta': meta,
            }
        else:
            payload = {
                'success': True,
                'message': 'Request completed successfully.',
                'code': None,
                'errors': None,
                'data': data,
                'meta': meta,
            }

        return super().render(payload, accepted_media_type, renderer_context)
