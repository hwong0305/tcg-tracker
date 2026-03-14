import * as cheerio from "cheerio";

export interface LimitlessSet {
  sourceSetId: string;
  setName: string;
  releaseDate: string | null;
  cardCount: number;
  usdTotal: number | null;
  eurTotal: number | null;
}

export interface LimitlessCard {
  sourceCardId: string;
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
    const sourceSetId = href.replace("/cards/", "").split("-")[0].toUpperCase();
    if (!sourceSetId) return;

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

  const cards: LimitlessCard[] = [];

  $("div.card-list a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const img = $(el).find("img");
    const src = img.attr("src") || "";

    const cardMatch = href.match(/\/cards\/([^?]+)/);
    if (!cardMatch) return;

    const rawCardId = cardMatch[1].toUpperCase();
    const variantMatch = href.match(/\?v=(\d+)/);
    const variantNum = variantMatch ? parseInt(variantMatch[1]) : null;

    const sourceCardId = rawCardId.replace(/_P\d+_/, "").replace(/_P\d+/, "");

    let parallelVariant: string | null = null;
    if (variantNum && variantNum > 1) {
      parallelVariant = `Parallel ${variantNum}`;
    }
    if (rawCardId.includes("_P1_") || rawCardId.endsWith("_P1")) {
      parallelVariant = "Parallel";
    }

    cards.push({
      sourceCardId,
      imageUrl: src || null,
      parallelVariant
    });
  });

  return cards;
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
