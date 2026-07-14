import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { useJobs, useRunJob, useToggleJob } from '@/hooks/useAdmin';

/**
 * The scheduler, visible. A job that has been quietly failing for a week is the classic
 * silent failure — so `last_result` is shown as it is, error text and all, rather than
 * being reduced to a green tick.
 *
 * "Run now" is safe to expose because every job is idempotent: running one twice does not
 * double-downgrade an account or re-delete a document.
 */
export function JobsPanel() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: jobs, isLoading } = useJobs(true);
  const run = useRunJob();
  const toggle = useToggleJob();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="rounded-card h-16" />
        ))}
      </div>
    );
  }

  return (
    <Card className="divide-line divide-y">
      {(jobs ?? []).map((job) => {
        const failed = job.last_result?.startsWith('error:');
        return (
          <div key={job.name} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <code className="text-ink text-sm font-medium">{job.name}</code>
                <Badge variant={job.enabled ? 'success' : 'neutral'}>
                  {t(job.enabled ? 'admin.jobs.enabled' : 'admin.jobs.disabled')}
                </Badge>
                {failed ? <Badge variant="danger">{t('admin.jobs.failing')}</Badge> : null}
              </div>
              <p className="text-faint font-mono text-xs">{job.schedule}</p>
              {job.last_run_at ? (
                <p className={failed ? 'text-danger mt-1 text-xs' : 'text-muted mt-1 text-xs'}>
                  {t('admin.jobs.lastRun', {
                    when: new Date(job.last_run_at).toLocaleString(language),
                    result: job.last_result ?? '—',
                  })}
                </p>
              ) : (
                <p className="text-faint mt-1 text-xs">{t('admin.jobs.neverRun')}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ name: job.name, enabled: !job.enabled })}
              >
                {t(job.enabled ? 'admin.jobs.turnOff' : 'admin.jobs.turnOn')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!job.enabled || run.isPending}
                onClick={() => run.mutate(job.name)}
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
                {t('admin.jobs.runNow')}
              </Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
