const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const match = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!match) throw new Error("engine script missing");

const sandbox = {};
vm.runInNewContext(match[1], sandbox);
const { project, earliestRetirementAge, cashflow } = sandbox.WealthPlan;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function near(actual, expected, msg) {
  if (Math.abs(actual - expected) > 1) {
    throw new Error(msg + " expected " + expected + " got " + actual);
  }
}

const plan = {
  dateOfBirth: "1980-01-01",
  lifeExpectancyAge: 41,
  retirementAge: 41,
  planStartDate: "2020-01-01",
  contingencyMonths: 6,
  buildPeriodMonths: 12,
  inflation: 0,
  incomes: [
    {
      id: "in1",
      name: "Salary",
      kind: "recurring",
      amountToday: 120000,
      every: 1,
      unit: "year",
      startDate: "2020-01-01",
      endDate: null,
      growthStart: 0,
      growthEnd: 0,
    },
  ],
  assets: [
    { id: "a1", name: "Fund", category: "Equity/MF", amount: 100000, growth: 0.1, rebalanceDate: "2020-01-01" },
    { id: "a2", name: "House", category: "Real Estate", amount: 50000, growth: 0, rebalanceDate: "2021-01-01" },
  ],
  liabilities: [
    { id: "l1", name: "Loan", principal: 10000, endDate: "2021-01-01", annualRate: 0 },
  ],
  goals: [
    {
      id: "g1",
      name: "Home",
      category: "Home",
      kind: "once",
      amountToday: 10000,
      inflation: 0,
      targetAge: 40,
      loan: { downPaymentPercent: 50, annualRate: 0, tenorYears: 1 },
    },
    {
      id: "g2",
      name: "Spend",
      category: "Other",
      kind: "recurring",
      amountToday: 1000,
      inflation: 0,
      startAge: 40,
      endAge: 41,
      every: 1,
      unit: "month",
      safetyShield: true,
    },
  ],
};

const result = project(plan);
near(result.rows[0].netWorth, 248000, "year 1 net worth");
near(result.rows[0].contingency, 6000, "year 1 contingency");
near(result.rows[0].shortfall, 0, "year 1 shortfall");
near(result.rows[1].netWorth, 262340, "year 2 net worth");
near(result.rows[1].contingency, 5240, "year 2 contingency");
near(result.finalNetWorth, 262340, "final");
near(result.peakNetWorth, 262340, "peak");
assert(result.peakAge === 41, "peak age");
near(result.interestPaid, 0, "interest");
near(result.totalInvested, 82000, "invested");
assert(result.funded === true, "funded");
assert(result.firstShortfallAge == null, "no shortfall");
assert(earliestRetirementAge(plan) === 41, "earliest retirement");

const raised = project({
  dateOfBirth: "1980-01-01",
  lifeExpectancyAge: 41,
  retirementAge: 50,
  planStartDate: "2020-01-01",
  contingencyMonths: 0,
  buildPeriodMonths: 0,
  inflation: 0,
  incomes: [
    {
      kind: "recurring",
      amountToday: 100,
      every: 1,
      unit: "year",
      startDate: "2020-01-01",
      endDate: "2021-01-01",
      growthStart: 0.1,
      growthEnd: 0.1,
    },
  ],
  assets: [],
  liabilities: [],
  goals: [],
});
near(raised.rows[0].income, 100, "income year 1");
near(raised.rows[1].income, 110, "income year 2");

const interest = project({
  dateOfBirth: "1980-01-01",
  lifeExpectancyAge: 40,
  retirementAge: 40,
  planStartDate: "2020-01-01",
  contingencyMonths: 0,
  buildPeriodMonths: 0,
  inflation: 0,
  incomes: [],
  assets: [{ amount: 2000, growth: 0, rebalanceDate: "2020-01-01" }],
  liabilities: [{ principal: 1000, endDate: "2021-01-01", annualRate: 0.1 }],
  goals: [],
});
near(interest.interestPaid, 100, "interest charged");
near(interest.rows[0].liabilityPayment, 1100, "loan payoff");

const short = project({
  dateOfBirth: "1980-01-01",
  lifeExpectancyAge: 41,
  retirementAge: 41,
  planStartDate: "2020-01-01",
  contingencyMonths: 0,
  buildPeriodMonths: 0,
  inflation: 0,
  incomes: [],
  assets: [{ amount: 1000, growth: 0, rebalanceDate: "2021-01-01" }],
  liabilities: [],
  goals: [{ kind: "once", amountToday: 100, inflation: 0, targetAge: 40 }],
});
near(short.rows[0].shortfall, 0, "one-time goal is paid from locked savings");
near(short.rows[0].netWorth, 900, "one-time goal reduces wealth");

const rising = project({
  dateOfBirth: "1980-01-01",
  lifeExpectancyAge: 42,
  retirementAge: 50,
  planStartDate: "2020-01-01",
  contingencyMonths: 0,
  buildPeriodMonths: 0,
  inflation: 0.1,
  incomes: [{ kind: "recurring", amountToday: 100000, every: 1, unit: "year", startDate: "2020-01-01", endDate: "2022-01-01", growthStart: 0, growthEnd: 0 }],
  assets: [],
  liabilities: [],
  goals: [{ kind: "recurring", amountToday: 1000, inflation: 0.1, startAge: 40, endAge: 42, every: 1, unit: "year", safetyShield: false }]
});
near(rising.rows[0].goalSpending, 1000, "cost in the start year");
near(rising.rows[1].goalSpending, 1100, "cost after one inflation year");
near(rising.rows[2].goalSpending, 1210, "cost after two inflation years");

const spent = project({
  dateOfBirth: "1980-01-01",
  lifeExpectancyAge: 41,
  retirementAge: 50,
  planStartDate: "2020-01-01",
  contingencyMonths: 0,
  buildPeriodMonths: 0,
  inflation: 0.1,
  incomes: [],
  assets: [{ amount: 100000, growth: 0, rebalanceDate: "2020-01-01" }],
  liabilities: [],
  goals: [{ name: "Home", kind: "once", amountToday: 10000, inflation: 0.1, targetAge: 41 }]
});
near(spent.rows[0].assets, 100000, "assets before the goal year");
near(spent.rows[1].assets, 89000, "inflated goal comes out of assets");
near(spent.rows[1].netWorth, 89000, "net worth after the goal");
assert(spent.rows[1].milestones.length === 1 && spent.rows[1].milestones[0].name === "Home" && spent.rows[1].milestones[0].index === 0, "goal milestone");
near(spent.rows[1].milestones[0].amount, 11000, "milestone uses inflated cost");

const pot = project({
  dateOfBirth: "1980-01-01",
  lifeExpectancyAge: 42,
  retirementAge: 50,
  planStartDate: "2020-01-01",
  contingencyMonths: 12,
  buildPeriodMonths: 12,
  inflation: 0,
  incomes: [{ kind: "recurring", amountToday: 200000, every: 1, unit: "year", startDate: "2020-01-01", endDate: "2022-01-01", growthStart: 0, growthEnd: 0 }],
  assets: [],
  liabilities: [],
  goals: [{ kind: "recurring", amountToday: 1000, inflation: 0, startAge: 40, endAge: 42, every: 1, unit: "month", safetyShield: true }]
});
assert(pot.rows[1].contingency > pot.rows[0].contingency, "contingency rises after it is funded");
assert(pot.rows[2].contingency > pot.rows[1].contingency, "contingency keeps moving");

const wedding = project({
  dateOfBirth: "1980-01-01",
  lifeExpectancyAge: 41,
  retirementAge: 50,
  planStartDate: "2020-01-01",
  contingencyMonths: 0,
  buildPeriodMonths: 0,
  inflation: 0,
  incomes: [],
  assets: [{ amount: 100000, growth: 0, rebalanceDate: "2030-01-01" }],
  liabilities: [],
  goals: [{ name: "Child's wedding", kind: "once", amountToday: 25000, inflation: 0, targetAge: 40 }]
});
near(wedding.rows[0].netWorth, 75000, "wedding is removed from wealth");
near(wedding.rows[0].assets, 75000, "wedding is removed from investments");
assert(!wedding.rows[0].shortfall, "locked savings can pay the wedding");

const gone = project({
  dateOfBirth: "1980-01-01",
  lifeExpectancyAge: 43,
  retirementAge: 50,
  planStartDate: "2020-01-01",
  contingencyMonths: 0,
  buildPeriodMonths: 0,
  inflation: 0,
  incomes: [],
  assets: [{ amount: 10000, growth: 0, rebalanceDate: "2020-01-01" }],
  liabilities: [],
  goals: [{ kind: "once", amountToday: 10000, inflation: 0, targetAge: 41 }]
});
assert(gone.funded === false, "running out before the end is not funded");
assert(gone.depletedAge === 41, "depletion age");
assert(gone.firstShortfallAge == null, "the goal itself was paid");

function flowPlan(extra) {
  return Object.assign({
    dateOfBirth: "1980-01-01",
    lifeExpectancyAge: 41,
    retirementAge: 50,
    planStartDate: "2020-01-01",
    contingencyMonths: 0,
    buildPeriodMonths: 0,
    inflation: 0,
    incomes: [],
    assets: [],
    liabilities: [],
    goals: [{ name: "Child's wedding", kind: "once", amountToday: 25000, inflation: 0, targetAge: 40 }]
  }, extra);
}
const january = cashflow(flowPlan({
  incomes: [{ kind: "recurring", amountToday: 10000, every: 1, unit: "month", startDate: "2020-01-01", endDate: "2020-12-31", growthStart: 0, growthEnd: 0 }]
}));
assert(january.events.length === 1 && january.events[0].cover === "loan", "January wedding is short before later salary");
near(january.events[0].gap, 15000, "January wedding gap");
const december = cashflow(flowPlan({
  dateOfBirth: "1980-12-01",
  incomes: [{ kind: "recurring", amountToday: 10000, every: 1, unit: "month", startDate: "2020-01-01", endDate: "2020-12-31", growthStart: 0, growthEnd: 0 }]
}));
assert(december.events[0].cover === "cash" && december.events[0].date.slice(0, 7) === "2020-12", "December wedding uses salary already received");
const invested = cashflow(flowPlan({
  assets: [{ amount: 100000, growth: 0, rebalanceDate: "2020-01-01" }]
}));
assert(invested.events[0].cover === "investments", "liquid savings pay the wedding");
const other = cashflow(flowPlan({
  assets: [{ amount: 100000, growth: 0, rebalanceDate: "2030-01-01" }]
}));
assert(other.events[0].cover === "other", "locked savings are other investments");
const bare = cashflow(flowPlan({}));
assert(bare.events[0].cover === "loan", "nothing saved needs a short-term loan");
near(bare.events[0].gap, 25000, "full wedding is short");

console.log("projection tests passed");
