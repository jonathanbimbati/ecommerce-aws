#!/bin/sh
set -e

# Create runtime config for Angular app
CONFIG_DIR=/usr/share/nginx/html/assets
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/env.js" <<EOF
window.__env = {
  API_URL: "${API_URL:-}",
  ALLOW_LOGIN_FALLBACK: ${ALLOW_LOGIN_FALLBACK:-false},
  // Feature flag: enable uploads UI only when explicitly true
  UPLOADS_ENABLED: ${UPLOADS_ENABLED:-false}
};
EOF

# Start nginx
exec nginx -g 'daemon off;'
