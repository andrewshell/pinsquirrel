# Contributing to PinSquirrel

Thank you for your interest in contributing to PinSquirrel! We welcome contributions from the community and are grateful for any help you can provide.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## How to Contribute

### Reporting Issues

- Check if the issue has already been reported in the [Issues](https://github.com/andrewshell/pinsquirrel/issues) section
- If not, create a new issue with a clear title and description
- Include steps to reproduce the issue if applicable
- Add relevant labels to help categorize the issue

### Suggesting Features

- Check the [Issues](https://github.com/andrewshell/pinsquirrel/issues) for existing feature requests
- Create a new issue with the "enhancement" label
- Clearly describe the feature and its benefits
- Include mockups or examples if possible

### Code Contributions

1. **Fork the Repository**

   - Fork the project to your GitHub account
   - Clone your fork locally: `git clone https://github.com/your-username/pinsquirrel.git`

2. **Set Up Development Environment**

   ```bash
   # Install dependencies
   pnpm install

   # Set up the database
   pnpm drizzle-kit generate
   pnpm drizzle-kit migrate

   # Start development server
   pnpm dev
   ```

3. **Create a Branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

4. **Make Your Changes**

   - Follow the existing code style and conventions
   - Write clear, commented code
   - Add tests for new functionality
   - Update documentation as needed

5. **Test Your Changes**

   ```bash
   # Run type checking
   pnpm typecheck

   # Run tests
   pnpm test

   # Check formatting
   pnpm format:check
   ```

6. **Commit Your Changes**

   - Write clear, descriptive commit messages
   - Follow conventional commits format: `type(scope): description`
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

7. **Push and Create Pull Request**
   - Push your branch to your fork
   - Create a pull request against the `main` branch
   - Fill out the pull request template
   - Link any related issues

### Development Guidelines

#### Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use meaningful variable and function names
- Keep functions small and focused

#### Database Changes

- Create migrations for schema changes: `pnpm drizzle-kit generate`
- Test migrations thoroughly before submitting
- Document any breaking changes

#### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Include both unit and integration tests where appropriate

#### Documentation

- Update README.md if adding new features
- Document new configuration options
- Add JSDoc comments for public APIs

## Pull Request Process

1. Ensure your PR description clearly describes the changes
2. Reference any related issues using GitHub keywords (fixes, closes)
3. Ensure all CI checks pass
4. Request review from maintainers
5. Address review feedback promptly
6. Once approved, a maintainer will merge your PR

## Questions?

If you have questions about contributing, feel free to:

- Open a discussion in the [Discussions](https://github.com/andrewshell/pinsquirrel/discussions) section
- Ask in the relevant issue thread
- Contact the maintainers

Thank you for contributing to PinSquirrel! 🐿️
