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
- Advanced analytics dashboard
- Client portal customization
- Enterprise-grade security

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

3. Install dependencies:
```bash
npm install
```

4. Start development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── assets/          # Static assets and global styles
├── components/      # Shared UI components
├── features/        # Feature-based modules
│   ├── auth/       # Authentication logic
│   ├── chat/       # Chat interface
│   ├── documents/  # Document management
│   └── analytics/  # Analytics dashboard
├── hooks/          # Custom React hooks
├── services/       # API integration
├── store/          # Redux state management
├── types/          # TypeScript definitions
└── utils/          # Utility functions
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run test` - Run test suite
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler
- `npm run format` - Format code with Prettier

### Code Style

- ESLint configuration with TypeScript and React rules
- Prettier for consistent code formatting
- Git hooks with husky for pre-commit checks
- EditorConfig for consistent IDE settings

### Testing

- Jest for unit testing
- React Testing Library for component testing
- Cypress for E2E testing
- Coverage threshold: 85%
- Accessibility testing with axe-core
- Performance testing with Lighthouse

## Docker Development

### Development Environment

```bash
# Build and start development container
docker-compose up --build

# Stop containers
docker-compose down
```

### Production Build

```bash
# Build production image
docker build -t catalog-search-web:prod --target production .

# Test production build locally
docker-compose -f docker-compose.prod.yml up
```

## Environment Variables

Required environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| VITE_API_URL | Backend API endpoint URL | Yes |
| VITE_WS_URL | WebSocket server URL | Yes |
| VITE_APP_ENV | Application environment | Yes |
| VITE_AUTH_DOMAIN | Azure AD B2C domain | Yes |
| VITE_AUTH_CLIENT_ID | Azure AD B2C client ID | Yes |

## Deployment

### Azure DevOps Pipeline

1. Build stage:
   - Install dependencies
   - Run tests
   - Create production build
   - Build Docker image

2. Test stage:
   - Unit tests
   - Integration tests
   - E2E tests
   - Security scanning

3. Deployment stage:
   - Push to Azure Container Registry
   - Deploy to AKS cluster
   - Health checks
   - Blue-green deployment

### Deployment Strategy

- Blue-green deployment for zero-downtime updates
- Automated rollback on failure
- Health check monitoring
- Performance metrics collection

## Performance Optimization

- Code splitting with React.lazy
- Image optimization with next-gen formats
- Caching strategies
- Bundle size optimization
- Tree shaking
- Performance monitoring

## Accessibility

- WCAG 2.1 Level AA compliance
- Semantic HTML structure
- ARIA attributes
- Keyboard navigation
- Screen reader support
- Color contrast compliance

## Browser Support

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90
- iOS Safari >= 14
- Android Chrome >= 90

## Contributing

1. Create feature branch from development
2. Implement changes with tests
3. Submit pull request
4. Code review process
5. Merge to development

## License

Proprietary - All rights reserved

## Support

Contact system administrators for support and access management.