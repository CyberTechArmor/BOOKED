#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/CyberTechArmor/BOOKED.git"
INSTALL_DIR="/opt/booked"
BRANCH="claude/booked-scheduling-system-Tj7o1"

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║     ██████╗  ██████╗  ██████╗ ██╗  ██╗███████╗██████╗       ║"
    echo "║     ██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝██╔════╝██╔══██╗      ║"
    echo "║     ██████╔╝██║   ██║██║   ██║█████╔╝ █████╗  ██║  ██║      ║"
    echo "║     ██╔══██╗██║   ██║██║   ██║██╔═██╗ ██╔══╝  ██║  ██║      ║"
    echo "║     ██████╔╝╚██████╔╝╚██████╔╝██║  ██╗███████╗██████╔╝      ║"
    echo "║     ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝       ║"
    echo "║                                                              ║"
    echo "║              Modern Scheduling Infrastructure                ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Generate secure random password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9!@#$%^&*()_+-=' | head -c "$length"
}

# Generate secure random string (alphanumeric only)
generate_secret() {
    local length=${1:-64}
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
    elif [ -f /etc/debian_version ]; then
        OS="debian"
    else
        OS="unknown"
    fi
    echo "$OS"
}

# Install Docker
install_docker() {
    local os=$(detect_os)

    log_info "Installing Docker..."

    case "$os" in
        ubuntu|debian)
            # Remove old versions
            sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

            # Install prerequisites
            sudo apt-get update
            sudo apt-get install -y ca-certificates curl gnupg lsb-release

            # Add Docker's official GPG key
            sudo mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$os/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

            # Set up repository
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$os $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

            # Install Docker Engine
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        centos|rhel|fedora|rocky|almalinux)
            # Remove old versions
            sudo yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true

            # Install prerequisites
            sudo yum install -y yum-utils

            # Add Docker repository
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

            # Install Docker Engine
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        amzn)
            # Amazon Linux
            sudo yum update -y
            sudo yum install -y docker
            sudo systemctl start docker
            sudo systemctl enable docker
            # Install docker-compose separately for Amazon Linux
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            ;;
        *)
            log_error "Unsupported OS: $os"
            log_info "Please install Docker manually: https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac

    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker

    # Add current user to docker group
    if [ "$EUID" -ne 0 ]; then
        sudo usermod -aG docker "$USER"
        log_warning "Added $USER to docker group. You may need to log out and back in for this to take effect."
    fi

    log_success "Docker installed successfully"
}

# Install git
install_git() {
    local os=$(detect_os)

    log_info "Installing git..."

    case "$os" in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y git
            ;;
        centos|rhel|fedora|rocky|almalinux|amzn)
            sudo yum install -y git
            ;;
        *)
            log_error "Unsupported OS: $os"
            exit 1
            ;;
    esac

    log_success "Git installed successfully"
}

# Install openssl
install_openssl() {
    local os=$(detect_os)

    log_info "Installing openssl..."

    case "$os" in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y openssl
            ;;
        centos|rhel|fedora|rocky|almalinux|amzn)
            sudo yum install -y openssl
            ;;
        *)
            log_error "Unsupported OS: $os"
            exit 1
            ;;
    esac

    log_success "OpenSSL installed successfully"
}

# Install curl
install_curl() {
    local os=$(detect_os)

    log_info "Installing curl..."

    case "$os" in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y curl
            ;;
        centos|rhel|fedora|rocky|almalinux|amzn)
            sudo yum install -y curl
            ;;
        *)
            log_error "Unsupported OS: $os"
            exit 1
            ;;
    esac

    log_success "curl installed successfully"
}

# Check and install system requirements
check_requirements() {
    log_info "Checking system requirements..."

    local missing_deps=()
    local needs_install=false

    # Check each dependency
    if ! command_exists curl; then
        missing_deps+=("curl")
    fi

    if ! command_exists git; then
        missing_deps+=("git")
    fi

    if ! command_exists openssl; then
        missing_deps+=("openssl")
    fi

    if ! command_exists docker; then
        missing_deps+=("docker")
    fi

    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        if command_exists docker; then
            # Docker exists but compose doesn't - might be older install
            missing_deps+=("docker-compose")
        fi
    fi

    # If there are missing dependencies, offer to install them
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_warning "Missing dependencies: ${missing_deps[*]}"
        echo ""
        read -p "Would you like to install the missing dependencies automatically? [Y/n]: " INSTALL_DEPS
        INSTALL_DEPS=${INSTALL_DEPS:-Y}

        if [[ "$INSTALL_DEPS" =~ ^[Yy]$ ]]; then
            # Check if we have sudo access
            if ! sudo -v 2>/dev/null; then
                log_error "sudo access is required to install dependencies"
                exit 1
            fi

            for dep in "${missing_deps[@]}"; do
                case "$dep" in
                    curl)
                        install_curl
                        ;;
                    git)
                        install_git
                        ;;
                    openssl)
                        install_openssl
                        ;;
                    docker|docker-compose)
                        if ! command_exists docker; then
                            install_docker
                        fi
                        ;;
                esac
            done

            # Verify installation
            log_info "Verifying installations..."

            local still_missing=()

            if ! command_exists docker; then
                still_missing+=("docker")
            fi

            if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
                still_missing+=("docker-compose")
            fi

            if ! command_exists git; then
                still_missing+=("git")
            fi

            if ! command_exists openssl; then
                still_missing+=("openssl")
            fi

            if [ ${#still_missing[@]} -ne 0 ]; then
                log_error "Failed to install: ${still_missing[*]}"
                log_info "Please install these manually and run the script again."
                exit 1
            fi
        else
            log_error "Cannot proceed without required dependencies."
            echo ""
            echo "Please install the missing dependencies manually:"
            echo ""
            echo "On Ubuntu/Debian:"
            echo "  sudo apt update && sudo apt install -y docker.io docker-compose git openssl curl"
            echo "  sudo systemctl enable --now docker"
            echo "  sudo usermod -aG docker \$USER"
            echo ""
            echo "On CentOS/RHEL/Rocky/Alma:"
            echo "  sudo yum install -y docker docker-compose git openssl curl"
            echo "  sudo systemctl enable --now docker"
            echo "  sudo usermod -aG docker \$USER"
            echo ""
            exit 1
        fi
    fi

    log_success "All system requirements met"
}

# Prompt for configuration
prompt_config() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    INSTALLATION CONFIGURATION                  ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""

    # Domain configuration
    read -p "Enter your domain name (e.g., booking.example.com): " DOMAIN
    while [[ -z "$DOMAIN" ]]; do
        log_warning "Domain name is required"
        read -p "Enter your domain name: " DOMAIN
    done

    echo ""

    # Reverse proxy configuration
    echo "Select your reverse proxy:"
    echo ""
    echo "  1) Nginx (default) - Popular, well-documented, great performance"
    echo "  2) Traefik         - Modern, automatic service discovery, great for Docker"
    echo "  3) Caddy           - Automatic HTTPS, simple configuration"
    echo "  4) None            - I already have a reverse proxy configured"
    echo ""
    read -p "Enter choice [1-4] (default: 1): " PROXY_CHOICE
    PROXY_CHOICE=${PROXY_CHOICE:-1}

    case $PROXY_CHOICE in
        1) PROXY_TYPE="nginx" ;;
        2) PROXY_TYPE="traefik" ;;
        3) PROXY_TYPE="caddy" ;;
        4) PROXY_TYPE="none" ;;
        *) PROXY_TYPE="nginx" ;;
    esac

    echo ""

    # Admin configuration
    echo -e "${CYAN}Admin Account Configuration${NC}"
    echo ""
    read -p "Enter admin email: " ADMIN_EMAIL
    while [[ ! "$ADMIN_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; do
        log_warning "Please enter a valid email address"
        read -p "Enter admin email: " ADMIN_EMAIL
    done

    read -p "Enter admin username (default: admin): " ADMIN_USERNAME
    ADMIN_USERNAME=${ADMIN_USERNAME:-admin}

    read -p "Enter admin full name (default: Administrator): " ADMIN_NAME
    ADMIN_NAME=${ADMIN_NAME:-Administrator}

    # Generate secure password
    ADMIN_PASSWORD=$(generate_password 24)

    echo ""

    # Let's Encrypt email (for SSL)
    if [[ "$PROXY_TYPE" != "none" ]]; then
        read -p "Enter email for Let's Encrypt SSL notifications (default: $ADMIN_EMAIL): " LETSENCRYPT_EMAIL
        LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:-$ADMIN_EMAIL}
    fi

    # Installation directory
    read -p "Enter installation directory (default: $INSTALL_DIR): " CUSTOM_INSTALL_DIR
    INSTALL_DIR=${CUSTOM_INSTALL_DIR:-$INSTALL_DIR}

    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    CONFIGURATION SUMMARY                       ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  Domain:           $DOMAIN"
    echo "  Reverse Proxy:    $PROXY_TYPE"
    echo "  Admin Email:      $ADMIN_EMAIL"
    echo "  Admin Username:   $ADMIN_USERNAME"
    echo "  Install Directory: $INSTALL_DIR"
    if [[ "$PROXY_TYPE" != "none" ]]; then
        echo "  Let's Encrypt:    $LETSENCRYPT_EMAIL"
    fi
    echo ""

    read -p "Proceed with installation? [Y/n]: " CONFIRM
    CONFIRM=${CONFIRM:-Y}
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        log_info "Installation cancelled"
        exit 0
    fi
}

# Clone repository
clone_repository() {
    log_info "Cloning BOOKED repository..."

    if [[ -d "$INSTALL_DIR" ]]; then
        log_warning "Directory $INSTALL_DIR already exists"
        read -p "Remove existing directory and continue? [y/N]: " REMOVE_EXISTING
        if [[ "$REMOVE_EXISTING" =~ ^[Yy]$ ]]; then
            sudo rm -rf "$INSTALL_DIR"
        else
            log_error "Installation cancelled"
            exit 1
        fi
    fi

    sudo mkdir -p "$INSTALL_DIR"
    sudo chown "$USER:$USER" "$INSTALL_DIR"

    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    log_success "Repository cloned successfully"
}

# Generate environment file
generate_env_file() {
    log_info "Generating environment configuration..."

    local db_password=$(generate_secret 32)
    local redis_password=$(generate_secret 32)
    local session_secret=$(generate_secret 64)
    local encryption_key=$(generate_secret 32)
    local webhook_secret=$(generate_secret 32)

    cat > "$INSTALL_DIR/.env" << EOF
# =============================================================================
# BOOKED - Environment Configuration
# Generated by install.sh on $(date)
# =============================================================================

# Application
NODE_ENV=production
APP_URL=https://${DOMAIN}
API_URL=https://${DOMAIN}/api
PORT=3000

# Database
DATABASE_URL=postgresql://booked:${db_password}@postgres:5432/booked?schema=public
POSTGRES_USER=booked
POSTGRES_PASSWORD=${db_password}
POSTGRES_DB=booked

# Redis
REDIS_URL=redis://:${redis_password}@redis:6379
REDIS_PASSWORD=${redis_password}

# Security
SESSION_SECRET=${session_secret}
ENCRYPTION_KEY=${encryption_key}
WEBHOOK_SIGNING_SECRET=${webhook_secret}

# Admin Account (created on first run)
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_NAME=${ADMIN_NAME}

# CORS
CORS_ORIGINS=https://${DOMAIN}

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info

# Optional: Email (configure for notifications)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASSWORD=
# SMTP_FROM=noreply@${DOMAIN}

# Optional: External Integrations
# NEON_API_URL=
# MEET_API_URL=

# Optional: OAuth Providers
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# MICROSOFT_CLIENT_ID=
# MICROSOFT_CLIENT_SECRET=
EOF

    chmod 600 "$INSTALL_DIR/.env"
    log_success "Environment file generated"
}

# Generate Nginx configuration
generate_nginx_config() {
    log_info "Generating Nginx configuration..."

    mkdir -p "$INSTALL_DIR/proxy/nginx"

    # Nginx main config
    cat > "$INSTALL_DIR/proxy/nginx/nginx.conf" << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/rss+xml application/atom+xml image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=conn:10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    include /etc/nginx/conf.d/*.conf;
}
EOF

    # Site configuration
    cat > "$INSTALL_DIR/proxy/nginx/default.conf" << EOF
upstream booked_api {
    server api:3000;
    keepalive 32;
}

upstream booked_web {
    server web:4000;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    # SSL certificates (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/${DOMAIN}/chain.pem;

    # SSL configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # API routes
    location /api {
        limit_req zone=api burst=20 nodelay;
        limit_conn conn 10;

        proxy_pass http://booked_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://booked_api/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        access_log off;
    }

    # Frontend
    location / {
        proxy_pass http://booked_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    # Docker compose override for nginx
    cat > "$INSTALL_DIR/docker-compose.nginx.yml" << EOF
services:
  nginx:
    image: nginx:alpine
    container_name: booked-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./proxy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./proxy/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - api
      - web
    networks:
      - booked-network

  certbot:
    image: certbot/certbot
    container_name: booked-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \$\${!}; done;'"
    networks:
      - booked-network
EOF

    # Initial cert script
    cat > "$INSTALL_DIR/init-letsencrypt.sh" << EOF
#!/bin/bash
set -e

DOMAIN="${DOMAIN}"
EMAIL="${LETSENCRYPT_EMAIL}"
STAGING=0  # Set to 1 for testing

echo "Initializing Let's Encrypt certificates for \$DOMAIN..."

# Create directories
mkdir -p ./certbot/conf ./certbot/www

# Download recommended TLS parameters
if [ ! -e "./certbot/conf/options-ssl-nginx.conf" ]; then
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > ./certbot/conf/options-ssl-nginx.conf
fi

if [ ! -e "./certbot/conf/ssl-dhparams.pem" ]; then
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > ./certbot/conf/ssl-dhparams.pem
fi

# Create dummy certificate for nginx to start
echo "Creating dummy certificate..."
mkdir -p ./certbot/conf/live/\$DOMAIN
openssl req -x509 -nodes -newkey rsa:4096 -days 1 \\
    -keyout ./certbot/conf/live/\$DOMAIN/privkey.pem \\
    -out ./certbot/conf/live/\$DOMAIN/fullchain.pem \\
    -subj '/CN=localhost'
cp ./certbot/conf/live/\$DOMAIN/fullchain.pem ./certbot/conf/live/\$DOMAIN/chain.pem

# Start nginx with dummy cert
echo "Starting nginx..."
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d nginx

# Delete dummy certificate
echo "Deleting dummy certificate..."
rm -rf ./certbot/conf/live/\$DOMAIN
rm -rf ./certbot/conf/archive/\$DOMAIN
rm -rf ./certbot/conf/renewal/\$DOMAIN.conf

# Request real certificate
echo "Requesting Let's Encrypt certificate..."
if [ \$STAGING -eq 1 ]; then
    STAGING_ARG="--staging"
else
    STAGING_ARG=""
fi

docker compose -f docker-compose.yml -f docker-compose.nginx.yml run --rm certbot certonly \\
    --webroot \\
    --webroot-path=/var/www/certbot \\
    \$STAGING_ARG \\
    --email \$EMAIL \\
    --agree-tos \\
    --no-eff-email \\
    -d \$DOMAIN

# Reload nginx
echo "Reloading nginx..."
docker compose -f docker-compose.yml -f docker-compose.nginx.yml exec nginx nginx -s reload

echo "Certificate obtained successfully!"
EOF
    chmod +x "$INSTALL_DIR/init-letsencrypt.sh"

    log_success "Nginx configuration generated"
}

# Generate Traefik configuration
generate_traefik_config() {
    log_info "Generating Traefik configuration..."

    mkdir -p "$INSTALL_DIR/proxy/traefik"

    # Traefik static configuration
    cat > "$INSTALL_DIR/proxy/traefik/traefik.yml" << EOF
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: ${LETSENCRYPT_EMAIL}
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: booked-network
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true

log:
  level: INFO

accessLog:
  filePath: "/var/log/traefik/access.log"
  bufferingSize: 100
EOF

    # Traefik dynamic configuration
    cat > "$INSTALL_DIR/proxy/traefik/dynamic.yml" << EOF
http:
  middlewares:
    secure-headers:
      headers:
        stsSeconds: 63072000
        stsIncludeSubdomains: true
        stsPreload: true
        forceSTSHeader: true
        contentTypeNosniff: true
        browserXssFilter: true
        frameDeny: true
        referrerPolicy: "strict-origin-when-cross-origin"

    rate-limit:
      rateLimit:
        average: 100
        burst: 50
        period: 1m

    api-rate-limit:
      rateLimit:
        average: 50
        burst: 20
        period: 1m

tls:
  options:
    default:
      minVersion: VersionTLS12
      sniStrict: true
      cipherSuites:
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305
EOF

    # Docker compose override for traefik
    cat > "$INSTALL_DIR/docker-compose.traefik.yml" << EOF
services:
  traefik:
    image: traefik:v3.0
    container_name: booked-traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./proxy/traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./proxy/traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro
      - ./letsencrypt:/letsencrypt
      - ./logs/traefik:/var/log/traefik
    networks:
      - booked-network
    labels:
      - "traefik.enable=true"

  api:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(\`${DOMAIN}\`) && PathPrefix(\`/api\`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
      - "traefik.http.routers.api.middlewares=secure-headers@file,api-rate-limit@file"
      - "traefik.http.services.api.loadbalancer.server.port=3000"

  web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(\`${DOMAIN}\`)"
      - "traefik.http.routers.web.entrypoints=websecure"
      - "traefik.http.routers.web.tls.certresolver=letsencrypt"
      - "traefik.http.routers.web.middlewares=secure-headers@file,rate-limit@file"
      - "traefik.http.services.web.loadbalancer.server.port=4000"
EOF

    mkdir -p "$INSTALL_DIR/letsencrypt"
    mkdir -p "$INSTALL_DIR/logs/traefik"
    touch "$INSTALL_DIR/letsencrypt/acme.json"
    chmod 600 "$INSTALL_DIR/letsencrypt/acme.json"

    log_success "Traefik configuration generated"
}

# Generate Caddy configuration
generate_caddy_config() {
    log_info "Generating Caddy configuration..."

    mkdir -p "$INSTALL_DIR/proxy/caddy"

    # Caddyfile
    cat > "$INSTALL_DIR/proxy/caddy/Caddyfile" << EOF
{
    email ${LETSENCRYPT_EMAIL}

    servers {
        protocols h1 h2 h3
    }
}

${DOMAIN} {
    # Security headers
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    # API routes
    handle /api/* {
        reverse_proxy api:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Health check
    handle /health {
        reverse_proxy api:3000
    }

    # Frontend
    handle {
        reverse_proxy web:4000 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Logging
    log {
        output file /var/log/caddy/access.log {
            roll_size 100mb
            roll_keep 5
        }
    }
}
EOF

    # Docker compose override for caddy
    cat > "$INSTALL_DIR/docker-compose.caddy.yml" << EOF
services:
  caddy:
    image: caddy:2-alpine
    container_name: booked-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3
    volumes:
      - ./proxy/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy_data:/data
      - ./caddy_config:/config
      - ./logs/caddy:/var/log/caddy
    depends_on:
      - api
      - web
    networks:
      - booked-network
EOF

    mkdir -p "$INSTALL_DIR/caddy_data"
    mkdir -p "$INSTALL_DIR/caddy_config"
    mkdir -p "$INSTALL_DIR/logs/caddy"

    log_success "Caddy configuration generated"
}

# Generate existing proxy configuration
generate_existing_proxy_config() {
    log_info "Generating configuration for existing reverse proxy..."

    mkdir -p "$INSTALL_DIR/proxy/examples"

    # Nginx example
    cat > "$INSTALL_DIR/proxy/examples/nginx-example.conf" << EOF
# Nginx configuration for BOOKED
# Add this to your existing nginx configuration

upstream booked_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream booked_web {
    server 127.0.0.1:4000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    # Your existing SSL configuration here
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    # API routes
    location /api {
        proxy_pass http://booked_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Frontend
    location / {
        proxy_pass http://booked_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    # Traefik example
    cat > "$INSTALL_DIR/proxy/examples/traefik-example.yml" << EOF
# Traefik configuration for BOOKED
# Add these labels to your docker-compose or use file provider

http:
  routers:
    booked-api:
      rule: "Host(\`${DOMAIN}\`) && PathPrefix(\`/api\`)"
      service: booked-api
      tls:
        certResolver: your-resolver

    booked-web:
      rule: "Host(\`${DOMAIN}\`)"
      service: booked-web
      tls:
        certResolver: your-resolver

  services:
    booked-api:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3000"

    booked-web:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:4000"
EOF

    # Caddy example
    cat > "$INSTALL_DIR/proxy/examples/caddy-example.conf" << EOF
# Caddy configuration for BOOKED
# Add this to your existing Caddyfile

${DOMAIN} {
    handle /api/* {
        reverse_proxy 127.0.0.1:3000
    }

    handle {
        reverse_proxy 127.0.0.1:4000
    }
}
EOF

    # HAProxy example
    cat > "$INSTALL_DIR/proxy/examples/haproxy-example.cfg" << EOF
# HAProxy configuration for BOOKED
# Add this to your existing haproxy.cfg

frontend https_front
    bind *:443 ssl crt /path/to/cert.pem
    acl is_booked hdr(host) -i ${DOMAIN}
    acl is_api path_beg /api

    use_backend booked_api if is_booked is_api
    use_backend booked_web if is_booked

backend booked_api
    server api 127.0.0.1:3000 check

backend booked_web
    server web 127.0.0.1:4000 check
EOF

    # Modify docker-compose to expose ports directly
    cat > "$INSTALL_DIR/docker-compose.external-proxy.yml" << EOF
services:
  api:
    ports:
      - "127.0.0.1:3000:3000"

  web:
    ports:
      - "127.0.0.1:4000:4000"
EOF

    log_success "Example proxy configurations generated in $INSTALL_DIR/proxy/examples/"
}

# Create startup script
create_startup_script() {
    log_info "Creating startup scripts..."

    # Main start script
    cat > "$INSTALL_DIR/start.sh" << EOF
#!/bin/bash
set -e

cd "$INSTALL_DIR"

# Load environment
set -a
source .env
set +a

echo "Starting BOOKED..."

case "${PROXY_TYPE}" in
    nginx)
        docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
        ;;
    traefik)
        docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d
        ;;
    caddy)
        docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
        ;;
    none)
        docker compose -f docker-compose.yml -f docker-compose.external-proxy.yml up -d
        ;;
esac

echo "BOOKED started successfully!"
echo "Access the application at: https://${DOMAIN}"
EOF
    chmod +x "$INSTALL_DIR/start.sh"

    # Stop script
    cat > "$INSTALL_DIR/stop.sh" << EOF
#!/bin/bash
cd "$INSTALL_DIR"

echo "Stopping BOOKED..."

case "${PROXY_TYPE}" in
    nginx)
        docker compose -f docker-compose.yml -f docker-compose.nginx.yml down
        ;;
    traefik)
        docker compose -f docker-compose.yml -f docker-compose.traefik.yml down
        ;;
    caddy)
        docker compose -f docker-compose.yml -f docker-compose.caddy.yml down
        ;;
    none)
        docker compose -f docker-compose.yml -f docker-compose.external-proxy.yml down
        ;;
esac

echo "BOOKED stopped"
EOF
    chmod +x "$INSTALL_DIR/stop.sh"

    # Logs script
    cat > "$INSTALL_DIR/logs.sh" << EOF
#!/bin/bash
cd "$INSTALL_DIR"
docker compose logs -f "\$@"
EOF
    chmod +x "$INSTALL_DIR/logs.sh"

    # Update script
    cat > "$INSTALL_DIR/update.sh" << EOF
#!/bin/bash
set -e

cd "$INSTALL_DIR"

echo "Updating BOOKED..."

# Pull latest changes
git pull origin ${BRANCH}

# Rebuild containers
case "${PROXY_TYPE}" in
    nginx)
        docker compose -f docker-compose.yml -f docker-compose.nginx.yml build
        docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
        ;;
    traefik)
        docker compose -f docker-compose.yml -f docker-compose.traefik.yml build
        docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d
        ;;
    caddy)
        docker compose -f docker-compose.yml -f docker-compose.caddy.yml build
        docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
        ;;
    none)
        docker compose -f docker-compose.yml -f docker-compose.external-proxy.yml build
        docker compose -f docker-compose.yml -f docker-compose.external-proxy.yml up -d
        ;;
esac

# Run migrations
docker compose exec api npx prisma migrate deploy

echo "BOOKED updated successfully!"
EOF
    chmod +x "$INSTALL_DIR/update.sh"

    log_success "Startup scripts created"
}

# Build and start services
build_and_start() {
    log_info "Building and starting services..."

    cd "$INSTALL_DIR"

    # Build images
    case $PROXY_TYPE in
        nginx)
            docker compose -f docker-compose.yml -f docker-compose.nginx.yml build
            ;;
        traefik)
            docker compose -f docker-compose.yml -f docker-compose.traefik.yml build
            ;;
        caddy)
            docker compose -f docker-compose.yml -f docker-compose.caddy.yml build
            ;;
        none)
            docker compose -f docker-compose.yml -f docker-compose.external-proxy.yml build
            ;;
    esac

    log_success "Docker images built"

    # Start database and redis first
    log_info "Starting database and Redis..."
    docker compose up -d postgres redis

    # Wait for database
    log_info "Waiting for database to be ready..."
    sleep 10

    # Run migrations
    log_info "Running database migrations..."
    docker compose run --rm api npx prisma migrate deploy

    # Seed admin user
    log_info "Creating admin user..."
    docker compose run --rm api npx prisma db seed

    log_success "Database initialized"
}

# Print completion message
print_completion() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}              BOOKED INSTALLATION COMPLETE!                     ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}Installation Directory:${NC} $INSTALL_DIR"
    echo -e "  ${CYAN}Domain:${NC}                https://${DOMAIN}"
    echo ""
    echo -e "  ${YELLOW}Admin Credentials:${NC}"
    echo -e "    Email:    ${ADMIN_EMAIL}"
    echo -e "    Username: ${ADMIN_USERNAME}"
    echo -e "    Password: ${ADMIN_PASSWORD}"
    echo ""
    echo -e "  ${RED}⚠️  SAVE THESE CREDENTIALS - They will not be shown again!${NC}"
    echo ""

    if [[ "$PROXY_TYPE" == "nginx" ]]; then
        echo -e "  ${YELLOW}Next Steps:${NC}"
        echo "    1. Initialize SSL certificates:"
        echo "       cd $INSTALL_DIR && ./init-letsencrypt.sh"
        echo ""
        echo "    2. Start all services:"
        echo "       ./start.sh"
        echo ""
    elif [[ "$PROXY_TYPE" != "none" ]]; then
        echo -e "  ${YELLOW}Next Steps:${NC}"
        echo "    Start all services:"
        echo "       cd $INSTALL_DIR && ./start.sh"
        echo ""
    else
        echo -e "  ${YELLOW}Next Steps:${NC}"
        echo "    1. Configure your reverse proxy using examples in:"
        echo "       $INSTALL_DIR/proxy/examples/"
        echo ""
        echo "    2. Start BOOKED services:"
        echo "       cd $INSTALL_DIR && ./start.sh"
        echo ""
    fi

    echo -e "  ${CYAN}Management Commands:${NC}"
    echo "    Start:   $INSTALL_DIR/start.sh"
    echo "    Stop:    $INSTALL_DIR/stop.sh"
    echo "    Logs:    $INSTALL_DIR/logs.sh"
    echo "    Update:  $INSTALL_DIR/update.sh"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

    # Save credentials to file
    cat > "$INSTALL_DIR/.credentials" << EOF
# BOOKED Admin Credentials
# Generated: $(date)
#
# WARNING: Delete this file after saving credentials securely!

Admin Email:    ${ADMIN_EMAIL}
Admin Username: ${ADMIN_USERNAME}
Admin Password: ${ADMIN_PASSWORD}

Domain: https://${DOMAIN}
EOF
    chmod 600 "$INSTALL_DIR/.credentials"

    echo ""
    log_warning "Credentials also saved to: $INSTALL_DIR/.credentials"
    log_warning "Delete this file after saving credentials securely!"
    echo ""
}

# Main installation flow
main() {
    print_banner
    check_requirements
    prompt_config
    clone_repository
    generate_env_file

    case $PROXY_TYPE in
        nginx)
            generate_nginx_config
            ;;
        traefik)
            generate_traefik_config
            ;;
        caddy)
            generate_caddy_config
            ;;
        none)
            generate_existing_proxy_config
            ;;
    esac

    create_startup_script
    build_and_start
    print_completion
}

# Run main function
main "$@"
