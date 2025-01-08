# AI-powered Product Catalog Search System Frontend

Enterprise-grade React application for intelligent product catalog search and management.

## Project Overview

A modern, scalable frontend application built with:
- React 18.2+ with TypeScript
- Redux Toolkit 1.9+ for state management
- Material-UI 5.14+ component library
- Real-time WebSocket communication
- Azure AD B2C authentication
- Multi-tenant architecture
- Role-based access control (RBAC)

Key features:
- Intuitive chat interface for product queries
- Document processing visualization
- Real-time processing status updates
- Advanced analytics dashboard
- Client portal customization
- Comprehensive audit logging

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker >= 20.10.0
- Docker Compose >= 2.0.0
- Azure CLI >= 2.40.0
- Git >= 2.30.0

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd src/web
```

2. Configure environment variables:
```bash
cp .env.development.example .env.development
cp .env.production.example .env.production
```

Required environment variables:
- VITE_API_URL: Backend API endpoint URL
- VITE_WS_URL: WebSocket server URL
- VITE_APP_ENV: Application environment
- VITE_AUTH_DOMAIN: Azure AD B2C domain
- VITE_AUTH_CLIENT_ID: Azure AD B2C client ID

3. Install dependencies:
```bash
npm install
```

4. Start development server:
```bash
npm run dev
```

## Development

### Available Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run test` - Run Jest test suite
- `npm run test:coverage` - Generate test coverage report
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript compiler
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── assets/           # Static assets
├── components/       # Shared components
├── features/         # Feature-based modules
├── hooks/           # Custom React hooks
├── layouts/         # Page layouts
├── lib/             # Utility functions
├── routes/          # Route definitions
├── services/        # API services
├── store/           # Redux store
├── styles/          # Global styles
└── types/           # TypeScript definitions
```

### Code Style

- ESLint configuration with TypeScript and React rules
- Prettier for consistent code formatting
- Import sorting with `@trivago/prettier-plugin-sort-imports`
- Strict TypeScript configuration
- React Testing Library best practices

### Testing Guidelines

- Unit tests required for all components
- Integration tests for feature workflows
- E2E tests for critical user journeys
- Minimum 85% test coverage
- Snapshot testing for UI components
- Performance testing with Lighthouse

## Docker Development

### Development Environment

Start the development container:
```bash
docker-compose up --build
```

The development server will be available at `http://localhost:3000` with hot reload enabled.

### Production Build

Build production container:
```bash
docker build -t catalog-search-web:prod --target production .
```

Test production build locally:
```bash
docker-compose -f docker-compose.prod.yml up
```

## Deployment

### Build Pipeline

1. Code quality checks:
   - ESLint validation
   - TypeScript compilation
   - Unit test execution
   - Code coverage verification

2. Build process:
   - Environment-specific builds
   - Asset optimization
   - Bundle analysis
   - Docker image creation

3. Testing:
   - Integration tests
   - E2E tests
   - Performance benchmarks
   - Accessibility validation

### Deployment Pipeline

1. Staging deployment:
   - Azure Container Registry push
   - Blue-green deployment
   - Smoke tests
   - Performance validation

2. Production deployment:
   - Progressive rollout
   - Health checks
   - Metrics verification
   - Automated rollback capability

### Monitoring

- Azure Application Insights integration
- Real-time error tracking
- Performance monitoring
- User behavior analytics
- Custom business metrics

## Performance Optimization

- Code splitting with React.lazy
- Image optimization with next-gen formats
- Efficient bundle size management
- Browser caching strategy
- Service Worker implementation
- Web Vitals monitoring

## Accessibility

- WCAG 2.1 Level AA compliance
- Semantic HTML structure
- ARIA attributes implementation
- Keyboard navigation support
- Screen reader optimization
- Color contrast verification

## Security

- Azure AD B2C authentication
- JWT token management
- XSS prevention
- CSRF protection
- Content Security Policy
- Secure HTTP headers

## Contributing

1. Create feature branch from `develop`
2. Implement changes with tests
3. Submit pull request with:
   - Clear description
   - Test coverage report
   - Performance impact analysis
   - Breaking changes documentation

## License

Proprietary - All rights reserved

## Support

Contact the development team for support:
- Email: support@example.com
- Internal Slack: #catalog-search-support