import type { PacketReading } from "@/lib/packet/read";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
    <div className="mt-3">{children}</div>
  </section>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-3 border-b border-neutral-100 py-2 text-sm dark:border-neutral-900">
    <span className="w-44 shrink-0 text-neutral-500">{label}</span>
    <span className="font-medium">{value || "—"}</span>
  </div>
);

export default function PacketResult({ reading }: { reading: PacketReading }) {
  const external = reading.requiredSubmittals.filter((s) => s.externallyObtained);
  const fillable = reading.requiredSubmittals.filter((s) => !s.externallyObtained);

  return (
    <div className="mt-8">
      {reading.conflicts.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">
            Confirm with the awarding authority before relying on this packet
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
            {reading.conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Solicitation">
        <Row label="IFB number" value={reading.ifbNumber} />
        <Row label="Project" value={reading.projectTitle} />
        <Row label="Awarding authority" value={reading.awardingAuthority} />
        <Row label="Contact" value={[reading.contactName, reading.contactEmail, reading.contactPhone].filter(Boolean).join(" · ")} />
        <Row label="Estimated value" value={reading.estimatedValue} />
        <Row label="Term" value={reading.contractTermYears ? `${reading.contractTermYears} years` : ""} />
        <Row label="Bid deposit" value={reading.bidDepositPercent ? `${reading.bidDepositPercent}% of bid` : ""} />
      </Section>

      <Section title={`Stated deadlines (${reading.deadlines.length})`}>
        {reading.deadlines.map((d, i) => (
          <div key={i} className="border-b border-neutral-100 py-2 text-sm dark:border-neutral-900">
            <div className="flex gap-3">
              <span className="w-44 shrink-0 text-neutral-500">{d.label}</span>
              <span className="font-medium">{d.date}</span>
              <span className="text-xs text-neutral-400">page {d.sourcePage}</span>
            </div>
            <p className="mt-1 pl-47 text-xs italic text-neutral-500">“{d.quote}”</p>
          </div>
        ))}
      </Section>

      <Section title={`Forms we fill (${fillable.length})`}>
        <ul className="space-y-1 text-sm">
          {fillable.map((s) => (
            <li key={s.name} className="flex gap-3 border-b border-neutral-100 py-2 dark:border-neutral-900">
              <span className="flex-1">{s.name}</span>
              <span className="text-xs text-neutral-400">
                {s.startPage ? `pp. ${s.startPage}–${s.endPage ?? s.startPage}` : "page not found"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`A person must obtain (${external.length})`}>
        <ul className="space-y-1 text-sm">
          {external.map((s) => (
            <li key={s.name} className="border-b border-neutral-100 py-2 dark:border-neutral-900">
              <span className="font-medium">{s.name}</span>
              {s.notes && <p className="mt-0.5 text-xs text-neutral-500">{s.notes}</p>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Never filled">
        <ul className="space-y-1 text-xs text-neutral-500">
          {reading.readOnlyPageRanges.map((r, i) => (
            <li key={i}>
              pp. {r.start}–{r.end} — {r.reason}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
