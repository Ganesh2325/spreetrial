# AI Usage Log

This document records the usage of AI during the development of Spreetrail, including the tools used, key prompts, and cases where the AI made a mistake that had to be caught and corrected.

## AI Tools Used
- Google DeepMind Antigravity AI Assistant

## Key Prompts
1. *"Create a backend Express server using Prisma and PostgreSQL to manage users, groups, and expenses."*
2. *"Write a min-cash-flow algorithm in TypeScript that takes a list of debts and calculates the minimum number of transactions needed to settle them."*
3. *"Write a React page that parses a CSV file containing expenses, and renders a table showing rows that succeeded and rows that failed anomaly detection."*

## AI Mistakes & Corrections

### Case 1: Dockerfile Prisma Compilation
- **What the AI did wrong**: The AI generated a standard Node Dockerfile but forgot that Prisma requires the `openssl` library to be present in Alpine Linux. 
- **How it was caught**: The Render deployment failed with a runtime error `Prisma failed to detect the libssl/openssl version`.
- **What was changed**: We modified the Dockerfile to run `apk add --no-cache openssl` before installing dependencies, ensuring the Prisma query engine could compile correctly.

### Case 2: Vercel Environment Variables
- **What the AI did wrong**: The AI provided an example URL (`https://spreetrail-api.onrender.com`) in its instructions for configuring the Vercel frontend. 
- **How it was caught**: The live website threw a `Failed to fetch` CORS error because the example URL was actually returning a 404 Not Found from Render.
- **What was changed**: The AI had to explicitly instruct the user to go to their Render dashboard, find their unique active URL, and paste that specific URL into Vercel instead of the generic example.

### Case 3: Local Port Caching
- **What the AI did wrong**: The AI modified the backend code and `.env` file to change the local port from `5002` to `5001`. However, it forgot that the user's running `tsx watch` terminal session had cached the old environment variable in memory.
- **How it was caught**: The user kept getting an `EADDRINUSE` crash on port 5002 locally, even though all code files said 5001.
- **What was changed**: The AI ran a PowerShell command to forcefully kill the old Node processes and instructed the user to restart their terminal so it would load the fresh `5001` environment variable.
