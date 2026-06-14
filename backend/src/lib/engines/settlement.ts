export interface OptimizedTransaction {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export interface SettlementInput {
  userId: string;
  name: string;
  netBalance: number;
}

export function optimizeSettlements(
  membersBalances: SettlementInput[]
): OptimizedTransaction[] {
  const debtors = membersBalances
    .filter((m) => m.netBalance < -0.01)
    .map((m) => ({ ...m, netBalance: Math.abs(m.netBalance) }));

  const creditors = membersBalances
    .filter((m) => m.netBalance > 0.01)
    .map((m) => ({ ...m }));

  const transactions: OptimizedTransaction[] = [];

  const sortByBalanceDesc = (arr: typeof debtors) => {
    arr.sort((a, b) => b.netBalance - a.netBalance);
  };

  while (debtors.length > 0 && creditors.length > 0) {
    sortByBalanceDesc(debtors);
    sortByBalanceDesc(creditors);

    const debtor = debtors[0];
    const creditor = creditors[0];

    const amount = Number(Math.min(debtor.netBalance, creditor.netBalance).toFixed(2));

    if (amount > 0) {
      transactions.push({
        from: debtor.userId,
        fromName: debtor.name,
        to: creditor.userId,
        toName: creditor.name,
        amount: amount,
      });
    }

    debtor.netBalance -= amount;
    creditor.netBalance -= amount;

    if (debtor.netBalance < 0.01) {
      debtors.shift();
    }
    if (creditor.netBalance < 0.01) {
      creditors.shift();
    }
  }

  return transactions;
}
