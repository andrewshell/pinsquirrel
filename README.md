# PinSquirrel

🐿️ **Hoard Your Links Like Nuts** - The ultimate link hoarding platform.

PinSquirrel is a modern bookmarking application that allows you to save, organize, and view your links as text lists, visual boards, reading lists, and RSS feeds. Built with React Router v7 and released under the GPL-3.0 license.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![React Router](https://img.shields.io/badge/React_Router-v7-CA4245?logo=react-router)](https://reactrouter.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 🔐 Authentication with email hashing for privacy
- 📊 SQLite database with Drizzle ORM
- ✅ Comprehensive test coverage
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Prerequisites

- Node.js 22 or higher
- Corepack (included with Node.js 16+)

### Setup

1. Enable corepack to use the exact pnpm version specified in package.json:

```bash
corepack enable
```

2. Create a `.env` file in the root directory:

```bash
DB_FILE_NAME=file:local.db
INVITE_CODE=your-secret-invite-code
```

### Installation

Install the dependencies:

```bash
pnpm install
```

> **Note**: The project uses the pnpm version specified in the `packageManager` field of package.json. Corepack will automatically use the correct version.

### Database Setup

Run database migrations to set up the schema:

```bash
pnpm drizzle-kit migrate
```

To reset the database (remove all data and recreate):

```bash
rm local.db
pnpm drizzle-kit migrate
```

### Development

Start the development server with HMR:

```bash
pnpm dev
```

Your application will be available at `http://localhost:5173`.

## Testing

Run the test suite:

```bash
pnpm test
```

Run tests with coverage:

```bash
pnpm test:coverage
```

## Code Quality

Check and fix code issues with ESLint:

```bash
pnpm lint
pnpm lint:fix
```

Format code with Prettier:

```bash
pnpm format
pnpm format:check
```

## Building for Production

Create a production build:

```bash
pnpm build
```

## Database Management

### Available Drizzle Commands

- **Run migrations**: `pnpm drizzle-kit migrate`
- **Generate new migration**: `pnpm drizzle-kit generate`
- **Push schema changes**: `pnpm drizzle-kit push`
- **Reset database**: Remove `local.db` and run `pnpm drizzle-kit migrate`

### Database Schema

The application uses SQLite with the following tables:

- **users**: Stores user accounts with hashed emails and passwords

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `pnpm build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/pinsquirrel.git`
3. Install dependencies: `pnpm install`
4. Set up your `.env` file as described above
5. Run migrations: `pnpm drizzle-kit migrate`
6. Start development: `pnpm dev`

## Code of Conduct

This project adheres to the Contributor Covenant [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Security

For security vulnerabilities, please see our [Security Policy](SECURITY.md).

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [React Router v7](https://reactrouter.com/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Database ORM by [Drizzle](https://orm.drizzle.team/)
- Styled with [TailwindCSS v4](https://tailwindcss.com/)

---

Built with ❤️ by the open source community.
