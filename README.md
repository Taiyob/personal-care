# Personal Care App - Backend

A robust backend service for the Personal Care application, built with a module-based architecture using Bun and Express.

## 🚀 Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Caching**: [Redis](https://redis.io/)
- **Storage**: [MinIO](https://min.io/) (S3 Compatible)
- **Email**: [AWS SES](https://aws.amazon.com/ses/)
- **Payments**: [Stripe](https://stripe.com/)
- **Logging**: [Winston](https://github.com/winstonjs/winston)
- **Validation**: [Zod](https://zod.dev/)

## 🛠️ Features

- **Authentication**: JWT-based auth with role-based access control (Admin, Employee, Subscriber).
- **User Management**: Complete CRUD with account status moderation (Active/Suspended) and soft deletion.
- **Product Management**: Category and product catalog management.
- **Order System**: Checkout process with Stripe integration and webhooks.
- **Dashboard Stats**: Administrative statistics (Total Users, Payment Revenue, Product Counts).
- **Caching**: Optimized performance with Redis caching.
- **Storage**: Media management using MinIO.

## 🏁 Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation) installed.
- Docker (optional, for local DB/Redis/MinIO).

### Installation

1. Install dependencies:
   ```bash
   bun install
   ```

2. Setup environment variables:
   Copy `.env.demo` to `.env` and fill in your credentials.

3. Database setup:
   ```bash
   bun run setup
   ```

### Development

Start the development server with auto-reload:
```bash
bun run dev
```

### Production

Build and start the production server:
```bash
bun run build
bun run start
```

## 🏗️ Project Structure

- `src/modules/`: Module-based business logic (Auth, Product, Category, Order, etc.).
- `prisma/`: Database schema and migrations.
- `scripts/`: Utility scripts (e.g., module generator).

## 📡 API Endpoints (Highlights)

- `/api/auth`: Registration, Login, Profile.
- `/api/users`: Admin user management.
- `/api/products`: Public and Admin product routes.
- `/api/orders`: Order creation and status tracking.
- `/api/dashboard`: Admin statistics.
