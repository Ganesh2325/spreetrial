import { optimizeSettlements } from '../backend/src/lib/engines/settlement';
import { calculateSplits } from '../backend/src/lib/engines/balance';
import { getLevenshteinDistance } from '../backend/src/lib/engines/import-engine';

// Color logging helpers
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(red(`Assertion Failed: ${message}`));
  }
  console.log(green(`✓ Passed: ${message}`));
}

function runTests() {
  console.log(cyan('\n======================================='));
  console.log(cyan('RUNNING SPREETRAIL CORE ENGINE TESTS'));
  console.log(cyan('=======================================\n'));

  // ----------------------------------------------------
  // Test 1: Levenshtein Distance Check
  // ----------------------------------------------------
  console.log(cyan('--- Testing Levenshtein Distance ---'));
  assert(getLevenshteinDistance('Internet Bill', 'Internet Bill') === 0, 'Exact matches yield 0 distance');
  assert(getLevenshteinDistance('Internet Bill', 'Internet Bills') === 1, 'Single insertion yields 1 distance');
  assert(getLevenshteinDistance('Room cleaning', 'Room Rent') === 6, 'Different descriptions yield correct distance');
  console.log('');

  // ----------------------------------------------------
  // Test 2: Split Calculations Engine
  // ----------------------------------------------------
  console.log(cyan('--- Testing Split Calculations Engine ---'));
  
  // Equal Split
  const equalSplits = calculateSplits(
    1200, 
    'EQUAL', 
    [{ userId: 'A' }, { userId: 'B' }, { userId: 'C' }], 
    ['A', 'B', 'C']
  );
  assert(equalSplits.length === 3, 'Equal split generates exactly 3 participant splits');
  assert(equalSplits.every(s => s.splitAmount === 400), 'Equal splits share amount equally (1200 / 3 = 400)');

  // Weighted Split
  const weightedSplits = calculateSplits(
    1000,
    'WEIGHTED',
    [
      { userId: 'A', value: 2 }, // Weight 2
      { userId: 'B', value: 1 }, // Weight 1
      { userId: 'C', value: 1 }  // Weight 1
    ],
    ['A', 'B', 'C']
  );
  assert(weightedSplits.find(s => s.userId === 'A')?.splitAmount === 500, 'Weight 2 share gets 500');
  assert(weightedSplits.find(s => s.userId === 'B')?.splitAmount === 250, 'Weight 1 share gets 250');
  assert(weightedSplits.find(s => s.userId === 'C')?.splitAmount === 250, 'Weight 1 share gets 250');

  // Percentage Split
  const pctSplits = calculateSplits(
    1500,
    'PERCENTAGE',
    [
      { userId: 'A', value: 50 },
      { userId: 'B', value: 30 },
      { userId: 'C', value: 20 }
    ],
    ['A', 'B', 'C']
  );
  assert(pctSplits.find(s => s.userId === 'A')?.splitAmount === 750, '50% of 1500 is 750');
  assert(pctSplits.find(s => s.userId === 'B')?.splitAmount === 450, '30% of 1500 is 450');
  assert(pctSplits.find(s => s.userId === 'C')?.splitAmount === 300, '20% of 1500 is 300');
  console.log('');

  // ----------------------------------------------------
  // Test 3: Settlement Graph Optimization (Cash Flow Minimizer)
  // ----------------------------------------------------
  console.log(cyan('--- Testing Settlement Optimization (Graph Reduction) ---'));
  
  // Input:
  // A has netBalance -1500 (owes 1500)
  // B has netBalance 2500 (gets back 2500)
  // C has netBalance 500 (gets back 500)
  // D has netBalance -1500 (owes 1500)
  const balancesInput = [
    { userId: 'A', name: 'Aisha', netBalance: -1500 },
    { userId: 'B', name: 'Rohan', netBalance: 2500 },
    { userId: 'C', name: 'Priya', netBalance: 500 },
    { userId: 'D', name: 'Dev', netBalance: -1500 }
  ];

  const transactions = optimizeSettlements(balancesInput);
  
  // Greedy matches:
  // Sort Debtors: A (1500), D (1500)
  // Sort Creditors: B (2500), C (500)
  // Step 1: A pays B 1500. A settled. B remaining: 1000
  // Step 2: D pays B 1000. B settled. D remaining: 500
  // Step 3: D pays C 500. C and D settled.
  
  assert(transactions.length === 3, 'Optimized cash flow yields exactly 3 transactions (reduced from original matrix)');
  
  const t1 = transactions.find(t => t.from === 'A' && t.to === 'B');
  assert(t1 !== undefined && t1.amount === 1500, 'Transaction: Aisha pays Rohan 1500');

  const t2 = transactions.find(t => t.from === 'D' && t.to === 'B');
  assert(t2 !== undefined && t2.amount === 1000, 'Transaction: Dev pays Rohan 1000');

  const t3 = transactions.find(t => t.from === 'D' && t.to === 'C');
  assert(t3 !== undefined && t3.amount === 500, 'Transaction: Dev pays Priya 500');

  console.log(cyan('\n======================================='));
  console.log(green('ALL ENGINE TESTS PASSED SUCCESSFULLY!'));
  console.log(cyan('=======================================\n'));
}

try {
  runTests();
} catch (e: any) {
  console.error('\n' + red('Test suite failed:'), e.message);
  process.exit(1);
}
