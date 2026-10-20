# Nginx Reverse Proxy & TLS Setup Guide
### Group 05 "Stack Kings" — Module 4: Amaraweera MTP (244015X)

---

## 1. Overview
The Nginx edge router terminates HTTPS (port 443) and WebSockets (`wss://`), enforces leaky-bucket API rate limits (20 req/s, burst 40), and routes traffic across internal Docker services:
- `/ws` ──► `safety-service:4400` (RFC 6455 WebSockets with 120s timeout)
- `/api/` ──► `gateway:8080` (REST microservices)
- `/tiles/` ──► `routing-engine:3000` (Vector map tiles)
- `/` ──► `dashboards:3005` (Next.js admin & government dashboards)

---

## 2. Let's Encrypt & Certbot Renewal (Production VM)
On the staging/production cloud VM, obtain official certificates with Certbot:

```bash
# 1. Obtain Certificate via Webroot
docker run -it --rm --name certbot \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -v "/var/www/certbot:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d api.ecocommute.lk \
  --email pariamaraweera22@gmail.com \
  --agree-tos --no-eff-email

# 2. Test Automated Renewal Dry Run
certbot renew --dry-run

# 3. Reload Nginx without downtime
docker exec shuttle_nginx nginx -s reload
```

---

## 3. Local Development Mode
The container builds with self-signed certificates in `/etc/nginx/ssl/live/`, allowing immediate testing over `https://localhost` or `https://127.0.0.1.nip.io`.
