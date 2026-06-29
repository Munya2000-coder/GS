import { ModulePlaceholder } from "@/components/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      title="Recruitment"
      subtitle="Recruitment evidence packs and genuine-vacancy evidence (Modules 3 & 4)"
      requirements={[
        { id: "ICMS-015", text: "Genuine vacancy evidence record per sponsored role" },
        { id: "ICMS-018", text: "Generate Genuine Vacancy Evidence Pack (PDF) for inspection" },
        { id: "ICMS-020", text: "Recruitment evidence record (advert, JD, interview notes, scoring, references…)" },
        { id: "ICMS-021", text: "Block CoS approval where mandatory recruitment documents are missing" },
      ]}
    />
  );
}
