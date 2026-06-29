import { ModulePlaceholder } from "@/components/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      title="Inspection Mode"
      subtitle="Read-only UKVI inspection pack generation (Module 18)"
      requirements={[
        { id: "ICMS-078", text: "Generate complete inspection evidence pack (licence, registers, per-worker Appendix D, payroll, rota, recruitment…)" },
        { id: "ICMS-079", text: "Time-limited (max 72h) read-only Inspector accounts, fully logged" },
        { id: "ICMS-080", text: "On-demand export as structured ZIP organised by worker and module" },
        { id: "ICMS-070", text: "Dedicated UKVI Inspection Dashboard with live compliance status" },
      ]}
    />
  );
}
