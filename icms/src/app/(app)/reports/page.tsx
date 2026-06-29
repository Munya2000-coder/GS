import { ModulePlaceholder } from "@/components/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      title="Reports"
      subtitle="Report library and export centre — PDF (ELMS-branded) and Excel (Module 31)"
      requirements={[
        { id: "ICMS-106", text: "Standard reports: Worker Register, CoS Register, Visa Expiry, RTW, Appendix D Missing, Payroll/Rota Exception, Salary Compliance, SMS Status, Audit, CAPA, Governance, Care Package Staffing, Risk Register" },
        { id: "ICMS-107", text: "Export to PDF (ELMS letterhead) and XLSX with metadata on every page" },
        { id: "ICMS-108", text: "Inspection Folder export as structured ZIP with index + cover sheet" },
        { id: "ICMS-109", text: "Date-range/worker/location/status filtering; RBAC-scoped data only" },
      ]}
    />
  );
}
