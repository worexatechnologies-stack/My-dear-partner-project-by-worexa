#!/bin/bash
# =====================================================================
# My Dear Partner - Automated VPS Deployment Script
# Target: root@187.127.157.140
# Usage: chmod +x deploy.sh && ./deploy.sh
# =====================================================================

set -e

VPS_IP="187.127.157.140"
VPS_USER="root"
APP_DIR="/opt/mydearpartner"
DOMAIN="$VPS_IP"  # Replace with your domain name e.g. mydearpartner.com

echo "=== My Dear Partner VPS Deployment ==="
echo "Target: $VPS_USER@$VPS_IP"
echo ""

# Step 1: Copy project files to VPS
echo "[1/7] Uploading project to VPS..."
ssh $VPS_USER@$VPS_IP "mkdir -p $APP_DIR"
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='__pycache__' \
  --exclude='*.pyc' --exclude='.git' --exclude='venv' \
  "." "$VPS_USER@$VPS_IP:$APP_DIR/"
echo "    ✓ Project uploaded"

# Step 2: Run remote setup
echo "[2/7] Running server setup..."
ssh $VPS_USER@$VPS_IP << 'REMOTE_SETUP'
set -e
echo "--- Updating system packages..."
apt-get update -qq

echo "--- Installing system dependencies..."
apt-get install -y -qq \
  python3 python3-pip python3-venv \
  nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib \
  curl git

echo "--- Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

echo "--- Setup complete."
REMOTE_SETUP
echo "    ✓ Server dependencies installed"

# Step 3: Backend Setup
echo "[3/7] Setting up Django backend..."
ssh $VPS_USER@$VPS_IP << REMOTE_BACKEND
set -e
cd /opt/mydearpartner/backend

echo "--- Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "--- Installing Python dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements/production.txt

echo "--- Running database migrations..."
python manage.py migrate --settings=config.settings.production

echo "--- Collecting static files..."
python manage.py collectstatic --noinput --settings=config.settings.production

echo "--- Backend setup complete."
REMOTE_BACKEND
echo "    ✓ Backend configured"

# Step 4: Frontend Setup
echo "[4/7] Building Next.js frontend..."
ssh $VPS_USER@$VPS_IP << 'REMOTE_FRONTEND'
set -e
cd /opt/mydearpartner/frontend
echo "--- Installing npm packages..."
npm ci --production=false
echo "--- Building production bundle..."
npm run build
echo "    ✓ Frontend built"
REMOTE_FRONTEND
echo "    ✓ Frontend build complete"

# Step 5: Systemd Services
echo "[5/7] Configuring services..."
ssh $VPS_USER@$VPS_IP << 'REMOTE_SERVICES'
set -e

# Django Gunicorn Service
cat > /etc/systemd/system/mydearpartner-backend.service << 'SERVICE'
[Unit]
Description=My Dear Partner Django Backend
After=network.target

[Service]
User=root
WorkingDirectory=/opt/mydearpartner/backend
Environment="PATH=/opt/mydearpartner/backend/venv/bin"
ExecStart=/opt/mydearpartner/backend/venv/bin/gunicorn config.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers 4 \
    --timeout 120 \
    --access-logfile /var/log/mydearpartner/backend-access.log \
    --error-logfile /var/log/mydearpartner/backend-error.log
Restart=always

[Install]
WantedBy=multi-user.target
SERVICE

# Next.js Frontend Service
cat > /etc/systemd/system/mydearpartner-frontend.service << 'SERVICE'
[Unit]
Description=My Dear Partner Next.js Frontend
After=network.target

[Service]
User=root
WorkingDirectory=/opt/mydearpartner/frontend
ExecStart=/usr/bin/node /opt/mydearpartner/frontend/node_modules/.bin/next start -p 3000
Restart=always
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
SERVICE

mkdir -p /var/log/mydearpartner
systemctl daemon-reload
systemctl enable mydearpartner-backend
systemctl enable mydearpartner-frontend
systemctl restart mydearpartner-backend
systemctl restart mydearpartner-frontend
echo "--- Services started"
REMOTE_SERVICES
echo "    ✓ Systemd services created and started"

# Step 6: Nginx Configuration
echo "[6/7] Configuring Nginx reverse proxy..."
ssh -v $VPS_USER@$VPS_IP << REMOTE_NGINX
set -e

cat > /etc/nginx/sites-available/mydearpartner << 'NGINX'
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 50M;

    # Next.js Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Django Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000/admin/;
        proxy_set_header Host \$host;
    }

    # Django Static Files
    location /static/ {
        alias /opt/mydearpartner/backend/staticfiles/;
    }

    # Django Media Files
    location /media/ {
        alias /opt/mydearpartner/backend/media/;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/mydearpartner /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
echo "--- Nginx configured and reloaded"
REMOTE_NGINX
echo "    ✓ Nginx reverse proxy configured"

# Step 7: Firewall
echo "[7/7] Configuring firewall..."
ssh $VPS_USER@$VPS_IP << 'REMOTE_FW'
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "--- Firewall rules applied"
REMOTE_FW
echo "    ✓ Firewall configured"

echo ""
echo "=============================================="
echo "Deployment Complete!"
echo "Your app is live at: http://$VPS_IP"
echo ""
echo "Service Status:"
ssh $VPS_USER@$VPS_IP "systemctl is-active mydearpartner-backend && echo 'Backend: RUNNING' || echo 'Backend: STOPPED'"
ssh $VPS_USER@$VPS_IP "systemctl is-active mydearpartner-frontend && echo 'Frontend: RUNNING' || echo 'Frontend: STOPPED'"
echo "=============================================="
