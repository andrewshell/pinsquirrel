#!/bin/bash

# Docker Build and Push Script for PinSquirrel
# Builds and pushes the Docker image to andrewshell/pinsquirrel on Docker Hub

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_REPO="andrewshell/pinsquirrel"
DOCKERFILE_PATH="apps/web/Dockerfile"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Parse command line arguments
SKIP_QUALITY=false
CUSTOM_TAG=""
DRY_RUN=false

# Check for help first
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage() {
        echo "Usage: $0 [OPTIONS] [CUSTOM_TAG]"
        echo ""
        echo "Options:"
        echo "  --skip-quality    Skip quality checks (typecheck, lint, test)"
        echo "  --dry-run         Show what would be done without executing"
        echo "  -h, --help        Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                        # Build and push with version + latest tags"
        echo "  $0 beta                   # Build and push with version + latest + beta tags"
        echo "  $0 --skip-quality         # Build and push without running quality checks"
        echo "  $0 --skip-quality v1.2.3  # Build and push with custom tag, skip quality checks"
        echo ""
    }
    show_usage
    exit 0
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-quality)
            SKIP_QUALITY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            CUSTOM_TAG="$1"
            shift
            ;;
    esac
done

# Function to check if Docker is running
check_docker() {
    log_info "Checking if Docker is running..."
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    log_success "Docker is running"
}

# Function to check Docker Hub login
check_docker_login() {
    log_info "Checking Docker Hub authentication..."
    if ! docker info | grep -q "Username:"; then
        log_warning "Not logged into Docker Hub. Attempting login..."
        if ! docker login; then
            log_error "Failed to login to Docker Hub. Please run 'docker login' manually."
            exit 1
        fi
    fi
    log_success "Docker Hub authentication verified"
}

# Function to run quality checks
run_quality_checks() {
    if [ "$SKIP_QUALITY" = true ]; then
        log_warning "Skipping quality checks as requested"
        return 0
    fi

    log_info "Running quality checks..."
    
    log_info "Running TypeScript type checking..."
    if ! pnpm typecheck; then
        log_error "TypeScript type checking failed"
        exit 1
    fi
    
    log_info "Running ESLint..."
    if ! pnpm lint; then
        log_error "ESLint checks failed"
        exit 1
    fi
    
    log_info "Running tests..."
    if ! pnpm test; then
        log_error "Tests failed"
        exit 1
    fi
    
    log_success "All quality checks passed"
}

# Function to get version from package.json
get_version() {
    node -p "require('./package.json').version"
}

# Function to build Docker image
build_image() {
    local version=$(get_version)
    
    log_info "Building Docker image..."
    log_info "Version: $version"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would build image with tag: ${DOCKER_REPO}:${version}"
        log_info "[DRY RUN] Would tag as latest: ${DOCKER_REPO}:latest"
        if [ -n "$CUSTOM_TAG" ]; then
            log_info "[DRY RUN] Would tag with custom tag: ${DOCKER_REPO}:${CUSTOM_TAG}"
        fi
        log_success "[DRY RUN] Docker image build simulation completed"
        return 0
    fi
    
    # Build image with version tag
    log_info "Building image with tag: ${DOCKER_REPO}:${version}"
    if ! docker build -f "$DOCKERFILE_PATH" -t "${DOCKER_REPO}:${version}" .; then
        log_error "Docker build failed"
        exit 1
    fi
    
    # Tag as latest
    log_info "Tagging as latest..."
    docker tag "${DOCKER_REPO}:${version}" "${DOCKER_REPO}:latest"
    
    # Tag with custom tag if provided
    if [ -n "$CUSTOM_TAG" ]; then
        log_info "Tagging with custom tag: ${CUSTOM_TAG}"
        docker tag "${DOCKER_REPO}:${version}" "${DOCKER_REPO}:${CUSTOM_TAG}"
    fi
    
    log_success "Docker image built successfully"
}

# Function to push Docker image
push_image() {
    local version=$(get_version)
    
    log_info "Pushing Docker image to Docker Hub..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would push ${DOCKER_REPO}:${version}"
        log_info "[DRY RUN] Would push ${DOCKER_REPO}:latest"
        if [ -n "$CUSTOM_TAG" ]; then
            log_info "[DRY RUN] Would push ${DOCKER_REPO}:${CUSTOM_TAG}"
        fi
        log_success "[DRY RUN] All tags push simulation completed"
        return 0
    fi
    
    # Push version tag
    log_info "Pushing ${DOCKER_REPO}:${version}..."
    if ! docker push "${DOCKER_REPO}:${version}"; then
        log_error "Failed to push version tag"
        exit 1
    fi
    
    # Push latest tag
    log_info "Pushing ${DOCKER_REPO}:latest..."
    if ! docker push "${DOCKER_REPO}:latest"; then
        log_error "Failed to push latest tag"
        exit 1
    fi
    
    # Push custom tag if provided
    if [ -n "$CUSTOM_TAG" ]; then
        log_info "Pushing ${DOCKER_REPO}:${CUSTOM_TAG}..."
        if ! docker push "${DOCKER_REPO}:${CUSTOM_TAG}"; then
            log_error "Failed to push custom tag"
            exit 1
        fi
    fi
    
    log_success "All tags pushed successfully"
}


# Function to display image info
show_image_info() {
    local version=$(get_version)
    
    echo ""
    log_success "🐳 Docker image build and push completed!"
    echo ""
    echo "📦 Image Repository: ${DOCKER_REPO}"
    echo "🏷️  Tags pushed:"
    echo "   • ${DOCKER_REPO}:${version}"
    echo "   • ${DOCKER_REPO}:latest"
    if [ -n "$CUSTOM_TAG" ]; then
        echo "   • ${DOCKER_REPO}:${CUSTOM_TAG}"
    fi
    echo ""
    echo "🚀 To run the image:"
    echo "   docker run -p 3000:3000 -e DATABASE_URL=your_db_url ${DOCKER_REPO}:latest"
    echo ""
}

# Main execution
main() {
    echo "🐳 PinSquirrel Docker Build & Push Script"
    echo "========================================"
    echo ""
    
    
    # Verify we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "$DOCKERFILE_PATH" ]; then
        log_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Run all checks and build steps
    check_docker
    check_docker_login
    run_quality_checks
    build_image
    push_image
    show_image_info
}

# Run main function with all arguments
main "$@"