# Keycloak Admin UI Development Guide

This guide provides step-by-step instructions for running and building the customized Keycloak Admin UI for development purposes.

## Overview

This customized Keycloak installation allows you to run the Admin UI as a separate React application against a dedicated development Keycloak server, making it easier to develop and test Admin UI customizations.

## Project Structure

- `/js/apps/keycloak-server` - Local development Keycloak server
- `/js/apps/admin-ui` - React-based Admin UI application  
- `/js` - Root JavaScript workspace for building JAR files

## Prerequisites

- **Node.js** (version 22 or higher; built and tested with 24)
- **pnpm** 11 (the version is pinned in `js/package.json`; `corepack pnpm` picks it up)
- **Maven** (for building JAR files)
- **Java 17+** (the stock 26.8.2 jar was built with JDK 17)

### Install pnpm (if not already installed)

```bash
corepack enable
```

Or prefix every command with `corepack pnpm` instead of `pnpm`.

## Development Setup

### 1. Running the Keycloak Server

The Keycloak server provides the backend API that the Admin UI connects to.

> **Note:** For detailed server configuration options, see the README.md file in `/js/apps/keycloak-server/`

**Steps:**

a. **Open the keycloak-server directory in terminal:**
```bash
cd js/apps/keycloak-server
```

b. **Install dependencies:**
```bash
pnpm install
```

c. **Start the development server:**
```bash
pnpm start --admin-dev
```

This will:
- Download and run a local Keycloak server on `http://localhost:8080`
- Configure it to work with the development Admin UI
- Automatically import the required client configuration

### 2. Running the Admin UI React Project

The Admin UI is a separate React application that runs independently from the Keycloak server.

**Steps:**

a. **Open the admin-ui directory in another terminal:**
```bash
cd js/apps/admin-ui
```

b. **Install dependencies:**
```bash
pnpm install
```

c. **Start the development server:**
```bash
pnpm run dev
```

d. **Access the application:**
- Open `http://localhost:8080` in your browser
- You should see the Keycloak login page

e. **Login credentials:**
- **Username:** `admin`
- **Password:** `admin`

## Building the JAR File

Once you've completed your customizations, you can build a production JAR file that includes your changes.

**Steps:**

a. **Open the root js directory in another terminal:**
```bash
cd js
```

b. **Build the JAR file:**
```bash
mvn install
```

> **Note:** Ensure Maven is installed on your system before running this command

c. **Locate the built JAR:**
After a successful build, you can find the JAR file at:
```
js/apps/admin-ui/target/keycloak-admin-ui-26.8.2.jar
```

### Building the JAR without Maven or Java

The jar is a drop-in replacement for the stock `org.keycloak:keycloak-admin-ui:26.8.2` jar. Without Maven it can be assembled by hand:

1. `cd js && corepack pnpm install`, then `cd apps/admin-ui && corepack pnpm run build` (writes the Vite output to `target/classes/theme/keycloak.v2/admin/resources`).
2. Download the stock jar from Maven Central and take its `META-INF/` (MANIFEST, `keycloak-themes.json`, Maven pom files).
3. Lay out, in this order so later copies win: `maven-resources-community/`, the Vite output under `theme/keycloak.v2/admin/resources/`, then `maven-resources/`.
4. Zip it as `keycloak-admin-ui-26.8.2.jar`. Its file list should match the stock jar's, apart from the hashed asset names and our extra `resources/icon.png` and `resources/logo.png`.

## Customisation notes (26.8.2)

- `WhoAmI` in 26.8.2 is a plain `WhoAmIRepresentation`. The MyMaintenance checks (`isClientAdmin()`, `isClientAdminWithSsoPermission()`, `isClientAdminWithLdapPermission()`, `isKeycloakAdmin()`) live on a separate `userAccess` object: `const { whoAmI, userAccess, isLoading } = useWhoAmI();`
- The realm selector dropdown no longer exists in 26.8.2. Realms are listed on the "Manage realms" page (`src/realm/RealmSection.tsx`), which carries the MyMaintenance ordering (mym_sso first, master and mym_admin last).
- Import `SelectControl` from `@keycloak/keycloak-ui-shared`, never from a relative `libs/ui-shared/src` path: a second copy of ui-shared means a second `HelpContext`, and the page crashes with "No provider found for the 'HelpContext' context".

## Development Workflow

1. **Start both servers** (Keycloak server and Admin UI dev server)
2. **Make your customizations** in the `/js/apps/admin-ui/src` directory
3. **Test changes** in real-time (hot reload is enabled)
4. **Build JAR** when ready for deployment

## Troubleshooting

### Common Issues

**Port conflicts:**
- Keycloak server runs on port `8080`
- Admin UI dev server typically runs on port `5173` or `5174`
- Ensure these ports are available

**Dependencies issues:**
```bash
# Clear node modules and reinstall
rm -rf node_modules
pnpm install
```

**Build failures:**
```bash
# Clean and rebuild
mvn clean install
```

### Important Notes

- The development setup automatically configures the necessary client (`security-admin-console-v2`) for local development
- Changes made in development mode are automatically reflected without server restart
- The JAR file contains your customized Admin UI and can be deployed to production Keycloak instances

## Additional Resources

- [Keycloak Admin UI Documentation](js/apps/admin-ui/README.md)
- [Keycloak Server Documentation](js/apps/keycloak-server/README.md)
- [Main Project README](README.md)

---

**Version:** Keycloak 26.8.2 (ported from the 26.1.2 customisation on 2026-11-25) 