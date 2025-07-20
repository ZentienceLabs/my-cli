# GitHub Action Setup for NPM Publishing

## Required Repository Secrets

To use the manual NPM publishing workflow, you need to configure the following secrets in your GitHub repository:

### 1. NPM_TOKEN
1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Click on your profile → "Access Tokens"
3. Click "Generate New Token" → "Classic Token"
4. Select "Automation" type (for CI/CD)
5. Copy the generated token
6. In your GitHub repository, go to Settings → Secrets and variables → Actions
7. Click "New repository secret"
8. Name: `NPM_TOKEN`
9. Value: paste your NPM token

### 2. GITHUB_TOKEN (Automatic)
The `GITHUB_TOKEN` is automatically provided by GitHub Actions and doesn't need manual setup.

## How to Use the Workflow

1. Go to your repository's "Actions" tab
2. Select "Publish to NPM" workflow
3. Click "Run workflow"
4. Choose version bump type (patch/minor/major)
5. Optionally enable "Dry run" to test without publishing
6. Click "Run workflow"

## What the Workflow Does

- **Installs dependencies** using pnpm
- **Runs tests** to ensure code quality
- **Builds the package** using TypeScript
- **Bumps version** according to your selection
- **Creates git tag** with new version
- **Publishes to NPM** with public access
- **Creates GitHub release** with changelog

## Version Bump Types

- **patch**: Bug fixes (1.0.0 → 1.0.1)
- **minor**: New features (1.0.0 → 1.1.0)  
- **major**: Breaking changes (1.0.0 → 2.0.0)

## Dry Run Mode

Enable "Dry run" to test the workflow without actually:
- Publishing to NPM
- Creating git tags
- Making GitHub releases

This is useful for testing the workflow setup.