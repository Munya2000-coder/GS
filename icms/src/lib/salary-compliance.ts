import { getConfig } from "./config";

/**
 * Salary & hours compliance (PRD Module 8 / ICMS-034,035).
 *
 * Checks a proposed salary/hours against:
 *  - the going rate for the SOC code
 *  - the immigration salary floor for the route
 *  - National Minimum Wage (hourly)
 *  - Working Time Regulations maximum weekly hours
 *
 * Thresholds are configurable (PRD §17) and read from the Configuration store,
 * falling back to built-in defaults aligned with the Health and Care Worker route.
 */

export type SalaryCheck = {
  pass: boolean;
  blocking: boolean; // true if any hard floor (immigration threshold / NMW) is breached
  checks: { label: string; required: number; actual: number; pass: boolean; unit: string }[];
};

const DEFAULTS = {
  immigrationFloorAnnual: 23200, // Health & Care Worker route floor
  nmwHourly: 11.44,
  wtrMaxWeeklyHours: 48,
  goingRateBySoc: {
    "6135": { annual: 23200, hourly: 11.9 }, // Care workers
    "6136": { annual: 24400, hourly: 12.5 }, // Senior care workers
  } as Record<string, { annual: number; hourly: number }>,
};

export async function checkSalaryCompliance(input: {
  socCode: string;
  salary: number;
  contractedHours: number;
}): Promise<SalaryCheck> {
  const floor = await getConfig<number>("salary_thresholds", "immigration_floor_annual", DEFAULTS.immigrationFloorAnnual);
  const nmw = await getConfig<number>("salary_thresholds", "nmw_hourly", DEFAULTS.nmwHourly);
  const wtr = await getConfig<number>("salary_thresholds", "wtr_max_weekly_hours", DEFAULTS.wtrMaxWeeklyHours);
  const goingRates = await getConfig("salary_thresholds", "going_rate_by_soc", DEFAULTS.goingRateBySoc);

  const going = (goingRates as typeof DEFAULTS.goingRateBySoc)[input.socCode] ?? { annual: floor, hourly: nmw };
  const hourly = input.contractedHours > 0 ? input.salary / 52 / input.contractedHours : 0;

  const checks = [
    { label: "Immigration salary floor", required: floor, actual: input.salary, pass: input.salary >= floor, unit: "£/yr", hard: true },
    { label: `Going rate (SOC ${input.socCode})`, required: going.annual, actual: input.salary, pass: input.salary >= going.annual, unit: "£/yr", hard: false },
    { label: "National Minimum Wage", required: nmw, actual: Math.round(hourly * 100) / 100, pass: hourly >= nmw, unit: "£/hr", hard: true },
    { label: "WTR max weekly hours", required: wtr, actual: input.contractedHours, pass: input.contractedHours <= wtr, unit: "hrs", hard: false },
  ];

  const blocking = checks.some((c) => c.hard && !c.pass);
  return {
    pass: checks.every((c) => c.pass),
    blocking,
    checks: checks.map(({ hard, ...c }) => c),
  };
}
