// Route-level loading skeleton (perceived performance; PRD §10.4).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-56 rounded bg-elms-grey" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border bg-white">
            <div className="m-4 h-8 w-12 rounded bg-elms-grey" />
            <div className="mx-4 h-3 w-24 rounded bg-elms-grey" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-lg border bg-white">
        <div className="m-4 h-4 w-40 rounded bg-elms-grey" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 w-full rounded bg-elms-grey/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
