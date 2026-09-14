#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="ivoryheart.herdr-world"
REPO="lion-lucaschang/herdr-world"
REF="${HERDR_WORLD_REF:-v0.1.1-lucas.2}"
MIN_HERDR_VERSION="0.9.0"
MIN_NODE_VERSION="22.14.0"
MIN_RUST_VERSION="1.88.0"
REQUIRED_PROTOCOL="22"
CARGO_WRAPPER=""

cleanup() {
  if [[ -n "$CARGO_WRAPPER" ]]; then
    rm -f "$CARGO_WRAPPER"
  fi
}
trap cleanup EXIT

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

version_ge() {
  local current="${1#v}"
  local minimum="${2#v}"
  local current_core minimum_core current_major current_minor current_patch minimum_major minimum_minor minimum_patch
  current_core="${current%%[-+]*}"
  minimum_core="${minimum%%[-+]*}"
  IFS=. read -r current_major current_minor current_patch _ <<< "$current_core"
  IFS=. read -r minimum_major minimum_minor minimum_patch _ <<< "$minimum_core"
  current_major="${current_major:-0}"
  current_minor="${current_minor:-0}"
  current_patch="${current_patch:-0}"
  minimum_major="${minimum_major:-0}"
  minimum_minor="${minimum_minor:-0}"
  minimum_patch="${minimum_patch:-0}"
  [[ "$current_major" =~ ^[0-9]+$ && "$current_minor" =~ ^[0-9]+$ && "$current_patch" =~ ^[0-9]+$ ]] || return 1
  [[ "$minimum_major" =~ ^[0-9]+$ && "$minimum_minor" =~ ^[0-9]+$ && "$minimum_patch" =~ ^[0-9]+$ ]] || return 1
  (( current_major > minimum_major )) ||
    (( current_major == minimum_major && current_minor > minimum_minor )) ||
    (( current_major == minimum_major && current_minor == minimum_minor && current_patch >= minimum_patch ))
}

command -v herdr >/dev/null || fail "herdr is required"
command -v node >/dev/null || fail "Node.js ${MIN_NODE_VERSION} or newer is required"
command -v npm >/dev/null || fail "npm is required"

node_version="$(node --version | sed 's/^v//')"
version_ge "$node_version" "$MIN_NODE_VERSION" || fail "Node.js ${MIN_NODE_VERSION} or newer is required; found ${node_version}"

herdr_status="$(herdr status 2>/dev/null || true)"
if [[ -z "$herdr_status" ]]; then
  fail "Herdr must be running before installing this plugin; start Herdr ${MIN_HERDR_VERSION} first"
fi
herdr_version="$(printf '%s\n' "$herdr_status" | awk '/server:/{server=1; next} server && /^[[:space:]]*version:/{print $2; exit}')"
herdr_protocol="$(printf '%s\n' "$herdr_status" | awk '/server:/{server=1; next} server && /^[[:space:]]*(private_protocol|protocol):/{print $2; exit}')"
version_ge "$herdr_version" "$MIN_HERDR_VERSION" || fail "Herdr ${MIN_HERDR_VERSION} or newer is required; server reports ${herdr_version:-unknown}"
[[ "$herdr_protocol" == "$REQUIRED_PROTOCOL" ]] || fail "Herdr terminal protocol ${REQUIRED_PROTOCOL} is required; server reports ${herdr_protocol:-unknown}"

select_cargo() {
  if [[ -n "${HERDR_WORLD_CARGO_PATH:-}" ]]; then
    [[ -x "$HERDR_WORLD_CARGO_PATH" ]] || fail "HERDR_WORLD_CARGO_PATH is not executable: $HERDR_WORLD_CARGO_PATH"
    printf '%s\n' "$HERDR_WORLD_CARGO_PATH"
    return 0
  fi
  command -v cargo >/dev/null || fail "Rust cargo ${MIN_RUST_VERSION} or newer is required"
  local rust_version
  rust_version="$(rustc --version 2>/dev/null | awk '{print $2}' || true)"
  if version_ge "$rust_version" "$MIN_RUST_VERSION"; then
    command -v cargo
    return 0
  fi
  if command -v rustup >/dev/null; then
    while IFS= read -r toolchain; do
      toolchain="${toolchain%% *}"
      [[ "$toolchain" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]] || continue
      local candidate_version
      candidate_version="$(rustc +"$toolchain" --version 2>/dev/null | awk '{print $2}' || true)"
      if version_ge "$candidate_version" "$MIN_RUST_VERSION"; then
        CARGO_WRAPPER="$(mktemp "${TMPDIR:-/tmp}/herdr-world-cargo.XXXXXX")"
        cat > "$CARGO_WRAPPER" <<SH
#!/bin/sh
exec "$(command -v cargo)" +$toolchain "\$@"
SH
        chmod +x "$CARGO_WRAPPER"
        printf '%s\n' "$CARGO_WRAPPER"
        return 0
      fi
    done < <(rustup toolchain list 2>/dev/null || true)
  fi
  fail "Rust ${MIN_RUST_VERSION} or newer is required; found ${rust_version:-unknown}. Run: rustup update stable"
}

cargo_path="$(select_cargo)"

echo "Installing ${PLUGIN_ID} from ${REPO}@${REF}"
echo "Using Herdr ${herdr_version}, protocol ${herdr_protocol}"
echo "Using Node.js ${node_version} ($(command -v node))"
echo "Using cargo: ${cargo_path}"

herdr plugin action invoke stop --plugin "$PLUGIN_ID" || true
herdr plugin uninstall "$PLUGIN_ID" || true
HERDR_WORLD_CARGO_PATH="$cargo_path" herdr plugin install "$REPO" --ref "$REF" --yes
herdr plugin action invoke start --plugin "$PLUGIN_ID"
sleep 2
herdr plugin action invoke doctor --plugin "$PLUGIN_ID"

echo
echo "Herdr World install requested. Check status with:"
echo "  herdr plugin action invoke status --plugin ${PLUGIN_ID}"
echo "Open: http://127.0.0.1:8787"
