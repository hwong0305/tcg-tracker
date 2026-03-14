import { expect, test } from "bun:test";
import { runIngestLimitlessJob } from "../src/ingest-limitless";

test("ingest-limitless uses set link slug and persists enriched card fields", async () => {
  const setListHtml = `
    <table class="data-table sets-table striped">
      <tr><th>Code</th><th>Name</th><th>Release Date</th><th>Cards</th><th>USD</th><th>EUR</th></tr>
      <tr>
        <td><a href="/cards/op01-romance-dawn">OP01</a></td>
        <td><a href="/cards/op01-romance-dawn">Romance Dawn</a></td>
        <td><a href="/cards/op01-romance-dawn">02 Dec 22</a></td>
        <td><a href="/cards/op01-romance-dawn">154</a></td>
        <td><a class="card-price usd">$6,130.18</a></td>
        <td><a class="card-price eur">7,054.18€</a></td>
      </tr>
    </table>
  `;

  const setPageHtml = `
    <div class="card-search-grid">
      <a href="/cards/OP01-001"><img src="https://cdn/OP01-001_EN.webp"></a>
      <a href="/cards/OP01-001?v=1"><img src="https://cdn/OP01-001_p1_EN.webp"></a>
    </div>
  `;

  const cardPageHtml = `
    <div class="card-image"><img src="https://cdn/OP01-001_EN.webp"></div>
    <span class="card-text-name"><a href="/cards/OP01-001">Roronoa Zoro</a></span>
    <div class="prints-current-details">
      <span>Romance Dawn (OP01)</span>
      <span>Leader</span>
    </div>
  `;

  const fetchCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = typeof url === "string" ? url : url.toString();
    fetchCalls.push(target);

    if (target.endsWith("/cards")) {
      return new Response(setListHtml, { status: 200, headers: { "content-type": "text/html" } });
    }
    if (target.endsWith("/cards/op01-romance-dawn")) {
      return new Response(setPageHtml, { status: 200, headers: { "content-type": "text/html" } });
    }
    if (target.endsWith("/cards/OP01-001")) {
      return new Response(cardPageHtml, { status: 200, headers: { "content-type": "text/html" } });
    }

    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;

  const { setsRepo } = await import("../../data/src/repos/sets-repo");
  const originalSetUpsert = setsRepo.upsertMany;
  let setPayload: any[] = [];
  setsRepo.upsertMany = async (rows: any[]) => {
    setPayload = rows;
    return {
      created: rows.length,
      updated: 0,
      rows: rows.map((row, idx) => ({ ...row, id: `set-${idx}` }))
    } as any;
  };

  const { cardsRepo } = await import("../../data/src/repos/cards-repo");
  const originalCardUpsert = cardsRepo.upsertMany;
  let cardPayload: any[] = [];
  cardsRepo.upsertMany = async (rows: any[]) => {
    cardPayload = rows;
    return { created: rows.length, updated: 0 } as any;
  };

  const { jobsRepo } = await import("../../data/src/repos/jobs-repo");
  const originalCreate = jobsRepo.create;
  const originalMarkRunning = jobsRepo.markRunning;
  const originalFinalize = jobsRepo.finalize;
  jobsRepo.create = (async () => ({ id: "job-limitless" })) as any;
  jobsRepo.markRunning = (async () => {}) as any;
  jobsRepo.finalize = (async () => {}) as any;

  try {
    await runIngestLimitlessJob({ baseUrl: "https://onepiece.limitlesstcg.com", setIds: ["OP01"] });

    expect(fetchCalls).toEqual(expect.arrayContaining([
      "https://onepiece.limitlesstcg.com/cards",
      "https://onepiece.limitlesstcg.com/cards/op01-romance-dawn",
      "https://onepiece.limitlesstcg.com/cards/OP01-001"
    ]));

    expect(setPayload[0].eurBoxPrice).toBe(7054.18);
    expect(cardPayload[0]).toMatchObject({
      sourceCardId: "OP01-001",
      cardName: "Roronoa Zoro",
      rarity: "Leader",
      imageUrl: "https://cdn/OP01-001_EN.webp",
      parallelVariant: "Parallel"
    });
  } finally {
    globalThis.fetch = originalFetch;
    setsRepo.upsertMany = originalSetUpsert;
    cardsRepo.upsertMany = originalCardUpsert;
    jobsRepo.create = originalCreate;
    jobsRepo.markRunning = originalMarkRunning;
    jobsRepo.finalize = originalFinalize;
  }
});
