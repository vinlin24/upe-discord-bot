# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tera-Byte Discord Bot** - A Discord bot for Upsilon Pi Epsilon (UPE) at UCLA that automates induction-related administration and provides utility functions for the organization.

## Common Development Commands

### Development & Testing
- `npm run dev` - Run in development mode with ts-node (includes bot login)
- `npm run start` - Production build and run (includes bot login)
- `npm run sync` - Deploy slash commands only (no bot login)
- `npm run build` - Compile TypeScript and copy assets
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Run ESLint with auto-fix

### Build System
The project uses a custom Makefile that generates `.env.example` from source code analysis. The build process includes TypeScript compilation and asset copying from `src/assets/` to `dist/assets/`.

## Architecture & Code Structure

### Core Architecture
- **Feature-driven modular design**: Each feature lives in `src/features/` with its own commands and services
- **ClientManager pattern**: Central bot client management in `src/bot/`
- **Middleware system**: Permission and privilege checking in `src/middleware/`
- **Service layer**: Business logic and external integrations in `src/services/`

### Key Entry Points
- `src/index.ts` - Main application entry point
- `src/bot/ClientManager.ts` - Discord client initialization and management
- `src/env.ts` - Centralized environment variable validation using Envalid

### Feature Module Structure
Each feature in `src/features/` follows a consistent pattern:
- Commands (slash commands and message commands)
- Services (business logic)
- Models (if feature-specific)
- Utilities (feature-specific helpers)

### Database Integration
- **MongoDB** with **Mongoose ODM**
- Models defined in `src/models/`
- Database connection managed through environment variables

### External Integrations
- **Google Sheets API** for data management (credentials in `src/assets/google-credentials.json`)
- **Discord.js v14** for Discord API interaction
- **Sharp** for image processing capabilities

## Environment Management

### Environment Variables
- Centralized validation in `src/env.ts` using Envalid
- Strict ESLint rule: `no-process-env` - all environment access must go through the env module
- Auto-generated `.env.example` file maintained by build hooks

### Security Practices
- Base64-encoded secrets in CI/CD
- Google credentials stored as JSON asset file
- Environment validation on startup

## CI/CD Pipeline

### GitHub Actions
- **Trigger**: Pushes to `main` branch
- **Process**: Lint → Build → Deploy to remote server → Restart PM2 process "terabyte"

### Git Hooks (Husky)
- **Pre-commit**: Runs linter, builds if source changed, updates .env.example
- **Pre-push**: Updates environment secrets if .env.example changed

## Special Considerations

### Season-Based Configuration
The bot includes season-specific configuration updates, suggesting periodic configuration changes for different academic terms.

### Command Deployment
Use `npm run sync` to deploy slash commands without starting the bot - useful for command updates during development.

### Asset Management
Static assets in `src/assets/` are automatically copied to `dist/assets/` during build. This includes Google credentials and JSON configuration files.

### Branch Context
- **Main branch**: `main` (production deployments)
- **Current development**: Feature branches for specific functionality
- The `job-webhook` directory suggests job-related feature development