const fs = require('fs');
const path = require('path');

const USAGE_FILE = process.env.USAGE_FILE_PATH || path.join(__dirname, '..', 'data', 'usage.json');
const MONTHLY_BUDGET_USD = parseFloat(process.env.MONTHLY_BUDGET_USD || '5', 10);
const INPUT_COST_PER_M = parseFloat(process.env.INPUT_COST_PER_M || '0.15', 10);
const OUTPUT_COST_PER_M = parseFloat(process.env.OUTPUT_COST_PER_M || '0.60', 10);

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function readUsage() {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    }
  } catch (_) {
    /* fresh start on corrupt file */
  }
  return { month: currentMonthKey(), spentUsd: 0, requestCount: 0 };
}

function writeUsage(data) {
  const dir = path.dirname(USAGE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

function getBudgetState() {
  const usage = readUsage();
  const month = currentMonthKey();

  if (usage.month !== month) {
    const fresh = { month, spentUsd: 0, requestCount: 0 };
    writeUsage(fresh);
    return { ...fresh, budgetUsd: MONTHLY_BUDGET_USD, remainingUsd: MONTHLY_BUDGET_USD, exhausted: false };
  }

  const remainingUsd = Math.max(0, MONTHLY_BUDGET_USD - usage.spentUsd);
  return {
    ...usage,
    budgetUsd: MONTHLY_BUDGET_USD,
    remainingUsd,
    exhausted: usage.spentUsd >= MONTHLY_BUDGET_USD,
  };
}

function estimateCost(usage) {
  if (!usage) return 0;
  const prompt = usage.prompt_tokens || 0;
  const completion = usage.completion_tokens || 0;
  return (prompt * INPUT_COST_PER_M + completion * OUTPUT_COST_PER_M) / 1_000_000;
}

function recordUsage(tokenUsage) {
  const state = getBudgetState();
  const cost = estimateCost(tokenUsage);
  const next = {
    month: state.month,
    spentUsd: Math.round((state.spentUsd + cost) * 1_000_000) / 1_000_000,
    requestCount: state.requestCount + 1,
    lastCostUsd: cost,
    lastTokens: tokenUsage || null,
  };
  writeUsage(next);
  return next;
}

function isBudgetExhausted() {
  return getBudgetState().exhausted;
}

module.exports = {
  getBudgetState,
  recordUsage,
  isBudgetExhausted,
  estimateCost,
  MONTHLY_BUDGET_USD,
};
