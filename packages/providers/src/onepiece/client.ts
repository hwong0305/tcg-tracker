export interface ProviderError {
  code: "NETWORK_ERROR" | "INVALID_PAYLOAD" | "HTTP_ERROR";
  source: "onepiece";
  entity: "set" | "card";
  reason: string;
  retryable: boolean;
}

function isProviderError(e: unknown): e is ProviderError {
  return Boolean(e) && typeof e === "object" && "code" in (e as Record<string, unknown>) && "retryable" in (e as Record<string, unknown>);
}

export function mapOnePieceError(error: Error, entity: "set" | "card"): ProviderError {
  if (error.message.includes("ETIMEDOUT") || error.message.includes("ECONNRESET")) {
    return { code: "NETWORK_ERROR", source: "onepiece", entity, reason: error.message, retryable: true };
  }
  if (error.message.includes("INVALID_PAYLOAD")) {
    return { code: "INVALID_PAYLOAD", source: "onepiece", entity, reason: error.message, retryable: false };
  }
  return { code: "HTTP_ERROR", source: "onepiece", entity, reason: error.message, retryable: false };
}

export async function fetchOnePieceSets(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/sets`);
    if (!res.ok) throw mapOnePieceError(new Error(`HTTP_${res.status}`), "set");
    return res.json();
  } catch (error) {
    if (isProviderError(error)) throw error;
    throw mapOnePieceError(error instanceof Error ? error : new Error(String(error)), "set");
  }
}

export async function fetchOnePieceCards(baseUrl: string, sourceSetId: string) {
  try {
    const res = await fetch(`${baseUrl}/cards?set=${sourceSetId}`);
    if (!res.ok) throw mapOnePieceError(new Error(`HTTP_${res.status}`), "card");
    return res.json();
  } catch (error) {
    if (isProviderError(error)) throw error;
    throw mapOnePieceError(error instanceof Error ? error : new Error(String(error)), "card");
  }
}

export async function fetchOnePieceAllSetCards(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/allSetCards/`);
    if (!res.ok) throw mapOnePieceError(new Error(`HTTP_${res.status}`), "card");
    try {
      return await res.json();
    } catch {
      throw mapOnePieceError(new Error("INVALID_JSON"), "card");
    }
  } catch (error) {
    if (isProviderError(error)) throw error;
    throw mapOnePieceError(error instanceof Error ? error : new Error(String(error)), "card");
  }
}
