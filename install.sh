#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SteerAgent Global Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/apurv-6/steer-agent/main/install.sh | bash
#        bash install.sh [--ext] [--ref <branch-or-tag>]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GITHUB_REPO="apurv-6/steer-agent"
GITHUB_REF="main"
CLI_PKG_PATH="packages/cli"
MIN_NODE=18
INSTALL_EXT=0

# ── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ext)   INSTALL_EXT=1; shift ;;
    --ref)   GITHUB_REF="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────────────
bold()    { printf '\033[1m%s\033[0m\n' "$*"; }
info()    { printf '  \033[34m→\033[0m %s\n' "$*"; }
ok()      { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn()    { printf '  \033[33m⚠\033[0m  %s\n' "$*"; }
die()     { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

echo ""
bold "⚡ SteerAgent Installer"
echo "──────────────────────────────────────"

# ── 1. Check OS ───────────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Linux|Darwin) ok "OS: $OS" ;;
  *) die "Unsupported OS: $OS (only Linux and macOS are supported)" ;;
esac

# ── 2. Check Node.js ─────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  die "Node.js not found. Install Node.js >= ${MIN_NODE} from https://nodejs.org and re-run."
fi

NODE_VERSION="$(node -e 'process.stdout.write(process.versions.node)')"
NODE_MAJOR="${NODE_VERSION%%.*}"

if (( NODE_MAJOR < MIN_NODE )); then
  die "Node.js ${NODE_VERSION} is too old. Requires >= ${MIN_NODE}. Update at https://nodejs.org"
fi
ok "Node.js ${NODE_VERSION}"

# ── 3. Check npm ─────────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  die "npm not found. It should come with Node.js. Check your installation."
fi
ok "npm $(npm --version)"

# ── 4. Install from GitHub ────────────────────────────────────────────────────
echo ""
info "Installing from GitHub (${GITHUB_REPO}@${GITHUB_REF})..."

# npm supports installing a subdirectory package via gitpkg convention or
# a workaround: clone + pack. We use the direct github: specifier which
# installs the root package.json — but this is a monorepo, so we clone,
# build, and install the CLI package directly.

TMPDIR_INSTALL="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_INSTALL"' EXIT

info "Cloning repository..."
if ! git clone --depth=1 --branch "${GITHUB_REF}" "https://github.com/${GITHUB_REPO}.git" "${TMPDIR_INSTALL}/repo" 2>&1; then
  die "Failed to clone https://github.com/${GITHUB_REPO}. Check network access and that the repo is public."
fi

info "Installing dependencies and building..."
cd "${TMPDIR_INSTALL}/repo"

# Install all workspace deps and build
if ! npm install --workspaces 2>&1; then
  die "npm install failed. Check that Node.js ${MIN_NODE}+ is installed."
fi

if ! npm run build --workspaces 2>&1; then
  die "Build failed. Check the repository for errors."
fi

# Pack the CLI package and install it globally
cd "${TMPDIR_INSTALL}/repo/${CLI_PKG_PATH}"
TARBALL="$(npm pack --json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d)[0].filename)" || npm pack 2>/dev/null | tail -1)"

cd /tmp
if npm install -g "${TMPDIR_INSTALL}/repo/${CLI_PKG_PATH}/${TARBALL}" 2>&1; then
  ok "steer-agent installed from GitHub"
else
  warn "npm install -g failed. Trying with sudo..."
  if sudo npm install -g "${TMPDIR_INSTALL}/repo/${CLI_PKG_PATH}/${TARBALL}" 2>&1; then
    ok "steer-agent installed (via sudo)"
  else
    die "Installation failed. Try: sudo bash install.sh"
  fi
fi


# ── 6. VS Code / Cursor extension (optional) ─────────────────────────────────
if [[ "$INSTALL_EXT" -eq 1 ]]; then
  echo ""
  info "Installing VS Code / Cursor extension..."
  if steer-agent install --ext 2>&1; then
    ok "Extension installed"
  else
    warn "Extension install failed. Try manually:"
    warn "  steer-agent install --ext"
  fi
fi

# ── 7. Verify installation ────────────────────────────────────────────────────
echo ""
if command -v steer-agent &>/dev/null; then
  VERSION="$(steer-agent --version 2>/dev/null || echo 'unknown')"
  ok "steer-agent ${VERSION} is ready"
else
  warn "steer-agent not found in PATH after install."
  warn "Add npm global bin to PATH and restart your shell:"
  warn "  export PATH=\"\$(npm root -g)/../bin:\$PATH\""
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────"
bold "⚡ SteerAgent installed!"
echo ""
echo "Next steps:"
echo "  cd <your-project>"
echo "  steer-agent init"
echo "  Open Claude Code → /steer-start"
if [[ "$INSTALL_EXT" -eq 0 ]]; then
  echo ""
  echo "  Optional: re-run with --ext to install the Cursor sidebar"
  echo "  bash install.sh --ext"
fi
echo ""
