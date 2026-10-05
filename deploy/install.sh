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
#                            (default 5000). Point your provider's reverse proxy here.
#   --ssh-port <port>        SSH port to keep open in the firewall (default 22).
#   --no-firewall            Skip firewall configuration.
#   --non-interactive        Never prompt; fail if a required input is missing.
#   -h, --help               Show this help.
#
# TLS modes:
#   * Self-managed HTTPS: pass --domain (and --email). Caddy obtains a Let's
#     Encrypt certificate and serves 80 + 443 directly. DNS for the domain must
#     point at this VPS.
#   * Behind a managed proxy: omit --domain. The stack serves plain HTTP on
#     --http-port (default 5000) and your VPS provider's reverse proxy handles the domain + SSL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
CADDYFILE="${SCRIPT_DIR}/Caddyfile"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
TLS_OVERRIDE="${SCRIPT_DIR}/docker-compose.tls.yml"

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
HTTP_PORT="${OPENPDF_HTTP_PORT:-5000}"
SSH_PORT="${OPENPDF_SSH_PORT:-22}"
SKIP_FIREWALL="${OPENPDF_SKIP_FIREWALL:-false}"
NONINTERACTIVE="${OPENPDF_NONINTERACTIVE:-false}"

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --domain)         DOMAIN="$2"; shift 2 ;;
      --email)          ACME_EMAIL="$2"; shift 2 ;;
      --http-port)      HTTP_PORT="$2"; shift 2 ;;
      --ssh-port)       SSH_PORT="$2"; shift 2 ;;
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
    prompt DOMAIN "Domain name for HTTPS (leave empty for HTTP-only on port 5000)" ""
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
    HTTP_PUBLISH=80
    ok "Configuration resolved: self-managed HTTPS for '${DOMAIN}' (Caddy issues the certificate)."
  else
    HTTP_PUBLISH="$HTTP_PORT"
    ok "Configuration resolved: HTTP-only on port ${HTTP_PORT}."
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
# Phase: environment file
# ---------------------------------------------------------------------------
write_env() {
  local tmp; tmp="$(mktemp "${SCRIPT_DIR}/.env.XXXXXX")" || fatal "cannot create temp file."
  chmod 0600 "$tmp"
  cat >"$tmp" <<EOF
NODE_ENV=production
OPENPDF_DOMAIN=${DOMAIN}
OPENPDF_ACME_EMAIL=${ACME_EMAIL}
HTTP_PUBLISH=${HTTP_PUBLISH}
EOF
  mv -f "$tmp" "$ENV_FILE" || fatal "failed to write ${ENV_FILE}."
  chmod 0600 "$ENV_FILE"
  ok "Environment configured: ${ENV_FILE}."
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
# Phase: compose up + readiness
# ---------------------------------------------------------------------------
compose() {
  local files=(-f "$COMPOSE_FILE")
  [ -n "$DOMAIN" ] && files+=(-f "$TLS_OVERRIDE")
  $SUDO docker compose --env-file "$ENV_FILE" "${files[@]}" "$@"
}

start_stack() {
  log "Building web container locally and starting the stack..."
  compose up -d --build || fatal "deploy: 'compose up --build' failed."
}

wait_ready() {
  local services="caddy web"
  local deadline=$(( $(date +%s) + 300 ))
  log "Waiting for services to become healthy..."
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
    sleep 3
  done
  warn "Some services did not reach a running state:${not_ready:-}"
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
  write_env
  render_caddyfile
  configure_firewall
  start_stack
  wait_ready
  print_summary
}

main "$@"
