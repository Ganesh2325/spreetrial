# Example Import Report

*This report is generated dynamically by the application when a user uploads a CSV file. Below is an example of what the system produces.*

---
**Import Batch ID**: `imp_8f29d2b1`
**Date**: `2026-06-15 13:00:00 UTC`
**Group ID**: `d80caaad-2383-4a21-afb6-736a4665d41b`

## Summary
- **Total Rows Processed**: 8
- **Successfully Imported**: 5
- **Anomalies Detected**: 3

## Anomaly Details

### Row 3
- **Data**: `Dinner, , John, 2026-06-12`
- **Anomaly**: `Missing Amount`
- **Action Taken**: **Rejected**. The row was skipped and not inserted into the database.

### Row 6
- **Data**: `Uber, 25.00, Alice, INVALID_DATE`
- **Anomaly**: `Invalid Date Format`
- **Action Taken**: **Accepted with Warning**. The system fell back to using the current timestamp for this expense.

### Row 8
- **Data**: `Groceries, 100.00, GhostUser, 2026-06-14`
- **Anomaly**: `Payer Not Found`
- **Action Taken**: **Rejected**. No user named 'GhostUser' exists in this group. The row was skipped.
