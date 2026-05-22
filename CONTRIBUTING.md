# Contributing to Inheribase

Thank you for your interest in contributing to Inheribase! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/USERNAME/inheribase/issues)
2. If not, create a new issue using the Bug Report template
3. Provide detailed information including:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (browser, OS)
   - Console errors or screenshots

### Suggesting Features

1. Check if the feature has already been requested in [Issues](https://github.com/USERNAME/inheribase/issues)
2. If not, create a new issue using the Feature Request template
3. Clearly describe:
   - The problem the feature solves
   - Your proposed solution
   - Use cases and examples

### Contributing Code

#### Prerequisites

- Node.js 18 or higher
- pnpm 10+
- Git
- Basic knowledge of Next.js, TypeScript, and React

#### Setup Development Environment

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/inheribase.git
cd inheribase

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
pnpm dev
```

#### Development Workflow

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

3. **Test your changes**:

   ```bash
   # Run linter
   pnpm lint

   # Run type checking
   pnpm build

   # Test manually in browser
   pnpm dev
   ```

4. **Commit your changes**:

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `refactor:` for code refactoring
   - `test:` for test additions/updates
   - `chore:` for maintenance tasks

5. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**:
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template
   - Submit for review

#### Code Style Guidelines

- **TypeScript**: Use strict typing, avoid `any` when possible
- **React**: Use functional components with hooks
- **Naming**:
  - Components: PascalCase (`VaultStatusBadge`)
  - Functions: camelCase (`connectWallet`)
  - Constants: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- **Imports**: Use absolute imports with `@/` prefix
- **Comments**: Add JSDoc comments for public functions
- **Formatting**: Run `pnpm format` before committing

#### Testing Guidelines

- Test wallet connection and disconnection
- Test encryption/decryption flows
- Test error handling and edge cases
- Test on multiple browsers (Chrome, Firefox, Safari)
- Verify no console errors or warnings

### Documentation

When contributing, please update relevant documentation:

- **README.md**: For setup or usage changes
- **docs/**: For technical documentation
- **Code comments**: For complex logic
- **Type definitions**: Keep TypeScript interfaces up to date

## Project Structure & Technology

See `AGENTS.md` for the full project structure, technology stack, and available commands.

## Privacy and Security

Inheribase prioritizes privacy and security. When contributing:

- **Never** transmit plaintext media or encryption keys
- **Always** perform encryption/decryption client-side
- **Ensure** sensitive data is cleared from memory
- **Verify** timestamp enforcement is maintained
- **Test** security features thoroughly

## Review Process

1. Maintainers will review your PR
2. Feedback may be provided for improvements
3. Make requested changes and push updates
4. Once approved, your PR will be merged
5. Your contribution will be credited

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/USERNAME/inheribase/discussions)
- **Issues**: Check existing [Issues](https://github.com/USERNAME/inheribase/issues)
- **Documentation**: See `apps/docs/` for the docs site, `AGENTS.md` for dev reference

## Recognition

Contributors will be recognized in:

- GitHub contributors list
- Release notes (for significant contributions)
- README acknowledgments section

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Your contributions help make Inheribase better for everyone. We appreciate your time and effort!
