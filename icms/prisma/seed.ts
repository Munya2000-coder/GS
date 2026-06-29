/**
 * ICMS demo seed.
 * Creates ELMS organisation + sponsor licence, RBAC users, and a set of
 * sponsored workers with realistic compliance state (Green/Amber/Red/Critical)
 * so every dashboard and module has meaningful data on first run.
 */
import { PrismaClient } from "@prisma/client";
import { addDays, subDays, subYears, addYears } from "date-fns";
import { APPENDIX_D_TEMPLATE } from "../src/lib/appendix-d";
import { calcReportingDeadline } from "../src/lib/sms";
import { bandFor } from "../src/lib/compliance-score";

const prisma = new PrismaClient();
const now = new Date();

async function main() {
  console.log("Seeding ICMS demo data…");

  // Wipe (dev only) in dependency-safe order.
  await prisma.auditTrail.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.workerFieldChange.deleteMany();
  await prisma.carePackageAllocation.deleteMany();
  await prisma.carePackage.deleteMany();
  await prisma.payrollRecord.deleteMany();
  await prisma.reportableEvent.deleteMany();
  await prisma.appendixDItem.deleteMany();
  await prisma.document.deleteMany();
  await prisma.cosApproval.deleteMany();
  await prisma.genuineVacancy.deleteMany();
  await prisma.cos.deleteMany();
  await prisma.rightToWorkCheck.deleteMany();
  await prisma.visa.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.smsUser.deleteMany();
  await prisma.sponsorLicence.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.capa.deleteMany();
  await prisma.auditFinding.deleteMany();
  await prisma.riskRegisterEntry.deleteMany();
  await prisma.user.deleteMany();

  // --- Organisation + licence (Module 1) ---
  const org = await prisma.organisation.create({
    data: {
      legalName: "ELMS Health Solutions Ltd",
      tradingNames: "ELMS Health Solutions",
      companiesHouseNo: "09876543",
      cqcProviderId: "1-101234567",
      cqcRating: "Good",
      sites: JSON.stringify([
        { name: "Cambridge", address: "Cambourne Business Park", postcode: "CB23 6DP" },
        { name: "Norwich", address: "St Crispins Road", postcode: "NR3 1YE" },
      ]),
    },
  });

  const licence = await prisma.sponsorLicence.create({
    data: {
      organisationId: org.id,
      licenceNumber: "ELMS0A1B2C3D4",
      rating: "A",
      licenceType: "Worker",
      route: "Health and Care Worker",
      expiryDate: addDays(now, 540),
      renewalDeadline: addDays(now, 480),
      authorisingOfficer: "Margaret Okafor",
      keyContact: "Daniel Price",
    },
  });

  await prisma.smsUser.createMany({
    data: [
      { licenceId: licence.id, name: "Margaret Okafor", level: "Level 1", email: "m.okafor@elmshealthsolutions.co.uk", lastReviewedAt: subDays(now, 100) },
      { licenceId: licence.id, name: "Daniel Price", level: "Level 1", email: "d.price@elmshealthsolutions.co.uk", lastReviewedAt: subDays(now, 100) },
      { licenceId: licence.id, name: "Priya Nair", level: "Level 2", email: "p.nair@elmshealthsolutions.co.uk", lastReviewedAt: subDays(now, 100) },
    ],
  });

  // --- Users / RBAC (Module 19) ---
  const users = [
    { email: "m.okafor@elmshealthsolutions.co.uk", displayName: "Margaret Okafor", roles: "AUTHORISING_OFFICER" },
    { email: "d.price@elmshealthsolutions.co.uk", displayName: "Daniel Price", roles: "KEY_CONTACT|LEVEL_1_SMS" },
    { email: "sysadmin@elmshealthsolutions.co.uk", displayName: "Tom Reilly (System Admin)", roles: "SYSTEM_ADMIN" },
    { email: "p.nair@elmshealthsolutions.co.uk", displayName: "Priya Nair", roles: "COMPLIANCE_MANAGER" },
    { email: "s.hughes@elmshealthsolutions.co.uk", displayName: "Sarah Hughes", roles: "HR_MANAGER" },
    { email: "j.adeyemi@elmshealthsolutions.co.uk", displayName: "James Adeyemi", roles: "FINANCE_MANAGER" },
    { email: "l.barnes@elmshealthsolutions.co.uk", displayName: "Laura Barnes", roles: "CARE_OPS_MANAGER" },
    { email: "auditor@elmshealthsolutions.co.uk", displayName: "Internal Auditor", roles: "AUDITOR" },
  ];
  const userRows: Record<string, string> = {};
  for (const u of users) {
    const row = await prisma.user.create({ data: u });
    userRows[u.roles.split("|")[0]] = row.id;
  }

  // Time-limited inspector account (PRD ICMS-079) — expires in 72h.
  await prisma.user.create({
    data: {
      email: "inspector@homeoffice.gov.uk",
      displayName: "Home Office Inspector",
      roles: "INSPECTOR",
      isExternal: true,
      accessExpiresAt: addDays(now, 3),
    },
  });

  // --- Care packages (Module 23) ---
  const pkg = await prisma.carePackage.create({
    data: {
      serviceCode: "CB-DOM-014",
      commissioner: "Cambridgeshire County Council",
      contractRef: "CCC-2026-DOM-014",
      hoursCommissioned: 1200,
      hoursDelivered: 1140,
      requiredStaffing: 18,
      serviceLocation: "Cambridge",
    },
  });

  // --- Workers with varied compliance posture ---
  type WorkerSpec = {
    name: string; nationality: string; soc: string; job: string; site: string;
    salary: number; hours: number; visaDays: number; rtwStatus: string; rtwRepeatDays: number;
    passportDays: number; cosStatus: string; cosNumber?: string; docApprovedRatio: number;
    payrollException?: string; smsEvent?: { key: string; days: number };
  };

  const specs: WorkerSpec[] = [
    { name: "Grace Mensah", nationality: "Ghanaian", soc: "6135", job: "Care Worker", site: "Cambridge", salary: 23400, hours: 37.5, visaDays: 720, rtwStatus: "Valid", rtwRepeatDays: 365, passportDays: 900, cosStatus: "Worker Started", cosNumber: "C2G6H1A0X9", docApprovedRatio: 1 },
    { name: "Aleksander Nowak", nationality: "Polish", soc: "6136", job: "Senior Care Worker", site: "Norwich", salary: 25600, hours: 37.5, visaDays: 75, rtwStatus: "Valid", rtwRepeatDays: 70, passportDays: 400, cosStatus: "Worker Started", cosNumber: "C2K9L3M7P1", docApprovedRatio: 0.82, smsEvent: { key: "salary_change", days: 4 } },
    { name: "Maria Santos", nationality: "Filipino", soc: "6135", job: "Care Worker", site: "Cambridge", salary: 23400, hours: 37.5, visaDays: 22, rtwStatus: "Valid", rtwRepeatDays: 18, passportDays: 200, cosStatus: "Worker Started", cosNumber: "C2A1B2C3D4", docApprovedRatio: 0.7, payrollException: "Underpayment against CoS salary" },
    { name: "Chidi Okeke", nationality: "Nigerian", soc: "6135", job: "Care Worker", site: "Norwich", salary: 23400, hours: 37.5, visaDays: -6, rtwStatus: "Expired", rtwRepeatDays: -6, passportDays: 120, cosStatus: "Worker Started", cosNumber: "C2Z9Y8X7W6", docApprovedRatio: 0.6 },
    { name: "Fatima Al-Sayed", nationality: "Egyptian", soc: "6136", job: "Senior Care Worker", site: "Cambridge", salary: 25600, hours: 37.5, visaDays: 500, rtwStatus: "Valid", rtwRepeatDays: 300, passportDays: 1000, cosStatus: "Assigned", cosNumber: "C2Q1W2E3R4", docApprovedRatio: 0.9 },
    { name: "Joseph Banda", nationality: "Zimbabwean", soc: "6135", job: "Care Worker", site: "Norwich", salary: 23400, hours: 37.5, visaDays: 0, rtwStatus: "Valid", rtwRepeatDays: 250, passportDays: 600, cosStatus: "Draft", docApprovedRatio: 0.3, smsEvent: { key: "no_start", days: -2 } },
  ];

  let wcidCounter = 1;
  for (const s of specs) {
    const wcid = `WCID-${String(wcidCounter++).padStart(4, "0")}`;
    const worker = await prisma.worker.create({
      data: {
        wcid,
        legalName: s.name,
        dateOfBirth: subYears(now, 30 + (wcidCounter % 10)),
        nationality: s.nationality,
        passportNumber: `P${Math.abs(hash(s.name)) % 9000000 + 1000000}`,
        passportExpiry: addDays(now, s.passportDays),
        niNumber: `AB${Math.abs(hash(s.name)) % 900000 + 100000}C`,
        email: `${s.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        phone: "07700 900000",
        address: s.site === "Cambridge" ? "Cambridge, CB1" : "Norwich, NR1",
        jobTitle: s.job,
        socCode: s.soc,
        workLocation: s.site,
        lineManager: "Laura Barnes",
        contractedHours: s.hours,
        salary: s.salary,
        hourlyRate: Math.round((s.salary / 52 / s.hours) * 100) / 100,
        employmentStart: subDays(now, 300),
        sponsorshipStatus: s.cosStatus === "Draft" ? "Pre-Start" : "Active",
      },
    });

    // Visa
    await prisma.visa.create({
      data: {
        workerId: worker.id,
        route: "Health and Care Worker",
        cosNumber: s.cosNumber,
        startDate: subDays(now, 300),
        expiryDate: addDays(now, s.visaDays),
        evisaRef: `EV-${wcid}`,
      },
    });

    // RTW check
    await prisma.rightToWorkCheck.create({
      data: {
        workerId: worker.id,
        shareCode: `W${Math.abs(hash(s.name)) % 900} ${Math.abs(hash(s.job)) % 900} ${Math.abs(hash(s.site)) % 900}`,
        checkDate: subDays(now, 60),
        checkedBy: "Sarah Hughes",
        permission: "Permission to work in care sector role",
        restrictions: "Must remain with sponsor",
        repeatCheckDate: addDays(now, s.rtwRepeatDays),
        status: s.rtwStatus,
      },
    });

    // CoS + approvals
    const cos = await prisma.cos.create({
      data: {
        cosNumber: s.cosNumber,
        workerId: worker.id,
        cosType: "Defined",
        jobTitle: s.job,
        socCode: s.soc,
        workLocation: s.site,
        contractedHours: s.hours,
        salary: s.salary,
        hourlyRate: Math.round((s.salary / 52 / s.hours) * 100) / 100,
        proposedStart: subDays(now, 280),
        candidateName: s.name,
        businessJustification: "Commissioned domiciliary care demand exceeds current establishment.",
        carePackageJustification: `Allocated to ${pkg.serviceCode} (${pkg.commissioner}).`,
        fundingSource: "Local authority commissioned hours",
        status: s.cosStatus,
        currentStage: s.cosStatus === "Draft" ? 1 : 5,
        submittedById: userRows["KEY_CONTACT"],
        assignedDate: s.cosStatus === "Draft" ? null : subDays(now, 290),
        expiryDate: s.cosStatus === "Draft" ? null : addDays(now, 60),
        smsReference: s.cosStatus === "Draft" ? null : `SMS-${wcid}`,
      },
    });

    // Approval stages
    const stageDefs = [
      { stage: 1, stageName: "Hiring Manager", role: "Care Operations Manager", approver: "Laura Barnes" },
      { stage: 2, stageName: "HR", role: "HR Manager", approver: "Sarah Hughes" },
      { stage: 3, stageName: "Finance salary review", role: "Finance Manager", approver: "James Adeyemi" },
      { stage: 4, stageName: "Compliance review", role: "Compliance Manager", approver: "Priya Nair" },
      { stage: 5, stageName: "Authorising Officer final approval", role: "Authorising Officer", approver: "Margaret Okafor" },
    ];
    const completedStages = s.cosStatus === "Draft" ? 0 : 5;
    for (const sd of stageDefs) {
      await prisma.cosApproval.create({
        data: {
          cosId: cos.id,
          stage: sd.stage,
          stageName: sd.stageName,
          approverName: sd.stage <= completedStages ? sd.approver : null,
          approverRole: sd.stage <= completedStages ? sd.role : null,
          decision: sd.stage <= completedStages ? "approved" : null,
          comments: sd.stage <= completedStages ? "Reviewed and approved." : null,
          decidedAt: sd.stage <= completedStages ? subDays(now, 295 - sd.stage) : null,
        },
      });
    }

    await prisma.genuineVacancy.create({
      data: {
        cosId: cos.id,
        vacancyReason: "Increase in commissioned domiciliary care hours",
        careService: pkg.serviceCode,
        hoursCommissioned: 1200,
        hoursDelivered: 1140,
        currentEstablishment: 16,
        staffingGap: 2,
        isJustified: true,
        evidenceComplete: s.docApprovedRatio > 0.8,
      },
    });

    // Care allocation
    await prisma.carePackageAllocation.create({
      data: { carePackageId: pkg.id, workerId: worker.id, isSponsored: true },
    });

    // Appendix D checklist + a couple of documents
    for (let i = 0; i < APPENDIX_D_TEMPLATE.length; i++) {
      const t = APPENDIX_D_TEMPLATE[i];
      let status: string;
      if (!t.required) {
        status = "Not Applicable";
      } else {
        // Approve the first docApprovedRatio share of required items; rest Missing/Expired.
        const approved = i / APPENDIX_D_TEMPLATE.length < s.docApprovedRatio;
        status = approved ? "Approved" : i % 3 === 0 ? "Expired" : "Missing";
      }
      await prisma.appendixDItem.create({
        data: {
          workerId: worker.id,
          key: t.key,
          label: t.label,
          required: t.required,
          status,
          expiryDate: t.tracksExpiry ? addDays(now, 200) : null,
        },
      });
    }

    // A representative stored document (metadata only; no binary in seed)
    await prisma.document.create({
      data: {
        workerId: worker.id,
        category: "passport",
        fileName: `${wcid}-passport.pdf`,
        storagePath: `seed/${wcid}-passport.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 248000,
        version: 1,
        status: "Approved",
        expiryDate: addDays(now, s.passportDays),
        uploadedBy: "Sarah Hughes",
        reviewedBy: "Priya Nair",
        reviewedAt: subDays(now, 50),
      },
    });

    // Payroll record (clean or with exception)
    await prisma.payrollRecord.create({
      data: {
        workerId: worker.id,
        payPeriod: "2026-05",
        grossPay: Math.round((s.salary / 12) * 100) / 100,
        hoursPaid: s.hours * 4,
        exception: s.payrollException ?? null,
        resolved: false,
      },
    });

    // SMS reportable event
    if (s.smsEvent) {
      const eventDate = subDays(now, Math.max(0, s.smsEvent.days >= 0 ? 0 : -s.smsEvent.days));
      await prisma.reportableEvent.create({
        data: {
          workerId: worker.id,
          eventType: s.smsEvent.key,
          eventDate,
          reportingDeadline: calcReportingDeadline(s.smsEvent.key, eventDate),
          ownerName: "Daniel Price",
          status: "Identified",
          autoCreated: s.smsEvent.key === "no_start",
        },
      });
    }
  }

  // --- A risk register entry + an audit finding/CAPA for scaffolded modules ---
  await prisma.riskRegisterEntry.create({
    data: {
      description: "Sponsored worker count may exceed demonstrable commissioned care demand",
      owner: "Priya Nair",
      likelihood: "Medium",
      impact: "High",
      mitigation: "Quarterly genuine-vacancy reconciliation against CareLineLive commissioned hours",
      reviewDate: addDays(now, 60),
    },
  });
  const finding = await prisma.auditFinding.create({
    data: {
      reference: "AF-2026-001",
      category: "Major",
      description: "Two worker files missing current DBS evidence",
      rootCause: "DBS renewals not tracked centrally before ICMS",
      owner: "Sarah Hughes",
      dueDate: addDays(now, 14),
      status: "Open",
    },
  });
  await prisma.capa.create({
    data: {
      reference: "CAPA-2026-001",
      findingId: finding.id,
      rootCause: finding.rootCause,
      correctiveAction: "Obtain and upload current DBS for affected workers",
      preventiveAction: "Enable DBS expiry monitoring alerts for all workers",
      owner: "Sarah Hughes",
      dueDate: addDays(now, 14),
      status: "Open",
    },
  });

  // --- Recompute compliance scores for all workers ---
  const allWorkers = await prisma.worker.findMany({
    include: { visas: true, rtwChecks: true, cosRecords: true, appendixD: true, reportableEvents: true, payrollRecords: true },
  });
  for (const w of allWorkers) {
    // Lightweight inline score (mirrors lib/compliance-score weighting) for the seed.
    const score = quickScore(w);
    await prisma.worker.update({
      where: { id: w.id },
      data: { complianceScore: score.score, ragStatus: score.rag },
    });
  }

  // --- Seed audit-trail entries so the viewer is populated ---
  const ao = userRows["AUTHORISING_OFFICER"];
  await prisma.auditTrail.createMany({
    data: [
      { actorId: ao, actorName: "Margaret Okafor", action: "licence.create", entityType: "SponsorLicence", entityId: licence.id, summary: "Sponsor licence record created" },
      { actorId: userRows["KEY_CONTACT"], actorName: "Daniel Price", action: "cos.submit", entityType: "Cos", summary: "CoS request submitted for Grace Mensah" },
      { actorId: ao, actorName: "Margaret Okafor", action: "cos.approve.ao", entityType: "Cos", summary: "CoS final-approved for Grace Mensah", newValue: "Approved" },
    ],
  });

  console.log(`Seed complete: ${allWorkers.length} workers, ${users.length + 1} users.`);
}

// Deterministic string hash for stable demo identifiers (no Math.random in seed).
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

function quickScore(w: any): { score: number; rag: string } {
  let critical = false;
  let score = 0;
  const latestRtw = w.rtwChecks[0];
  if (latestRtw && latestRtw.status === "Valid") score += 20;
  else if (latestRtw && latestRtw.status === "Expired") critical = true;
  const visa = w.visas[0];
  if (visa) {
    const days = Math.ceil((+new Date(visa.expiryDate) - +now) / 86400000);
    if (days < 0) { critical = true; } else if (days <= 30) score += 12; else score += 20;
  }
  if (w.cosRecords.some((c: any) => ["Approved", "Assigned", "Used", "Worker Started"].includes(c.status))) score += 15;
  const req = w.appendixD.filter((i: any) => i.required && i.status !== "Not Applicable");
  const ok = req.filter((i: any) => i.status === "Approved").length;
  score += Math.round(20 * (req.length ? ok / req.length : 0));
  const openExc = w.payrollRecords.filter((p: any) => p.exception && !p.resolved).length;
  score += openExc === 0 ? 10 : Math.max(0, 10 - openExc * 4);
  const openEvents = w.reportableEvents.filter((e: any) => e.status !== "Closed");
  const overdue = openEvents.filter((e: any) => +new Date(e.reportingDeadline) < +now).length;
  score += overdue > 0 ? 0 : openEvents.length ? 6 : 10;
  score += 5; // audit findings placeholder
  score = Math.max(0, Math.min(100, score));
  return { score, rag: bandFor(score, critical) };
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
