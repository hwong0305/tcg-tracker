import React, { useEffect, useMemo, useState } from "react";
import { FilterBar, type FilterState } from "./components/FilterBar";
import { SetList } from "./components/SetList";
import { ThemeToggle } from "./components/ThemeToggle";
import { fetchDashboard, type DashboardData, type DashboardCard } from "./lib/api";

const initialFilters: FilterState = {
  printStatus: "all",
  tcgType: "all",
  set: "all",
  rarity: "all",
  chaseOnly: false
};

export default function App() {
  const [data, setData] = useState<DashboardData>({ sets: [], cards: [] });
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return data.cards.filter((card) => {
      if (filters.printStatus !== "all" && card.printStatus !== filters.printStatus) return false;
      if (filters.tcgType !== "all" && card.tcgType !== filters.tcgType) return false;
      if (filters.set !== "all" && card.setId !== filters.set) return false;
      if (filters.rarity !== "all" && card.rarity !== filters.rarity) return false;
      if (filters.chaseOnly && !card.isChase) return false;
      return true;
    });
  }, [data, filters]);

  const onPreset = (preset: "store-hunter" | "vault" | "all") => {
    if (preset === "all") {
      setFilters(initialFilters);
    } else {
      setFilters((prev) => ({
        ...prev,
        printStatus: preset === "store-hunter" ? "in-print" : "out-of-print"
      }));
    }
  };

  const tcgOptions = Array.from(new Set(data.cards.map((c) => c.tcgType)));
  const setOptions = Array.from(new Map(data.sets.map((s) => [s.id, s])).values())
    .sort((a, b) => a.setName.localeCompare(b.setName))
    .map((s) => ({ id: s.id, name: `${s.setName} (${s.sourceSetId})` }));
  const rarityOptions = Array.from(new Set(data.cards.map((c) => c.rarity).filter((r): r is string => r != null)));

  if (loading) return <div>Loading...</div>;
  if (error) return <div role="alert">{error}</div>;

  return (
    <main className="app-shell">
      <section className="dashboard-hero">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Collection Console</p>
            <h1>CardTracker Dashboard</h1>
          </div>
          <ThemeToggle />
        </div>
        <p>Filter in-print releases, spot chase cards, and pivot between trading card segments quickly.</p>
        <div className="hero-metrics">
          <div>
            <span className="metric-label">Visible Cards</span>
            <strong>{filtered.length}</strong>
          </div>
          <div>
            <span className="metric-label">Tracked Sets</span>
            <strong>{data.sets.length}</strong>
          </div>
        </div>
      </section>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onPreset={onPreset}
        tcgOptions={tcgOptions}
        setOptions={setOptions}
        rarityOptions={rarityOptions}
      />
      <SetList cards={filtered} />
    </main>
  );
}
