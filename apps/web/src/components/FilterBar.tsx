import React from "react";

export type FilterState = {
  printStatus: "all" | "in-print" | "out-of-print";
  tcgType: string;
  set: string;
  rarity: string;
  chaseOnly: boolean;
};

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
  onPreset: (preset: "store-hunter" | "vault") => void;
  tcgOptions: string[];
  setOptions: string[];
  rarityOptions: string[];
}) {
  return (
    <div>
      <label>
        Print Status
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

      <label>
        TCG Type
        <select aria-label="TCG Type" value={filters.tcgType} onChange={(e) => onChange({ ...filters, tcgType: e.target.value })}>
          <option value="all">All</option>
          {tcgOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      <label>
        Set
        <select aria-label="Set" value={filters.set} onChange={(e) => onChange({ ...filters, set: e.target.value })}>
          <option value="all">All</option>
          {setOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      <label>
        Rarity
        <select aria-label="Rarity" value={filters.rarity} onChange={(e) => onChange({ ...filters, rarity: e.target.value })}>
          <option value="all">All</option>
          {rarityOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      <label>
        Chase Only
        <input
          aria-label="Chase Only"
          type="checkbox"
          checked={filters.chaseOnly}
          onChange={(e) => onChange({ ...filters, chaseOnly: e.target.checked })}
        />
      </label>

      <button type="button" onClick={() => onPreset("store-hunter")}>
        Store Hunter
      </button>
      <button type="button" onClick={() => onPreset("vault")}>
        Vault
      </button>
    </div>
  );
}
