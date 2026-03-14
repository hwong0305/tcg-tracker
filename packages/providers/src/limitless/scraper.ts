import * as cheerio from "cheerio";

export interface LimitlessSet {
  sourceSetId: string;
  setSlug: string;
  setName: string;
  releaseDate: string | null;
  cardCount: number;
  usdTotal: number | null;
  eurTotal: number | null;
}

export interface LimitlessCard {
  sourceCardId: string;
  cardName: string | null;
  rarity: string | null;
  imageUrl: string | null;
  parallelVariant: string | null;
}

export async function fetchLimitlessSets(baseUrl: string): Promise<LimitlessSet[]> {
  const res = await fetch(`${baseUrl}/cards`);
  if (!res.ok) throw new Error(`HTTP_${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const sets: LimitlessSet[] = [];

  $("table.sets-table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const codeLink = $(cells[0]).find("a");
    const href = codeLink.attr("href") || "";
    const setSlug = href.startsWith("/cards/") ? href.replace("/cards/", "") : "";
    const sourceSetId = href.replace("/cards/", "").split("-")[0].toUpperCase();
    if (!sourceSetId || !setSlug) return;

    const setName = $(cells[1]).find("a").text().trim();
    const releaseDateStr = $(cells[2]).text().trim();
    const releaseDate = releaseDateStr ? formatDate(releaseDateStr) : null;

    const cardCountTd = $(cells[3]);
    const cardCountStr = cardCountTd.find("a").text().split(" ")[0];
    const cardCount = parseInt(cardCountStr) || 0;

    const usdTd = $(cells[4]);
    const usdStr = usdTd.find("a").text().replace(/[$,]/g, "").trim();
    const usdTotal = usdStr && usdStr !== "-" ? parseFloat(usdStr) : null;

    const eurTd = $(cells[5]);
    const eurStr = eurTd.find("a").text().replace(/[€,\s]/g, "").trim();
    const eurTotal = eurStr && eurStr !== "-" ? parseFloat(eurStr) : null;

    if (sourceSetId && setName) {
      sets.push({
        sourceSetId,
        setSlug,
        setName,
        releaseDate,
        cardCount,
        usdTotal,
        eurTotal
      });
    }
  });

  return sets;
}

export async function fetchLimitlessCards(baseUrl: string, setSlug: string): Promise<LimitlessCard[]> {
  const res = await fetch(`${baseUrl}/cards/${setSlug}`);
  if (!res.ok) throw new Error(`HTTP_${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const discovered = new Map<
    string,
    { detailPath: string; imageUrl: string | null; parallelVariant: string | null }
  >();

  const linkNodes = $(".card-search-grid a, div.card-list a");
  linkNodes.each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href.startsWith("/cards/")) return;

    const img = $(el).find("img");
    const src = img.attr("src") || "";

    const cardMatch = href.match(/\/cards\/([^?]+)/);
    if (!cardMatch) return;

    const canonicalCardId = cardMatch[1].toUpperCase();
    const variantMatch = href.match(/\?v=(\d+)/);
    const variantNum = variantMatch ? parseInt(variantMatch[1]) : null;

    let parallelVariant: string | null = null;
    if (variantNum && variantNum >= 1) {
      parallelVariant = `Parallel ${variantNum}`;
    }
    if (parallelVariant === "Parallel 1") {
      parallelVariant = "Parallel";
    }

    const existing = discovered.get(canonicalCardId);
    if (!existing) {
      discovered.set(canonicalCardId, {
        detailPath: `/cards/${canonicalCardId}`,
        imageUrl: src || null,
        parallelVariant
      });
      return;
    }

    discovered.set(canonicalCardId, {
      detailPath: existing.detailPath,
      imageUrl: existing.imageUrl ?? (src || null),
      parallelVariant: existing.parallelVariant ?? parallelVariant
    });
  });

  const cards: LimitlessCard[] = [];
  for (const [sourceCardId, discoveredCard] of discovered.entries()) {
    const details = await fetchLimitlessCardDetails(baseUrl, discoveredCard.detailPath);
    cards.push({
      sourceCardId,
      cardName: details.cardName,
      rarity: details.rarity,
      imageUrl: details.imageUrl ?? discoveredCard.imageUrl,
      parallelVariant: discoveredCard.parallelVariant
    });
  }

  return cards;
}

async function fetchLimitlessCardDetails(baseUrl: string, detailPath: string) {
  const res = await fetch(`${baseUrl}${detailPath}`);
  if (!res.ok) {
    return { cardName: null, rarity: null, imageUrl: null };
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const cardName = $(".card-text-name a").first().text().trim() || null;
  const rarity = $(".prints-current-details span").eq(1).text().trim() || null;
  const imageUrl = $(".card-image img").first().attr("src") || null;

  return { cardName, rarity, imageUrl };
}

function formatDate(str: string): string | null {
  const match = str.match(/(\d{2})\s+(\w+)\s+(\d{2})/);
  if (!match) return null;

  const months: Record<string, string> = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
    "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
    "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
  };

  const [, day, month, year] = match;
  const monthNum = months[month];
  if (!monthNum) return null;

  return `20${year}-${monthNum}-${day.padStart(2, "0")}`;
}
