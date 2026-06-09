# MyMaintenance System

A comprehensive maintenance management system built with Flutter, .NET, and PostgreSQL, featuring multi-tenant architecture with Keycloak authentication.

## 🏗️ System Architecture

The MyMaintenance system consists of multiple interconnected components:

- **Frontend Applications**: Flutter-based mobile and web applications
- **Backend Services**: .NET microservices with PostgreSQL databases
- **Authentication**: Keycloak-based SSO and multi-tenant support
- **Database Management**: Automated migration and schema management
- **Infrastructure**: Docker-based deployment with nginx

## 📱 Frontend Applications

### MyMaintenance-Flutter/
**Main Flutter Application**
- Cross-platform mobile and web application for end-users
- Maintenance request submission and tracking
- Multi-tenant support with realm-based routing
- PWA capabilities for offline functionality
- Built with Flutter 3.x with advanced caching strategies

**Key Features:**
- Request form management
- Real-time notifications
- File attachments and image capture
- QR code scanning
- Multi-language support

### MyMaintenance-Flutter-Admin/
**Administrative Flutter Application**
- Admin panel for system management
- User and tenant management
- Analytics and reporting dashboards
- QR code generation for assets
- Web-focused design with responsive layout

### flutter_web_file_selector/
**Custom Flutter Package**
- Enhanced file selection capabilities for web platforms
- Supports multiple file types and validation
- Custom UI components for file management

## 🔧 Backend Services

### MyMaintenance-SecurityGateway/
**API Gateway & Security Layer**
- .NET Core API gateway
- Authentication and authorization proxy
- Rate limiting and request validation
- Multi-tenant routing and data isolation
- Integration with Keycloak for SSO

**Technologies:**
- ASP.NET Core
- Entity Framework
- JWT token validation
- PostgreSQL integration

### MyMaintenance-CreateRealm-Process/
**Tenant Provisioning Service**
- Automated realm/tenant creation
- Database schema provisioning
- Keycloak realm configuration
- Batch processing for tenant onboarding

**Features:**
- Command-line interface
- Configuration-driven provisioning
- Database migration integration
- Error handling and rollback capabilities

### MyMaintenance-WorksOrderReport-Process/
**Reporting & Analytics Service**
- Work order report generation
- Data aggregation and analytics
- Scheduled report processing
- Export capabilities (PDF, Excel)

## 🔐 Authentication & Identity

### MyMaintenance-Keycloak/
**Custom Keycloak Distribution**
- Multi-tenant authentication server
- Custom themes and branding
- Enhanced user session management
- Integration with external identity providers

### KeycloakCustomSPIs/
**Custom Service Provider Interfaces**
- Custom user session providers
- Enhanced authentication flows
- Java-based extensions for Keycloak
- Specialized session management for multi-tenant scenarios

## 🗄️ Database Management

### DbMigration/
**Core Database Migrations**
- PostgreSQL schema management
- Entity framework migrations
- Core system tables and functions
- Version-controlled database changes

### DbMigration_WorksOrders/
**Works Orders Database Module**
- Work order specific schema
- Audit tables and triggers
- Specialized functions for work order management

### DbMigration_Request_Additional_Info/
**Request Information Module**
- Additional request data management
- Extended field support
- Custom form field definitions

**Migration Features:**
- Automated deployment scripts
- Rollback capabilities
- Environment-specific configurations
- Data seeding and initialization

## 🌐 Web & Infrastructure

### DeepLinkFallbackPage/
**Deep Link Handling**
- Fallback pages for mobile deep links
- App store redirection
- Email verification pages
- Dynamic URL generation for app downloads

### Docker/
**Containerization & Deployment**
- Multi-service Docker Compose configurations
- Environment-specific deployments
- Database initialization scripts
- Keycloak setup and configuration
- Admin application deployment
- Development and production configurations

**Available Configurations:**
- `docker-compose.admin_app.yml` - Admin application
- `docker-compose.create_realm_process_*.yml` - Tenant provisioning
- Various environment-specific setups

## 🚀 Getting Started

### Prerequisites
- Flutter SDK (version specified in `.fvm/fvm_config.json`)
- .NET 6.0 or later
- PostgreSQL 12+
- Docker & Docker Compose
- Keycloak 15+

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MyMaintenance
   ```

2. **Setup Flutter Environment**
   ```bash
   cd MyMaintenance-Flutter
   fvm use  # Uses version from fvm_config.json
   flutter pub get
   ```

3. **Start Infrastructure Services**
   ```bash
   cd Docker/MyMaintenance-Flutter
   docker-compose up -d keycloak postgres
   ```

4. **Run Database Migrations**
   ```bash
   cd DbMigration
   # Configure connection strings
   dotnet run
   ```

5. **Start Backend Services**
   ```bash
   cd MyMaintenance-SecurityGateway
   dotnet run
   ```

6. **Launch Flutter Applications**
   ```bash
   # Main app
   cd MyMaintenance-Flutter
   flutter run -d web

   # Admin app
   cd MyMaintenance-Flutter-Admin
   flutter run -d web
   ```

## 🏗️ Deployment

### Production Deployment

1. **Build Docker Images**
   ```bash
   # Build Flutter app
   cd MyMaintenance-Flutter
   docker build -t mymaintenance-app .

   # Build admin app
   cd MyMaintenance-Flutter-Admin
   docker build -t mymaintenance-admin .
   ```

2. **Deploy with Docker Compose**
   ```bash
   cd Docker/MyMaintenance-Flutter
   docker-compose -f docker-compose.production.yml up -d
   ```

### Environment Configuration

Each service supports environment-specific configuration:

- **Development**: Local development with hot reload
- **Staging**: Pre-production testing environment
- **Production**: High-availability production deployment

Configuration is managed through:
- Environment variables
- Docker Compose overrides
- Kubernetes manifests (if applicable)

## 🧪 Testing

### Frontend Testing
```bash
cd MyMaintenance-Flutter
flutter test
```

### Backend Testing
```bash
cd MyMaintenance-SecurityGateway
dotnet test
```

### Integration Testing
- Database migration tests
- API endpoint validation
- End-to-end workflow testing

## 📊 Monitoring & Observability

- Application logging with structured logs
- Performance monitoring
- Database query optimization
- Error tracking and alerting
- Health check endpoints

## 🤝 Contributing

1. Follow the established project structure
2. Ensure all tests pass before submitting PRs
3. Update documentation for new features
4. Follow coding standards for each technology stack

## 📞 Support

For technical support and documentation:
- Check individual project README files
- Review API documentation
- Contact the development team

## 📄 License

[Specify your license here]

---

**Last Updated:** $(date)
**Version:** Check individual project versions
**Maintained by:** MyMaintenance Development Team
