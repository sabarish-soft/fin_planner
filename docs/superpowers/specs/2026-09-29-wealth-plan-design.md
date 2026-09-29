# Wealth plan designer

A single HTML file for building and adjusting retirement plans. Inputs follow the Wealth42 plan editor. The projection stays a yearly practical planner. Nothing is locked behind credits. No build step and no server.

## Scope

In scope:

- Several named plans kept in the browser
- Wealth42-style fields for preferences, goals, incomes, liabilities, and assets, including the presets from that editor
- A yearly projection from the plan start through life expectancy
- Report that updates as soon as inputs change
- Print to PDF through the browser print dialog
- Export and import one plan as JSON

Out of scope:

- Credits, coins, and a separate "generate" or "recalculate" action
- Sign-in, sharing, and a backend
- FIRE solvers that search for a required income or a required corpus
- Investment-policy buckets and per-fund monthly allocation
- Month-by-month cashflow and tracing which past deposit pays a goal
- Currencies other than rupees

## Plan data

Stored as a JSON array under `localStorage` key `wealth-plans`. The active plan id is `wealth-plan-active`.

```json
{
  "id": "string",
  "name": "string",
  "dateOfBirth": "1984-06-18",
  "lifeExpectancyAge": 85,
  "retirementAge": 60,
  "planStartDate": "2026-10-01",
  "contingencyMonths": 6,
  "buildPeriodMonths": 12,
  "inflation": 0.065,
  "incomes": [],
  "assets": [],
  "liabilities": [],
  "goals": []
}
```

Amounts are rupees in today's value, as of `planStartDate`. Rates are stored as decimals and entered as percents (`6.5` means 6.5%).

Age on a date is the completed years from `dateOfBirth` to that date. The plan runs one row per calendar year from the year of `planStartDate` through the year the person reaches `lifeExpectancyAge`.

A new plan is named "New plan" with date of birth 35 years before today, life expectancy 85, retirement age 60, plan start today, contingency 6 months, build period 12 months, and inflation 6.5%. Lists start empty.

### Incomes

```json
{
  "id": "string",
  "name": "string",
  "kind": "recurring",
  "amountToday": 0,
  "every": 1,
  "unit": "month",
  "startDate": "2026-10-01",
  "endDate": null,
  "growthStart": 0.15,
  "growthEnd": 0.05
}
```

- `kind` is `recurring` or `once`.
- `amountToday` is one occurrence in today's rupees.
- `every` and `unit` (`month` or `year`) are the gap between occurrences. They are ignored when `kind` is `once`.
- `endDate` null means the income stops at retirement: it is paid only while age is below `retirementAge`. A set end date is honored even after retirement.
- `growthStart` and `growthEnd` are annual raise rates. They apply only to recurring incomes.

### Assets

```json
{
  "id": "string",
  "name": "string",
  "category": "Equity/MF",
  "amount": 0,
  "growth": 0.09,
  "rebalanceDate": "2026-10-01"
}
```

Categories: Cash/Bank, Equity/MF, Real Estate, Gold, Fixed Income, Retirement Corpus (PF/NPS), Other.

The balance grows at `growth` every year. It cannot be spent until the calendar year of `rebalanceDate`. From that year on it is liquid.

### Liabilities

```json
{
  "id": "string",
  "name": "string",
  "principal": 0,
  "endDate": "2056-10-01",
  "annualRate": 0.08
}
```

`principal` is the balance left on `planStartDate`. There is no separate payment field. The yearly payment is the level payment that brings the balance to zero in the calendar year of `endDate`.

### Goals

```json
{
  "id": "string",
  "name": "string",
  "category": "Retirement Spends",
  "kind": "recurring",
  "amountToday": 100000,
  "inflation": 0.065,
  "targetAge": null,
  "startAge": 60,
  "endAge": 85,
  "every": 1,
  "unit": "month",
  "safetyShield": true,
  "loan": null
}
```

Categories: Home, Education, Car, Vacation, Wedding, Retirement Spends, Other.

- `amountToday` is one occurrence in today's rupees. Recurring rows label it per occurrence (a monthly goal is the monthly amount, not the yearly amount).
- `inflation` is that goal's own rate. New goals copy the plan inflation.
- `kind` `once` uses `targetAge` and ignores the recurring schedule.
- `kind` `recurring` uses `startAge`, `endAge`, `every`, and `unit`.
- `safetyShield` is only for recurring goals. Those occurrences are paid from the contingency balance first.
- `loan` is only for one-time goals. Null means no loan. Otherwise `{ "downPaymentPercent": 20, "annualRate": 0.085, "tenorYears": 15 }`.

## How inputs hit the yearly projection

Each calendar year, in order:

1. Grow every asset by its `growth`. Grow the invested-surplus balance (defined below) by the average of the asset `growth` values. If the plan has no assets, that average is 0. Contingency cash does not grow.
2. Move an asset into the liquid pool when the year reaches its `rebalanceDate`.
3. Add this year's income into the liquid pool. A one-time income is paid in the year of `startDate`. A recurring income pays once per date in that year on its schedule, measured from `startDate`. The occurrence amount starts at `amountToday` and compounds once a year. The raise rate moves in a straight line from `growthStart` in the start year to `growthEnd` in the last planned year of that income (the end date, or retirement when the end date is empty). Income is not inflated again.
4. For each liability, including loans opened by goals in earlier years, add `balance * annualRate` to the balance and to lifetime interest. The scheduled payment is the original level payment. Pay `min(scheduled payment, balance)` from the liquid pool and reduce the balance. Balance never goes below zero.
5. Pay goals due this year. Inflate an occurrence with that goal's inflation: `amountToday * (1 + inflation) ^ years`, where `years` is the calendar year minus the plan-start year. A one-time goal is due in the year the person reaches `targetAge`. A recurring goal's dates start on the birthday of `startAge` and repeat every `every` months or years through the birthday year of `endAge`.
6. A safety-shield occurrence is taken from contingency first. Any remainder, and every goal without the shield, is taken from the liquid pool.
7. A one-time goal with a loan spends only the down payment from the liquid pool. The rest becomes a new liability in that same year: rate `loan.annualRate`, tenor `loan.tenorYears`, level yearly payment. That first payment is taken from the liquid pool immediately, interest for the year is included in the lifetime interest total, and the balance is reduced the same way as in step 4.
8. If the liquid pool is negative, that positive gap is this year's shortfall. Add it to the lifetime unfunded total and set the liquid pool to zero.
9. Savings this year are `max(0, income - liability payments - cash spent on goals)`, counted after step 7. Contingency is topped up only while the plan is still inside the build period, rounded up to whole years (`ceil(buildPeriodMonths / 12)` years from the plan start). In those years, move `min(savings, target - contingency balance)` from the liquid pool into contingency. After the build period, contingency is not topped up. It can still pay safety-shield goals. The target for the year is `contingencyMonths` times one month of recurring-goal cost due that year (inflated occurrence amounts divided by 12).

The invested surplus is the part of the liquid pool that did not come from an asset row. It is tracked separately so asset rows can stay illiquid until their rebalance date.

Net worth is liquid assets plus illiquid assets plus contingency minus remaining liability balances.

Derived figures:

- **Funded** when every year's shortfall is zero.
- **First shortfall age** is the smallest age with a shortfall, or none.
- **Final net worth** and **peak net worth** (with age) use the definition above. The last year is the life-expectancy year.
- **Interest paid** is the sum of liability interest, including goal loans.
- **Total invested** is the sum of yearly savings that stayed in the liquid pool rather than moving into contingency.
- **Earliest retirement age** is the smallest age from the age at plan start, plus one, through life expectancy, such that a fresh run with that retirement age has no shortfall. Incomes with an empty end date stop at the trial age. Dated incomes, goals, assets, and liabilities stay as entered.

## Screens

One page, two views, same active plan. Editing recalculates before the next paint. There is no credit balance and no generate button.

**Plan bar:** list of plans, new, rename, duplicate, delete. A new plan asks for a name. Rename asks for a name. Delete asks for confirmation. Deleting the only plan clears it back to a new empty plan.

**Edit view**, five blocks, each with add, edit, and remove:

- **Preferences.** Date of birth, life expectancy, retirement age, plan start date, contingency months, build period in months, inflation percent. Currency is rupees.
- **Goals.** Presets that add an editable row: Retirement, Dream Home, Child's Education, Child's Wedding, Car Upgrade, Monthly Spend, Annual Vacation, and Create Custom. Fields match the goal object. Retirement defaults to a monthly amount from retirement age through life expectancy with safety shield on. Car Upgrade defaults to every 8 years. Monthly Spend defaults to every month from the plan-start age through retirement. Loan planning is shown only for a one-time goal. Safety shield is shown only for a recurring goal.
- **Incomes.** Fields match the income object. No calculate-amount, calculate-duration, or calculate-corpus actions.
- **Liabilities.** Presets: Home loan (8%, 30 years from plan start), Car loan (9.5%, 5 years), Custom loan (12%, end date left blank until filled). Fields are name, principal left, end date, and interest percent.
- **Assets.** Presets: Current liquid net worth (Equity/MF, liquid on the plan start, 9%), Real estate to sell (Real Estate, rebalance 10 years out, 5%), NPS/PF lumpsum (Retirement Corpus, rebalance at retirement age, 8%), FD maturity (Fixed Income, rebalance 1 year out, 6%), Custom asset. Fields match the asset object.

**Report view**

- Status: funded through life expectancy, or the first shortfall age and the unfunded total, plus the earliest retirement age when one exists
- Cards: retirement age, final net worth, peak net worth and age, interest paid, total invested, contingency balance at the end
- Charts: net worth by year, assets versus liabilities by year, contingency balance by year
- Goals table: name, today's occurrence cost, inflated cost at the first due year, loan down payment when a loan is on, and the plan-level funded or shortfall status
- Year-by-year table, collapsed by default: age, year, income, goal spending, liability payment, interest, contingency, shortfall, net worth
- Input summary of the preferences and every row
- Print / Save report via `window.print()`, with the edit controls and plan bar hidden
- Export plan as `<plan-name>.json` and import a plan object. Invalid JSON shows an error and does not change existing plans.

## Validation

- Blank numeric fields are zero.
- Retirement age is greater than the age at plan start and less than or equal to life expectancy. Until the ages are valid, the field shows an error and the previous valid preferences are kept.
- Life expectancy is an integer from 1 to 120 and greater than the age at plan start.
- A goal end age is greater than or equal to its start age, and both sit inside life expectancy.
- An end date, when set, is on or after its start date.
- Rates, amounts, ages, and tenor cannot be negative. Down payment percent is from 0 to 100.
- A liability whose end date is missing or not after the plan start is excluded from the projection and the row shows that warning.
- Import of a plan that lacks the objects above is rejected.

## File

`index.html` at the repository root. Markup, CSS, and script are in that file. Charts are inline SVG. No libraries.

## Check

Open `index.html`. Enter a plan that can be recomputed by hand for two years: one recurring income with a raise, one liquid asset, one illiquid asset that rebalances in year two, one loan, one one-time goal with a loan, and one monthly safety-shield goal. Confirm net worth, interest, contingency transfer during the build period, shortfall, earliest retirement age, reload, import round-trip, and that print hides the edit controls.

## Reference walk

Wealth42's signed-in editor, walked 29 Sep 2026, is the source of the fields and presets above. Credits, the paid recalculation step, FIRE utility buttons, and the horizon-by-horizon fund mixer are not part of this app. The report here is the yearly practical result, not Wealth42's monthly funding trace.
