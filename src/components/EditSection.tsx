// One scannable card per editing step. Step numbers are optional:
// the steward flow shows them pre-publish; admin pages use plain titles.
export function EditSection({ step, title, hint, aside, children }: {
  step?: number
  title: string
  hint?: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-3xl shadow-md border border-amber-100 p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-gray-900">
          {step != null && (
            <span aria-hidden="true" className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 text-sm font-bold flex items-center justify-center shrink-0">{step}</span>
          )}
          {title}
        </h2>
        {aside}
      </div>
      {hint && <p className="text-sm text-gray-500 mb-4">{hint}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  )
}
