# Docker Build & Push Script

This directory contains scripts for building and deploying the PinSquirrel application.

## docker-build-push.sh

A comprehensive script that builds the Docker image and pushes it to Docker Hub as `andrewshell/pinsquirrel`.

### Features

- ✅ **Quality Checks**: Runs TypeScript, ESLint, and tests before building
- 🐳 **Docker Validation**: Checks Docker is running and user is authenticated
- 🏷️ **Smart Tagging**: Automatically tags with version from package.json + latest
- 🎯 **Custom Tags**: Support for additional custom tags
- 🚀 **Multi-platform**: Builds and pushes `linux/amd64` + `linux/arm64` in one pass
- 📊 **Progress Feedback**: Clear, colorized output with emojis
- 🔍 **Dry Run**: Test the script without actually building/pushing

### Usage

#### Direct Script Usage

```bash
# Basic usage - build and push with version + latest tags
./scripts/docker-build-push.sh

# With custom tag
./scripts/docker-build-push.sh beta

# Skip quality checks for quick iterations
./scripts/docker-build-push.sh --skip-quality

# Dry run to see what would happen
./scripts/docker-build-push.sh --dry-run --skip-quality

# Show help
./scripts/docker-build-push.sh --help
```

#### pnpm Scripts

```bash
# Full build with quality checks
pnpm docker:build-push

# Skip quality checks
pnpm docker:build-push-skip-quality

# Dry run (shows what would happen without executing)
pnpm docker:dry-run
```

### Requirements

- Docker installed and running
- Docker Hub authentication (`docker login`)
- Node.js and pnpm installed
- Project must be run from repository root

### Output

The script creates and pushes the following tags:

- `andrewshell/pinsquirrel:<version>` (version from the root `package.json`)
- `andrewshell/pinsquirrel:latest`
- `andrewshell/pinsquirrel:custom-tag` (if provided)

The image is built for `linux/amd64` and `linux/arm64` with `docker buildx`, and
all tags are pushed as part of that build. To run what it produced:

```bash
docker run -p 8100:8100 -e DATABASE_URL=your_db_url andrewshell/pinsquirrel:latest
```

### Quality Checks

When quality checks are enabled (default), the script runs:

1. `pnpm typecheck` - TypeScript type checking
2. `pnpm lint` - ESLint code quality checks
3. `pnpm test` - Full test suite

Use `--skip-quality` flag to skip these for faster iterations during development.

### Troubleshooting

**Docker not running:**

```bash
❌ Docker is not running. Please start Docker and try again.
```

→ Start Docker Desktop or Docker daemon

**Not authenticated:**

```bash
⚠️  Not logged into Docker Hub. Attempting login...
```

→ The script will automatically prompt for Docker Hub login

**Quality checks fail:**

```bash
❌ TypeScript type checking failed
```

→ Fix the reported issues or use `--skip-quality` flag

**Wrong directory:**

```bash
❌ Please run this script from the project root directory
```

→ Run from the repository root where package.json is located
