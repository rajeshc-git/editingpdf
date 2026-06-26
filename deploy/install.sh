#!/usr/bin/env bash
#
# open-pdf one-click VPS installer.
#
# Brings a fresh Ubuntu 22.04/24.04 or Debian 12 host to a fully running
# open-pdf stack with a single command. Installs Docker if missing, generates
# strong secrets, configures the firewall, renders a Caddy reverse proxy, and
# starts the production compose stack.
#
# Usage:
#   sudo ./install.sh [options]
#
# Options:
#   --domain <fqdn>          Serve HTTPS for this domain (omit for HTTP-only).
#   --email <addr>           ACME contact email (required when --domain is set).
#   --http-port <port>       Host port Caddy listens on in proxied/HTTP-only mode
#                            (default 80). Point your provider's reverse proxy here.
#   --ssh-port <port>        SSH port to keep open in the firewall (default 22).
#   --with-data              Also run the datastores (PostgreSQL/Redis/NATS/MinIO).
#                            Off by default; the current app does not use them.
#   --no-firewall            Skip firewall configuration.
#   --non-interactive        Never prompt; fail if a required input is missing.
#   -h, --help               Show this help.
#
# TLS modes:
#   * Self-managed HTTPS: pass --domain (and --email). Caddy obtains a Let's
#     Encrypt certificate and serves 80 + 443 directly. DNS for the domain must
#     point at this VPS.
#   * Behind a managed proxy: omit --domain. The stack serves plain HTTP on
#     --http-port and your VPS provider's reverse proxy handles the domain + SSL.
#
# Secrets may be supplied via environment variables (POSTGRES_PASSWORD,
# JWT_SECRET, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD); otherwise they are generated.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
CADDYFILE="${SCRIPT_DIR}/Caddyfile"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
TLS_OVERRIDE="${SCRIPT_DIR}/docker-compose.tls.yml"
DATA_OVERRIDE="${SCRIPT_DIR}/docker-compose.data.yml"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log()   { printf '\033[0;36m[open-pdf]\033[0m %s\n' "$*"; }
ok()    { printf '\033[0;32m[ ok ]\033[0m %s\n' "$*"; }
warn()  { printf '\033[0;33m[warn]\033[0m %s\n' "$*" >&2; }
fatal() { printf '\033[0;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Defaults / config
# ---------------------------------------------------------------------------
DOMAIN="${OPENPDF_DOMAIN:-}"
ACME_EMAIL="${OPENPDF_ACME_EMAIL:-}"
HTTP_PORT="${OPENPDF_HTTP_PORT:-80}"
SSH_PORT="${OPENPDF_SSH_PORT:-22}"
WITH_DATA="${OPENPDF_WITH_DATA:-false}"
SKIP_FIREWALL="${OPENPDF_SKIP_FIREWALL:-false}"
NONINTERACTIVE="${OPENPDF_NONINTERACTIVE:-false}"

DATASTORE_PORTS="5432 6379 4222 8222 9000 9001"

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --domain)         DOMAIN="$2"; shift 2 ;;
      --email)          ACME_EMAIL="$2"; shift 2 ;;
      --http-port)      HTTP_PORT="$2"; shift 2 ;;
      --ssh-port)       SSH_PORT="$2"; shift 2 ;;
      --with-data)      WITH_DATA="true"; shift ;;
      --no-firewall)    SKIP_FIREWALL="true"; shift ;;
      --non-interactive) NONINTERACTIVE="true"; shift ;;
      -h|--help)        awk 'NR>1 && /^#/{sub(/^# ?/,"");print;next} NR>1{exit}' "${BASH_SOURCE[0]}"; exit 0 ;;
      *) fatal "config: unknown argument '$1'" ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# Phase: OS support
# ---------------------------------------------------------------------------
assert_supported_os() {
  [ -r /etc/os-release ] || fatal "os: cannot read /etc/os-release. Supported: Ubuntu 22.04/24.04, Debian 12."
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID}:${VERSION_ID:-}" in
    ubuntu:22.04|ubuntu:24.04|debian:12)
      ok "Supported OS detected: ${PRETTY_NAME:-$ID $VERSION_ID}" ;;
    *)
      fatal "os: unsupported OS '${PRETTY_NAME:-$ID ${VERSION_ID:-?}}'. Supported: Ubuntu 22.04, Ubuntu 24.04, Debian 12." ;;
  esac
}

# ---------------------------------------------------------------------------
# Phase: privileges
# ---------------------------------------------------------------------------
SUDO=""
assert_privileges() {
  if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
  elif command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
    $SUDO -n true 2>/dev/null || sudo true || fatal "privileges: root or passwordless/usable sudo is required to install packages and configure the firewall."
  else
    fatal "privileges: this installer must run as root or with sudo available."
  fi
}

# ---------------------------------------------------------------------------
# Phase: config resolution
# ---------------------------------------------------------------------------
prompt() {
  # prompt <var> <message> <default>
  local __var="$1" __msg="$2" __def="${3:-}" __ans=""
  if [ "$NONINTERACTIVE" = "true" ]; then
    printf -v "$__var" '%s' "$__def"
    return
  fi
  if [ -n "$__def" ]; then
    read -r -p "$__msg [$__def]: " __ans || true
    printf -v "$__var" '%s' "${__ans:-$__def}"
  else
    read -r -p "$__msg: " __ans || true
    printf -v "$__var" '%s' "$__ans"
  fi
}

resolve_config() {
  if [ "$NONINTERACTIVE" != "true" ] && [ -z "$DOMAIN" ] && [ -z "${OPENPDF_DOMAIN+x}" ]; then
    prompt DOMAIN "Domain name for HTTPS (leave empty for HTTP-only on the server IP)" ""
  fi
  if [ -n "$DOMAIN" ] && [ -z "$ACME_EMAIL" ]; then
    prompt ACME_EMAIL "ACME contact email for Let's Encrypt" ""
  fi

  local missing=()
  [ -n "$DOMAIN" ] && [ -z "$ACME_EMAIL" ] && missing+=("email (required with --domain)")

  if [ "${#missing[@]}" -gt 0 ]; then
    fatal "config: missing required input(s): ${missing[*]}"
  fi

  if [ -n "$DOMAIN" ]; then
    # Self-managed HTTPS: Caddy needs host port 80 (ACME + redirect) and 443.
    HTTP_PUBLISH=80
    ok "Configuration resolved: self-managed HTTPS for '${DOMAIN}' (Caddy issues the certificate)."
  else
    # Behind a managed proxy / HTTP-only: serve on the chosen port.
    HTTP_PUBLISH="$HTTP_PORT"
    ok "Configuration resolved: HTTP-only on port ${HTTP_PORT} (point your provider's reverse proxy here)."
  fi
  if [ "$WITH_DATA" = "true" ]; then
    log "Datastores enabled (PostgreSQL/Redis/NATS/MinIO)."
  else
    log "Lean mode: datastores disabled (api-gateway does not use them yet). Use --with-data to enable."
  fi
}

# ---------------------------------------------------------------------------
# Phase: Docker runtime
# ---------------------------------------------------------------------------
runtime_present() {
  command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1
}

install_docker() {
  if runtime_present; then
    ok "Docker Engine and Compose plugin already present; reusing."
    return
  fi
  log "Installing Docker Engine and Compose plugin (official Docker apt repo)..."
  # shellcheck disable=SC1091
  . /etc/os-release
  local repo="https://download.docker.com/linux/${ID}"
  export DEBIAN_FRONTEND=noninteractive
  $SUDO apt-get update -y
  $SUDO apt-get install -y ca-certificates curl gnupg
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "${repo}/gpg" | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] ${repo} ${VERSION_CODENAME} stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin \
    || fatal "runtime: Docker package installation failed."
  $SUDO systemctl enable --now docker || true
}

verify_docker() {
  local deadline=$(( $(date +%s) + 60 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if $SUDO docker version >/dev/null 2>&1 && $SUDO docker compose version >/dev/null 2>&1; then
      ok "Docker daemon is running and Compose plugin responds."
      return
    fi
    sleep 2
  done
  fatal "runtime: Docker verification failed (daemon not running or version query failed within 60s)."
}

# ---------------------------------------------------------------------------
# Phase: secrets
# ---------------------------------------------------------------------------
gen_secret() {
  # 48 base64 bytes -> trimmed to a URL-safe >=32 char token (>=256 bits).
  openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 48
}

read_env_value() {
  # read_env_value <KEY> ; echoes value from existing ENV_FILE or empty
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | head -n1
}

is_insecure() {
  # is_insecure <value> -> returns 0 (true) if insecure
  local v="$1"
  case "$v" in openpdf|openpdf123) return 0 ;; esac
  [ "${#v}" -lt 12 ] && return 0
  return 1
}

resolve_secret() {
  # resolve_secret <KEY> <supplied-or-empty>
  local key="$1" supplied="$2" existing
  if [ -n "$supplied" ]; then
    is_insecure "$supplied" && fatal "secrets: supplied value for ${key} is insecure (default or <12 chars); aborting without changing ${ENV_FILE}."
    printf '%s' "$supplied"; return
  fi
  existing="$(read_env_value "$key")"
  if [ -n "$existing" ]; then printf '%s' "$existing"; return; fi
  gen_secret
}

provision_secrets() {
  command -v openssl >/dev/null 2>&1 || fatal "secrets: openssl is required to generate secrets."

  local pg_user pg_db pg_pass minio_user minio_pass jwt
  pg_user="$(read_env_value POSTGRES_USER)"; pg_user="${pg_user:-openpdf_app}"
  pg_db="$(read_env_value POSTGRES_DB)"; pg_db="${pg_db:-openpdf}"
  pg_pass="$(resolve_secret POSTGRES_PASSWORD "${POSTGRES_PASSWORD:-}")"
  minio_user="$(resolve_secret MINIO_ROOT_USER "${MINIO_ROOT_USER:-}")"
  minio_pass="$(resolve_secret MINIO_ROOT_PASSWORD "${MINIO_ROOT_PASSWORD:-}")"
  jwt="$(resolve_secret JWT_SECRET "${JWT_SECRET:-}")"

  local tmp; tmp="$(mktemp "${SCRIPT_DIR}/.env.XXXXXX")" || fatal "secrets: cannot create temp file."
  chmod 0600 "$tmp"
  cat >"$tmp" <<EOF
POSTGRES_USER=${pg_user}
POSTGRES_DB=${pg_db}
POSTGRES_PASSWORD=${pg_pass}
MINIO_ROOT_USER=${minio_user}
MINIO_ROOT_PASSWORD=${minio_pass}
JWT_SECRET=${jwt}
NODE_ENV=production
OPENPDF_DOMAIN=${DOMAIN}
OPENPDF_ACME_EMAIL=${ACME_EMAIL}
OPENPDF_WITH_DATA=${WITH_DATA}
HTTP_PUBLISH=${HTTP_PUBLISH}
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_PDF_ENGINE_URL=/pdf
EOF
  mv -f "$tmp" "$ENV_FILE" || fatal "secrets: failed to write ${ENV_FILE}."
  chmod 0600 "$ENV_FILE"
  ok "Secrets resolved and written to ${ENV_FILE} (0600)."
}

# ---------------------------------------------------------------------------
# Phase: Caddy reverse proxy
# ---------------------------------------------------------------------------
render_caddyfile() {
  if [ -n "$DOMAIN" ]; then
    cat >"$CADDYFILE" <<EOF
{
	email ${ACME_EMAIL}
}

${DOMAIN} {
	encode gzip zstd
	handle_path /pdf/* {
		reverse_proxy pdf-engine:3001
	}
	handle /api/* {
		reverse_proxy api-gateway:8080
	}
	handle {
		reverse_proxy web:3000
	}
}
EOF
    ok "Caddyfile rendered for HTTPS on ${DOMAIN}."
  else
    cat >"$CADDYFILE" <<'EOF'
:80 {
	encode gzip zstd
	handle_path /pdf/* {
		reverse_proxy pdf-engine:3001
	}
	handle /api/* {
		reverse_proxy api-gateway:8080
	}
	handle {
		reverse_proxy web:3000
	}
}
EOF
    ok "Caddyfile rendered for HTTP-only on :80."
  fi
}

# ---------------------------------------------------------------------------
# Phase: firewall
# ---------------------------------------------------------------------------
configure_firewall() {
  local http_desc="80/tcp, 443/tcp"
  [ -z "$DOMAIN" ] && http_desc="${HTTP_PORT}/tcp"
  if [ "$SKIP_FIREWALL" = "true" ]; then
    warn "Skipping firewall configuration."
    warn "Recommended: allow ${SSH_PORT}/tcp, ${http_desc}; keep closed: ${DATASTORE_PORTS}."
    return
  fi
  if ! command -v ufw >/dev/null 2>&1; then
    if [ "$NONINTERACTIVE" = "true" ]; then
      warn "ufw not installed and running non-interactively; skipping firewall."
      warn "Allow ${SSH_PORT}/tcp, ${http_desc} manually; keep closed: ${DATASTORE_PORTS}."
      return
    fi
    local ans; read -r -p "ufw is not installed. Install it now? [Y/n]: " ans || true
    case "${ans:-Y}" in
      [Nn]*) warn "Firewall skipped. Allow ${SSH_PORT}/tcp, ${http_desc}; keep closed: ${DATASTORE_PORTS}."; return ;;
      *) $SUDO apt-get install -y ufw || fatal "firewall: ufw installation failed." ;;
    esac
  fi
  $SUDO ufw --force reset >/dev/null 2>&1 || true
  $SUDO ufw default deny incoming
  $SUDO ufw default allow outgoing
  $SUDO ufw allow "${SSH_PORT}/tcp"
  if [ -n "$DOMAIN" ]; then
    $SUDO ufw allow 80/tcp
    $SUDO ufw allow 443/tcp
    ok "Firewall configured: allow ${SSH_PORT}/tcp, 80/tcp, 443/tcp; default deny inbound."
  else
    $SUDO ufw allow "${HTTP_PORT}/tcp"
    ok "Firewall configured: allow ${SSH_PORT}/tcp, ${HTTP_PORT}/tcp; default deny inbound."
  fi
  $SUDO ufw --force enable
}

# ---------------------------------------------------------------------------
# Phase: swap safety net (low-RAM hosts building images locally)
# ---------------------------------------------------------------------------
ensure_swap() {
  local mem_kb swap_kb mem_mb
  mem_kb="$(awk '/^MemTotal:/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  swap_kb="$(awk '/^SwapTotal:/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  mem_mb=$(( mem_kb / 1024 ))

  # Plenty of RAM, or swap already configured -> nothing to do.
  [ "$mem_mb" -ge 3000 ] && return 0
  [ "$swap_kb" -gt 0 ] && { ok "Swap already present; skipping swapfile creation."; return 0; }

  warn "Detected ${mem_mb}MB RAM and no swap. Building images locally may run out of memory."
  if [ -e /swapfile ]; then
    warn "/swapfile already exists; not recreating."
    return 0
  fi
  log "Creating a 2G swapfile to make local builds reliable..."
  if $SUDO fallocate -l 2G /swapfile 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null; then
    $SUDO chmod 600 /swapfile
    $SUDO mkswap /swapfile >/dev/null
    $SUDO swapon /swapfile
    if ! grep -q '^/swapfile ' /etc/fstab 2>/dev/null; then
      echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
    fi
    ok "2G swap enabled (persisted in /etc/fstab)."
  else
    warn "Could not create swapfile; continuing without it. If the build is killed, add swap manually and re-run."
  fi
}

# ---------------------------------------------------------------------------
# Phase: compose up + readiness
# ---------------------------------------------------------------------------
compose() {
  local files=(-f "$COMPOSE_FILE")
  [ "$WITH_DATA" = "true" ] && files+=(-f "$DATA_OVERRIDE")
  [ -n "$DOMAIN" ] && files+=(-f "$TLS_OVERRIDE")
  $SUDO docker compose --env-file "$ENV_FILE" "${files[@]}" "$@"
}

start_stack() {
  log "Building images locally and starting the stack (first run may take several minutes)..."
  compose up -d --build || fatal "deploy: 'compose up --build' failed."
}

wait_ready() {
  local services="caddy web api-gateway pdf-engine"
  [ "$WITH_DATA" = "true" ] && services="$services postgres redis nats minio"
  local deadline=$(( $(date +%s) + 600 ))
  log "Waiting for services to become healthy (up to 600s)..."
  while [ "$(date +%s)" -lt "$deadline" ]; do
    local not_ready=""
    for s in $services; do
      local cid state
      cid="$(compose ps -q "$s" 2>/dev/null || true)"
      if [ -z "$cid" ]; then not_ready="$not_ready $s"; continue; fi
      # Health if defined, else running state.
      state="$($SUDO docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo unknown)"
      case "$state" in
        healthy|running) ;;
        *) not_ready="$not_ready $s ($state)" ;;
      esac
    done
    if [ -z "$not_ready" ]; then
      ok "All services are running."
      return
    fi
    sleep 5
  done
  warn "Some services did not reach a running state within 600s:${not_ready:-}"
  compose ps || true
  fatal "deploy: timed out waiting for:${not_ready:-}"
}

print_summary() {
  echo
  ok "open-pdf is deployed."
  compose ps
  echo
  if [ -n "$DOMAIN" ]; then
    log "Access: https://${DOMAIN}"
  else
    local ip; ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    log "Serving plain HTTP on port ${HTTP_PORT}."
    log "Direct check: http://${ip:-<server-ip>}:${HTTP_PORT}"
    log "Now point your provider's reverse proxy (domain + SSL) at this VPS on port ${HTTP_PORT}."
  fi
  log "Manage with: deploy/openpdf {logs|status|update|down}"
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
main() {
  parse_args "$@"
  assert_supported_os
  assert_privileges
  resolve_config
  install_docker
  verify_docker
  provision_secrets
  render_caddyfile
  configure_firewall
  ensure_swap
  start_stack
  wait_ready
  print_summary
}

main "$@"
