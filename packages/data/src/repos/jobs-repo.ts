import { eq } from "drizzle-orm";
import { db } from "../client";
import { jobRuns } from "../schema";

type JobRunCreate = {
  type: string;
  status: string;
  requestPayloadJson?: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JobRunRecord = {
  id: string;
  type: string;
  status: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestPayloadJson?: unknown;
  statsJson?: unknown;
  errorsJson?: unknown;
};

function mapRow(row: typeof jobRuns.$inferSelect): JobRunRecord {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    requestPayloadJson: row.requestPayloadJson ?? undefined,
    statsJson: row.statsJson ?? undefined,
    errorsJson: row.errorsJson ?? undefined
  };
}

export const jobsRepo = {
  async create(input: JobRunCreate) {
    const inserted = await db
      .insert(jobRuns)
      .values({
        type: input.type,
        status: input.status,
        requestPayloadJson: input.requestPayloadJson
      })
      .returning();

    return mapRow(inserted[0]);
  },

  async markRunning(id: string) {
    await db
      .update(jobRuns)
      .set({
        status: "running",
        startedAt: new Date()
      })
      .where(eq(jobRuns.id, id));
  },

  async finalize(id: string, payload: { status: string; statsJson?: unknown; errorsJson?: unknown; finishedAt: Date }) {
    await db
      .update(jobRuns)
      .set({
        status: payload.status,
        statsJson: payload.statsJson,
        errorsJson: payload.errorsJson,
        finishedAt: payload.finishedAt
      })
      .where(eq(jobRuns.id, id));
  },

  async getById(id: string) {
    if (!UUID_RE.test(id)) {
      return null;
    }
    const rows = await db.select().from(jobRuns).where(eq(jobRuns.id, id)).limit(1);
    if (!rows[0]) {
      return null;
    }
    return mapRow(rows[0]);
  }
};
