import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './lib/db';
import { getActiveMembersOnDate, calculateSplits, calculateGroupBalances, explainBalance, SplitType } from './lib/engines/balance';
import { optimizeSettlements } from './lib/engines/settlement';
import { convertCurrency } from './lib/engines/currency';
import { analyzeCSVImport } from './lib/engines/import-engine';

dotenv.config();

const app = express();
const PORT = 5002;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Helper middleware to get authenticated user from x-user-id header
async function getUserId(req: express.Request): Promise<string | null> {
  const userId = req.headers['x-user-id'];
  if (!userId || typeof userId !== 'string') return null;
  return userId;
}

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.toLowerCase().trim();

    if (trimmedName.length === 0) {
      return res.status(400).json({ error: 'Username cannot be empty' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        passwordHash: password,
      },
    });

    // Auto-join to default Room 404 Roommates group
    const defaultGroup = await prisma.group.findFirst({
      where: { name: 'Room 404 Roommates' },
    });

    if (defaultGroup) {
      const newMember = await prisma.groupMember.create({
        data: {
          groupId: defaultGroup.id,
          userId: user.id,
          role: 'MEMBER',
          joinedAt: new Date(),
        },
      });

      await prisma.membershipHistory.create({
        data: {
          groupId: defaultGroup.id,
          userId: user.id,
          action: 'JOIN',
          timestamp: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'MEMBER_JOINED',
          entityType: 'MEMBERSHIP',
          entityId: newMember.id,
          newValue: JSON.stringify({ userId: user.id, date: new Date() }),
        },
      });
    }

    return res.status(201).json({ user });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// GROUPS ENDPOINTS
// ----------------------------------------------------
app.get('/api/groups', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const groups = await prisma.group.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ groups });
  } catch (error) {
    console.error('Fetch groups error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// ----------------------------------------------------
// GROUP CREATE ENDPOINT
// ----------------------------------------------------
app.post('/api/groups', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, description, currencyCode } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name required' });
    const group = await prisma.group.create({
      data: {
        name,
        description,
        currencyCode,
      },
    });
    // Add creator as admin member
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: 'ADMIN',
        joinedAt: new Date(),
      },
    });
    return res.status(201).json({ group });
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/groups/:id/imports', async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { csvContent, filename } = req.body;
    if (!csvContent) return res.status(400).json({ error: 'csvContent required' });
    // Run import analysis
    const result = await analyzeCSVImport(csvContent, groupId);
    return res.json(result);
  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});



app.get('/api/groups/:id', async (req, res) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
        history: {
          include: { user: true },
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!group) return res.status(404).json({ error: 'Group not found' });
    return res.json({ group });
  } catch (error) {
    console.error('Fetch group details error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Membership JOIN/LEAVE timelines
app.post('/api/groups/:id/members', async (req, res) => {
  try {
    const groupId = req.params.id;
    const authorId = await getUserId(req);
    if (!authorId) return res.status(401).json({ error: 'Unauthorized' });

    const { action, userId, date } = req.body;
    if (!action || !userId) return res.status(400).json({ error: 'Action and User ID are required' });

    const eventDate = date ? new Date(date) : new Date();

    if (action === 'JOIN') {
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: { groupId, userId },
        },
      });

      if (existingMember) {
        if (existingMember.leftAt) {
          const updated = await prisma.groupMember.update({
            where: { id: existingMember.id },
            data: { leftAt: null, joinedAt: eventDate, active: true },
          });

          await prisma.membershipHistory.create({
            data: { groupId, userId, action: 'JOIN', timestamp: eventDate },
          });

          await prisma.auditLog.create({
            data: {
              userId: authorId,
              action: 'MEMBER_REJOINED',
              entityType: 'MEMBERSHIP',
              entityId: updated.id,
              newValue: JSON.stringify({ userId, date: eventDate }),
            },
          });

          return res.json({ success: true, member: updated });
        }
        return res.status(400).json({ error: 'User is already a member' });
      }

      // Ensure the user exists before creating membership
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (!userExists) {
        return res.status(400).json({ error: 'User does not exist' });
      }
      const newMember = await prisma.groupMember.create({
        data: {
          groupId,
          userId,
          joinedAt: eventDate,
          role: 'MEMBER',
        },
      });

      await prisma.membershipHistory.create({
        data: { groupId, userId, action: 'JOIN', timestamp: eventDate },
      });

      await prisma.auditLog.create({
        data: {
          userId: authorId,
          action: 'MEMBER_JOINED',
          entityType: 'MEMBERSHIP',
          entityId: newMember.id,
          newValue: JSON.stringify({ userId, date: eventDate }),
        },
      });

      return res.json({ success: true, member: newMember });
    } else if (action === 'LEAVE') {
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: { groupId, userId },
        },
      });

      if (!existingMember) return res.status(400).json({ error: 'User is not a member' });
      if (existingMember.leftAt) return res.status(400).json({ error: 'Member has already left' });

      const updated = await prisma.groupMember.update({
        where: { id: existingMember.id },
        data: { leftAt: eventDate, active: false },
      });

      await prisma.membershipHistory.create({
        data: { groupId, userId, action: 'LEAVE', timestamp: eventDate },
      });

      await prisma.auditLog.create({
        data: {
          userId: authorId,
          action: 'MEMBER_LEFT',
          entityType: 'MEMBERSHIP',
          entityId: updated.id,
          newValue: JSON.stringify({ userId, date: eventDate }),
        },
      });

      return res.json({ success: true, member: updated });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Member mutation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// BALANCES & EXPLANATIONS
// ----------------------------------------------------
app.get('/api/groups/:id/balances', async (req, res) => {
  try {
    const groupId = req.params.id;
    const balances = await calculateGroupBalances(groupId);

    const optimizationInput = Object.values(balances).map((b) => ({
      userId: b.userId,
      name: b.name,
      netBalance: b.netBalance,
    }));

    const suggestedTransactions = optimizeSettlements(optimizationInput);

    return res.json({
      balances: Object.values(balances),
      suggestedSettlements: suggestedTransactions,
    });
  } catch (error) {
    console.error('Calculate balances error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/groups/:id/explain-balance', async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const trace = await explainBalance(groupId, userId);
    return res.json({ trace });
  } catch (error) {
    console.error('Explain balance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// EXPENSES
// ----------------------------------------------------
app.get('/api/groups/:id/expenses', async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { groupId: req.params.id, isSettlement: false },
      include: {
        payer: true,
        participants: { include: { user: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });
    return res.json({ expenses });
  } catch (error) {
    console.error('Fetch expenses error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/groups/:id/expenses', async (req, res) => {
  try {
    const groupId = req.params.id;
    const authorId = await getUserId(req);
    if (!authorId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      description,
      amount,
      currency,
      payerId,
      expenseDate,
      category,
      splitType,
      participants,
    } = req.body;

    if (!description || !amount || !currency || !payerId || !expenseDate || !splitType || !participants) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const date = new Date(expenseDate);
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const activeMemberIds = await getActiveMembersOnDate(groupId, date);
    if (!activeMemberIds.includes(payerId)) {
      return res.status(400).json({ error: 'Payer was not active on this date' });
    }

    let splits;
    try {
      splits = calculateSplits(amount, splitType as SplitType, participants, activeMemberIds);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Split calculation failed' });
    }

    const { convertedAmount, rate } = await convertCurrency(amount, currency, group.currencyCode, date);

    const newExpense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          groupId,
          payerId,
          description,
          originalAmount: amount,
          originalCurrency: currency,
          convertedAmount,
          convertedCurrency: group.currencyCode,
          exchangeRate: rate,
          expenseDate: date,
          category: category || 'General',
        },
      });

      const participantData = splits.map((s) => ({
        expenseId: exp.id,
        userId: s.userId,
        splitAmount: s.splitAmount,
        sharePercentage: s.sharePercentage,
        weight: s.weight,
        splitType: splitType,
      }));

      for (const p of participantData) {
        await tx.expenseParticipant.create({ data: p });
      }

      await tx.auditLog.create({
        data: {
          userId: authorId,
          action: 'EXPENSE_CREATED',
          entityType: 'EXPENSE',
          entityId: exp.id,
          newValue: JSON.stringify({ expense: exp, participants: participantData }),
        },
      });

      return exp;
    });

    return res.json({ expense: newExpense });
  } catch (error) {
    console.error('Create expense error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// SETTLEMENTS
// ----------------------------------------------------
app.get('/api/groups/:id/settlements', async (req, res) => {
  try {
    const settlements = await prisma.settlement.findMany({
      where: { groupId: req.params.id },
      include: { payer: true, payee: true },
      orderBy: { date: 'desc' },
    });
    return res.json({ settlements });
  } catch (error) {
    console.error('Fetch settlements error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/groups/:id/settlements', async (req, res) => {
  try {
    const groupId = req.params.id;
    const authorId = await getUserId(req);
    if (!authorId) return res.status(401).json({ error: 'Unauthorized' });

    const { payerId, payeeId, amount, currency, date } = req.body;
    if (!payerId || !payeeId || !amount || !currency || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const settlementDate = new Date(date);
    const { convertedAmount, rate } = await convertCurrency(amount, currency, group.currencyCode, settlementDate);

    const settlement = await prisma.$transaction(async (tx) => {
      const s = await tx.settlement.create({
        data: {
          groupId,
          payerId,
          payeeId,
          amount,
          currency,
          exchangeRate: rate,
          convertedAmount,
          date: settlementDate,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: authorId,
          action: 'SETTLEMENT_ADDED',
          entityType: 'SETTLEMENT',
          entityId: s.id,
          newValue: JSON.stringify(s),
        },
      });

      return s;
    });

    return res.json({ settlement });
  } catch (error) {
    console.error('Add settlement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// CSV IMPORTS & REVIEW QUEUE
// ----------------------------------------------------
app.get('/api/groups/:id/imports', async (req, res) => {
  try {
    const imports = await prisma.expenseImport.findMany({
      where: { groupId: req.params.id },
      include: { uploadedBy: true, issues: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ imports });
  } catch (error) {
    console.error('Fetch imports error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/groups/:id/imports', async (req, res) => {
  try {
    const groupId = req.params.id;
    const authorId = await getUserId(req);
    if (!authorId) return res.status(401).json({ error: 'Unauthorized' });

    const { csvContent, filename } = req.body;
    if (!csvContent || !filename) {
      return res.status(400).json({ error: 'Missing csvContent or filename' });
    }

    const { rows, issues } = await analyzeCSVImport(csvContent, groupId);

    const expenseImport = await prisma.$transaction(async (tx) => {
      const imp = await tx.expenseImport.create({
        data: {
          groupId,
          filename,
          uploadedById: authorId,
          status: 'PENDING',
        },
      });

      for (const issue of issues) {
        await tx.importIssue.create({
          data: {
            importId: imp.id,
            rowIndex: issue.rowIndex,
            severity: issue.severity,
            issueType: issue.issueType,
            explanation: issue.explanation,
            suggestedFix: issue.suggestedFix,
            autoAction: issue.autoAction,
            manualAction: issue.manualAction,
            status: 'PENDING',
          },
        });
      }

      return imp;
    });

    const savedIssues = await prisma.importIssue.findMany({
      where: { importId: expenseImport.id },
    });

    return res.json({
      importId: expenseImport.id,
      status: expenseImport.status,
      rows,
      issues: savedIssues,
    });
  } catch (error: any) {
    console.error('CSV import analyze error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Import Action overrides (Meera's Queue execution)
app.post('/api/groups/:id/imports/:importId/action', async (req, res) => {
  try {
    const { id: groupId, importId } = req.params;
    const authorId = await getUserId(req);
    if (!authorId) return res.status(401).json({ error: 'Unauthorized' });

    const { action, resolvedRows } = req.body;

    const imp = await prisma.expenseImport.findUnique({
      where: { id: importId },
    });

    if (!imp) return res.status(404).json({ error: 'Import record not found' });

    if (action === 'REJECT') {
      await prisma.$transaction(async (tx) => {
        await tx.expenseImport.update({
          where: { id: importId },
          data: { status: 'REJECTED' },
        });

        await tx.importIssue.updateMany({
          where: { importId },
          data: { status: 'RESOLVED' },
        });

        await tx.auditLog.create({
          data: {
            userId: authorId,
            action: 'IMPORT_REJECTED',
            entityType: 'IMPORT',
            entityId: importId,
          },
        });
      });

      return res.json({ success: true, status: 'REJECTED' });
    }

    if (action === 'APPROVE') {
      if (!resolvedRows || !Array.isArray(resolvedRows)) {
        return res.status(400).json({ error: 'Resolved rows list is required for approval' });
      }

      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: { include: { user: true } },
        },
      });

      if (!group) return res.status(404).json({ error: 'Group not found' });

      const memberMap = new Map<string, string>();
      group.members.forEach((m) => {
        memberMap.set(m.user.email.toLowerCase(), m.user.id);
        memberMap.set(m.user.name.toLowerCase(), m.user.id);
      });

      const processedItems: any[] = [];

      await prisma.$transaction(async (tx) => {
        for (const row of resolvedRows) {
          if (row.resolutionAction === 'SKIP' || row.resolutionAction === 'REJECT') {
            continue;
          }

          const desc = row.Description || 'Imported Expense';
          const amt = parseFloat(row.Amount);
          const origCurrency = (row.Currency || group.currencyCode).toUpperCase();
          const payerKey = (row.PayerEmail || '').trim().toLowerCase();
          const payerId = memberMap.get(payerKey) || authorId;
          const expenseDate = new Date(row.Date || new Date());
          const splitType = (row.SplitType || 'EQUAL').toUpperCase() as SplitType;

          const isSettlementRecord =
            row.resolutionAction === 'CONVERT_TO_SETTLEMENT' ||
            (row.issueType === 'SETTLEMENT_AS_EXPENSE' && row.resolutionAction === 'AUTO');

          if (isSettlementRecord) {
            const parts = (row.Participants || '').split(',');
            const payeeKey = parts[0]?.split(':')[0]?.trim().toLowerCase() || '';
            const payeeId = memberMap.get(payeeKey);

            if (!payeeId) continue;

            const { convertedAmount, rate } = await convertCurrency(amt, origCurrency, group.currencyCode, expenseDate);

            const settlement = await tx.settlement.create({
              data: {
                groupId,
                payerId,
                payeeId,
                amount: amt,
                currency: origCurrency,
                exchangeRate: rate,
                convertedAmount,
                date: expenseDate,
              },
            });

            await tx.auditLog.create({
              data: {
                userId: authorId,
                action: 'SETTLEMENT_ADDED',
                entityType: 'SETTLEMENT',
                entityId: settlement.id,
                newValue: JSON.stringify(settlement),
              },
            });

            processedItems.push({ type: 'SETTLEMENT', id: settlement.id });
            continue;
          }

          const activeMemberIds = await getActiveMembersOnDate(groupId, expenseDate);
          const { convertedAmount, rate } = await convertCurrency(amt, origCurrency, group.currencyCode, expenseDate);

          const partString = row.Participants || '';
          const parsedParticipants: { userId: string; value?: number }[] = [];

          if (partString.trim() === '') {
            activeMemberIds.forEach((mId) => {
              parsedParticipants.push({ userId: mId });
            });
          } else {
            const splitParts = partString.split(',');
            splitParts.forEach((p: string) => {
              const item = p.trim();
              if (item.includes(':')) {
                const [name, valStr] = item.split(':');
                const uId = memberMap.get(name.trim().toLowerCase());
                if (uId) {
                  parsedParticipants.push({
                    userId: uId,
                    value: parseFloat(valStr.trim()),
                  });
                }
              } else {
                const uId = memberMap.get(item.toLowerCase());
                if (uId) {
                  parsedParticipants.push({ userId: uId });
                }
              }
            });
          }

          if (parsedParticipants.length === 0) {
            activeMemberIds.forEach((mId) => {
              parsedParticipants.push({ userId: mId });
            });
          }

          const splits = calculateSplits(amt, splitType, parsedParticipants, activeMemberIds);

          const exp = await tx.expense.create({
            data: {
              groupId,
              payerId,
              description: desc,
              originalAmount: amt,
              originalCurrency: origCurrency,
              convertedAmount,
              convertedCurrency: group.currencyCode,
              exchangeRate: rate,
              expenseDate,
              category: row.Category || 'Imported',
            },
          });

          for (const s of splits) {
            await tx.expenseParticipant.create({
              data: {
                expenseId: exp.id,
                userId: s.userId,
                splitAmount: s.splitAmount,
                sharePercentage: s.sharePercentage,
                weight: s.weight,
                splitType: splitType,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              userId: authorId,
              action: 'EXPENSE_CREATED',
              entityType: 'EXPENSE',
              entityId: exp.id,
              newValue: JSON.stringify(exp),
            },
          });

          processedItems.push({ type: 'EXPENSE', id: exp.id });
        }

        await tx.expenseImport.update({
          where: { id: importId },
          data: { status: 'APPROVED' },
        });

        await tx.importIssue.updateMany({
          where: { importId },
          data: { status: 'RESOLVED' },
        });

        await tx.auditLog.create({
          data: {
            userId: authorId,
            action: 'IMPORT_APPROVED',
            entityType: 'IMPORT',
            entityId: importId,
          },
        });
      });

      return res.json({ success: true, status: 'APPROVED', itemsCount: processedItems.length });
    }

    return res.status(400).json({ error: 'Invalid action type' });
  } catch (error: any) {
    console.error('Import action error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
// ----------------------------------------------------
// IMPORT CONFIRMATION (frontend final step)
// ----------------------------------------------------
app.post('/api/groups/:id/imports/confirm', async (req, res) => {
  try {
    const groupId = req.params.id;
    const authorId = await getUserId(req);
    if (!authorId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to import' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: true } } },
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Build member lookup map (email or name -> userId)
    const memberMap = new Map<string, string>();
    group.members.forEach(m => {
      if (m.user.email) memberMap.set(m.user.email.toLowerCase(), m.user.id);
      if (m.user.name) memberMap.set(m.user.name.toLowerCase(), m.user.id);
    });

    const processedItems: any[] = [];
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        // Basic validation
        const desc = row.Description || 'Imported Expense';
        const amt = parseFloat(row.Amount);
        const origCurrency = (row.Currency || group.currencyCode).toUpperCase();
        const payerKey = (row.PayerEmail || '').trim().toLowerCase();
        const payerId = memberMap.get(payerKey) || authorId;
        const expenseDate = new Date(row.Date || new Date());
        const splitType = (row.SplitType || 'EQUAL').toUpperCase();

        // Ensure payer is active on the date
        const activeMemberIds = await getActiveMembersOnDate(groupId, expenseDate);
        if (!activeMemberIds.includes(payerId)) {
          // skip rows with invalid payer
          continue;
        }

        // Parse participants
        const partString = row.Participants || '';
        const parsedParticipants: { userId: string; value?: number }[] = [];
        if (partString.trim() === '') {
          activeMemberIds.forEach(id => parsedParticipants.push({ userId: id }));
        } else {
          const parts = partString.split(',');
          parts.forEach((p: string) => {
            const item = p.trim();
            if (item.includes(':')) {
              const [name, val] = item.split(':');
              const uid = memberMap.get(name.trim().toLowerCase());
              if (uid) parsedParticipants.push({ userId: uid, value: parseFloat(val) });
            } else {
              const uid = memberMap.get(item.toLowerCase());
              if (uid) parsedParticipants.push({ userId: uid });
            }
          });
        }
        if (parsedParticipants.length === 0) {
          activeMemberIds.forEach(id => parsedParticipants.push({ userId: id }));
        }

        // Calculate splits – may throw if invalid
        let splits;
        try {
          // @ts-ignore - splitType is string at runtime
          splits = calculateSplits(amt, splitType as any, parsedParticipants, activeMemberIds);
        } catch (e: any) {
          // skip problematic row
          continue;
        }

        const { convertedAmount, rate } = await convertCurrency(amt, origCurrency, group.currencyCode, expenseDate);

        // Create expense record
        const exp = await tx.expense.create({
          data: {
            groupId,
            payerId,
            description: desc,
            originalAmount: amt,
            originalCurrency: origCurrency,
            convertedAmount,
            convertedCurrency: group.currencyCode,
            exchangeRate: rate,
            expenseDate,
            category: row.Category || 'Imported',
          },
        });

        // Create participants
        for (const s of splits) {
          await tx.expenseParticipant.create({
            data: {
              expenseId: exp.id,
              userId: s.userId,
              splitAmount: s.splitAmount,
              sharePercentage: s.sharePercentage,
              weight: s.weight,
              splitType: splitType,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: authorId,
            action: 'EXPENSE_CREATED',
            entityType: 'EXPENSE',
            entityId: exp.id,
            newValue: JSON.stringify({ expense: exp, participants: splits }),
          },
        });

        processedItems.push({ expenseId: exp.id, description: desc, amount: amt });
      }
    });

    return res.json({ success: true, processedCount: processedItems.length, items: processedItems });
  } catch (error) {
    console.error('Import confirm error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// ----------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------
app.get('/api/groups/:id/audit-logs', async (req, res) => {
  try {
    const groupId = req.params.id;

    // Gather all entity IDs that belong to this group
    const [expenses, settlements, imports, members] = await Promise.all([
      prisma.expense.findMany({ where: { groupId }, select: { id: true } }),
      prisma.settlement.findMany({ where: { groupId }, select: { id: true } }),
      prisma.expenseImport.findMany({ where: { groupId }, select: { id: true } }),
      prisma.groupMember.findMany({ where: { groupId }, select: { id: true } }),
    ]);

    const entityIds = [
      ...expenses.map(e => e.id),
      ...settlements.map(s => s.id),
      ...imports.map(i => i.id),
      ...members.map(m => m.id),
    ];

    const logs = await prisma.auditLog.findMany({
      where: { entityId: { in: entityIds } },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
    return res.json({ auditLogs: logs });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// USERS - list all users (for member invite)
// ----------------------------------------------------
  app.get('/api/users', async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      });
      return res.json({ users });
    } catch (error) {
      console.error('Fetch users error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Global error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

app.listen(PORT, () => {
  console.log(`Backend server successfully running on port ${PORT}`);
});
