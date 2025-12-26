# BOOKED

> Scheduling infrastructure for teams and enterprises

BOOKED is a modern, API-first scheduling and calendar system designed for self-hosting or cloud deployment. It provides comprehensive scheduling capabilities including public booking pages, internal scheduling, round-robin distribution, collective scheduling, and resource booking.

## Features

- **External → Internal Booking**: Public booking pages for clients/customers to schedule with team members
- **Internal → Internal Scheduling**: Team members scheduling meetings with each other
- **Round-Robin Distribution**: Automatic assignment across available team members
- **Collective Scheduling**: Find mutual availability across multiple participants
- **Resource Booking**: Rooms, equipment, and shared resources
- **Event Types + Ad-Hoc**: Pre-configured meeting templates and one-off scheduling
- **Multi-Tenancy**: Full organization isolation with RBAC
- **HIPAA Compliance**: Audit logging, encryption, and data retention controls
- **Webhooks**: Real-time event notifications for integrations
- **API Keys**: Secure programmatic access with scoped permissions

## Tech Stack

- **Backend**: Node.js 20, TypeScript, Fastify
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache/Queue**: Redis with BullMQ
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Realtime**: Socket.io

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/your-org/booked.git
cd booked
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
npm run db:generate
npm run db:push
```

5. Start the development servers:
```bash
npm run dev
```

The API will be available at `http://localhost:3000` and the web app at `http://localhost:5173`.

### Docker Deployment

```bash
cd docker
docker-compose up -d
```

## Project Structure

```
booked/
├── apps/
│   ├── api/                    # Fastify API server
│   │   ├── src/
│   │   │   ├── modules/        # Feature modules
│   │   │   ├── common/         # Shared utilities
│   │   │   ├── core/           # Core services
│   │   │   └── infrastructure/ # External concerns
│   │   ├── prisma/             # Database schema
│   │   └── tests/              # Test files
│   │
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── pages/          # Page components
│       │   ├── stores/         # State management
│       │   └── api/            # API client
│       └── public/             # Static assets
│
├── packages/                   # Shared packages
│   ├── types/                  # Shared TypeScript types
│   ├── validators/             # Shared Zod schemas
│   └── embed/                  # Embeddable widget SDK
│
├── docker/                     # Docker configuration
└── docs/                       # Documentation
```

## API Reference

### Authentication

```
POST /api/v1/auth/register     # Register new user
POST /api/v1/auth/login        # Login
POST /api/v1/auth/logout       # Logout
POST /api/v1/auth/refresh      # Refresh session
```

### Bookings

```
GET  /api/v1/bookings          # List bookings
POST /api/v1/bookings          # Create booking
GET  /api/v1/bookings/:id      # Get booking
POST /api/v1/bookings/:id/cancel     # Cancel booking
POST /api/v1/bookings/:id/reschedule # Reschedule booking
```

### Event Types

```
GET  /api/v1/event-types       # List event types
POST /api/v1/event-types       # Create event type
GET  /api/v1/event-types/:id   # Get event type
PATCH /api/v1/event-types/:id  # Update event type
DELETE /api/v1/event-types/:id # Delete event type
```

### Availability

```
GET /api/v1/availability       # Get available slots
GET /api/v1/availability/collective  # Get collective availability
```

### Public Booking

```
GET  /api/v1/public/:org/:event              # Get event type info
GET  /api/v1/public/:org/:event/availability # Get availability
POST /api/v1/public/:org/:event/book         # Create booking
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `ENCRYPTION_KEY` | 32-byte hex encryption key | Yes |
| `SESSION_SECRET` | Session secret (32+ chars) | Yes |
| `SMTP_HOST` | SMTP server host | No |
| `SMTP_PORT` | SMTP server port | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASS` | SMTP password | No |

## Testing

```bash
# Run all tests
npm run test

# Run unit tests
npm run test:unit

# Run with coverage
npm run test:coverage
```

## License

BOOKED is licensed under the n8n Sustainable Use License, which allows self-hosting and commercial use with certain restrictions.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.
