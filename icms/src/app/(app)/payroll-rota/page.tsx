import { ModulePlaceholder } from "@/components/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      title="Payroll & Rota"
      subtitle="BrightPay payroll reconciliation and CareLineLive rota monitoring (Modules 9 & 10)"
      requirements={[
        { id: "ICMS-039", text: "Import monthly payroll from BrightPay via CSV (BrightPay Connect)" },
        { id: "ICMS-040", text: "Reconcile payroll against CoS salary, contract, rota hours, contracted hours" },
        { id: "ICMS-043", text: "Auto-escalate unresolved payroll discrepancies >5 working days to the AO" },
        { id: "ICMS-046", text: "Integrate CareLineLive (REST v2 + webhook) for rota/shift/clock-in data" },
        { id: "ICMS-050", text: "Compare rota/timesheet vs contracts, CoS hours, payroll, attendance" },
      ]}
    />
  );
}
