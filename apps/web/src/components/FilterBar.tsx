import React from "react";

export type FilterState = {
  printStatus: "all" | "in-print" | "out-of-print";
  tcgType: string;
  set: string;
  rarity: string;
  chaseOnly: boolean;
};

type SetOption = { id: string; name: string };

const RARITY_MAP: Record<string, string> = {
  L: "Leader",
  C: "Common",
  UC: "Uncommon",
  R: "Rare",
  SR: "Super Rare",
  SEC: "Secret Rare",
  PR: "Promo",
  P: "Promo"
};

export function formatRarity(rarity: string): string {
  return RARITY_MAP[rarity] || rarity;
}

export function FilterBar({
  filters,
  onChange,
  onPreset,
  tcgOptions,
  setOptions,
  rarityOptions
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onPreset: (preset: "store-hunter" | "vault" | "all") => void;
  tcgOptions: string[];
  setOptions: SetOption[];
  rarityOptions: string[];
}) {
  return (
    <section className="filter-panel" aria-label="Dashboard filters">
      <div className="filter-grid">
        <label className="filter-field">
          <span>Print Status</span>
          <select
            aria-label="Print Status"
            value={filters.printStatus}
            onChange={(e) => onChange({ ...filters, printStatus: e.target.value as FilterState["printStatus"] })}
          >
          <option value="all">All</option>
            <option value="in-print">In-Print</option>
            <option value="out-of-print">Out-of-Print</option>
          </select>
        </label>

        <label className="filter-field">
          <span>TCG Type</span>
          <select aria-label="TCG Type" value={filters.tcgType} onChange={(e) => onChange({ ...filters, tcgType: e.target.value })}>
            <option value="all">All</option>
            {tcgOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Set</span>
          <select aria-label="Set" value={filters.set} onChange={(e) => onChange({ ...filters, set: e.target.value })}>
            <option value="all">All</option>
            {setOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Rarity</span>
          <select aria-label="Rarity" value={filters.rarity} onChange={(e) => onChange({ ...filters, rarity: e.target.value })}>
            <option value="all">All</option>
            {rarityOptions.map((opt) => (
              <option key={opt} value={opt}>
                {formatRarity(opt)} ({opt})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filter-actions">
        <label className="chase-toggle">
          <input
            aria-label="Chase Only"
            type="checkbox"
            checked={filters.chaseOnly}
            onChange={(e) => onChange({ ...filters, chaseOnly: e.target.checked })}
          />
          <span>Chase Only</span>
        </label>

        <div className="preset-buttons">
          <button type="button" onClick={() => onPreset("all")}>
            All
          </button>
          <button type="button" onClick={() => onPreset("store-hunter")}>
            Store Hunter
          </button>
          <button type="button" onClick={() => onPreset("vault")}>
            Vault
          </button>
        </div>
      </div>
    </section>
  );
}
