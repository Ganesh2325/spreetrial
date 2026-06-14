import { prisma } from '../db';
import Papa from 'papaparse';

export function getLevenshteinDistance(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1 === str2) return 0;
  
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }
  return dp[m][n];
}

export interface CSVRow {
  Date: string;
  Description: string;
  Amount: string;
  Currency: string;
  PayerEmail: string;
  SplitType: string;
  Participants: string;
}

export interface AnomalyIssue {
  rowIndex: number;
  severity: 'ERROR' | 'WARNING';
  issueType: string;
  explanation: string;
  suggestedFix: string;
  autoAction: string | null;
  manualAction: string | null;
}

export async function analyzeCSVImport(
  csvContent: string,
  groupId: string
): Promise<{
  rows: CSVRow[];
  issues: AnomalyIssue[];
}> {
  const parseResult = Papa.parse<CSVRow>(csvContent.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parseResult.data;
  const issues: AnomalyIssue[] = [];

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { user: true },
      },
      expenses: {
        include: {
          payer: true,
          participants: true,
        },
      },
    },
  });

  if (!group) {
    // Return empty result with a group not found issue instead of throwing
    return {
      rows: [],
      issues: [
        {
          rowIndex: 0,
          severity: 'ERROR',
          issueType: 'GROUP_NOT_FOUND',
          explanation: 'The specified group does not exist.',
          suggestedFix: 'Create the group before importing CSV.',
          autoAction: null,
          manualAction: null,
        },
      ],
    };
  }

  const members = group.members;
  const existingExpenses = group.expenses;

  const userMap = new Map<string, typeof members[0]['user'] & { joinedAt: Date; leftAt: Date | null }>();
  members.forEach((m) => {
    const userEmail = m.user.email.toLowerCase();
    const userName = m.user.name.toLowerCase();
    const userDetail = {
      ...m.user,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
    };
    userMap.set(userEmail, userDetail);
    userMap.set(userName, userDetail);
  });

  const now = new Date();

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 1;

    if (!row.Description || row.Description.trim() === '') {
      issues.push({
        rowIndex: rowNum,
        severity: 'ERROR',
        issueType: 'EMPTY_DESCRIPTION',
        explanation: 'The description of the expense is empty.',
        suggestedFix: 'Provide a valid description for the expense (e.g., Room Rent).',
        autoAction: 'Set description to "Imported Expense"',
        manualAction: 'Edit description',
      });
    }

    if (!row.Date || row.Date.trim() === '') {
      issues.push({
        rowIndex: rowNum,
        severity: 'ERROR',
        issueType: 'MISSING_DATE',
        explanation: 'Expense date is missing.',
        suggestedFix: 'Enter a valid date in YYYY-MM-DD format.',
        autoAction: 'Default to today\'s date',
        manualAction: 'Select date',
      });
    }

    let parsedDate: Date | null = null;
    if (row.Date) {
      parsedDate = new Date(row.Date);
      if (isNaN(parsedDate.getTime())) {
        issues.push({
          rowIndex: rowNum,
          severity: 'ERROR',
          issueType: 'INVALID_DATE',
          explanation: `The date "${row.Date}" is invalid.`,
          suggestedFix: 'Enter the date in YYYY-MM-DD format.',
          autoAction: null,
          manualAction: 'Edit date value',
        });
        parsedDate = null;
      } else {
        if (parsedDate > now) {
          issues.push({
            rowIndex: rowNum,
            severity: 'ERROR',
            issueType: 'FUTURE_DATE',
            explanation: `The date ${row.Date} is in the future.`,
            suggestedFix: 'Provide a current or historical date.',
            autoAction: 'Set to current date',
            manualAction: 'Edit date value',
          });
        }
      }
    }

    const amountVal = parseFloat(row.Amount);
    if (isNaN(amountVal)) {
      issues.push({
        rowIndex: rowNum,
        severity: 'ERROR',
        issueType: 'INVALID_AMOUNT',
        explanation: `The amount "${row.Amount}" is not a valid number.`,
        suggestedFix: 'Enter a positive numeric value.',
        autoAction: null,
        manualAction: 'Input numeric value',
      });
    } else if (amountVal <= 0) {
      issues.push({
        rowIndex: rowNum,
        severity: 'ERROR',
        issueType: 'NEGATIVE_AMOUNT',
        explanation: 'Expense amount must be greater than zero.',
        suggestedFix: 'Ensure expense amount is positive.',
        autoAction: amountVal < 0 ? 'Convert to positive absolute value' : null,
        manualAction: 'Change amount',
      });
    }

    const currencyVal = (row.Currency || '').trim().toUpperCase();
    const allowedCurrencies = ['INR', 'USD', 'EUR'];
    if (!currencyVal) {
      issues.push({
        rowIndex: rowNum,
        severity: 'WARNING',
        issueType: 'MISSING_CURRENCY',
        explanation: 'No currency specified.',
        suggestedFix: `Default to group base currency (${group.currencyCode}).`,
        autoAction: `Apply ${group.currencyCode}`,
        manualAction: 'Choose currency',
      });
    } else if (!allowedCurrencies.includes(currencyVal)) {
      issues.push({
        rowIndex: rowNum,
        severity: 'ERROR',
        issueType: 'CURRENCY_MISMATCH',
        explanation: `Currency "${currencyVal}" is unsupported.`,
        suggestedFix: 'Choose one of: INR, USD, EUR.',
        autoAction: `Apply base currency ${group.currencyCode}`,
        manualAction: 'Map to a supported currency',
      });
    }

    const payerKey = (row.PayerEmail || '').trim().toLowerCase();
    const payerUser = userMap.get(payerKey);
    if (!payerKey) {
      issues.push({
        rowIndex: rowNum,
        severity: 'ERROR',
        issueType: 'MISSING_PAYER',
        explanation: 'The payer email/name is empty.',
        suggestedFix: 'Provide a valid roommate name or email.',
        autoAction: null,
        manualAction: 'Select payer from group',
      });
    } else if (!payerUser) {
      issues.push({
        rowIndex: rowNum,
        severity: 'ERROR',
        issueType: 'INVALID_PAYER',
        explanation: `Payer "${row.PayerEmail}" is not a member of this group.`,
        suggestedFix: 'Ensure payer is added to group or select active roommate.',
        autoAction: null,
        manualAction: 'Assign active member or Invite roommate',
      });
    }

    if (parsedDate && payerUser) {
      if (payerUser.leftAt && parsedDate > payerUser.leftAt) {
        issues.push({
          rowIndex: rowNum,
          severity: 'ERROR',
          issueType: 'PAYER_LEFT_TIMELINE',
          explanation: `Payer ${payerUser.name} left the group on ${payerUser.leftAt.toISOString().split('T')[0]}, but the expense date is ${row.Date}.`,
          suggestedFix: 'Verify the expense date or change the payer.',
          autoAction: null,
          manualAction: 'Adjust timeline or change payer',
        });
      }
      if (parsedDate < payerUser.joinedAt) {
        issues.push({
          rowIndex: rowNum,
          severity: 'ERROR',
          issueType: 'PAYER_JOINED_TIMELINE',
          explanation: `Payer ${payerUser.name} joined the group on ${payerUser.joinedAt.toISOString().split('T')[0]}, but the expense date is ${row.Date}.`,
          suggestedFix: 'Verify the expense date or change the payer.',
          autoAction: null,
          manualAction: 'Adjust timeline or change payer',
        });
      }
    }

    const splitTypeVal = (row.SplitType || 'EQUAL').trim().toUpperCase();
    const partString = row.Participants || '';

    const parsedParticipants: { emailOrName: string; value?: number }[] = [];
    if (partString.trim() !== '') {
      const parts = partString.split(',');
      parts.forEach((p) => {
        const item = p.trim();
        if (item.includes(':')) {
          const [name, valStr] = item.split(':');
          parsedParticipants.push({
            emailOrName: name.trim().toLowerCase(),
            value: parseFloat(valStr.trim()),
          });
        } else {
          parsedParticipants.push({
            emailOrName: item.toLowerCase(),
          });
        }
      });
    }

    let activeParticipantsCount = 0;
    let splitValueSum = 0;

    parsedParticipants.forEach((p) => {
      const u = userMap.get(p.emailOrName);
      if (!u) {
        issues.push({
          rowIndex: rowNum,
          severity: 'ERROR',
          issueType: 'INVALID_PARTICIPANT',
          explanation: `Split participant "${p.emailOrName}" is not a member of the group.`,
          suggestedFix: 'Select a valid group member for the split.',
          autoAction: null,
          manualAction: 'Assign to active members',
        });
      } else {
        activeParticipantsCount++;
        splitValueSum += p.value || 0;

        if (parsedDate) {
          if (u.leftAt && parsedDate > u.leftAt) {
            issues.push({
              rowIndex: rowNum,
              severity: 'ERROR',
              issueType: 'PARTICIPANT_LEFT_TIMELINE',
              explanation: `Participant ${u.name} left the group on ${u.leftAt.toISOString().split('T')[0]}, but the expense date is ${row.Date}.`,
              suggestedFix: 'Exempt left member from the split.',
              autoAction: 'Remove left member from split list',
              manualAction: 'Edit splits manually',
            });
          }
          if (parsedDate < u.joinedAt) {
            issues.push({
              rowIndex: rowNum,
              severity: 'ERROR',
              issueType: 'PARTICIPANT_JOINED_TIMELINE',
              explanation: `Participant ${u.name} joined the group on ${u.joinedAt.toISOString().split('T')[0]}, but the expense date is ${row.Date}.`,
              suggestedFix: 'Exempt non-joined member from the split.',
              autoAction: 'Remove non-joined member from split list',
              manualAction: 'Edit splits manually',
            });
          }
        }
      }
    });

    if (activeParticipantsCount === 0 && partString.trim() !== '') {
      issues.push({
        rowIndex: rowNum,
        severity: 'ERROR',
        issueType: 'NO_PARTICIPANTS',
        explanation: 'No valid participants specified for split.',
        suggestedFix: 'Split equally among all active members.',
        autoAction: 'Split equally among all active members',
        manualAction: 'Select split list',
      });
    }

    if (!isNaN(amountVal) && amountVal > 0 && activeParticipantsCount > 0) {
      if (splitTypeVal === 'PERCENTAGE' && Math.abs(splitValueSum - 100) > 0.05) {
        issues.push({
          rowIndex: rowNum,
          severity: 'ERROR',
          issueType: 'SPLIT_PERCENTAGE_MISMATCH',
          explanation: `Split percentages must sum to 100%. Current sum: ${splitValueSum}%.`,
          suggestedFix: 'Adjust percentages to sum to exactly 100%.',
          autoAction: 'Distribute remaining percentage equally',
          manualAction: 'Manually edit percentages',
        });
      } else if ((splitTypeVal === 'FIXED' || splitTypeVal === 'CUSTOM') && Math.abs(splitValueSum - amountVal) > 0.05) {
        issues.push({
          rowIndex: rowNum,
          severity: 'ERROR',
          issueType: 'SPLIT_AMOUNT_MISMATCH',
          explanation: `Sum of split amounts (${splitValueSum}) does not equal the total amount (${amountVal}).`,
          suggestedFix: 'Adjust individual splits or total amount.',
          autoAction: 'Adjust split sums to equal total amount',
          manualAction: 'Manually edit splits',
        });
      }
    }

    const descLower = (row.Description || '').toLowerCase();
    const settlementKeywords = ['settlement', 'settle', 'paid back', 'refund', 'repay', 'payment'];
    const isSettlementKeyword = settlementKeywords.some((kw) => descLower.includes(kw));
    const isSingleParticipantSettlement =
      activeParticipantsCount === 1 &&
      payerUser &&
      parsedParticipants[0] &&
      userMap.get(parsedParticipants[0].emailOrName)?.id !== payerUser.id;

    if (isSettlementKeyword || isSingleParticipantSettlement) {
      issues.push({
        rowIndex: rowNum,
        severity: 'WARNING',
        issueType: 'SETTLEMENT_AS_EXPENSE',
        explanation: `Expense "${row.Description}" looks like a debt settlement transaction.`,
        suggestedFix: 'Convert this record to a Settlement transaction instead of an Expense.',
        autoAction: 'Log as Settlement transaction',
        manualAction: 'Keep as Expense / Convert to Settlement',
      });
    }

    if (parsedDate && !isNaN(amountVal) && row.Description) {
      const dbDuplicate = existingExpenses.find(
        (e) =>
          e.description.toLowerCase().trim() === row.Description.toLowerCase().trim() &&
          Math.abs(e.originalAmount - amountVal) < 0.01 &&
          e.payerId === payerUser?.id &&
          e.expenseDate.toISOString().split('T')[0] === parsedDate?.toISOString().split('T')[0]
      );

      if (dbDuplicate) {
        issues.push({
          rowIndex: rowNum,
          severity: 'WARNING',
          issueType: 'DUPLICATE_EXPENSE',
          explanation: `Duplicate of existing expense "${row.Description}" (ID: ${dbDuplicate.id}) on ${row.Date} with amount ${row.Amount}.`,
          suggestedFix: 'Skip this row, merge with existing, or import as separate.',
          autoAction: 'Skip importing this duplicate',
          manualAction: 'Approve duplicate / Merge / Reject',
        });
      }

      const nearDuplicate = existingExpenses.find((e) => {
        const descDist = getLevenshteinDistance(e.description, row.Description);
        const amtMatch = Math.abs(e.originalAmount - amountVal) < 0.01;
        const dateDiff = Math.abs(e.expenseDate.getTime() - (parsedDate?.getTime() || 0)) / (1000 * 60 * 60 * 24);
        return descDist > 0 && descDist < 3 && amtMatch && dateDiff <= 2;
      });

      if (nearDuplicate) {
        issues.push({
          rowIndex: rowNum,
          severity: 'WARNING',
          issueType: 'NEAR_DUPLICATE_EXPENSE',
          explanation: `Looks similar to expense "${nearDuplicate.description}" on ${nearDuplicate.expenseDate.toISOString().split('T')[0]}.`,
          suggestedFix: 'Check if this is a double entry or edit description.',
          autoAction: null,
          manualAction: 'Skip / Keep both',
        });
      }

      const diffAmountMatch = existingExpenses.find(
        (e) =>
          e.description.toLowerCase().trim() === row.Description.toLowerCase().trim() &&
          Math.abs(e.originalAmount - amountVal) >= 0.01 &&
          e.payerId === payerUser?.id &&
          e.expenseDate.toISOString().split('T')[0] === parsedDate?.toISOString().split('T')[0]
      );

      if (diffAmountMatch) {
        issues.push({
          rowIndex: rowNum,
          severity: 'WARNING',
          issueType: 'DIFFERENT_AMOUNT_SAME_EXPENSE',
          explanation: `Same expense "${row.Description}" exists on ${row.Date} but with different amount ${diffAmountMatch.originalAmount}.`,
          suggestedFix: 'Verify which amount is correct.',
          autoAction: null,
          manualAction: 'Update existing amount / Keep both',
        });
      }
    }
  }

  return { rows, issues };
}
