# Wealth plan

A retirement planner you can use in the browser.

**Open the app:** [https://sabarish-soft.github.io/fin_planner/](https://sabarish-soft.github.io/fin_planner/)

Plans stay in your browser. Nothing is uploaded. You can keep several plans, export or import one as JSON, and print or save the report from the browser’s print dialog.

## What you enter

Amounts are today's rupees.

- **Preferences.** Date of birth, life expectancy, retirement age, plan start, contingency months, build period, and inflation.
- **Goals.** One-time or repeating, with their own inflation. Presets cover retirement spending, a home, education, a wedding, a car, monthly spending, and vacations. Repeating goals can use a safety shield. A one-time goal can be partly funded with a loan.
- **Incomes.** A schedule and an optional end date. Raises ease from a starting percent to an ending percent. An empty end date stops the income at retirement.
- **Liabilities.** Principal left, an end date, and an interest rate. The yearly payment is the amount that clears the loan by the end date.
- **Assets.** A category, a yearly growth rate, and a rebalance date. The balance cannot be spent until that year.

## What the report does

Each year from the plan start through life expectancy, assets grow, income is added, loans are paid, and goals are spent at their inflated cost. Contingency is refilled from savings up to several months of that year's recurring costs, and the balance earns a short-term return so it keeps moving. It pays safety-shield goals when income does not cover them. Other spending comes from liquid assets. A gap is a shortfall.

The report shows whether the plan stays funded, the earliest retirement age that still funds it, final and peak net worth, interest paid, amount invested, and the contingency balance.

## Run the projection check

```bash
node test/projection.test.js
```
