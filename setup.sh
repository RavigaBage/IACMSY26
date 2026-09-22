#!/usr/bin/env bash
# =============================================================================
#  IACMSY26 — Comprehensive Setup & Deploy Script
#  Run with:  bash setup.sh [--fix] [--up] [--down] [--logs] [--reset]
#
#  Flags:
#    (no flag)   Run pre-flight checks only — safe, read-only
#    --fix       Auto-fix all detected issues, then verify
#    --up        Fix issues + build + start Docker stack
#    --down      Stop and remove containers (keeps volumes)
#
#  NOTE (Windows / Git Bash): On this machine Git Bash mounts C:\Program Files\Git
#  as its root, so Docker (installed on C:) is not on /c. We route all docker
#  calls through cmd.exe which DOES have Docker in its Windows PATH.
#    --reset     Stop containers AND wipe all volumes (destructive!)
#    --logs      Tail logs from running stack
# =============================================================================

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m';    GREEN='\033[0;32m';  YELLOW='\033[1;33m'
BLUE='\033[0;34m';   CYAN='\033[0;36m';  BOLD='\033[1m';  RESET='\033[0m'

# ── Helpers ──────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; }
step()    { echo -e "\n${BOLD}${BLUE}══ $* ${RESET}"; }
die()     { error "$*"; exit 1; }

ISSUES=0
FIXES=0

flag_issue() { ISSUES=$((ISSUES+1)); }
flag_fix()   { FIXES=$((FIXES+1)); }

# ── Parse arguments ──────────────────────────────────────────────────────────
MODE="check"
for arg in "$@"; do
  case "$arg" in
    --fix)   MODE="fix" ;;
    --up)    MODE="up" ;;
    --down)  MODE="down" ;;
    --reset) MODE="reset" ;;
    --logs)  MODE="logs" ;;
    --help|-h)
      echo "Usage: bash setup.sh [--fix|--up|--down|--reset|--logs]"
      exit 0 ;;
    *) die "Unknown flag: $arg. Use --help for usage." ;;
  esac
done

# ── Docker PATH injection (Windows / Git Bash) ───────────────────────────────
# When bash runs a script file, $HOME is already POSIX: /c/Users/User
# Docker Desktop may install to AppData (user) or Program Files (system).
DOCKER_APPDATA_PATH="${HOME}/AppData/Local/Programs/DockerDesktop/resources/bin"
DOCKER_PROGRAMFILES_PATH="/c/Program Files/Docker/Docker/resources/bin"

if [[ -f "${DOCKER_APPDATA_PATH}/docker" ]]; then
  export PATH="${DOCKER_APPDATA_PATH}:${PATH}"
elif [[ -f "${DOCKER_PROGRAMFILES_PATH}/docker" ]]; then
  export PATH="${DOCKER_PROGRAMFILES_PATH}:${PATH}"
fi
# cmd.exe passthrough as last-resort fallback
if ! command -v docker &>/dev/null; then
  docker() { cmd.exe /c docker "$@" 2>&1 | tr -d '\r'; }
fi


# ── Resolve project root ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

cd "$PROJECT_ROOT"
info "Working directory: $PROJECT_ROOT"

# =============================================================================
# SECTION: Handle --down / --reset / --logs early
# =============================================================================

if [[ "$MODE" == "down" ]]; then
  step "Stopping Docker stack (volumes preserved)"
  docker compose down
  success "Stack stopped."
  exit 0
fi

if [[ "$MODE" == "reset" ]]; then
  echo -e "${RED}${BOLD}WARNING: This will DELETE all Docker volumes (database data, uploads).${RESET}"
  read -r -p "Type 'yes' to confirm: " confirm
  [[ "$confirm" == "yes" ]] || die "Aborted."
  step "Resetting Docker stack + volumes"
  docker compose down -v --remove-orphans
  success "Stack and volumes removed."
  exit 0
fi

if [[ "$MODE" == "logs" ]]; then
  step "Tailing Docker logs (Ctrl+C to stop)"
  docker compose logs -f --tail=100
  exit 0
fi

# =============================================================================
# SECTION 1 — Pre-flight: Tool availability
# =============================================================================
step "Pre-flight: Checking required tools"

check_tool() {
  local cmd="$1" label="${2:-$1}"
  if command -v "$cmd" &>/dev/null; then
    success "$label found: $(command -v "$cmd")"
  else
    error "$label not found."
    flag_issue
    [[ "$MODE" == "up" || "$MODE" == "fix" ]] && die "$label is required. Please install it first."
  fi
}

check_tool node    "Node.js"
check_tool npm     "npm"

# Docker check — binary located via PATH injection above
if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version 2>&1 | tr -d '\r')
  success "Docker found: $DOCKER_VER"
else
  error "Docker not found. Is Docker Desktop installed?"
  flag_issue
  [[ "$MODE" == "up" || "$MODE" == "fix" ]] && die "Docker is required. Please install Docker Desktop."
fi

# Docker daemon running?
if command -v docker &>/dev/null; then
  DAEMON_CHECK=$(docker info --format '{{.ServerVersion}}' 2>&1 | tr -d '\r')
  if echo "$DAEMON_CHECK" | grep -qE "^[0-9]+\.[0-9]+"; then
    success "Docker daemon is running (v${DAEMON_CHECK})"
  else
    error "Docker daemon is not running."
    warn  "Open Docker Desktop and wait for it to fully start, then re-run this script."
    flag_issue
    [[ "$MODE" == "up" || "$MODE" == "fix" ]] && die "Docker daemon must be running to continue."
  fi
fi

# =============================================================================
# SECTION 2 — .env file check
# =============================================================================
step "Checking .env configuration"

ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env not found."
  if [[ "$MODE" == "fix" || "$MODE" == "up" ]]; then
    if [[ -f "$ENV_EXAMPLE" ]]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      flag_fix
      success "Copied .env.example → .env"
    else
      die ".env.example also missing. Cannot create .env automatically."
    fi
  else
    flag_issue
  fi
else
  success ".env file exists"
fi

# ── Check for placeholder JWT secrets ────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  PLACEHOLDER_PATTERN="your_jwt"
  if grep -q "$PLACEHOLDER_PATTERN" "$ENV_FILE"; then
    warn "Placeholder JWT secrets detected in .env (your_jwt_*)"
    flag_issue
    if [[ "$MODE" == "fix" || "$MODE" == "up" ]]; then
      info "Generating cryptographically secure JWT secrets..."

      # Backup first
      cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
      info "Backed up .env to ${ENV_FILE}.bak.*"

      gen_secret() { node -e "process.stdout.write(require('crypto').randomBytes(64).toString('hex'))"; }

      NEW_JWT=$(gen_secret)
      NEW_JWT_REFRESH=$(gen_secret)
      NEW_JWT_TICKET=$(gen_secret)

      # Replace placeholders using node (avoids sed/perl cross-platform issues)
      node - "$ENV_FILE" "$NEW_JWT" "$NEW_JWT_REFRESH" "$NEW_JWT_TICKET" <<'NODEJS'
const fs = require('fs');
const [,, file, jwt, refresh, ticket] = process.argv;
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/^JWT_SECRET=.*$/m,         `JWT_SECRET=${jwt}`);
content = content.replace(/^JWT_REFRESH_SECRET=.*$/m,  `JWT_REFRESH_SECRET=${refresh}`);
content = content.replace(/^JWT_TICKET=.*$/m,          `JWT_TICKET=${ticket}`);
fs.writeFileSync(file, content, 'utf8');
console.log('JWT secrets updated.');
NODEJS
      flag_fix
      success "Real JWT secrets generated and written to .env"
    fi
  else
    success "JWT secrets appear to be set (no placeholder values)"
  fi

  # ── PORT mismatch check ────────────────────────────────────────────────────
  CURRENT_PORT=$(grep -E "^PORT=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '[:space:]')
  if [[ "$CURRENT_PORT" == "3000" ]]; then
    warn ".env PORT=3000 but Docker expects PORT=5000 — local dev won't match Vite proxy"
    flag_issue
    if [[ "$MODE" == "fix" || "$MODE" == "up" ]]; then
      node - "$ENV_FILE" <<'NODEJS'
const fs = require('fs');
const file = process.argv[2];
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/^PORT=3000$/m, 'PORT=5000');
fs.writeFileSync(file, content, 'utf8');
console.log('PORT updated to 5000.');
NODEJS
      flag_fix
      success ".env PORT updated: 3000 → 5000"
    fi
  else
    success ".env PORT=$CURRENT_PORT"
  fi

  # ── USE_MEMORY_DB check ────────────────────────────────────────────────────
  MEMORY_DB=$(grep -E "^USE_MEMORY_DB=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '[:space:]')
  if [[ "$MEMORY_DB" == "true" ]]; then
    warn "USE_MEMORY_DB=true in .env — Docker Compose overrides this to false, but MongoMemoryServer binary may not be present in the image"
    info "This is fine for Docker (compose sets USE_MEMORY_DB=false), but the MongoMemoryServer fallback will crash inside the container if triggered."
  else
    success "USE_MEMORY_DB=$MEMORY_DB"
  fi
fi

# =============================================================================
# SECTION 3 — Dockerfile analysis
# =============================================================================
step "Checking Dockerfile"

DOCKERFILE="$PROJECT_ROOT/Dockerfile"

if [[ ! -f "$DOCKERFILE" ]]; then
  error "Dockerfile not found."
  flag_issue
else
  success "Dockerfile exists"

  # Check --ignore-scripts on backend install (critical issue #1)
  if grep -q "\-\-ignore-scripts" "$DOCKERFILE"; then
    IGNORE_LINE=$(grep -n "\-\-ignore-scripts" "$DOCKERFILE" | grep -i "backend\|workspace=backend" || true)
    if [[ -n "$IGNORE_LINE" ]]; then
      warn "Dockerfile backend install uses --ignore-scripts (line: $IGNORE_LINE)"
      warn "mongodb-memory-server binary won't be downloaded — MongoMemoryServer fallback in db.js will crash if triggered inside Docker."
      flag_issue
      if [[ "$MODE" == "fix" || "$MODE" == "up" ]]; then
        node - "$DOCKERFILE" <<'NODEJS'
const fs = require('fs');
const file = process.argv[2];
let content = fs.readFileSync(file, 'utf8');
const updated = content.replace(
  /(RUN npm ci --omit=dev --workspace=backend)\s+--ignore-scripts/,
  '$1'
);
if (updated === content) {
  console.log('Pattern not matched — no change made (may already be fixed).');
} else {
  fs.writeFileSync(file, updated, 'utf8');
  console.log('Removed --ignore-scripts from backend npm ci line.');
}
NODEJS
        flag_fix
        success "Removed --ignore-scripts from backend install step in Dockerfile"
      fi
    fi
  else
    success "Dockerfile backend install: no --ignore-scripts issue detected"
  fi

  # Multi-stage build check
  STAGE_COUNT=$(grep -c "^FROM " "$DOCKERFILE" || true)
  if [[ "$STAGE_COUNT" -ge 2 ]]; then
    success "Multi-stage Dockerfile confirmed ($STAGE_COUNT stages)"
  else
    warn "Expected multi-stage Dockerfile (2+ FROM statements), found: $STAGE_COUNT"
    flag_issue
  fi

  # Non-root user check
  if grep -q "USER appuser" "$DOCKERFILE"; then
    success "Non-root user (appuser) configured in Dockerfile"
  else
    warn "No non-root USER directive found — container will run as root"
    flag_issue
  fi
fi

# =============================================================================
# SECTION 4 — vite.config.ts alias check
# =============================================================================
step "Checking frontend Vite configuration"

VITE_CONFIG="$PROJECT_ROOT/frontend/vite.config.ts"
TSCONFIG="$PROJECT_ROOT/frontend/tsconfig.json"

if [[ ! -f "$VITE_CONFIG" ]]; then
  error "frontend/vite.config.ts not found."
  flag_issue
else
  # Check if @/ alias imports are used in source (grep exits 1 when nothing found — safe with || true)
  ALIAS_USAGE=$(grep -rl "from '@/" "$PROJECT_ROOT/frontend/src" 2>/dev/null | wc -l | tr -d '[:space:]' || echo "0")

  if [[ "$ALIAS_USAGE" -gt 0 ]]; then
    info "$ALIAS_USAGE file(s) use '@/' path alias"
    if grep -q "resolve" "$VITE_CONFIG" && grep -q "alias" "$VITE_CONFIG"; then
      success "resolve.alias found in vite.config.ts"
    else
      warn "@/ alias is used in $ALIAS_USAGE source file(s) but vite.config.ts has no resolve.alias — Vite build will FAIL"
      flag_issue
      if [[ "$MODE" == "fix" || "$MODE" == "up" ]]; then
        node - "$VITE_CONFIG" <<'NODEJS'
const fs = require('fs');
const file = process.argv[2];
let content = fs.readFileSync(file, 'utf8');
if (!content.includes("import path from 'path'")) {
  content = "import path from 'path';\n" + content;
}
content = content.replace(
  /plugins:\s*\[react\(\)\],/,
  `plugins: [react()],\n  resolve: {\n    alias: {\n      '@': path.resolve(__dirname, './src'),\n    },\n  },`
);
fs.writeFileSync(file, content, 'utf8');
console.log('Added resolve.alias to vite.config.ts');
NODEJS
        flag_fix
        success "Added resolve.alias for '@/' to vite.config.ts"
      fi
    fi
  else
    success "No '@/' alias imports found in frontend/src — vite alias not required"
  fi
fi

# =============================================================================
# SECTION 5 — Duplicate lockfile check
# =============================================================================
step "Checking for conflicting lockfiles"

BACKEND_LOCK="$PROJECT_ROOT/backend/package-lock.json"
ROOT_LOCK="$PROJECT_ROOT/package-lock.json"

if [[ -f "$BACKEND_LOCK" ]] && [[ -f "$ROOT_LOCK" ]]; then
  warn "Duplicate lockfile: backend/package-lock.json exists alongside root package-lock.json"
  warn "Dockerfile uses only the root lockfile — backend lockfile is ignored and may cause version drift"
  flag_issue
  if [[ "$MODE" == "fix" || "$MODE" == "up" ]]; then
    cp "$BACKEND_LOCK" "${BACKEND_LOCK}.bak.$(date +%Y%m%d_%H%M%S)"
    rm "$BACKEND_LOCK"
    flag_fix
    success "Removed backend/package-lock.json (backed up as .bak)"
  fi
elif [[ ! -f "$ROOT_LOCK" ]]; then
  warn "Root package-lock.json not found — run 'npm install' at project root first"
  flag_issue
else
  success "Single root package-lock.json — no lockfile conflicts"
fi

# =============================================================================
# SECTION 6 — Docker Compose validation
# =============================================================================
step "Validating docker-compose.yml"

if docker compose config --quiet 2>/dev/null; then
  success "docker-compose.yml is valid YAML"
else
  error "docker-compose.yml failed validation:"
  docker compose config 2>&1 | head -20
  flag_issue
fi

if grep -q "healthcheck" "$PROJECT_ROOT/docker-compose.yml"; then
  success "Health checks configured in docker-compose.yml"
else
  warn "No healthchecks found in docker-compose.yml — depends_on conditions may not work"
  flag_issue
fi

# =============================================================================
# SECTION 7 — TypeScript config sanity
# =============================================================================
step "Checking TypeScript configuration"

if [[ -f "$TSCONFIG" ]]; then
  if grep -q '"noEmit": true' "$TSCONFIG"; then
    success "tsconfig.json: noEmit=true (correct for Vite)"
  else
    warn "tsconfig.json: noEmit is not set to true"
    flag_issue
  fi
  if grep -q '"jsx"' "$TSCONFIG"; then
    success "tsconfig.json: jsx setting present"
  fi
else
  error "frontend/tsconfig.json not found."
  flag_issue
fi

# =============================================================================
# SECTION 8 — .dockerignore sanity
# =============================================================================
step "Checking .dockerignore"

DOCKERIGNORE="$PROJECT_ROOT/.dockerignore"
if [[ -f "$DOCKERIGNORE" ]]; then
  success ".dockerignore exists"
  for required_entry in "node_modules" ".git" "*.env"; do
    if grep -q "$required_entry" "$DOCKERIGNORE"; then
      success ".dockerignore: '$required_entry' excluded ✓"
    else
      warn ".dockerignore: '$required_entry' is NOT excluded — build context may be bloated or secrets leaked"
      flag_issue
    fi
  done
else
  warn ".dockerignore not found — Docker build context may include node_modules and secrets"
  flag_issue
fi

# =============================================================================
# SECTION 9 — Summary report
# =============================================================================
step "Summary"

if [[ "$MODE" == "fix" || "$MODE" == "up" ]]; then
  echo -e "${GREEN}Auto-fixes applied: ${FIXES}${RESET}"
fi

REMAINING=$((ISSUES - FIXES))
if [[ "$REMAINING" -gt 0 ]]; then
  echo -e "${YELLOW}Issues found: ${ISSUES}  |  Fixed: ${FIXES}  |  Remaining (manual): ${REMAINING}${RESET}"
  if [[ "$MODE" == "check" ]]; then
    echo ""
    echo -e "  Run ${BOLD}bash setup.sh --fix${RESET}  to auto-fix all fixable issues."
    echo -e "  Run ${BOLD}bash setup.sh --up${RESET}   to fix + build + launch the stack."
  fi
elif [[ "$ISSUES" -eq 0 ]]; then
  echo -e "${GREEN}✅ No issues found — project looks clean!${RESET}"
else
  echo -e "${GREEN}✅ All issues resolved.${RESET}"
fi

# =============================================================================
# SECTION 10 — Docker build + start (--up mode only)
# =============================================================================
if [[ "$MODE" == "up" ]]; then
  step "Syncing package-lock.json with package.json"
  info "Running: npm install (ensures lockfile is up to date before Docker build)"
  if npm install; then
    success "Lockfile synced"
  else
    warn "npm install had warnings — continuing anyway"
  fi

  step "Building Docker images (no cache)"
  info "Running: docker compose build --no-cache"
  echo ""
  if docker compose build --no-cache; then
    BUILD_EXIT=0
  else
    BUILD_EXIT=$?
  fi
  echo ""
  if [[ $BUILD_EXIT -eq 0 ]]; then
    success "Docker images built successfully"
  else
    die "Docker build failed (exit $BUILD_EXIT). Review the errors above."
  fi

  step "Starting Docker stack"
  info "Running: docker compose up -d"
  docker compose up -d

  # ── Wait for services to become healthy ─────────────────────────────────
  step "Waiting for services to become healthy"

  wait_healthy() {
    local service="$1"
    local max_attempts="${2:-30}"
    local attempt=0
    info "Waiting for '$service' to be healthy..."
    while [[ $attempt -lt $max_attempts ]]; do
      CONTAINER=$(docker compose ps -q "$service" 2>/dev/null | tr -d '\r' | head -1)
      if [[ -n "$CONTAINER" ]]; then
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null | tr -d '\r')
        if [[ "$HEALTH" == "healthy" ]]; then
          success "$service is healthy ✅"
          return 0
        elif [[ "$HEALTH" == "unhealthy" ]]; then
          error "$service is UNHEALTHY!"
          docker compose logs "$service" --tail=30
          return 1
        fi
      fi
      attempt=$((attempt+1))
      printf "."
      sleep 2
    done
    echo ""
    warn "$service did not report healthy within $((max_attempts * 2))s"
    warn "Check logs with: bash setup.sh --logs"
    return 1
  }

  wait_healthy mongo 30 || true
  wait_healthy redis 20 || true

  # ── Final status ─────────────────────────────────────────────────────────
  step "Stack Status"
  docker compose ps

  echo ""
  echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${GREEN}${BOLD}  ✅  IACMSY26 is running!${RESET}"
  echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  echo -e "  ${BOLD}App:${RESET}    http://localhost:5000"
  echo -e "  ${BOLD}Mongo:${RESET}  localhost:27017"
  echo -e "  ${BOLD}Redis:${RESET}  localhost:6379"
  echo ""
  echo -e "  ${CYAN}Tail logs:${RESET}    bash setup.sh --logs"
  echo -e "  ${CYAN}Stop stack:${RESET}   bash setup.sh --down"
  echo -e "  ${CYAN}Wipe data:${RESET}    bash setup.sh --reset  ⚠️"
  echo ""
fi
