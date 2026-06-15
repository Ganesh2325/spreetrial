# Spreetrail

Spreetrail is a full-stack web application designed for group expense tracking and settlement, similar to Splitwise. It features user authentication, group management, expense tracking, a CSV import tool for bulk expenses, and an optimized debt-settlement algorithm to minimize the total number of transactions between users.

## Features
- **User Authentication**: Secure signup and login functionality.
- **Group Management**: Create groups and invite members.
- **Expense Tracking**: Add expenses split equally or unequally among members.
- **Debt Simplification**: Uses a minimum cash-flow algorithm to optimize how debts are settled.
- **CSV Data Ingestion**: Import expenses from a CSV file with automatic anomaly detection (duplicate expenses, missing fields, invalid dates).
- **Audit Logging**: Keeps track of all group activities (expense added, member joined, imports).

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)
- Git

### 1. Clone the repository
```bash
git clone https://github.com/Ganesh2325/spreetrial.git
cd spreetrial
```

### 2. Backend Setup
```bash
cd backend
npm install
```
- Create a `.env` file in the `backend` directory based on `.env.example`:
  ```env
  PORT=5001
  DATABASE_URL="postgresql://username:password@localhost:5432/spreetrail"
  ```
- Run Prisma migrations:
  ```bash
  npx prisma db push
  ```
- Start the backend server:
  ```bash
  npm run dev
  ```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```
- Create a `.env.local` file in the `frontend` directory:
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:5001
  ```
- Start the frontend development server:
  ```bash
  npm run dev
  ```

### 4. Open Application
Navigate to `http://localhost:3000` in your browser.

## AI Tools Used
- Google DeepMind Antigravity AI Assistant was utilized throughout the development process for architectural guidance, debugging Docker deployment, writing the min-cash-flow algorithm, and troubleshooting Vercel environment variables.
