# Decision Log

This document records the major architectural and technical decisions made during the development of Spreetrail.

## 1. Monorepo vs Multi-repo Structure
- **Options Considered**: Having completely separate Git repositories for frontend and backend, vs a monorepo structure.
- **Decision**: Monorepo (`frontend/` and `backend/` folders in the same repository).
- **Reason**: Easier to review full-stack features in single commits, unified deployment pipelines, and simpler developer onboarding.

## 2. Debt Simplification Algorithm
- **Options Considered**: 
  1. Storing literal 1-to-1 debts for every expense.
  2. Calculating net balances per user and applying a greedy min-cash-flow algorithm.
- **Decision**: Greedy Min-Cash-Flow algorithm.
- **Reason**: If Alice owes Bob $10 and Bob owes Charlie $10, it's a terrible user experience to force two transactions. The greedy algorithm calculates net balances and settles the highest debtor with the highest creditor iteratively, minimizing total transactions.

## 3. Deployment Strategy (Vercel + Render)
- **Options Considered**: 
  1. Deploying everything together in a single AWS EC2 instance.
  2. Deploying frontend on Vercel and backend on Render using Docker.
- **Decision**: Vercel for Frontend, Render for Backend.
- **Reason**: Vercel provides world-class edge caching and Next.js optimization out-of-the-box. Render allows us to easily deploy the Node.js backend using a custom Dockerfile with Alpine Linux to keep the image small and fast.

## 4. State Management (Frontend)
- **Options Considered**: Redux, Zustand, React Context, React Query.
- **Decision**: React `useState` / `useEffect` combined with native `fetch`.
- **Reason**: Given the strict time constraints, we avoided the overhead of setting up Redux or Zustand. Simple React state was sufficient for our component tree.

## 5. CSV Parsing Library
- **Options Considered**: Native string splitting vs `csv-parse` vs `PapaParse`.
- **Decision**: `PapaParse`.
- **Reason**: Handling edge cases in CSVs (like commas inside quoted strings) is notoriously difficult to write from scratch. PapaParse handles malformed data gracefully and is extremely robust.
