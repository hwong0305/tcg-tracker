import { afterEach, expect, mock, test } from "bun:test";
import { fetchLimitlessCards } from "../src/limitless/scraper";

afterEach(() => {
  mock.restore();
});

test("fetchLimitlessCards follows set card links and scrapes card detail fields", async () => {
  const setHtml = `
    <div class="card-search-grid">
      <a href="/cards/OP01-001"><img src="https://cdn/OP01-001_EN.webp"></a>
      <a href="/cards/OP01-002?v=1"><img src="https://cdn/OP01-002_p1_EN.webp"></a>
    </div>
  `;

  const cardOneHtml = `
    <div class="card-image">
      <img src="https://cdn/OP01-001_EN.webp">
    </div>
    <span class="card-text-name"><a href="/cards/OP01-001">Roronoa Zoro</a></span>
    <div class="prints-current-details">
      <span>Romance Dawn (OP01)</span>
      <span>Leader</span>
    </div>
  `;

  const cardTwoHtml = `
    <div class="card-image">
      <img src="https://cdn/OP01-002_EN.webp">
    </div>
    <span class="card-text-name"><a href="/cards/OP01-002">Trafalgar Law</a></span>
    <div class="prints-current-details">
      <span>Romance Dawn (OP01)</span>
      <span>Character</span>
    </div>
  `;

  const calls: string[] = [];
  const fetchMock = mock(async (url: string | URL | Request) => {
    const target = typeof url === "string" ? url : url.toString();
    calls.push(target);

    if (target.endsWith("/cards/op01-romance-dawn")) {
      return new Response(setHtml, { status: 200, headers: { "content-type": "text/html" } });
    }
    if (target.endsWith("/cards/OP01-001")) {
      return new Response(cardOneHtml, { status: 200, headers: { "content-type": "text/html" } });
    }
    if (target.endsWith("/cards/OP01-002")) {
      return new Response(cardTwoHtml, { status: 200, headers: { "content-type": "text/html" } });
    }

    return new Response("not found", { status: 404 });
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  try {
    const cards = await fetchLimitlessCards("https://onepiece.limitlesstcg.com", "op01-romance-dawn");

    expect(calls).toEqual([
      "https://onepiece.limitlesstcg.com/cards/op01-romance-dawn",
      "https://onepiece.limitlesstcg.com/cards/OP01-001",
      "https://onepiece.limitlesstcg.com/cards/OP01-002"
    ]);

    expect(cards as any).toEqual([
      {
        sourceCardId: "OP01-001",
        cardName: "Roronoa Zoro",
        rarity: "Leader",
        imageUrl: "https://cdn/OP01-001_EN.webp",
        parallelVariant: null
      },
      {
        sourceCardId: "OP01-002",
        cardName: "Trafalgar Law",
        rarity: "Character",
        imageUrl: "https://cdn/OP01-002_EN.webp",
        parallelVariant: "Parallel"
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
