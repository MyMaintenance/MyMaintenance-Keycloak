# Keycloak Admin UI Development Guide

This guide provides step-by-step instructions for running and building the customized Keycloak Admin UI for development purposes.

## Overview

This customized Keycloak installation allows you to run the Admin UI as a separate React application against a dedicated development Keycloak server, making it easier to develop and test Admin UI customizations.

## Project Structure

- `/js/apps/keycloak-server` - Local development Keycloak server
- `/js/apps/admin-ui` - React-based Admin UI application  
- `/js` - Root JavaScript workspace for building JAR files

## Prerequisites

- **Node.js** (version 16 or higher)
- **pnpm** (Package manager)
- **Maven** (for building JAR files)
- **Java 17+** (required by Keycloak)

### Install pnpm (if not already installed)

```bash
npm install -g pnpm
```

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
js/apps/admin-ui/target/keycloak-admin-ui-26.1.2.jar
```

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

**Version:** Keycloak 26.1.2  
**Last Updated:** $(date) 