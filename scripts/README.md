# Scripts

- `release.ts` pushes the image for a release. The `publish` job runs it when a release pull
  request merges.
- `docker-build-push.sh` builds and pushes the image on its own.
- `mysql-init/` sets up the development database container.

[Publishing a release](../DEPLOYMENT.md#publishing-a-release) in DEPLOYMENT.md explains how to
use them.
