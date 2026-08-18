FROM nginx:stable-alpine

RUN apk add --no-cache openssl

COPY nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /usr/local/bin/dear-partner-nginx-entrypoint.sh

# Docker Desktop can provide Windows checkouts with CRLF shell scripts.
RUN sed -i 's/\r$//' /usr/local/bin/dear-partner-nginx-entrypoint.sh \
    && chmod 755 /usr/local/bin/dear-partner-nginx-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/dear-partner-nginx-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
