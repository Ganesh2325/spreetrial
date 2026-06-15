# Scope & Anomaly Log

This document outlines the database schema of the Spreetrail application, as well as the anomaly detection rules implemented during the CSV data ingestion process.

## Database Schema (Prisma)

Our PostgreSQL database uses the following core entities:
- **User**: Stores user credentials, email, and name.
- **Group**: Represents a shared expense group.
- **GroupMember**: A join table mapping Users to Groups.
- **Expense**: Represents an expense transaction. Contains `amount`, `description`, `date`, `payerId`, and `groupId`.
- **ExpenseParticipant**: Represents how much a specific user owes for a specific expense (`owedShare`).
- **DataImport**: Tracks CSV import batches.
- **AuditLog**: Immutable ledger of all events (creates, updates, deletes, imports) inside a group.

## Anomaly Detection Log (CSV Ingestion)

When users upload a CSV file to bulk-import expenses, the backend parser processes the rows. The following data problems are actively detected and handled:

1. **Missing Required Fields**
   - *Problem*: A row is missing a description, amount, or payer.
   - *Handling*: The row is rejected and marked as an error. The user is shown which row failed and why.
2. **Invalid Amount Formats**
   - *Problem*: Amounts containing currency symbols (`$`, `€`), commas (`1,000`), or negative values (`-50`).
   - *Handling*: The parser strips out common currency symbols and commas. If the parsed number is still negative or Not-a-Number (NaN), the row is rejected.
3. **Invalid Date Formats**
   - *Problem*: Dates formatted inconsistently (e.g., `MM-DD-YYYY`, `YYYY/MM/DD`, or gibberish strings).
   - *Handling*: The system attempts strict ISO 8601 parsing. If the date is invalid, it falls back to the current date `new Date()` but flags a warning in the import report so the user is aware of the assumption.
4. **Unmatched Users / Typos in Payer Name**
   - *Problem*: The "Payer" specified in the CSV does not match the exact name of any existing group member.
   - *Handling*: The system performs a case-insensitive lookup. If no user is found, the row is rejected to prevent assigning debt to a ghost user.
5. **Duplicate Transactions**
   - *Problem*: The exact same expense (same amount, same description, same payer, same date) is uploaded twice.
   - *Handling*: Before inserting, the database is queried for an identical expense within the group. If a match is found, the system skips the row and flags it as a "Duplicate Skipped" anomaly to prevent double-charging.
