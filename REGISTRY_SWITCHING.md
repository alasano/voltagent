# Registry Switching Guide

This guide explains how to switch between GitHub Packages (for development/forks) and npmjs.org (for production) in the VoltAgent monorepo.

## Overview

- **GitHub Packages**: Used for development, testing, and forks
- **npmjs.org**: Used for production releases

## Quick Commands

### Switch to GitHub Packages (Development)

```bash
# Switch registry configuration
node scripts/switch-registry.js switch github

# Update all package.json files for GitHub
node scripts/switch-registry.js update github

# Or use the npm script
pnpm switch-registry switch github
```

### Switch to npmjs.org (Production)

```bash
# Switch registry configuration
node scripts/switch-registry.js switch npmjs

# Update all package.json files for npmjs
node scripts/switch-registry.js update npmjs

# Or use the npm script
pnpm switch-registry switch npmjs
```

## Configuration Files

### Registry-Specific .npmrc Files

- **`.npmrc.github`**: Configuration for GitHub Packages
- **`.npmrc.npmjs`**: Configuration for npmjs.org
- **`.npmrc`**: Active configuration (copied from one of the above)

### Package Configuration

Each package's `package.json` is updated with:

- `publishConfig.registry`: Target registry URL
- `repository.url`: Repository URL (different for each registry)

## Authentication

### GitHub Packages

- **Token**: `GITHUB_TOKEN` environment variable
- **Scopes**: `read:packages`, `write:packages`
- **Local Setup**: Create `~/.npmrc` with your Personal Access Token

### npmjs.org

- **Token**: `NPM_TOKEN` environment variable
- **Scopes**: Standard npm publishing permissions
- **Local Setup**: Use `npm login` or set `NPM_TOKEN`

## GitHub Actions Workflows

### Production Release (npmjs.org)

- **File**: `.github/workflows/release.yml`
- **Trigger**: Push to `main` branch
- **Registry**: npmjs.org
- **Token**: `NPM_TOKEN`

### Development Release (GitHub Packages)

- **File**: `.github/workflows/release-github.yml`
- **Trigger**: Push to `main` branch with package changes
- **Registry**: GitHub Packages
- **Token**: `GITHUB_TOKEN`

## Development Workflow

### For Development/Testing

1. Switch to GitHub Packages:

   ```bash
   node scripts/switch-registry.js switch github
   node scripts/switch-registry.js update github
   ```

2. Set your GitHub token:

   ```bash
   export GITHUB_TOKEN=your_github_token
   ```

3. Build and publish:
   ```bash
   pnpm build:all
   pnpm publish
   ```

### For Production Release

1. Switch to npmjs.org:

   ```bash
   node scripts/switch-registry.js switch npmjs
   node scripts/switch-registry.js update npmjs
   ```

2. Set your npm token:

   ```bash
   export NPM_TOKEN=your_npm_token
   ```

3. Build and publish:
   ```bash
   pnpm build:all
   pnpm publish
   ```

## Package URLs

### GitHub Packages

- **Registry**: `https://npm.pkg.github.com`
- **Repository**: `https://github.com/myrrakh/alasano.git`
- **Package URLs**: `https://github.com/myrrakh/alasano/packages`

### npmjs.org

- **Registry**: `https://registry.npmjs.org/`
- **Repository**: `https://github.com/voltagent/voltagent.git`
- **Package URLs**: `https://www.npmjs.com/package/@voltagent/core`

## Environment Variables

### Required for GitHub Packages

```bash
export GITHUB_TOKEN=ghp_your_github_token_here
```

### Required for npmjs.org

```bash
export NPM_TOKEN=npm_your_npm_token_here
```

## Troubleshooting

### Authentication Issues

- Ensure tokens have correct scopes
- Check token expiration
- Verify `.npmrc` configuration

### Publishing Issues

- Ensure you're on the correct registry
- Check package names and versions
- Verify repository URLs

### Installation Issues

- Update consuming project's `.npmrc`
- Check package visibility (public/private)
- Verify registry configuration

## Script Usage

```bash
# Show help
node scripts/switch-registry.js

# Switch registry configuration
node scripts/switch-registry.js switch <registry>

# Update package configurations
node scripts/switch-registry.js update <registry>

# Available registries: github, npmjs
```

## Best Practices

1. **Always switch before publishing**: Use the switch script to ensure correct configuration
2. **Test locally first**: Publish to development registry before production
3. **Use different versions**: Consider using pre-release versions for development
4. **Check permissions**: Ensure tokens have correct scopes for the target registry
5. **Verify configuration**: Double-check registry URLs and repository links
