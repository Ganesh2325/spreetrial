import { prisma } from '../db';

const DEFAULT_RATES: Record<string, Record<string, number>> = {
  USD: { INR: 83.5, EUR: 0.92, USD: 1.0 },
  EUR: { INR: 90.2, USD: 1.08, EUR: 1.0 },
  INR: { USD: 0.012, EUR: 0.011, INR: 1.0 },
};

export async function getExchangeRate(
  from: string,
  to: string,
  date: Date = new Date()
): Promise<{ rate: number; isFallback: boolean }> {
  const cleanFrom = from.toUpperCase();
  const cleanTo = to.toUpperCase();

  if (cleanFrom === cleanTo) {
    return { rate: 1.0, isFallback: false };
  }

  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dbRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: cleanFrom,
        toCurrency: cleanTo,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (dbRate) {
      return { rate: dbRate.rate, isFallback: false };
    }

    const latestDbRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: cleanFrom,
        toCurrency: cleanTo,
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (latestDbRate) {
      return { rate: latestDbRate.rate, isFallback: false };
    }
  } catch (error) {
    console.error('Error fetching exchange rate from database:', error);
  }

  const fromRates = DEFAULT_RATES[cleanFrom];
  if (fromRates && fromRates[cleanTo] !== undefined) {
    return { rate: fromRates[cleanTo], isFallback: true };
  }

  const reverseRates = DEFAULT_RATES[cleanTo];
  if (reverseRates && reverseRates[cleanFrom] !== undefined) {
    return { rate: 1 / reverseRates[cleanFrom], isFallback: true };
  }

  return { rate: 1.0, isFallback: true };
}

export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
  date: Date = new Date()
): Promise<{
  convertedAmount: number;
  rate: number;
  isFallback: boolean;
}> {
  const { rate, isFallback } = await getExchangeRate(from, to, date);
  const convertedAmount = Number((amount * rate).toFixed(2));
  return { convertedAmount, rate, isFallback };
}
