# CleanMails — Full Implementation Plan

## Overview

This document plans the complete one-command deploy system across both project folders:
- **Landing page** (`Landing page/`) — marketing site + thank-you/deploy page
- **CleanMails script** (`email-verifier-main/`) — the Go backend + React frontend + Docker infrastructure

---

## Phase 1: Thank-You / Deploy Page (Landing Page Folder)

### File: `Landing page/thank-you.html`

**Purpose:** After Dodo Payments completes, user is redirected here. This page guides them through setup with 3 clear steps + a video walkthrough.

### Page Structure

```
┌─────────────────────────────────────────────────┐
│  Nav (minimal — logo + "Back to Home" link)     │
├─────────────────────────────────────────────────┤
│                                                   │
│  Hero: "You're in! Let's deploy CleanMails."     │
│  Subtitle: "3 steps, 3 minutes, you're live."   │
│                                                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  📹 VIDEO SECTION                                │
│  Embedded video player (YouTube/Loom embed)      │
│  Title: "Watch: Full Setup Walkthrough"          │
│  ~3 min video explaining the whole flow          │
│                                                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  STEP 1: Add A Record                           │
│  ┌────────────────────────────────────────────┐ │
│  │ Instructions:                               │ │
│  │ 1. Go to your DNS provider (Cloudflare,    │ │
│  │    Namecheap, GoDaddy, etc.)               │ │
│  │ 2. Add an A record:                        │ │
│  │    Type: A                                  │ │
│  │    Name: verify (or your subdomain)         │ │
│  │    Value: [your VPS IP]                     │ │
│  │    TTL: Auto                                │ │
│  │ 3. Wait 2-5 minutes for DNS propagation    │ │
│  │                                             │ │
│  │ ⚠️ Disable Cloudflare proxy (orange cloud) │ │
│  │   — must be DNS-only (grey cloud) for SSL  │ │
│  │                                             │ │
│  │ Visual: DNS record example table            │ │
│  └────────────────────────────────────────────┘ │
│                                                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  STEP 2: Generate Install Command               │
│  ┌────────────────────────────────────────────┐ │
│  │                                             │ │
│  │  [License Key] ← pre-filled from URL param │ │
│  │  [VPS IP Address]                           │ │
│  │  [Domain / Subdomain]                       │ │
│  │  [Admin Password] (min 8 chars)             │ │
│  │                                             │ │
│  │  [Generate Command] button                  │ │
│  │                                             │ │
│  │  ┌─────────────────────────────────────┐   │ │
│  │  │ Terminal-style output:               │   │ │
│  │  │ curl -sSL https://cleanmails.online │   │ │
│  │  │ /install.sh | bash -s -- \          │   │ │
│  │  │   --key=CM-XXXX \                   │   │ │
│  │  │   --domain=verify.example.com \     │   │ │
│  │  │   --ip=164.92.xx.xx \              │   │ │
│  │  │   --password=MySecure123            │   │ │
│  │  └─────────────────────────────────────┘   │ │
│  │                                             │ │
│  │  [📋 Copy Command] button                  │ │
│  │                                             │ │
│  │  "Paste this in your VPS terminal as root" │ │
│  └────────────────────────────────────────────┘ │
│                                                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  STEP 3: Add rDNS (Reverse DNS)                 │
│  ┌────────────────────────────────────────────┐ │
│  │ Why: Mail servers check rDNS to verify     │ │
│  │ your IP matches your domain. Without it,   │ │
│  │ SMTP verification accuracy drops.          │ │
│  │                                             │ │
│  │ How:                                        │ │
│  │ 1. Go to your VPS provider's dashboard    │ │
│  │ 2. Find "Reverse DNS" or "rDNS" or "PTR" │ │
│  │ 3. Set it to your domain:                  │ │
│  │    164.92.xx.xx → verify.example.com       │ │
│  │                                             │ │
│  │ Provider-specific guides:                   │ │
│  │ • Hetzner: Server → Networking → rDNS     │ │
│  │ • DigitalOcean: Droplet → set hostname    │ │
│  │ • Contabo: VPS Control → rDNS             │ │
│  │ • Vultr: Server → Settings → Reverse DNS  │ │
│  │                                             │ │
│  │ ⏱️ Takes effect in 5-30 minutes           │ │
│  └────────────────────────────────────────────┘ │
│                                                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  SUCCESS SECTION (below steps)                   │
│  "Once the script finishes, your dashboard is   │
│   live at https://verify.example.com"            │
│                                                   │
│  Need help? hello@cleanmails.online              │
│                                                   │
├─────────────────────────────────────────────────┤
│  Footer (same as main site)                      │
└─────────────────────────────────────────────────┘
```

### Design Details

- Same font stack, colors, and tailwind config as `index.html`
- Same glass nav, same noise texture, same selection color
- Steps use numbered cards with the dark terminal style (like the 404 page)
- Input fields use same styling as the landing page pricing section
- Generated command shown in a terminal-style card (dark bg, monospace, line numbers)
- Copy button with clipboard animation (checkmark appears briefly)
- Video section uses same aspect-video container as the hero video placeholder

### URL Parameters

The page reads `?license_key=CM-XXXX` from the URL (Dodo Payments can redirect with this). If present, auto-fills the license key field.

### Client-Side Logic (JavaScript)

```
1. On page load: parse URL params, pre-fill license key if present
2. On "Generate Command":
   - Validate: IP looks like an IP (regex), domain has a dot, password >= 8 chars
   - Build command string with the inputs
   - Show in terminal card
   - Enable copy button
3. Copy button: navigator.clipboard.writeText(command)
4. No server calls — purely client-side
```

---

## Phase 2: Install Script (Script Folder)

### File: `email-verifier-main/scripts/install.sh`

This bash script runs on the user's VPS. Full flow:

```
1. Parse args: --key, --domain, --ip, --password
2. Validate inputs (non-empty, format checks)
3. Check: root user, Ubuntu/Debian, architecture (amd64/arm64)
4. Validate license: curl POST to cleanmails.online/api/validate-license
5. Install Docker CE + Docker Compose plugin (if missing)
6. Configure firewall: ufw allow 80,443,25/tcp
7. Create /opt/cleanmails/ directory
8. Generate secrets:
   - JWT_SECRET=$(openssl rand -hex 32)
   - DB_PASSWORD=$(openssl rand -hex 16)
9. Write /opt/cleanmails/.env
10. Write /opt/cleanmails/docker-compose.yml (from template)
11. Write /opt/cleanmails/Caddyfile (with user's domain)
12. docker compose pull
13. docker compose up -d
14. Wait loop: curl localhost:8080/health (max 60s)
15. Call POST localhost:8080/api/v1/internal/setup with admin password + license
16. Print summary box with URL + credentials
```

### File: `email-verifier-main/scripts/update.sh`

Called by the one-click update feature:

```
1. cd /opt/cleanmails
2. docker compose pull api worker
3. docker compose up -d api worker
4. Wait for health check
5. Print new version
```

---

## Phase 3: License Validation Proxy

### File: `email-verifier-main/cloudflare-worker/validate-license.js`

Cloudflare Worker deployed at `cleanmails.online/api/validate-license`:

```
- Accepts POST with { license_key }
- Calls Dodo Payments API with your secret Bearer token
- Returns { valid: true/false, customer_name }
- CORS headers for the landing page
- Rate limited (10 req/min per IP)
```

---

## Phase 4: Docker Infrastructure Changes (Script Folder)

### Modified: `email-verifier-main/Dockerfile`

```
Stage 1: Build React frontend (node:20-alpine)
  - cd web && npm ci && npm run build

Stage 2: Build Go binaries (golang:1.22-alpine)
  - Copy frontend dist into Go embed directory
  - Build cmd/server → /cleanmails-server
  - Build cmd/worker → /cleanmails-worker

Stage 3: Runtime (alpine:3.19)
  - Copy both binaries
  - Copy migrations/
  - Install docker-cli (for self-update capability)
```

### New: `email-verifier-main/deploy/docker-compose.prod.yml`

Production compose template with Caddy, pinned versions, Docker socket mount.

### New: `email-verifier-main/deploy/Caddyfile.template`

Simple reverse proxy with automatic HTTPS.

---

## Phase 5: Server-Side Changes (Script Folder)

### New: `internal/api/system_handler.go`

Two endpoints:
- `GET /api/v1/system/updates` — compare current version vs S3 manifest
- `POST /api/v1/system/update` — trigger docker compose pull + restart

### New: `internal/updater/checker.go`

Background goroutine that:
- Fetches `https://cleanmails.online/version.json` every 6 hours
- Caches result in memory
- Exposes via the system_handler

### Modified: `cmd/server/main.go`

Add:
- Auto-run migrations on startup (idempotent, checks schema version)
- Setup endpoint for first-boot admin creation
- Embed frontend via `embed.FS`
- Start version checker goroutine

### New: `internal/api/setup_handler.go`

`POST /api/v1/internal/setup`:
- Only works if zero users exist in DB
- Creates admin user with provided password
- Stores license key in a `system_config` table
- Returns success + access token

### New migration: `migrations/007_system_config.sql`

```sql
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Stores: license_key, installed_at, current_version, install_domain.

---

## Phase 6: Frontend Update UI (Script Folder)

### Modified: `web/src/pages/Settings.tsx`

Add an "Updates" section at the top:
- On mount: fetch `GET /api/v1/system/updates`
- If update available: show banner with version + changelog + "Update Now" button
- On click: POST to update endpoint, show spinner, then "Restarting..." message
- After ~10s: reload page (new version loaded)

### Modified: `web/src/App.tsx`

Add a small dot indicator on the Settings dock button when update is available (subtle notification).

---

## Phase 7: Version Manifest & CI (Script Folder)

### New: `deploy/version.json`

```json
{
  "latest": "1.0.0",
  "released_at": "2026-06-17T00:00:00Z",
  "changelog": "Initial release",
  "docker_tag": "1.0.0",
  "min_version": "1.0.0"
}
```

Uploaded to S3 on each release.

### New: `.github/workflows/release.yml`

Triggered on git tag push (`v*`):
1. Build Docker images (api + worker)
2. Push to Docker Hub with version tag + latest
3. Upload updated `version.json` to S3
4. Upload `install.sh` to S3

---

## Phase Execution Order

| Phase | What | Depends On | Effort |
|-------|------|-----------|--------|
| **1** | thank-you.html | Nothing — standalone page | 2 hours |
| **2** | install.sh + update.sh | Phase 4 (needs Docker image to exist) | 3 hours |
| **3** | Cloudflare Worker | Nothing — standalone | 1 hour |
| **4** | Dockerfile + docker-compose.prod | Phase 5 (needs server changes) | 2.5 hours |
| **5** | Server changes (migrations, setup, embed, updater) | Core of everything | 4 hours |
| **6** | Frontend Settings update UI | Phase 5 (needs API endpoints) | 1.5 hours |
| **7** | CI/CD pipeline + version manifest | Phase 4 (needs Dockerfile) | 1.5 hours |

### Recommended build order:
```
Phase 1 → Phase 3 → Phase 5 → Phase 4 → Phase 6 → Phase 2 → Phase 7
```

Phase 1 and 3 are independent and can be built first while the rest depends on each other.

---

## Harmony Between Folders

| Concern | Landing Page Folder | Script Folder |
|---------|-------------------|---------------|
| Design system | Tailwind + Lora + Inter + JetBrains Mono | Same fonts/colors in React frontend |
| Color palette | brand red (#dc2626), ink dark, canvas light | Same dark theme (#09090b) + red accents |
| Terminal style | Dark code cards (404.html, hero code block) | Same dark terminal style in thank-you |
| User flow | index.html → Dodo → thank-you.html → install | Script bootstraps → user sees same React UI |
| Version awareness | Landing page doesn't need it | App checks cleanmails.online/version.json |
| License | Landing page generates command with key | Script validates key, server stores it |

The user journey is seamless:
```
Landing page (buy) → Thank-you page (setup) → VPS terminal (install) → App dashboard (use)
```

Every touchpoint shares the same visual language.

---

## Open Questions (To Decide Later)

1. **Video hosting** — YouTube embed? Loom? Self-hosted on S3?
2. **Dodo redirect URL** — need to configure in Dodo dashboard to redirect to `cleanmails.online/thank-you.html?license_key=XXX`
3. **S3 bucket name + region** — for hosting install.sh, version.json, and release images
4. **AWS CLI configured** — needed on your machine to run `release.sh`

---

## Architecture (Final — S3 Only)

| Service | Purpose | Cost |
|---------|---------|------|
| **AWS S3 + CloudFront** | Hosts install.sh, version.json, Docker image tarballs | ~$1-5/month |
| **Vercel** | Hosts landing page + license validation API route | Free tier |
| **DodoPayments** | Payment + license key generation | Per-sale commission |

No Docker Hub. No Cloudflare. No GitHub Actions.

### Release flow:
```
You: ./release.sh 1.2.0 → builds images → uploads .tar.gz to S3 → updates version.json
Customer: sees "Update Available" → clicks button → downloads from S3 → restarts
```

---

## Total Effort: ~16 hours of implementation

Ready to build on your go signal.
