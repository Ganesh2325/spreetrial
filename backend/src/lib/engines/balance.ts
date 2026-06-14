import { prisma } from '../db';

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'FIXED' | 'WEIGHTED' | 'CUSTOM';

export interface ParticipantInput {
  userId: string;
  value?: number;
}

export interface SplitResult {
  userId: string;
  splitAmount: number;
  sharePercentage: number;
  weight: number;
}

export function calculateSplits(
  totalAmount: number,
  splitType: SplitType,
  participants: ParticipantInput[],
  activeMemberIds: string[]
): SplitResult[] {
  const activeParticipants = participants.filter((p) =>
    activeMemberIds.includes(p.userId)
  );

  if (activeParticipants.length === 0) {
    throw new Error('No active members are selected for the expense split.');
  }

  const numParticipants = activeParticipants.length;
  let results: SplitResult[] = [];

  switch (splitType) {
    case 'EQUAL': {
      const shareAmount = Number((totalAmount / numParticipants).toFixed(2));
      let sum = 0;
      results = activeParticipants.map((p, idx) => {
        const amount = idx === numParticipants - 1 ? Number((totalAmount - sum).toFixed(2)) : shareAmount;
        sum += amount;
        return {
          userId: p.userId,
          splitAmount: amount,
          sharePercentage: Number(((amount / totalAmount) * 100).toFixed(2)),
          weight: 1.0,
        };
      });
      break;
    }

    case 'PERCENTAGE': {
      let totalPercentage = 0;
      activeParticipants.forEach((p) => {
        totalPercentage += p.value || 0;
      });

      if (Math.abs(totalPercentage - 100) > 0.05) {
        throw new Error(`Percentages must sum to 100%. Current sum: ${totalPercentage}%`);
      }

      let sum = 0;
      results = activeParticipants.map((p, idx) => {
        const pct = p.value || 0;
        const amount = idx === numParticipants - 1 ? Number((totalAmount - sum).toFixed(2)) : Number(((totalAmount * pct) / 100).toFixed(2));
        sum += amount;
        return {
          userId: p.userId,
          splitAmount: amount,
          sharePercentage: pct,
          weight: 1.0,
        };
      });
      break;
    }

    case 'FIXED':
    case 'CUSTOM': {
      let totalSplitSum = 0;
      activeParticipants.forEach((p) => {
        totalSplitSum += p.value || 0;
      });

      if (Math.abs(totalSplitSum - totalAmount) > 0.05) {
        throw new Error(
          `Fixed amounts must sum to the total expense. Total: ${totalAmount}, Sum of splits: ${totalSplitSum}`
        );
      }

      results = activeParticipants.map((p) => {
        const amount = p.value || 0;
        return {
          userId: p.userId,
          splitAmount: amount,
          sharePercentage: totalAmount > 0 ? Number(((amount / totalAmount) * 100).toFixed(2)) : 0,
          weight: 1.0,
        };
      });
      break;
    }

    case 'WEIGHTED': {
      let totalWeight = 0;
      activeParticipants.forEach((p) => {
        totalWeight += p.value || 0;
      });

      if (totalWeight <= 0) {
        throw new Error('Total weight must be greater than 0.');
      }

      let sum = 0;
      results = activeParticipants.map((p, idx) => {
        const weight = p.value || 0;
        const amount = idx === numParticipants - 1 ? Number((totalAmount - sum).toFixed(2)) : Number(((totalAmount * weight) / totalWeight).toFixed(2));
        sum += amount;
        return {
          userId: p.userId,
          splitAmount: amount,
          sharePercentage: totalAmount > 0 ? Number(((amount / totalAmount) * 100).toFixed(2)) : 0,
          weight: weight,
        };
      });
      break;
    }

    default:
      throw new Error(`Unsupported split type: ${splitType}`);
  }

  return results;
}

export async function getActiveMembersOnDate(groupId: string, date: Date): Promise<string[]> {
  const members = await prisma.groupMember.findMany({
    where: {
      groupId: groupId,
      joinedAt: {
        lte: date,
      },
    },
  });

  return members
    .filter((m) => m.leftAt === null || m.leftAt >= date)
    .map((m) => m.userId);
}

export interface MemberBalanceSummary {
  userId: string;
  name: string;
  email: string;
  paid: number;
  owed: number;
  settlementsPaid: number;
  settlementsReceived: number;
  netBalance: number;
}

export async function calculateGroupBalances(groupId: string): Promise<Record<string, MemberBalanceSummary>> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  const balances: Record<string, MemberBalanceSummary> = {};
  members.forEach((m) => {
    balances[m.userId] = {
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      paid: 0,
      owed: 0,
      settlementsPaid: 0,
      settlementsReceived: 0,
      netBalance: 0,
    };
  });

  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      isSettlement: false,
    },
    include: {
      participants: true,
    },
  });

  expenses.forEach((expense) => {
    if (balances[expense.payerId]) {
      balances[expense.payerId].paid += expense.convertedAmount;
    }

    expense.participants.forEach((p) => {
      if (balances[p.userId]) {
        balances[p.userId].owed += p.splitAmount;
      }
    });
  });

  const settlements = await prisma.settlement.findMany({
    where: { groupId },
  });

  settlements.forEach((s) => {
    if (balances[s.payerId]) {
      balances[s.payerId].settlementsPaid += s.convertedAmount;
    }
    if (balances[s.payeeId]) {
      balances[s.payeeId].settlementsReceived += s.convertedAmount;
    }
  });

  Object.keys(balances).forEach((userId) => {
    const b = balances[userId];
    b.paid = Number(b.paid.toFixed(2));
    b.owed = Number(b.owed.toFixed(2));
    b.settlementsPaid = Number(b.settlementsPaid.toFixed(2));
    b.settlementsReceived = Number(b.settlementsReceived.toFixed(2));
    b.netBalance = Number((b.paid - b.owed + b.settlementsPaid - b.settlementsReceived).toFixed(2));
  });

  return balances;
}

export async function explainBalance(groupId: string, userId: string) {
  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      isSettlement: false,
      OR: [
        { payerId: userId },
        {
          participants: {
            some: { userId },
          },
        },
      ],
    },
    include: {
      participants: {
        where: { userId },
      },
      payer: true,
    },
    orderBy: {
      expenseDate: 'asc',
    },
  });

  const settlements = await prisma.settlement.findMany({
    where: {
      groupId,
      OR: [{ payerId: userId }, { payeeId: userId }],
    },
    include: {
      payer: true,
      payee: true,
    },
    orderBy: {
      date: 'asc',
    },
  });

  interface ExplainItem {
    id: string;
    type: 'EXPENSE' | 'SETTLEMENT';
    description: string;
    date: Date;
    totalAmount: number;
    currency: string;
    share: number;
    contribution: number;
    impact: number;
  }

  const items: ExplainItem[] = [];

  expenses.forEach((e) => {
    const contribution = e.payerId === userId ? e.convertedAmount : 0;
    const share = e.participants[0]?.splitAmount || 0;
    const impact = Number((contribution - share).toFixed(2));

    items.push({
      id: e.id,
      type: 'EXPENSE',
      description: e.description,
      date: e.expenseDate,
      totalAmount: e.originalAmount,
      currency: e.originalCurrency,
      share,
      contribution,
      impact,
    });
  });

  settlements.forEach((s) => {
    const isSender = s.payerId === userId;
    const contribution = isSender ? s.convertedAmount : 0;
    const share = isSender ? 0 : s.convertedAmount;
    const impact = Number((contribution - share).toFixed(2));

    items.push({
      id: s.id,
      type: 'SETTLEMENT',
      description: isSender
        ? `Settlement paid to ${s.payee.name}`
        : `Settlement received from ${s.payer.name}`,
      date: s.date,
      totalAmount: s.amount,
      currency: s.currency,
      share,
      contribution,
      impact,
    });
  });

  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalance = 0;
  const trace = items.map((item) => {
    runningBalance = Number((runningBalance + item.impact).toFixed(2));
    return {
      ...item,
      runningBalance,
    };
  });

  return trace;
}
