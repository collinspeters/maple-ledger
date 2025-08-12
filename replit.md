# BookkeepAI - AI-Powered Bookkeeping Software

## Overview
BookkeepAI is an AI-powered bookkeeping software designed for Canadian sole proprietors. It automates business finance management through intelligent transaction categorization, receipt processing, and natural language financial queries. The project aims to provide a modern, efficient, and CRA-compliant solution for managing business finances, leveraging AI for smart automation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend
- **Framework**: React 18 (TypeScript)
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Components**: Radix UI, shadcn/ui
- **Styling**: Tailwind CSS (with CSS variables)
- **Forms**: React Hook Form (with Zod validation)

### Backend
- **Runtime**: Node.js (Express.js)
- **Language**: TypeScript (ES modules)
- **Authentication**: Passport.js (local strategy, express-session)
- **File Uploads**: Multer
- **API Design**: RESTful (JSON responses)

### Database
- **Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM
- **Schema**: Centralized definition in shared directory
- **Migrations**: Drizzle Kit

### Key Components
- **Authentication System**: Session-based, bcrypt for hashing, trial/subscription tracking.
- **Transaction Management**: Automatic categorization via GPT-4, manual entry, bank feed readiness (Plaid), confidence scoring for AI suggestions, review workflow.
- **Receipt Processing**: File upload, OCR readiness (Mindee), automatic matching, unmatched receipt queue.
- **AI Integration**: OpenAI GPT-4 for categorization and chat, confidence scoring, Canadian tax compliance.
- **Subscription Management**: Stripe integration, 14-day free trial, access control.
- **Reporting System**: P&L statements, financial summaries, CRA-compliant formatting, export functionality.
- **Hybrid Transaction Categorization**: 4-tier fallback system (Transfer → Merchant → Rules → AI with enrichment) for optimal accuracy and performance.
- **Interactive Agent System**: AI-driven web automation for UI analysis, interaction testing, and issue detection, similar to ChatGPT's agent capabilities.

### Data Flow
User Registration → Transaction Import (Bank feeds/manual) → AI Categorization → Receipt Upload → OCR Processing → Transaction Matching → GPT-4 Analysis → User Review → Reporting → Subscription Management.

## External Dependencies
### Core Services
- **Neon Database**: PostgreSQL hosting.
- **OpenAI API**: GPT-4 for AI functionalities.
- **Stripe**: Payment processing and subscription management.
- **Plaid**: (Planned) Bank account connectivity.
- **Mindee**: (Planned) OCR service for receipts.