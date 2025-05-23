# Convos

## Setup

### 1. Install JS/React Native dependencies

First, install the project's JavaScript and React Native dependencies:

```sh
yarn
```

### 2. Install Ruby dependencies

To ensure you're using the correct version of CocoaPods for iOS development, install the Ruby dependencies:

```sh
gem install bundler
bundle install
```

### 3. Environment Variables

This project uses EAS (Expo Application Services) to manage environment variables. For local development, these variables are pulled into an `.env` file.

**For New Developers:**

1.  **Create an Expo Account:** If you don't have one, sign up at [expo.dev](https://expo.dev).
2.  **Project Setup on EAS:** You'll need to be invited to the project on EAS or set up your own EAS project linked to a fork of this repository.
3.  **Configure Environment Variables on EAS:**
    - Navigate to your project on the EAS dashboard.
    - Go to "Secrets" to add the necessary environment variables.
    - Refer to the `.env.example` file in the root of this repository to see the list of required environment variables and their purpose. You will need to provide your own values for these secrets in your EAS project settings.

**Pulling Environment Variables:**

Environment variables are typically handled automatically when you run the application for the first time (e.g., via `yarn ios`, see Quick Start). However, if you need to pull them manually for a specific environment (after they have been set up in your EAS project), you can use:

```sh
# For development environment (ensure 'development' secrets are set in EAS)
yarn env:pull:dev

# For preview environment (ensure 'preview' secrets are set in EAS)
yarn env:pull:preview

# For production environment (ensure 'production' secrets are set in EAS)
yarn env:pull:prod
```

These commands create the appropriate `.env` file locally by pulling the variables you configured in your EAS project for the specified environment.

## Quick start

### iOS

The following commands will also automatically handle pulling the correct environment variables for the 'dev' environment.

```sh
yarn ios  # For iOS simulator
# OR
yarn ios:device  # For physical iOS device
```

### Android

**Note:** Android development (`yarn android`) is currently experiencing issues. The team is actively working on a resolution.

```sh
yarn android
```

After the initial build for either platform, you can typically use `yarn start` to launch the Expo development server for subsequent runs.

### Running the app

Once the app builds, the Expo development server will start and you'll be able to run the app on your chosen device/simulator. If you encounter any issues, try cleaning the native build folders:

```sh
# For iOS build issues
yarn ios:clean

# For Android build issues
yarn android:clean
```

#### Forward backend port (Android only)

If running the backend locally with Android, run:

```sh
yarn android:reverse
```

### Start Expo server (after initial build)

```sh
yarn start
```

## Development

### Code Style and Best Practices

This project follows specific coding standards and best practices. Please refer to:

- `.cursorrules` - Defines our coding standards and patterns
- `eslint.config.mjs` - ESLint configuration
- `.prettierrc.cjs` - Prettier formatting rules

We use ESLint and Prettier to enforce code quality and consistency. Make sure to run linting before submitting PRs:

### Lint

```sh
yarn lint
```

### Typecheck

```sh
yarn typecheck
```

### Environments

The app supports three environments:

1. **Development** - For local development
2. **Preview** - For testing before production
3. **Production** - Live app environment

Each environment has its own configuration in `app.config.ts`.

### Rebuilding after Native Changes

If you add a new library with native dependencies or change configuration in `app.config.ts`, you'll need to rebuild the native project:

```sh
# For iOS
yarn ios:clean

# For Android
yarn android:clean
```

## Release Process

### Preview Deployments (from Main Branch)

The `main` branch represents the current code for preview releases.

- **Trigger**: Deployments to Preview are triggered automatically on pushes to the `main` branch (for relevant file changes like `.ts(x)`, assets, `package.json`, etc.) or can be manually dispatched via GitHub Actions.
- **Action**:
  - The workflow currently performs a **native iOS build** using `eas build --platform ios --profile preview --non-interactive --auto-submit`.
  - This build is then submitted to TestFlight.
  - EAS Build's `autoIncrement` feature handles version/build number increments for these native builds.
  - _(Note: The Over-The-Air (OTA) update path for non-native changes is currently disabled in the workflow; all pushes to main that trigger the workflow result in a native build.)_
  - Source maps uploading to Sentry is part of the workflow but may be conditionally run.

### Production Deployments (from Production Branch)

Deployments to Production are a two-step process:

1.  **Promotion to Production Branch**:

    - **Trigger**: Manually triggered via the "Promote to Production" GitHub Actions workflow. This workflow takes the current state of a source branch (typically `main`).
    - **Action**:
      - It prepares a merge commit, determining the app version from `package.json` and calculating the next iOS build number.
      - This merge commit is then pushed to the `production` branch.

2.  **Deployment from Production Branch**:
    - **Trigger**: Automatically triggered by the push to the `production` branch (from the promotion step above).
    - **Action**:
      - The "Production Deployment" workflow performs a **new native iOS build** using `eas build --platform ios --profile production --non-interactive --auto-submit`.
      - The build message includes details from the commits being deployed.
      - The app is submitted to the App Store.
      - Source maps uploading to Sentry is part of this workflow.

For more details on the deployment process, see the GitHub Actions workflows:

- `.github/workflows/preview-deployment.yml`
- `.github/workflows/promote-to-production.yml`
- `.github/workflows/production-deployment.yml`

## Troubleshoot

If you're having trouble with installation or the build process, try cleaning the native project folders and rebuilding:

```sh
# For iOS issues
yarn ios:clean

# For Android issues
yarn android:clean
```

## Contributing

See our [contribution guide](./CONTRIBUTING.md) to learn more about contributing to this project.
