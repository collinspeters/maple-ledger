# BookkeepAI - AI-Powered Bookkeeping Software

## Overview
BookkeepAI is an AI-powered bookkeeping software designed for Canadian sole proprietors. It automates business finance management through intelligent transaction categorization, receipt processing, and natural language financial queries. The project aims to provide an intuitive and efficient solution for managing finances, ensuring compliance with Canadian tax regulations, and offering robust reporting capabilities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with CSS variables
- **Forms**: React Hook Form with Zod validation
- **UI/UX Decisions**: Professional invoice layout matching Canadian business standards, responsive table designs, intuitive user flows.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js (local strategy, express-session, bcrypt for hashing)
- **File Uploads**: Multer
- **API Design**: RESTful JSON API

### Database
- **Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM (type-safe queries, Drizzle Kit for migrations)
- **Schema**: Centralized schema definition for full-stack type safety.

### Key Features
- **Authentication**: Session-based, user registration with business profiles, trial and subscription tracking.
- **Transaction Management**: Automatic categorization using AI, manual entry, bank feed integration, confidence scoring, review workflow for unverified transactions. Includes a 4-tier hybrid categorization system (Transfer, Merchant, Rules, AI) with merchant enrichment and comprehensive logging.
- **Receipt Processing**: File upload handling, OCR data extraction, automatic matching to transactions, unmatched receipt queue.
- **AI Integration**: OpenAI GPT-4 for categorization and natural language queries, confidence scoring, Canadian tax compliance.
- **Subscription Management**: Stripe integration for payments, 14-day free trial, access control, upgrade prompts.
- **Reporting**: Profit & Loss statements, financial summaries, dashboards, CRA-compliant formats, export functionality.
- **Banking**: Multi-account management for same-bank connections, intelligent transfer detection, transfer activity dashboard, account disconnection.
- **Interactive Agent System**: Comprehensive web automation system for UI analysis, interaction testing, and automated issue resolution, similar to ChatGPT's agent capabilities.

### System Design Choices
- Monorepo structure with shared TypeScript types and schemas for end-to-end type safety.
- Environment-based configuration for development and production.
- Robust security measures: secure cookies, password hashing, file upload validation, CORS, HTTPS.
- Comprehensive unit and security testing (Jest, input validation, SQL injection prevention).

## External Dependencies

### Core Services
- **Neon Database**: PostgreSQL hosting.
- **OpenAI API**: GPT-4 for AI functionalities.
- **Stripe**: Payment processing and subscription management.

### Planned Integrations
- **Plaid**: Bank account connectivity.
- **Mindee**: OCR service for receipt data extraction.