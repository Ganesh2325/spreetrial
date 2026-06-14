import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding PostgreSQL database...');

  // Clean existing data
  await prisma.auditLog.deleteMany({});
  await prisma.importIssue.deleteMany({});
  await prisma.expenseImport.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.expenseParticipant.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.membershipHistory.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.exchangeRate.deleteMany({});
  await prisma.currency.deleteMany({});

  // Seed Currencies
  const inr = await prisma.currency.create({
    data: { code: 'INR', symbol: '₹', name: 'Indian Rupee', isBase: true },
  });
  const usd = await prisma.currency.create({
    data: { code: 'USD', symbol: '$', name: 'US Dollar', isBase: false },
  });
  const eur = await prisma.currency.create({
    data: { code: 'EUR', symbol: '€', name: 'Euro', isBase: false },
  });

  // Seed Exchange Rates
  const exchangeRates = [
    { fromCurrency: 'USD', toCurrency: 'INR', rate: 83.5, date: new Date('2026-01-01') },
    { fromCurrency: 'EUR', toCurrency: 'INR', rate: 90.2, date: new Date('2026-01-01') },
    { fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.92, date: new Date('2026-01-01') },
    { fromCurrency: 'INR', toCurrency: 'USD', rate: 0.012, date: new Date('2026-01-01') },
    { fromCurrency: 'INR', toCurrency: 'EUR', rate: 0.011, date: new Date('2026-01-01') },
    { fromCurrency: 'USD', toCurrency: 'INR', rate: 84.0, date: new Date('2026-04-01') },
    { fromCurrency: 'EUR', toCurrency: 'INR', rate: 91.0, date: new Date('2026-04-01') },
    { fromCurrency: 'USD', toCurrency: 'INR', rate: 84.2, date: new Date('2026-05-10') },
  ];

  for (const rate of exchangeRates) {
    await prisma.exchangeRate.create({ data: rate });
  }

  // Seed Users
  const usersData = [
    { name: 'Aisha', email: 'aisha@example.com', passwordHash: 'aisha123' },
    { name: 'Rohan', email: 'rohan@example.com', passwordHash: 'rohan123' },
    { name: 'Priya', email: 'priya@example.com', passwordHash: 'priya123' },
    { name: 'Meera', email: 'meera@example.com', passwordHash: 'meera123' },
    { name: 'Dev', email: 'dev@example.com', passwordHash: 'dev123' },
    { name: 'Sam', email: 'sam@example.com', passwordHash: 'sam123' },
  ];

  const users: Record<string, any> = {};
  for (const u of usersData) {
    users[u.name] = await prisma.user.create({ data: u });
  }

  // Seed Group
  const group = await prisma.group.create({
    data: {
      name: 'Room 404 Roommates',
      description: 'Shared expenses for the 4th floor roommates of Apt 404.',
      currencyCode: 'INR',
    },
  });

  // Seed Members (Aisha, Rohan, Priya, Meera, Dev joined Jan 1st, Sam joined April 1st)
  const joinedJan = new Date('2026-01-01');
  const joinedApr = new Date('2026-04-01');

  const memberships = [
    { userId: users.Aisha.id, joinedAt: joinedJan, leftAt: null },
    { userId: users.Rohan.id, joinedAt: joinedJan, leftAt: null },
    { userId: users.Priya.id, joinedAt: joinedJan, leftAt: null },
    { userId: users.Meera.id, joinedAt: joinedJan, leftAt: null },
    { userId: users.Dev.id, joinedAt: joinedJan, leftAt: null },
    { userId: users.Sam.id, joinedAt: joinedApr, leftAt: null },
  ];

  for (const m of memberships) {
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: m.userId,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt,
        role: m.userId === users.Aisha.id ? 'ADMIN' : 'MEMBER',
      },
    });

    await prisma.membershipHistory.create({
      data: {
        groupId: group.id,
        userId: m.userId,
        action: 'JOIN',
        timestamp: m.joinedAt,
      },
    });
  }

  // Seed Initial Expenses
  // Expense 1: Internet Bill (Feb 15)
  const expense1 = await prisma.expense.create({
    data: {
      groupId: group.id,
      payerId: users.Aisha.id,
      description: 'Internet Bill (February)',
      originalAmount: 1200,
      originalCurrency: 'INR',
      convertedAmount: 1200,
      convertedCurrency: 'INR',
      exchangeRate: 1.0,
      expenseDate: new Date('2026-02-15'),
      category: 'Utilities',
    },
  });

  const membersJan = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev'];
  for (const name of membersJan) {
    await prisma.expenseParticipant.create({
      data: {
        expenseId: expense1.id,
        userId: users[name].id,
        splitAmount: 240,
        sharePercentage: 20,
        splitType: 'EQUAL',
      },
    });
  }

  // Expense 2: Apartment Cleaning (March 10)
  const expense2 = await prisma.expense.create({
    data: {
      groupId: group.id,
      payerId: users.Rohan.id,
      description: 'Apartment Deep Cleaning',
      originalAmount: 1500,
      originalCurrency: 'INR',
      convertedAmount: 1500,
      convertedCurrency: 'INR',
      exchangeRate: 1.0,
      expenseDate: new Date('2026-03-10'),
      category: 'Maintenance',
    },
  });

  for (const name of membersJan) {
    await prisma.expenseParticipant.create({
      data: {
        expenseId: expense2.id,
        userId: users[name].id,
        splitAmount: 300,
        sharePercentage: 20,
        splitType: 'EQUAL',
      },
    });
  }

  // Expense 3: Goa Cabin Booking (May 10) - 300 USD
  const rateGoa = 84.2;
  const convertedGoa = 300 * rateGoa;
  const expense3 = await prisma.expense.create({
    data: {
      groupId: group.id,
      payerId: users.Priya.id,
      description: 'Goa Trip Cabin Booking',
      originalAmount: 300,
      originalCurrency: 'USD',
      convertedAmount: convertedGoa,
      convertedCurrency: 'INR',
      exchangeRate: rateGoa,
      expenseDate: new Date('2026-05-10'),
      category: 'Travel',
    },
  });

  const allMembers = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev', 'Sam'];
  for (const name of allMembers) {
    await prisma.expenseParticipant.create({
      data: {
        expenseId: expense3.id,
        userId: users[name].id,
        splitAmount: 50 * rateGoa,
        sharePercentage: 100 / 6,
        splitType: 'EQUAL',
      },
    });
  }

  // Seed a settlement: Aisha paid Rohan 300 INR
  await prisma.settlement.create({
    data: {
      groupId: group.id,
      payerId: users.Aisha.id,
      payeeId: users.Rohan.id,
      amount: 300,
      currency: 'INR',
      exchangeRate: 1.0,
      convertedAmount: 300,
      date: new Date('2026-03-20'),
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
