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

# ── 4. Clean up previous installation ────────────────────────────────────────
echo ""
info "Cleaning up previous installation (if any)..."

# 4a. Uninstall global npm package
if npm ls -g @coinswitch/steer-agent &>/dev/null; then
  STEER_SKIP_POSTINSTALL=1 npm uninstall -g @coinswitch/steer-agent 2>/dev/null \
    || sudo STEER_SKIP_POSTINSTALL=1 npm uninstall -g @coinswitch/steer-agent 2>/dev/null \
    || true
  ok "Removed previous npm package"
fi

# 4b. Remove symlinks from stable dirs
for dir in /usr/local/bin "${HOME}/.local/bin"; do
  for cmd in steer-agent steer-mcp steer-hook-prompt; do
    if [[ -L "${dir}/${cmd}" ]] || [[ -f "${dir}/${cmd}" ]]; then
      rm -f "${dir}/${cmd}" 2>/dev/null || sudo rm -f "${dir}/${cmd}" 2>/dev/null || true
    fi
  done
done
ok "Removed old symlinks"

# 4c. Remove steer skills from ~/.claude/skills/
GLOBAL_SKILLS_DIR="${HOME}/.claude/skills"
if [[ -d "$GLOBAL_SKILLS_DIR" ]]; then
  for skill in "${GLOBAL_SKILLS_DIR}"/steer "${GLOBAL_SKILLS_DIR}"/steer-*; do
    [[ -e "$skill" || -L "$skill" ]] && rm -rf "$skill" 2>/dev/null || true
  done
  ok "Removed old skills"
fi

# 4d. Remove steer-agent entries from ~/.claude/settings.json
CLAUDE_SETTINGS="${HOME}/.claude/settings.json"
if [[ -f "$CLAUDE_SETTINGS" ]] && command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const p = '${CLAUDE_SETTINGS}';
    try {
      const s = JSON.parse(fs.readFileSync(p, 'utf8'));
      // Remove MCP server
      if (s.mcpServers) delete s.mcpServers['steer-agent'];
      // Remove steer hooks from UserPromptSubmit
      if (s.hooks && Array.isArray(s.hooks.UserPromptSubmit)) {
        s.hooks.UserPromptSubmit = s.hooks.UserPromptSubmit.filter(h => {
          const cmd = JSON.stringify(h);
          return !cmd.includes('prompt-submit') && !cmd.includes('steer-hook-prompt');
        });
      }
      fs.writeFileSync(p, JSON.stringify(s, null, 2));
    } catch {}
  " 2>/dev/null
  ok "Cleaned settings.json"
fi

# 4e. Uninstall Cursor/VS Code extension
for editor in cursor code; do
  if command -v "$editor" &>/dev/null; then
    "$editor" --uninstall-extension steer-agent-tool.steer-agent-tool-extension 2>/dev/null && true
  fi
done
ok "Removed old extension"

# ── 5. Install from GitHub ────────────────────────────────────────────────────
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

# Install all workspace deps
if ! npm install --workspaces 2>&1; then
  die "npm install failed. Check that Node.js ${MIN_NODE}+ is installed."
fi

# Build in dependency order: core → mcp-server + extension → cli
info "Building packages (core → mcp-server → cli)..."
if ! npm run build --workspace=packages/core 2>&1; then
  die "Build failed: packages/core"
fi

if ! npm run build --workspace=packages/mcp-server 2>&1; then
  die "Build failed: packages/mcp-server"
fi

info "Building and packaging Cursor extension..."
if ! npm run build --workspace=packages/cursor-extension 2>&1; then
  warn "Extension build failed (non-fatal — continuing without sidebar)"
else
  # Package the extension — vsce prompts interactively for missing fields,
  # so we pipe "yes" and use --allow-missing-repository to handle all cases
  VSIX_BUILT=0
  if (cd "${TMPDIR_INSTALL}/repo/packages/cursor-extension" && yes | npx vsce package --no-dependencies --allow-missing-repository 2>&1); then
    VSIX_BUILT=1
    ok "Extension packaged"
  else
    warn "Extension packaging failed (non-fatal — continuing without sidebar)"
  fi
fi

if ! npm run build --workspace=packages/cli 2>&1; then
  die "Build failed: packages/cli"
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


# ── 6. Register MCP + hooks + skills + extension ─────────────────────────────
echo ""
info "Registering MCP server, hooks, skills, and extension..."
steer-agent install 2>&1 || true

# If steer-agent install didn't find the vsix, install it directly from the build
VSIX_FILE=""
for f in "${TMPDIR_INSTALL}/repo/packages/cursor-extension/"*.vsix; do
  [[ -f "$f" ]] && VSIX_FILE="$f" && break
done

if [[ -n "$VSIX_FILE" ]]; then
  EXT_INSTALLED=0
  for editor in cursor code; do
    if command -v "$editor" &>/dev/null; then
      if "$editor" --uninstall-extension steer-agent-tool.steer-agent-tool-extension 2>/dev/null; then
        ok "Removed old extension from ${editor}"
      fi
      if "$editor" --install-extension "$VSIX_FILE" 2>/dev/null; then
        ok "Extension installed via ${editor}"
        EXT_INSTALLED=1
        break
      fi
    fi
  done
  if [[ "$EXT_INSTALLED" -eq 0 ]]; then
    warn "Extension auto-install failed. Install manually:"
    warn "  Open Cursor/VS Code → Cmd+Shift+P → 'Extensions: Install from VSIX'"
  fi
else
  warn "No .vsix file found. Extension not installed."
fi

# ── 7. Create stable symlinks so steer-agent works across nvm versions ───────
echo ""
NPM_BIN="$(npm prefix -g)/bin"
STEER_BIN="${NPM_BIN}/steer-agent"
STABLE_DIRS=("/usr/local/bin" "${HOME}/.local/bin")

if [[ -f "$STEER_BIN" ]]; then
  for dir in "${STABLE_DIRS[@]}"; do
    if [[ -d "$dir" ]] && [[ -w "$dir" ]]; then
      for cmd in steer-agent steer-mcp steer-hook-prompt; do
        src="${NPM_BIN}/${cmd}"
        dst="${dir}/${cmd}"
        [[ -f "$src" ]] && ln -sf "$src" "$dst" 2>/dev/null && true
      done
      ok "Symlinks created in ${dir} (works across nvm versions)"
      break
    elif [[ -d "$dir" ]]; then
      # Need sudo
      for cmd in steer-agent steer-mcp steer-hook-prompt; do
        src="${NPM_BIN}/${cmd}"
        [[ -f "$src" ]] && sudo ln -sf "$src" "${dir}/${cmd}" 2>/dev/null && true
      done
      ok "Symlinks created in ${dir} (via sudo, works across nvm versions)"
      break
    fi
  done
fi

# ── 8. Verify installation ────────────────────────────────────────────────────
echo ""
if command -v steer-agent &>/dev/null; then
  VERSION="$(steer-agent --version 2>/dev/null || echo 'unknown')"
  ok "steer-agent ${VERSION} is ready"
elif [[ -f "$STEER_BIN" ]]; then
  ok "steer-agent installed at: ${STEER_BIN}"
  warn "Not in PATH. Add this to your shell profile and restart:"
  warn "  export PATH=\"${NPM_BIN}:\$PATH\""
else
  warn "steer-agent not found after install."
  warn "Add npm global bin to PATH and restart your shell:"
  warn "  export PATH=\"${NPM_BIN}:\$PATH\""
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
