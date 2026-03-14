type JobRunCreate = {
  type: string;
  status: string;
  requestPayloadJson?: unknown;
};

type JobRunRecord = {
  id: string;
  type: string;
  status: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  statsJson?: unknown;
  errorsJson?: unknown;
};

const jobStore = new Map<string, JobRunRecord>();

export const jobsRepo = {
  async create(input: JobRunCreate) {
    const id = crypto.randomUUID();
    const row: JobRunRecord = {
      id,
      type: input.type,
      status: input.status,
      requestedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null
    };
    jobStore.set(id, row);
    return row;
  },

  async markRunning(id: string) {
    const row = jobStore.get(id);
    if (!row) {
      return;
    }
    row.status = "running";
    row.startedAt = new Date().toISOString();
  },

  async finalize(id: string, payload: { status: string; statsJson?: unknown; errorsJson?: unknown; finishedAt: Date }) {
    const row = jobStore.get(id);
    if (!row) {
      return;
    }
    row.status = payload.status;
    row.statsJson = payload.statsJson;
    row.errorsJson = payload.errorsJson;
    row.finishedAt = payload.finishedAt.toISOString();
  },

  async getById(id: string) {
    return jobStore.get(id) ?? null;
  }
};
