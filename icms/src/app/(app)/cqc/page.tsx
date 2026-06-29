import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";

export const dynamic = "force-dynamic";

type EvidenceRow = {
  label: string;
  // A numeric count, a qualitative status string, or null when only tracked.
  count: number | null;
  status?: string;
  strong: boolean; // true => green badge, false => amber
};

type KeyQuestion = {
  name: string;
  description: string;
  evidence: EvidenceRow[];
};

// CQC Evidence Mapping (PRD Module 28 / ICMS-103).
// READ-ONLY: maps existing compliance records to the five CQC key questions.
// Overlapping evidence is linked to both UKVI and CQC without duplication.
export default async function CqcPage() {
  const guard = await pageGuard("cqc.view");
  if (guard) return guard;

  const [
    dbsApproved,
    rtwValid,
    recruitmentComplete,
    trainingApproved,
    carePackageAllocations,
    rotaCompleted,
    auditOpen,
    auditClosed,
    capaOpen,
    capaClosed,
    licence,
  ] = await Promise.all([
    prisma.appendixDItem.count({ where: { key: "dbs", status: "Approved" } }),
    prisma.rightToWorkCheck.count({ where: { status: "Valid" } }),
    prisma.recruitmentRecord.count({ where: { complete: true } }),
    prisma.appendixDItem.count({ where: { key: "training_records", status: "Approved" } }),
    prisma.carePackageAllocation.count(),
    prisma.rotaShift.count({ where: { status: "Completed" } }),
    prisma.auditFinding.count({ where: { status: { not: "Closed" } } }),
    prisma.auditFinding.count({ where: { status: "Closed" } }),
    prisma.capa.count({ where: { status: { not: "Closed" } } }),
    prisma.capa.count({ where: { status: "Closed" } }),
    prisma.sponsorLicence.findFirst(),
  ]);

  const keyQuestions: KeyQuestion[] = [
    {
      name: "Safe",
      description:
        "People are protected from abuse and avoidable harm — pre-employment vetting and right-to-work assurance.",
      evidence: [
        { label: "DBS checks approved", count: dbsApproved, strong: dbsApproved > 0 },
        { label: "Right-to-work valid", count: rtwValid, strong: rtwValid > 0 },
        { label: "Safeguarding training", count: null, status: "Tracked", strong: false },
      ],
    },
    {
      name: "Effective",
      description:
        "Care achieves good outcomes and staff are suitably recruited, qualified and trained.",
      evidence: [
        {
          label: "Recruitment / qualifications complete",
          count: recruitmentComplete,
          strong: recruitmentComplete > 0,
        },
        { label: "Training records approved", count: trainingApproved, strong: trainingApproved > 0 },
      ],
    },
    {
      name: "Caring",
      description: "Staff involve and treat people with compassion, kindness, dignity and respect.",
      evidence: [
        {
          label: "Care package allocations",
          count: carePackageAllocations,
          strong: carePackageAllocations > 0,
        },
      ],
    },
    {
      name: "Responsive",
      description:
        "Services are organised to meet people's needs — staffing meets commissioned hours.",
      evidence: [
        { label: "Rota shifts completed", count: rotaCompleted, strong: rotaCompleted > 0 },
        { label: "Staffing vs commissioned hours", count: null, status: "Tracked", strong: false },
      ],
    },
    {
      name: "Well-Led",
      description:
        "Leadership, governance and a culture of continuous improvement — including sponsor licence governance.",
      evidence: [
        {
          label: "Sponsor licence rating",
          count: null,
          status: licence ? `Rating ${licence.rating}` : "Not configured",
          strong: licence?.rating === "A",
        },
        {
          label: "Audit findings (open / closed)",
          count: null,
          status: `${auditOpen} open / ${auditClosed} closed`,
          strong: auditOpen === 0,
        },
        {
          label: "CAPA status (open / closed)",
          count: null,
          status: `${capaOpen} open / ${capaClosed} closed`,
          strong: capaOpen === 0,
        },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <PageIntro
        title="CQC Evidence Mapping"
        subtitle="Map compliance records to CQC key questions; evidence is linkable to UKVI and CQC without duplication (Module 28 / ICMS-103)"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {keyQuestions.map((kq) => (
          <Card key={kq.name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="navy">{kq.name}</Badge>
                <span className="text-sm font-normal text-muted-foreground">CQC key question</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{kq.description}</p>
              <Table>
                <TableBody>
                  {kq.evidence.map((e) => (
                    <TableRow key={e.label}>
                      <TableCell className="text-sm">{e.label}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={e.strong ? "green" : "amber"}>
                          {e.count !== null ? e.count : e.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Overlapping records — DBS checks, training, rotas and recruitment evidence — are linked to both the
        UKVI sponsor-compliance and CQC inspection frameworks without duplication. A single source record
        satisfies both regimes, mapped here to the relevant CQC key question (ICMS-103).
      </p>
    </div>
  );
}
