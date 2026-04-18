import { Suspense } from 'react';

import { ShadowDiffsDashboard } from '@/components/shadow-diffs/shadow-diffs-dashboard';
import { ModulePageSkeleton } from '@/components/dashboard/module-page-skeleton';
import { getShadowLogs, getShadowLogsSummary } from '@/lib/productos-servicios-api';

export const dynamic = 'force-dynamic';

export default function ShadowDiffsPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <ShadowDiffsPageContent />
    </Suspense>
  );
}

async function ShadowDiffsPageContent() {
  const [logs, summary] = await Promise.all([
    getShadowLogs({ limit: 100 }),
    getShadowLogsSummary(),
  ]);

  return <ShadowDiffsDashboard logs={logs} summary={summary} />;
}
