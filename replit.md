# BookkeepAI - AI-Powered Bookkeeping Software

## Overview

BookkeepAI is an AI-powered bookkeeping software specifically designed for Canadian sole proprietors. The application automates business finance management through intelligent transaction categorization, receipt processing, and natural language financial queries. It features a modern React frontend with a Node.js/Express backend, utilizing PostgreSQL for data persistence and integrating with external services like Stripe for payments and OpenAI for AI capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with CSS variables for theming
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy and express-session
- **File Uploads**: Multer for handling receipt uploads
- **API Design**: RESTful endpoints with JSON responses

### Database Layer
- **Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM with type-safe queries
- **Schema**: Centralized schema definition in shared directory
- **Migrations**: Drizzle Kit for database migrations

## Key Components

### Authentication System
- Session-based authentication using express-session
- Password hashing with bcrypt
- User registration with business profile information
- Trial and subscription status tracking

### Transaction Management
- Automatic transaction categorization using GPT-4
- Manual transaction entry and editing
- Bank feed integration (prepared for Plaid)
- Confidence scoring for AI suggestions
- Review workflow for unverified transactions

### Receipt Processing
- File upload handling with size limits (10MB)
- OCR data extraction (prepared for Mindee integration)
- Automatic matching to existing transactions
- Unmatched receipt queue for manual review

### AI Integration
- OpenAI GPT-4 for transaction categorization
- Natural language chat interface for financial queries
- Confidence scoring and explanations for audit trails
- Canadian tax regulation compliance in categorization

### Subscription Management
- Stripe integration for payment processing
- 14-day free trial system
- Access control based on subscription status
- Trial countdown and upgrade prompts

### Reporting System
- Profit & Loss statements
- Financial summaries and dashboards
- CRA-compliant report formatting
- Export functionality (PDF ready)

## Data Flow

1. **User Registration**: Creates user account with trial period
2. **Transaction Import**: Bank feeds or manual entry → AI categorization
3. **Receipt Upload**: File upload → OCR processing → Transaction matching
4. **AI Processing**: GPT-4 analyzes transactions and generates suggestions
5. **User Review**: Users review and approve AI suggestions
6. **Reporting**: Processed data generates financial reports
7. **Subscription**: Trial expiration triggers payment flow

## External Dependencies

### Core Services
- **Neon Database**: PostgreSQL hosting with serverless architecture
- **OpenAI API**: GPT-4 for AI categorization and chat functionality
- **Stripe**: Payment processing and subscription management

### Planned Integrations
- **Plaid**: Bank account connectivity for automatic transaction import
- **Mindee**: OCR service for receipt data extraction

### Development Tools
- **Replit**: Development environment with live reload
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Production bundling for server code

## Deployment Strategy

### Development Environment
- Vite dev server for frontend with HMR
- tsx for TypeScript execution in development
- Environment-based configuration with .env files
- Replit integration with runtime error overlay

### Production Build
- Vite builds optimized frontend bundle
- ESBuild creates server bundle with external packages
- Static file serving from Express in production
- Database migrations via Drizzle Kit

### Configuration Management
- Environment variables for sensitive data (API keys, database URLs)
- Separate client and server TypeScript configurations
- Path aliases for clean import statements
- CORS and security headers for production deployment

### Security Considerations
- Session-based authentication with secure cookies
- Password hashing with high-cost bcrypt
- File upload restrictions and validation
- Environment-specific security settings
- HTTPS enforcement in production

The application follows a monorepo structure with shared TypeScript types and schemas, enabling type safety across the full stack while maintaining clear separation of concerns between client, server, and shared code.

## Recent Changes

### January 31, 2025 - Invoice Preview & UI Fixes
- ✅ Implemented animated invoice preview with framer-motion transitions
- ✅ Fixed button visibility issues (Add Client, Create Invoice, Sign Up buttons)
- ✅ Fixed registration flow - new users now get proper 14-day trial setup
- ✅ Enhanced invoice preview with minimize/expand functionality
- ✅ Added professional invoice layout matching Canadian business standards
- ✅ Integrated real-time preview with form data and calculated totals