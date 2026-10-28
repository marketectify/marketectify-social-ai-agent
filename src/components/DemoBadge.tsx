/** Marks a screen whose data is still sample data (not yet connected to the real backend). */
export default function DemoBadge({ label = "Sample data" }: { label?: string }) {
  return (
    <span
      title="This screen shows example data. It will be connected to real data in an upcoming update."
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400 align-middle"
    >
      {label}
    </span>
  );
}
