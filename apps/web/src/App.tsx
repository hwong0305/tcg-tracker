import React, { useEffect, useMemo, useRef, useState } from "react";
import { FilterBar, type FilterState } from "./components/FilterBar";
import { SetList } from "./components/SetList";
import { ThemeToggle } from "./components/ThemeToggle";
import { fetchDashboard, type DashboardData } from "./lib/api";

const initialFilters: FilterState = {
  printStatus: "all",
  tcgType: "all",
  set: "all",
  rarity: "all",
  chaseOnly: false,
  search: "",
  sort: "name-asc"
};

const SEARCH_DEBOUNCE_MS = 250;

const PRINT_STATUS_VALUES: FilterState["printStatus"][] = ["all", "in-print", "out-of-print"];
const SORT_VALUES: FilterState["sort"][] = ["name-asc", "name-desc"];

function getLastParam(params: URLSearchParams, key: string): string | null {
  const values = params.getAll(key);
  if (values.length === 0) return null;
  return values[values.length - 1];
}

function parseFiltersFromQuery(query: string): FilterState {
  const params = new URLSearchParams(query);
  const printStatusParam = getLastParam(params, "printStatus");
  const sortParam = getLastParam(params, "sort");
  const printStatus = PRINT_STATUS_VALUES.includes(printStatusParam as FilterState["printStatus"])
    ? (printStatusParam as FilterState["printStatus"])
    : initialFilters.printStatus;

  return {
    printStatus,
    tcgType: getLastParam(params, "tcgType") ?? initialFilters.tcgType,
    set: getLastParam(params, "set") ?? initialFilters.set,
    rarity: getLastParam(params, "rarity") ?? initialFilters.rarity,
    chaseOnly: getLastParam(params, "chaseOnly") === "true",
    search: getLastParam(params, "search") ?? initialFilters.search,
    sort: SORT_VALUES.includes(sortParam as FilterState["sort"]) ? (sortParam as FilterState["sort"]) : initialFilters.sort
  };
}

function serializeFiltersToQuery(filters: FilterState): string {
  const params = new URLSearchParams();

  if (filters.printStatus !== initialFilters.printStatus) params.set("printStatus", filters.printStatus);
  if (filters.tcgType !== initialFilters.tcgType) params.set("tcgType", filters.tcgType);
  if (filters.set !== initialFilters.set) params.set("set", filters.set);
  if (filters.rarity !== initialFilters.rarity) params.set("rarity", filters.rarity);
  if (filters.chaseOnly) params.set("chaseOnly", "true");

  const trimmedSearch = filters.search.trim();
  if (trimmedSearch.length > 0) params.set("search", trimmedSearch);
  if (filters.sort !== initialFilters.sort) params.set("sort", filters.sort);

  return params.toString();
}

export default function App() {
  const initialFromQuery = useMemo(() => parseFiltersFromQuery(window.location.search), []);
  const [data, setData] = useState<DashboardData>({ sets: [], cards: [] });
  const [filters, setFilters] = useState<FilterState>(initialFromQuery);
  const [searchValue, setSearchValue] = useState(initialFromQuery.search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hydratedFromUrl = useRef(false);

  useEffect(() => {
    fetchDashboard()
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    hydratedFromUrl.current = true;
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((prev) => (prev.search === searchValue ? prev : { ...prev, search: searchValue }));
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchValue]);

  const tcgOptions = useMemo(() => Array.from(new Set(data.cards.map((c) => c.tcgType))), [data.cards]);
  const setOptions = useMemo(
    () =>
      Array.from(new Map(data.sets.map((s) => [s.id, s])).values())
        .sort((a, b) => a.setName.localeCompare(b.setName))
        .map((s) => ({ id: s.id, name: `${s.setName} (${s.sourceSetId})` })),
    [data.sets]
  );
  const rarityOptions = useMemo(
    () => Array.from(new Set(data.cards.map((c) => c.rarity).filter((r): r is string => r != null))),
    [data.cards]
  );

  useEffect(() => {
    if (loading) return;

    setFilters((prev) => {
      let changed = false;
      const next: FilterState = { ...prev };

      if (prev.tcgType !== initialFilters.tcgType && !tcgOptions.includes(prev.tcgType)) {
        next.tcgType = initialFilters.tcgType;
        changed = true;
      }

      if (prev.set !== initialFilters.set && !setOptions.some((option) => option.id === prev.set)) {
        next.set = initialFilters.set;
        changed = true;
      }

      if (prev.rarity !== initialFilters.rarity && !rarityOptions.includes(prev.rarity)) {
        next.rarity = initialFilters.rarity;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [loading, tcgOptions, setOptions, rarityOptions]);

  useEffect(() => {
    if (!hydratedFromUrl.current) return;

    const serialized = serializeFiltersToQuery(filters);
    const hash = window.location.hash;
    const nextUrl = serialized.length > 0 ? `${window.location.pathname}?${serialized}${hash}` : `${window.location.pathname}${hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [filters]);

  const filtered = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return data.cards.filter((card) => {
      if (filters.printStatus !== "all" && card.printStatus !== filters.printStatus) return false;
      if (filters.tcgType !== "all" && card.tcgType !== filters.tcgType) return false;
      if (filters.set !== "all" && card.setId !== filters.set) return false;
      if (filters.rarity !== "all" && card.rarity !== filters.rarity) return false;
      if (filters.chaseOnly && !card.isChase) return false;
      if (searchTerm.length > 0) {
        const matchName = card.cardName.toLowerCase().includes(searchTerm);
        const matchId = card.sourceCardId.toLowerCase().includes(searchTerm);
        if (!matchName && !matchId) return false;
      }
      return true;
    });
  }, [data, filters]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      const byName = a.cardName.localeCompare(b.cardName);
      return filters.sort === "name-desc" ? -byName : byName;
    });
    return next;
  }, [filtered, filters.sort]);

  const onPreset = (preset: "store-hunter" | "vault" | "all") => {
    if (preset === "all") {
      setFilters(initialFilters);
      setSearchValue(initialFilters.search);
    } else {
      setFilters((prev) => ({
        ...prev,
        printStatus: preset === "store-hunter" ? "in-print" : "out-of-print"
      }));
    }
  };

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
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onChange={setFilters}
        onPreset={onPreset}
        tcgOptions={tcgOptions}
        setOptions={setOptions}
        rarityOptions={rarityOptions}
      />
      <SetList cards={sorted} />
    </main>
  );
}
