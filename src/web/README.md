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
├── assets/          # Static assets
├── components/      # Shared components
├── features/        # Feature-based modules
├── hooks/          # Custom React hooks
├── layouts/        # Page layouts
├── lib/            # Utility functions
├── routes/         # Route definitions
├── services/       # API services
├── store/          # Redux store
├── styles/         # Global styles
└── types/          # TypeScript definitions
```

### Code Style

- ESLint configuration with TypeScript and React rules
- Prettier for consistent formatting
- Import sorting with `@trivago/prettier-plugin-sort-imports`
- Strict TypeScript configuration
- React Testing Library best practices

### Testing

- Jest for unit and integration tests
- React Testing Library for component testing
- Cypress for E2E testing
- Required coverage: >85%
- Snapshot testing for UI components
- Mock service worker for API testing

## Docker Development

### Development Environment

1. Build and start development container:
```bash
docker-compose up --build
```

2. Access development server:
```
http://localhost:3000
```

### Production Build

1. Build production image:
```bash
docker build -t catalog-search-web:prod --target production .
```

2. Test production build locally:
```bash
docker-compose -f docker-compose.prod.yml up
```

## Deployment

### Azure DevOps Pipeline

1. Build stage:
- Install dependencies
- Type checking
- Linting
- Unit tests
- Build production assets
- Container image build

2. Test stage:
- Integration tests
- E2E tests
- Accessibility tests
- Performance tests

3. Security stage:
- Container scanning
- Dependency audit
- SAST analysis

4. Deployment stage:
- Azure Container Registry push
- Blue-green deployment
- Health checks
- Automated rollback

### Environment Configuration

Development:
- Hot module replacement
- Source maps
- Redux DevTools
- Error overlay

Staging:
- Production build
- Staging API endpoints
- Test authentication
- Monitoring enabled

Production:
- Optimized build
- CDN integration
- Error tracking
- Full monitoring

## Performance Optimization

- Code splitting with React.lazy
- Image optimization with next/image
- Bundle size analysis
- Tree shaking
- Memoization strategies
- Service Worker caching
- Compression (Brotli/Gzip)

## Accessibility

- WCAG 2.1 Level AA compliance
- Semantic HTML
- ARIA attributes
- Keyboard navigation
- Screen reader support
- Color contrast compliance
- Focus management

## Browser Support

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90
- iOS Safari >= 14
- Android Chrome >= 90

## Contributing

1. Create feature branch:
```bash
git checkout -b feature/feature-name
```

2. Commit changes:
```bash
git commit -m "feat: add feature description"
```

3. Push branch:
```bash
git push origin feature/feature-name
```

4. Create pull request with:
- Feature description
- Testing evidence
- Performance impact
- Breaking changes
- Screenshots (if applicable)

## License

Copyright © 2024. All rights reserved.