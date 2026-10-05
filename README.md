# EditingPDF

<p align="center">
  <strong>A high-performance, browser-based PDF editor with a Figma-like canvas experience.</strong>
  <br />
  <span>Live at <a href="https://editingpdf.in">editingpdf.in</a></span>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Zustand-443E38?style=for-the-badge&logo=react&logoColor=white" alt="Zustand" />
  <img src="https://img.shields.io/badge/Bun_1.4.2-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Caddy-1F88C0?style=for-the-badge&logo=caddy&logoColor=white" alt="Caddy" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
</p>

---

## ⚡ Overview

EditingPDF brings modern collaborative canvas editing tools to PDF documents. Edit, annotate, transform, and arrange pages with low-latency rendering and pixel-perfect precision.

### Key Features
- **Figma-like Canvas**: Infinite panning, zooming, spatial indexing, and drag-and-drop layer management.
- **Ultra-Fast Client-Side Engine**: Browser-based PDF rendering via PDF.js and canvas scene graph.
- **1GB VPS Ready**: Highly optimized, lightweight Docker container that builds in ~30 seconds with Bun 1.4.2 (<500MB memory).
- **Zero-Config 1-Click Deploy**: Automated installer on port 5000 with optional automatic Let's Encrypt TLS via Caddy.

---

## 🏗️ Architecture

The repository is organized as a lightweight monorepo:

```
editingpdf/
├── apps/
│   └── web/           # Next.js 15 frontend with canvas-based editor (React 18, Zustand)
│
├── packages/
│   ├── editor-core/   # Scene graph, spatial index (RBush), command manager, undo/redo
│   ├── ui/            # Reusable design system & UI components
│   └── types/         # Shared TypeScript interfaces & models
│
└── deploy/            # 1-click Linux VPS installer, Caddy reverse proxy & lightweight Compose stack
```

---

## 🚀 1-Click Instant Deploy (`install.sh`)

Deploy the entire production stack onto any fresh **Ubuntu 22.04 / 24.04** or **Debian 12** VPS with a single command without any mandatory parameters.

### Instant Command (Zero Parameters)

```bash
git clone https://github.com/rajeshc-git/editingpdf.git
cd editingpdf
sudo ./deploy/install.sh
```

### What happens automatically:
1. **OS & Runtime Check**: Verifies Debian/Ubuntu and automatically installs Docker Engine + Compose plugin if not present.
2. **Interactive Configuration**: Prompts for your domain & ACME email for automatic HTTPS, or press Enter for immediate HTTP-only mode on **port 5000** (`http://<server-ip>:5000`).
3. **Automated Security & Secrets**: Generates cryptographically secure 256-bit secrets for JWT and internal services.
4. **Firewall Protection**: Configures UFW to block external access while keeping SSH (`22`) and web traffic open.
5. **Reverse Proxy & TLS**: Automatically manages Caddy reverse proxy.
6. **Container Launch**: Builds and starts all microservices with healthchecks.

---

### Optional Deploy Flags

Pass flags to customize the deployment or run non-interactively:

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--domain <fqdn>` | Public domain for auto-HTTPS (e.g., `editingpdf.in`) | _Empty (HTTP on port 5000)_ |
| `--email <addr>` | ACME contact email for Let's Encrypt certificates | _Required with `--domain`_ |
| `--http-port <port>` | Port Caddy listens on for HTTP-only / proxy mode | `5000` |
| `--ssh-port <port>` | SSH port kept open in the firewall | `22` |
| `--with-data` | Also enable datastores (PostgreSQL, Redis, NATS, MinIO) | `false` (Lean mode) |
| `--no-firewall` | Skip automatic UFW firewall configuration | `false` |
| `--non-interactive` | Run without interactive prompts | `false` |

#### Example: Automated HTTPS Deployment

```bash
sudo ./deploy/install.sh --domain editingpdf.in --email admin@editingpdf.in
```

#### Example: Non-Interactive HTTP Deployment

```bash
sudo ./deploy/install.sh --non-interactive
```

---

## 🛠️ Management CLI (`./deploy/openpdf`)

Use the included helper script to manage your production instance:

```bash
./deploy/openpdf status     # Check container and health status
./deploy/openpdf logs       # Stream live timestamped logs (or filter: ./deploy/openpdf logs web)
./deploy/openpdf update     # Git pull + rebuild images + zero-downtime service restart
./deploy/openpdf restart    # Restart all running services
./deploy/openpdf down       # Gracefully stop the stack (persisting data volumes)
```

---

## 💻 Local Development

Run the development environment locally:

```bash
# 1. Install all dependencies
bun install

# 2. Start development server with hot-reloading
bun run dev
```

### Development Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` | Start Next.js canvas editor in dev mode |
| `bun run build` | Build all packages and applications |
| `bun run test` | Run test suites across the workspace |
| `bun run lint` | Run ESLint across all projects |
| `bun run format` | Format code using Prettier |

---

## 🔒 Security & Networking

- **Exposed Ports**: Only port `5000` (or `80`/`443` for domain HTTPS) is exposed.
- **Internal Network**: Web application runs in an isolated Docker container routed by Caddy.
- **Firewall**: UFW defaults to deny inbound traffic except for SSH and web traffic.

---

## 📄 License

This project is licensed under the MIT License.
