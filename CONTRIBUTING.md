Refer to our contribution guide here: [Contributing](https://voltagent.dev/docs/community/contributing/)

npm run update-workspace-deps update npmjs
npm run update-workspace-deps restore

# Contributing to VoltAgent

Thank you for your interest in contributing to VoltAgent! This guide will help you get started with development, understand our processes, and make your first contribution.

## Table of Contents

- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Registry Configuration](#registry-configuration)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Publishing](#publishing)
- [Pull Request Process](#pull-request-process)
- [Code of Conduct](#code-of-conduct)

## Quick Start

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/alasano.git
   cd alasano
   ```
3. **Install dependencies:**
   ```bash
   pnpm install
   ```
4. **Set up registry configuration** (see [Registry Configuration](#registry-configuration))
5. **Start development:**
   ```bash
   pnpm dev
   ```

## Development Setup

### Prerequisites

- **Node.js**: Version 20 or higher
- **pnpm**: Version 8 or higher
- **Git**: Latest version

### Initial Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Build all packages:**

   ```bash
   pnpm build:all
   ```

3. **Run tests:**
   ```bash
   pnpm test:all
   ```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# For GitHub Packages (development)
GITHUB_TOKEN=your_github_token_here

# For npmjs.org (production)
NPM_TOKEN=your_npm_token_here

# For development
NODE_ENV=development
```

## Registry Configuration

VoltAgent supports publishing to both GitHub Packages (for development) and npmjs.org (for production). See [REGISTRY_SWITCHING.md](./REGISTRY_SWITCHING.md) for detailed information.

### For Development (GitHub Packages)

```bash
# Switch to GitHub Packages
pnpm switch-registry switch github
pnpm switch-registry update github

# Set your GitHub token
export GITHUB_TOKEN=your_github_token
```

### For Production (npmjs.org)

```bash
# Switch to npmjs.org
pnpm switch-registry switch npmjs
pnpm switch-registry update npmjs

# Set your npm token
export NPM_TOKEN=your_npm_token
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Follow the [coding standards](#coding-standards)
- Write tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run linting
pnpm lint

# Run tests
pnpm test:all

# Build packages
pnpm build:all

# Check types
pnpm attw:all
```

### 4. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: type(scope): description
git commit -m "feat(core): add new tool for web scraping"
git commit -m "fix(vercel-ai): resolve authentication issue"
git commit -m "docs(readme): update installation instructions"
```

**Commit Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode in `tsconfig.json`
- Use proper type annotations
- Prefer interfaces over types for object shapes

### Code Style

We use [Biome](https://biomejs.dev/) for code formatting and linting:

```bash
# Format code
pnpm format

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix
```

### Package Structure

Each package should follow this structure:

```
packages/package-name/
├── src/
│   ├── index.ts          # Main exports
│   ├── types.ts          # Type definitions
│   └── utils.ts          # Utility functions
├── tests/
│   └── index.test.ts     # Tests
├── package.json          # Package configuration
├── tsconfig.json         # TypeScript configuration
└── README.md             # Package documentation
```

### Package.json Requirements

Each package must include:

```json
{
  "name": "@voltagent/package-name",
  "version": "0.1.0",
  "description": "Package description",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "jest",
    "lint": "biome check ."
  }
}
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test:all

# Run tests with coverage
pnpm test:all:coverage

# Run tests for specific package
pnpm test --scope @voltagent/core
```

### Writing Tests

- Use Jest as the testing framework
- Write unit tests for all new functionality
- Aim for >80% code coverage
- Use descriptive test names

Example test:

```typescript
import { someFunction } from "../src/index";

describe("someFunction", () => {
  it("should return expected result", () => {
    const result = someFunction("input");
    expect(result).toBe("expected output");
  });

  it("should handle edge cases", () => {
    expect(() => someFunction("")).toThrow("Invalid input");
  });
});
```

## Publishing

### Development Publishing

For testing your changes:

```bash
# Switch to GitHub Packages
pnpm switch-registry switch github
pnpm switch-registry update github

# Build and publish
pnpm build:all
pnpm publish
```

### Production Publishing

For official releases:

```bash
# Switch to npmjs.org
pnpm switch-registry switch npmjs
pnpm switch-registry update npmjs

# Build and publish
pnpm build:all
pnpm publish
```

### Version Management

We use [Changesets](https://github.com/changesets/changesets) for version management:

```bash
# Create a changeset
pnpm changeset

# Version packages
pnpm version-packages

# Publish packages
pnpm changeset publish
```

## Pull Request Process

### Before Submitting

1. **Ensure all tests pass:**

   ```bash
   pnpm test:all
   ```

2. **Check code quality:**

   ```bash
   pnpm lint
   pnpm attw:all
   ```

3. **Update documentation** if needed

4. **Add changeset** if it's a user-facing change:
   ```bash
   pnpm changeset
   ```

### Pull Request Guidelines

- **Title**: Use conventional commit format
- **Description**: Explain what and why, not how
- **Checklist**: Include a checklist of completed tasks
- **Screenshots**: Add screenshots for UI changes
- **Tests**: Ensure all tests pass

Example PR description:

```markdown
## Description

Adds a new web scraping tool to the core package.

## Changes

- Add `WebScraperTool` class
- Add tests for web scraping functionality
- Update documentation

## Checklist

- [x] Tests added and passing
- [x] Documentation updated
- [x] Code follows style guidelines
- [x] Changeset added

## Related Issues

Closes #123
```

### Review Process

1. **Automated checks** must pass
2. **Code review** from maintainers
3. **Approval** from at least one maintainer
4. **Merge** by maintainers

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) to understand our community standards.

## Getting Help

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and general discussion
- **Documentation**: Check our [documentation](https://voltagent.dev/docs)
- **Discord**: Join our [Discord community](https://discord.gg/voltagent)

## Recognition

Contributors will be recognized in:

- Repository contributors list
- Release notes
- Documentation acknowledgments

Thank you for contributing to VoltAgent! 🚀
