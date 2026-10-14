export interface HealthDetail {
  database: string;
  seeded: boolean;
  recordTypes: number;
  lastReminderRun: string | null;
}

/**
 * Public liveness is only ok or error. Database mode, seed state and the last reminder run
 * are returned only when the caller presented CRON_SECRET.
 */
export function healthBody(reachable: boolean, authed: boolean, detail?: HealthDetail): { status: number; body: Record<string, unknown> } {
  if (!reachable) return { status: 503, body: { status: "error" } };
  if (!authed || !detail) return { status: 200, body: { status: "ok" } };
  return {
    status: 200,
    body: {
      status: "ok",
      database: detail.database,
      seeded: detail.seeded,
      recordTypes: detail.recordTypes,
      lastReminderRun: detail.lastReminderRun,
    },
  };
}
