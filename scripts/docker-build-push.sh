#!/usr/bin/env bash
set -euo pipefail

readonly IMAGE="ghcr.io/andrewshell/pinsquirrel"
readonly REGISTRY="ghcr.io"
readonly PLATFORMS="linux/amd64,linux/arm64"
readonly BUILDER="multiplatform"
readonly DOCKERFILE="apps/hono/Dockerfile"
readonly VERSION_FILE="package.json"
readonly GATE="quality"

log() {
  printf '\033[1m==> %s\033[0m\n' "$*"
}

fail() {
  printf '\033[31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: scripts/docker-build-push.sh [--dry-run] [--check-only | --skip-gates] [CUSTOM_TAG]

Build ${IMAGE} for ${PLATFORMS} and push it tagged with the version in
${VERSION_FILE}, latest, and CUSTOM_TAG when one is given.

Options:
  --dry-run     Print what would be built and pushed without doing any of it
  --check-only  Run the preflight checks and nothing else
  --skip-gates  Build and push without running the quality gate. Warning: it
                assumes the quality gate just passed on this commit. Use it
                to finish a release whose gate already ran, as
                scripts/release.ts does
  -h, --help    Show this help

A normal release pushes the image with pnpm release.

Run it from the repository root, after merging the release pull request and
pulling main.
EOF
}

dry_run=false
custom_tag=""
mode=full

set_mode() {
  if [[ "$mode" != full && "$mode" != "$1" ]]; then
    fail "--check-only and --skip-gates cannot be used together"
  fi
  mode="$1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --dry-run)
      dry_run=true
      ;;
    --check-only)
      set_mode check-only
      ;;
    --skip-gates)
      set_mode skip-gates
      ;;
    # pnpm passes the -- in `pnpm docker:build-push -- --skip-gates` through.
    --) ;;
    -*)
      usage >&2
      fail "unknown option: $1"
      ;;
    *)
      [[ -z "$custom_tag" ]] || fail "only one custom tag may be given (got '$custom_tag' and '$1')"
      custom_tag="$1"
      ;;
  esac
  shift
done

if [[ -n "$custom_tag" && ! "$custom_tag" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
  fail "'${custom_tag}' is not a valid tag; use letters, digits, '_', '.' and '-'"
fi

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
if [[ "$(pwd -P)" != "$root" || ! -f "$DOCKERFILE" || ! -f "$VERSION_FILE" ]]; then
  fail "run this from the repository root (${root}), for example with pnpm docker:build-push"
fi

read_version() {
  node -p "require('./${VERSION_FILE}').version"
}

main() {
  local version tag
  version="$(read_version)"

  local tags=("${IMAGE}:${version}" "${IMAGE}:latest")
  [[ -z "$custom_tag" ]] || tags+=("${IMAGE}:${custom_tag}")

  if [[ "$dry_run" == true ]]; then
    log "Dry run: nothing will be built or pushed"
    echo "Image:     ${IMAGE}"
    echo "Version:   ${version} (from ${VERSION_FILE})"
    echo "Platforms: ${PLATFORMS}"
    case "$mode" in
      check-only)
        echo "Would run the preflight checks only: no quality gate, nothing built or pushed"
        return 0
        ;;
      skip-gates) echo "Would skip the quality gate (--skip-gates)" ;;
      full) echo "Would run the quality gate: pnpm ${GATE}" ;;
    esac
    echo "Would build and push:"
    for tag in "${tags[@]}"; do
      echo "  ${tag}"
    done
    return 0
  fi

  check_docker
  check_login
  case "$mode" in
    check-only)
      log "Preflight checks passed: ready to build and push:"
      for tag in "${tags[@]}"; do
        echo "  ${tag}"
      done
      return 0
      ;;
    skip-gates) log "Skipping the quality gate (--skip-gates)" ;;
    full)
      log "Quality gate: pnpm ${GATE}"
      pnpm "$GATE" || fail "quality gate 'pnpm ${GATE}' failed; nothing was built or pushed"
      ;;
  esac
  build_and_push "${tags[@]}"

  log "Pushed ${IMAGE} for ${PLATFORMS}:"
  for tag in "${tags[@]}"; do
    echo "  ${tag}"
  done
  echo "Confirm both platforms are in the manifest list with:"
  echo "  docker buildx imagetools inspect ${IMAGE}:${version}"
}

check_docker() {
  log "Checking Docker is running"
  docker info >/dev/null 2>&1 || fail "Docker is not running; start it and try again"
}

# `docker login` writes the registry under "auths" in the docker config, even
# when a credential helper holds the secret itself.
check_login() {
  log "Checking ${REGISTRY} login"
  local config="${DOCKER_CONFIG:-$HOME/.docker}/config.json"
  if ! grep -q "\"${REGISTRY}\"" "$config" 2>/dev/null; then
    echo "Not logged in to ${REGISTRY}; running docker login ${REGISTRY}"
    echo "(use a GitHub personal access token with write:packages as the password)"
    docker login "$REGISTRY" || fail "could not log in to ${REGISTRY}; run 'docker login ${REGISTRY}' and try again"
  fi
}

# The default docker driver cannot build and push multi-platform images
# without the containerd image store.
build_and_push() {
  if docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
    log "Using buildx builder ${BUILDER}"
  else
    log "Creating buildx builder ${BUILDER}"
    docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
  fi

  local args=() tag
  for tag in "$@"; do
    args+=(--tag "$tag")
  done

  log "Building and pushing ${PLATFORMS}"
  docker buildx build \
    --builder "$BUILDER" \
    --platform "$PLATFORMS" \
    --file "$DOCKERFILE" \
    --pull \
    --no-cache \
    "${args[@]}" \
    --push \
    . || fail "docker buildx build failed"
}

main
