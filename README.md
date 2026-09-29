# Wealth plan

A single-page retirement planner. Open `index.html` in a browser. There is no build step and no server.

Plans stay in the browser. You can keep several, and the report updates as you edit. Export and import use a JSON file. Print / Save report uses the browser print dialog.

## What you enter

Amounts are today's rupees.

- **Preferences.** Date of birth, life expectancy, retirement age, plan start, contingency months, build period, and inflation.
- **Goals.** One-time or repeating, with their own inflation. Presets cover retirement spending, a home, education, a wedding, a car, monthly spending, and vacations. Repeating goals can use a safety shield. A one-time goal can be partly funded with a loan.
- **Incomes.** A schedule and an optional end date. Raises ease from a starting percent to an ending percent. An empty end date stops the income at retirement.
- **Liabilities.** Principal left, an end date, and an interest rate. The yearly payment is the amount that clears the loan by the end date.
- **Assets.** A category, a yearly growth rate, and a rebalance date. The balance cannot be spent until that year.

## What the report does

Each year from the plan start through life expectancy, assets grow, income is added, loans are paid, and goals are spent at their inflated cost. Contingency is filled only during the build period, from that year's savings, and does not earn a return. Safety-shield goals are paid from it first. Spending otherwise comes from liquid assets. A gap is a shortfall.

The report shows whether the plan stays funded, the earliest retirement age that still funds it, final and peak net worth, interest paid, amount invested, and the contingency balance.

## Check the projection

```bash
node test/projection.test.js
```
