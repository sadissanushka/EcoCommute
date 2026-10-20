FROM nginx:1.25-alpine

RUN apk add --no-cache openssl

# Generate self-signed certificate fallback for local development
RUN mkdir -p /etc/nginx/ssl/live /var/www/certbot && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/live/privkey.pem \
    -out /etc/nginx/ssl/live/fullchain.pem \
    -subj "/C=LK/ST=Western/L=Colombo/O=EcoCommute/OU=Safety/CN=localhost"

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
