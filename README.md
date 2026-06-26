# EditingPDF

A browser-based PDF editor with a Figma-like experience, served at **[editingpdf.in](https://editingpdf.in)**.

## Architecture

```
apps/
  web/           # Next.js frontend with canvas-based editor
  api-gateway/   # Go API gateway (Fiber)
  pdf-engine/    # Rust PDF rendering engine (Actix-web)

packages/
  types/         # Shared TypeScript types
  editor-core/   # Scene graph, spatial index, command manager
  ui/            # UI components

deploy/          # Production deployment (Docker, one-command installer)
```

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, TailwindCSS, Zustand
- **Backend**: Go 1.22, Fiber
- **PDF Engine**: Rust, Actix-web
- **Infrastructure**: Docker Compose, Caddy (auto-HTTPS), PostgreSQL, Redis, NATS, MinIO

---

## Deploy to a VPS (one command)

This is the path for your workflow: push to GitHub → clone on your Linux VPS → run **one** command. The host only needs **Docker** — the installer adds it if it's missing. You do **not** install Node, pnpm, Go, or Rust on the VPS.

### Prerequisites

- A fresh **Ubuntu 22.04 / 24.04** or **Debian 12** VPS with SSH access.
- Your domain **editingpdf.in** pointed at the VPS public IP (an `A` record). Needed only if you want HTTPS.

### Will 2 GB RAM / 10 GB SSD be enough?

- **Running the stack: yes.** At idle the containers use roughly **1–1.3 GB RAM** and **~2–3 GB disk**.
- **Building the images on the VPS: tight.** The Rust and Next.js builds are memory-hungry and can exceed 2 GB RAM and 10 GB disk.

So pick one of the two options below. **Option A is recommended for a 2 GB box.**

### Option A — Build on GitHub, pull on the VPS (recommended for 2 GB)

The included GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the three images and pushes them to Docker Hub. The VPS just pulls them — no compiling on the server.

1. **One-time GitHub setup.** In your repo: Settings → Secrets and variables → Actions, add:
   - `DOCKER_USERNAME` — your Docker Hub username
   - `DOCKER_PASSWORD` — a Docker Hub access token

   Pushing to `main` then builds and pushes:
   `DOCKER_USERNAME/openpdf-web`, `…/openpdf-api-gateway`, `…/openpdf-pdf-engine`.

2. **On the VPS:**

   ```bash
   git clone https://github.com/<you>/editingpdf.git
   cd editingpdf

   sudo ./deploy/install.sh \
     --domain editingpdf.in \
     --email you@editingpdf.in \
     --image-source registry \
     --registry <your-dockerhub-username>
   ```

That's it. The installer detects the OS, installs Docker if needed, generates strong secrets, configures the firewall (SSH/80/443 only), sets up Caddy with automatic HTTPS for editingpdf.in, pulls the images, and starts everything.

### Option B — Build everything on the VPS (no registry needed)

Simplest to set up (no Docker Hub), but slower and heavier. The installer automatically adds a 2 GB swap file on low-RAM hosts so the build doesn't get killed.

```bash
git clone https://github.com/<you>/editingpdf.git
cd editingpdf

sudo ./deploy/install.sh --domain editingpdf.in --email you@editingpdf.in
```

> The first build can take several minutes and disk usage peaks during the build. If you hit out-of-disk errors on the 10 GB SSD, use Option A instead, or run `docker builder prune -af` after the first successful deploy.

### No domain yet? (HTTP-only on the IP)

Omit `--domain`; the app is served over plain HTTP on the server IP:

```bash
sudo ./deploy/install.sh --image-source registry --registry <your-dockerhub-username>
```

### Installer options

| Flag | Description | Default |
| --- | --- | --- |
| `--domain <fqdn>` | Serve HTTPS for this domain (auto Let's Encrypt) | _empty → HTTP-only_ |
| `--email <addr>` | ACME contact email (required with `--domain`) | — |
| `--ssh-port <port>` | SSH port kept open in the firewall | `22` |
| `--image-source <build\|registry>` | Build images locally, or pull prebuilt | `build` |
| `--registry <namespace>` | Docker Hub username (with `registry`) | — |
| `--tag <tag>` | Image tag (with `registry`) | `latest` |
| `--no-firewall` | Skip firewall configuration | _off_ |
| `--non-interactive` | Never prompt; fail if a required input is missing | _off_ |

Secrets are generated automatically. To pin your own, export `POSTGRES_PASSWORD`, `JWT_SECRET`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` before running (each must be ≥12 chars and not a known default).

### Day-to-day operations

```bash
./deploy/openpdf status     # service + health status
./deploy/openpdf logs       # follow timestamped logs (add a service name to filter)
./deploy/openpdf update     # git pull + rebuild/pull images + restart (secrets & data preserved)
./deploy/openpdf restart    # restart services
./deploy/openpdf down       # stop the stack (named volumes are kept)
```

### What gets exposed

Only Caddy publishes ports **80** and **443**. PostgreSQL, Redis, NATS, and MinIO stay on a private Docker network and are never published to the public interface. The firewall (ufw) defaults to deny-inbound and allows only SSH, 80, and 443.

### Services

| Service     | Exposed | Description            |
| ----------- | ------- | ---------------------- |
| Caddy       | 80/443  | Reverse proxy + HTTPS  |
| Web         | private | Next.js frontend       |
| API Gateway | private | Go REST API            |
| PDF Engine  | private | Rust PDF service        |
| PostgreSQL  | private | Database               |
| Redis       | private | Cache                  |
| NATS        | private | Event bus              |
| MinIO       | private | Object storage         |

---

## Local development

```bash
pnpm install        # install dependencies
pnpm dev            # start dev servers
docker compose up -d  # start infrastructure (dev compose at repo root)
pnpm build          # build all packages
pnpm lint           # lint
pnpm test           # test
pnpm format         # format
```

> Note: the root `docker-compose.yml` is for **local development** (it exposes datastore ports and uses default credentials). Production uses `deploy/docker-compose.prod.yml` via the installer.

## License

MIT
