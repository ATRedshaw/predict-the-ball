const TONES = {
  default: 'bg-white/[0.07]',
  teal: 'bg-white/20',
  light: 'bg-jet/10',
}

function Block({ className = '', tone = 'default' }) {
  return <div aria-hidden="true" className={`rounded-lg ${TONES[tone]} ${className}`} />
}

function SkeletonPage({ label, visible, className = '', children }) {
  return (
    <div
      className={`animate-pulse transition-opacity duration-150 motion-reduce:animate-none motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'} ${className}`}
      role={visible ? 'status' : undefined}
      aria-busy={visible || undefined}
      aria-label={visible ? label : undefined}
      aria-hidden={visible ? undefined : true}
    >
      {children}
    </div>
  )
}

function CompactRows({ count = 8, columns = false }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`grid items-center gap-3 rounded-xl bg-jet px-3 py-2.5 ${
            columns ? 'grid-cols-[1.5rem_1fr_2.5rem_2.5rem]' : 'grid-cols-[1.5rem_1fr]'
          }`}
        >
          <Block className="h-3 w-4" />
          <Block className={`h-3 ${index % 3 === 0 ? 'w-2/3' : 'w-4/5'}`} />
          {columns && <Block className="h-3 w-5 justify-self-center" />}
          {columns && <Block className="h-3 w-5 justify-self-center" />}
        </div>
      ))}
    </div>
  )
}

function SectionHeadingSkeleton({ width = 'w-28' }) {
  return <Block className={`mb-3 h-3 ${width}`} />
}

export function LandingPageSkeleton({ visible = true }) {
  return (
    <SkeletonPage
      label="Loading home page"
      visible={visible}
      className="grid max-w-7xl mx-auto grid-cols-12 gap-4"
    >
      <div className="col-span-12 md:col-span-8 min-h-64 rounded-2xl bg-teal p-8 md:p-10 flex flex-col justify-between">
        <div>
          <Block tone="teal" className="h-6 w-32 mb-5" />
          <Block tone="teal" className="h-10 md:h-12 w-4/5 max-w-lg mb-3" />
          <Block tone="teal" className="h-10 md:h-12 w-3/5 max-w-sm mb-5" />
          <Block tone="teal" className="h-3 w-3/4 max-w-md mb-2" />
          <Block tone="teal" className="h-3 w-2/3 max-w-sm" />
        </div>
        <div className="flex gap-3 mt-8">
          <Block tone="teal" className="h-11 w-32" />
          <Block tone="teal" className="h-11 w-28" />
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 min-h-64 rounded-2xl bg-jet-dark p-6">
        <div className="flex items-center justify-between mb-3">
          <Block className="h-3 w-28" />
          <Block className="h-2 w-2" />
        </div>
        <Block className="h-2 w-36 mb-5" />
        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Block className="h-3 w-4" />
              <Block className="h-7 flex-1" />
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 rounded-2xl bg-bone p-6">
        <Block tone="light" className="h-3 w-20 mb-3" />
        <Block tone="light" className="h-6 w-44 mb-3" />
        <Block tone="light" className="h-3 w-full mb-2" />
        <Block tone="light" className="h-3 w-4/5 mb-5" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Block key={index} tone="light" className="h-9 w-full" />
          ))}
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 rounded-2xl bg-teal-muted p-6">
        <Block tone="light" className="h-3 w-24 mb-3" />
        <Block tone="light" className="h-6 w-5/6 mb-2" />
        <Block tone="light" className="h-6 w-2/3 mb-5" />
        <Block tone="light" className="h-3 w-full mb-2" />
        <Block tone="light" className="h-3 w-11/12 mb-2" />
        <Block tone="light" className="h-3 w-3/4" />
      </div>

      <div className="col-span-12 md:col-span-4 rounded-2xl bg-mist p-6">
        <Block tone="light" className="h-3 w-28 mb-3" />
        <Block tone="light" className="h-6 w-4/5 mb-5" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Block key={index} tone="light" className="h-10 w-full" />
          ))}
        </div>
      </div>

      <div className="col-span-12 rounded-2xl bg-jet-dark px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <Block className="h-7 w-20" />
            <Block className="h-3 w-36" />
          </div>
        ))}
      </div>

      <div className="col-span-12 rounded-2xl bg-teal p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <Block tone="teal" className="h-7 w-72 max-w-full mb-3" />
          <Block tone="teal" className="h-3 w-96 max-w-full" />
        </div>
        <Block tone="teal" className="h-11 w-40" />
      </div>
    </SkeletonPage>
  )
}

export function DashboardSkeleton({ visible = true }) {
  return (
    <SkeletonPage label="Loading dashboard" visible={visible} className="max-w-4xl mx-auto w-full space-y-6 py-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Block className="h-7 w-48 mb-2" />
          <Block className="h-3 w-28" />
        </div>
        <Block className="h-10 w-28" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-2xl bg-jet-dark p-5">
            <Block className="h-3 w-20 mb-4" />
            <Block className="h-8 w-16 mb-2" />
            <Block className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index}>
            <SectionHeadingSkeleton width={index === 0 ? 'w-36' : 'w-40'} />
            <div className="rounded-2xl bg-jet-dark p-4">
              <CompactRows count={8} columns />
            </div>
          </div>
        ))}
      </div>

      <div>
        <SectionHeadingSkeleton width="w-28" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-xl bg-jet-dark p-4">
              <Block className="h-4 w-3/4 mb-3" />
              <Block className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}

export function PredictionsSkeleton({ visible = true }) {
  return (
    <SkeletonPage label="Loading predictions" visible={visible} className="max-w-2xl mx-auto w-full px-4 py-6">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <Block className="h-7 w-52 mb-2" />
          <Block className="h-3 w-32" />
        </div>
        <Block className="h-7 w-28" />
      </div>
      <div className="rounded-2xl border border-white/5 bg-jet-dark p-4">
        <div className="grid grid-cols-[2rem_1fr] gap-3 px-3 pb-3">
          <Block className="h-3 w-4" />
          <Block className="h-3 w-16" />
        </div>
        <CompactRows count={12} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Block className="h-10 w-40" />
        <Block className="h-3 w-24" />
      </div>
    </SkeletonPage>
  )
}

export function StandingsSkeleton({ visible = true }) {
  return (
    <SkeletonPage label="Loading standings" visible={visible} className="max-w-4xl mx-auto w-full px-4 py-6">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <Block className="h-7 w-32 mb-2" />
          <Block className="h-3 w-36" />
        </div>
        <Block className="h-3 w-44" />
      </div>
      <div className="rounded-2xl bg-jet-dark overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[42rem]">
            <div className="grid grid-cols-[2rem_minmax(10rem,1fr)_repeat(8,2.5rem)] gap-3 border-b border-white/5 px-4 py-3">
              {Array.from({ length: 10 }, (_, index) => (
                <Block key={index} className="h-2" />
              ))}
            </div>
            <div className="divide-y divide-white/5">
              {Array.from({ length: 12 }, (_, row) => (
                <div
                  key={row}
                  className="grid grid-cols-[2rem_minmax(10rem,1fr)_repeat(8,2.5rem)] items-center gap-3 px-4 py-3"
                >
                  <Block className="h-3 w-4" />
                  <Block className={`h-3 ${row % 3 === 0 ? 'w-2/3' : 'w-4/5'}`} />
                  {Array.from({ length: 8 }, (_, cell) => (
                    <Block key={cell} className="h-3 w-4 justify-self-center" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkeletonPage>
  )
}

export function LeaguesSkeleton({ visible = true }) {
  return (
    <SkeletonPage label="Loading leagues" visible={visible} className="max-w-2xl mx-auto w-full px-4 py-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <Block className="h-7 w-28 mb-2" />
          <Block className="h-3 w-56 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Block className="h-9 w-16" />
          <Block className="h-9 w-20" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="rounded-2xl bg-jet-dark p-4 flex items-center justify-between gap-4">
            <div className="flex-1">
              <Block className={`h-4 mb-3 ${index % 2 === 0 ? 'w-2/5' : 'w-3/5'}`} />
              <Block className="h-3 w-32" />
            </div>
            <div className="flex items-center gap-2">
              {index < 2 && <Block className="h-6 w-14" />}
              <Block className="h-4 w-5" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}

export function LeagueDetailSkeleton({ visible = true }) {
  return (
    <SkeletonPage label="Loading league" visible={visible} className="max-w-2xl mx-auto w-full px-4 py-6">
      <Block className="h-4 w-28 mb-6" />
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1">
          <Block className="h-7 w-52 max-w-full mb-2" />
          <Block className="h-3 w-32" />
        </div>
        <Block className="h-7 w-28" />
      </div>
      <div className="rounded-2xl bg-jet-dark p-4 mb-4 flex items-center justify-between gap-4">
        <div>
          <Block className="h-3 w-20 mb-3" />
          <Block className="h-7 w-28" />
        </div>
        <div className="flex gap-2">
          <Block className="h-9 w-24" />
          <Block className="h-9 w-24" />
        </div>
      </div>
      <div className="rounded-2xl bg-jet-dark p-4">
        <Block className="h-3 w-24 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="grid grid-cols-[1.5rem_1fr_4rem] gap-3 items-center rounded-xl bg-jet px-3 py-3">
              <Block className="h-4 w-5" />
              <Block className={`h-3 ${index % 2 === 0 ? 'w-2/3' : 'w-4/5'}`} />
              <Block className="h-3 w-10 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}

export function ModelPredictionsSkeleton({ visible = true }) {
  return (
    <SkeletonPage label="Loading model predictions" visible={visible} className="max-w-4xl mx-auto w-full space-y-6 py-2">
      <div>
        <Block className="h-7 w-52 mb-2" />
        <Block className="h-3 w-28" />
      </div>

      <div className="rounded-2xl bg-jet-dark p-5">
        <Block className="h-3 w-40 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-xl bg-jet p-4">
              <Block className="h-3 w-16 mb-3" />
              <Block className="h-7 w-12" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 max-w-xl rounded-2xl bg-jet-dark p-1 gap-1">
        <Block className="h-10 w-full" />
        <Block className="h-10 w-full" />
      </div>

      <div className="rounded-2xl bg-jet-dark p-5">
        <Block className="h-3 w-28 mb-3" />
        <Block className="h-3 w-3/4 mb-4" />
        <div className="flex items-center gap-3">
          <Block className="h-9 w-36" />
          <Block className="h-9 w-16" />
          <Block className="h-3 w-24" />
        </div>
      </div>

      <div className="rounded-2xl bg-jet-dark p-5">
        <SectionHeadingSkeleton width="w-48" />
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="grid grid-cols-[1.5rem_1fr_5rem_5rem] gap-3 items-center rounded-xl bg-jet px-3 py-2.5">
              <Block className="h-3 w-4" />
              <Block className={`h-3 ${index % 3 === 0 ? 'w-2/3' : 'w-4/5'}`} />
              <Block className="h-2 w-full" />
              <Block className="h-3 w-10 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}

function FormSectionSkeleton({ fields = 2, compact = false }) {
  return (
    <div className="rounded-2xl bg-jet-dark p-6 md:p-8">
      <Block className="h-4 w-32 mb-3" />
      <Block className="h-3 w-3/5 mb-6" />
      <div className={compact ? 'flex items-center gap-4' : 'space-y-4'}>
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className={compact ? '' : 'w-full'}>
            {!compact && <Block className="h-2 w-20 mb-2" />}
            <Block className={`${compact ? 'h-10 w-28' : 'h-11 w-full'}`} />
          </div>
        ))}
      </div>
      {!compact && <Block className="h-10 w-32 ml-auto mt-5" />}
    </div>
  )
}

export function SettingsSkeleton({ visible = true }) {
  return (
    <SkeletonPage label="Loading settings" visible={visible} className="max-w-2xl mx-auto w-full py-4 space-y-4">
      <Block className="h-10 w-24 ml-auto" />
      <FormSectionSkeleton fields={3} />
      <FormSectionSkeleton fields={3} />
      <FormSectionSkeleton fields={2} />
    </SkeletonPage>
  )
}

export function AdminSkeleton({ visible = true }) {
  return (
    <SkeletonPage label="Loading admin panel" visible={visible} className="max-w-5xl mx-auto w-full py-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Block className="h-7 w-36 mb-2" />
          <Block className="h-3 w-24" />
        </div>
        <Block className="h-7 w-16" />
      </div>
      <FormSectionSkeleton fields={1} compact />
      <div className="rounded-2xl bg-jet-dark p-6 md:p-8">
        <Block className="h-4 w-36 mb-3" />
        <Block className="h-3 w-3/5 mb-6" />
        <div className="space-y-2 mb-6">
          {Array.from({ length: 2 }, (_, index) => (
            <Block key={index} className="h-12 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Block key={index} className="h-11 w-full" />
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-jet-dark p-6 md:p-8">
        <Block className="h-4 w-28 mb-3" />
        <Block className="h-3 w-52 mb-6" />
        <Block className="h-11 w-full mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_5rem] gap-4 border-b border-white/5 py-3">
              <Block className="h-3 w-3/4" />
              <Block className="h-3 w-4/5" />
              <Block className="h-3 w-12 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}
