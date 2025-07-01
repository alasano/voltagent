# GitHub Packages Deployment

This document explains how to deploy VoltAgent packages to your private GitHub Packages registry.

## Configuration

### 1. Authentication

You need to authenticate with GitHub Packages using a Personal Access Token (classic) with the following scopes:

- `read:packages` - to download packages
- `write:packages` - to publish packages
- `delete:packages` - to delete packages (optional)

### 2. Environment Setup

#### Local Development

Create a `.npmrc` file in your home directory (`~/.npmrc`):

```
@voltagent:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_PERSONAL_ACCESS_TOKEN
```

#### GitHub Actions

The workflow automatically uses `GITHUB_TOKEN` for authentication.

### 3. Package Configuration

All packages in this monorepo are configured to publish to GitHub Packages:

- Root `.npmrc` file configures the registry for `@voltagent` scope
- Each package has `publishConfig.registry` set to `https://npm.pkg.github.com`
- Each package has `repository` field pointing to this GitHub repository

## Publishing

### Manual Publishing

1. **Build all packages:**

   ```bash
   pnpm build:all
   ```

2. **Update package configurations (if needed):**

   ```bash
   pnpm update-package-configs
   ```

3. **Publish using Lerna:**
   ```bash
   pnpm publish
   ```

### Automated Publishing

The GitHub Actions workflow automatically publishes packages when:

- Changes are pushed to the `main` branch
- Changesets are created and merged

## Installing Packages

### From GitHub Packages

To install packages from this registry, add to your project's `.npmrc`:

```
@voltagent:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Package Usage

Install packages using their scoped names:

```bash
npm install @voltagent/core
npm install @voltagent/vercel-ai
npm install @voltagent/xsai
```

## Package Visibility

By default, packages published to GitHub Packages are **private**. To make them public:

1. Go to your GitHub repository
2. Navigate to "Packages" tab
3. Select the package
4. Go to "Package settings"
5. Change visibility to "Public"

## Troubleshooting

### Authentication Issues

- Ensure your Personal Access Token has the correct scopes
- Check that the token hasn't expired
- Verify the `.npmrc` configuration

### Publishing Issues

- Ensure all packages are built before publishing
- Check that package names follow the `@voltagent/package-name` format
- Verify repository URLs in package.json files

### Installation Issues

- Ensure the consuming project has the correct `.npmrc` configuration
- Check that the package is accessible (public or you have access to private packages)

## Package Structure

The monorepo contains the following packages:

- `@voltagent/core` - Core framework
- `@voltagent/vercel-ai` - Vercel AI provider
- `@voltagent/xsai` - xsAI provider
- `@voltagent/anthropic-ai` - Anthropic AI provider
- `@voltagent/google-ai` - Google AI provider
- `@voltagent/groq-ai` - Groq AI provider
- `@voltagent/cli` - Command line interface
- `@voltagent/create-voltagent-app` - Project creation tool
- And more...

Each package is published independently to GitHub Packages.
