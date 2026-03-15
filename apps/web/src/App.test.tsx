import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { afterEach, beforeEach, expect, test } from "vitest";
import App from "./App";
import * as api from "./lib/api";

const fixture = {
  sets: [
    { id: "OP01", setName: "Romance Dawn" },
    { id: "OP02", setName: "Paramount War" }
  ],
  cards: [
    {
      id: "1",
      sourceCardId: "OP01-001",
      cardName: "A",
      setId: "OP01",
      setName: "Romance Dawn",
      rarity: "Alt Art",
      marketPrice: 2.55,
      imageUrl: "https://img/a.jpg",
      isChase: true,
      tcgType: "OnePiece",
      printStatus: "in-print" as const
    },
    {
      id: "2",
      sourceCardId: "OP02-050",
      cardName: "B",
      setId: "OP02",
      setName: "Paramount War",
      rarity: "R",
      marketPrice: null,
      imageUrl: null,
      isChase: false,
      tcgType: "OnePiece",
      printStatus: "out-of-print" as const
    }
  ]
};

beforeEach(() => {
  vi.spyOn(api, "fetchDashboard").mockResolvedValue(fixture as any);
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  window.history.replaceState({}, "", "/dashboard");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("renders single-page filters and applies client-side filtering", async () => {
  render(<App />);
  await screen.findByLabelText("Print Status");
  await screen.findByText("A");
  expect(screen.getByLabelText("Search cards")).toBeInTheDocument();
  expect(screen.getByLabelText("TCG Type")).toBeInTheDocument();
  expect(screen.getByLabelText("Set")).toBeInTheDocument();
  expect(screen.getByLabelText("Rarity")).toBeInTheDocument();
  expect(screen.getByLabelText("Chase Only")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Print Status"), { target: { value: "in-print" } });
  expect(screen.getByText("A")).toBeInTheDocument();
  expect(screen.queryByText("B")).toBeNull();
});

test("search filters cards by card name case-insensitively", async () => {
  vi.mocked(api.fetchDashboard).mockResolvedValueOnce({
    ...fixture,
    cards: [{ ...fixture.cards[0], cardName: "Alpha" }, fixture.cards[1]]
  } as any);

  render(<App />);
  await screen.findByText("Alpha");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "LPH" } });
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  expect(screen.queryByText("B")).toBeNull();
});

test("search filters cards by source id case-insensitively", async () => {
  render(<App />);
  await screen.findByText("A");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "op02" } });
  expect(screen.getByText("B")).toBeInTheDocument();
  expect(screen.queryByText("A")).toBeNull();
});

test("whitespace-only search behaves like empty search", async () => {
  render(<App />);
  await screen.findByText("A");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "   " } });
  expect(screen.getByText("A")).toBeInTheDocument();
  expect(screen.getByText("B")).toBeInTheDocument();
});

test("Store Hunter and Vault presets do not change route", async () => {
  window.history.pushState({}, "", "/dashboard");
  render(<App />);
  await screen.findByText("A");
  fireEvent.click(screen.getByRole("button", { name: /Store Hunter/i }));
  expect(window.location.pathname).toBe("/dashboard");
  expect(screen.getByText("A")).toBeInTheDocument();
  expect(screen.queryByText("B")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /Vault/i }));
  expect(window.location.pathname).toBe("/dashboard");
  expect(screen.getByText("B")).toBeInTheDocument();
  expect(screen.queryByText("A")).toBeNull();
});

test("chase cards are highlighted and chaseOnly narrows list", async () => {
  render(<App />);
  await screen.findByText("A");
  expect(screen.getAllByTestId("chase-badge").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByLabelText("Chase Only"));
  expect(screen.queryByTestId("non-chase-row")).toBeNull();
});

test("renders styled dashboard shell", async () => {
  render(<App />);
  await screen.findByText("A");
  expect(document.querySelector(".app-shell")).toBeInTheDocument();
  expect(document.querySelector(".filter-panel")).toBeInTheDocument();
  expect(document.querySelector(".card-list")).toBeInTheDocument();
});

test("renders card metadata (set, source id, price, image fallback)", async () => {
  render(<App />);
  await screen.findByText("Romance Dawn");
  expect(screen.getByText("OP01-001")).toBeInTheDocument();
  expect(screen.getByText("$2.55")).toBeInTheDocument();
  expect(document.querySelector(".rarity-badge")).toHaveTextContent("Alt Art");
  expect(screen.getByTestId("chase-badge")).toBeInTheDocument();
});

test("renders fallback media and N/A for missing values", async () => {
  render(<App />);
  await screen.findByText("B");
  expect(screen.getByTestId("card-image-fallback")).toBeInTheDocument();
  expect(screen.getByText("N/A")).toBeInTheDocument();
});

test("theme toggle persists and sets data-theme", async () => {
  render(<App />);
  await screen.findByText("A");
  fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "dark" } });
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("cardtracker-theme")).toBe("dark");
});

test("restores theme from storage on remount", async () => {
  localStorage.setItem("cardtracker-theme", "dark");
  const { unmount } = render(<App />);
  await screen.findByText("A");
  expect(document.documentElement.dataset.theme).toBe("dark");
  unmount();
  render(<App />);
  await screen.findByText("A");
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("invalid stored value falls back to system", async () => {
  localStorage.setItem("cardtracker-theme", "sepia");
  render(<App />);
  await screen.findByText("A");
  expect(screen.getByLabelText("Theme")).toHaveValue("system");
});

test("defaults to system when no stored value exists", async () => {
  localStorage.removeItem("cardtracker-theme");
  render(<App />);
  await screen.findByText("A");
  expect(screen.getByLabelText("Theme")).toHaveValue("system");
});

test("hydrates filters from query params", async () => {
  window.history.replaceState({}, "", "/dashboard?printStatus=in-print&search=op01");
  render(<App />);
  await screen.findByText("A");
  expect(screen.getByLabelText("Print Status")).toHaveValue("in-print");
  expect(screen.getByLabelText("Search cards")).toHaveValue("op01");
  expect(screen.queryByText("B")).toBeNull();
});

test("retains valid tcgType/set/rarity query params after data load", async () => {
  window.history.replaceState({}, "", "/dashboard?tcgType=OnePiece&set=OP01&rarity=Alt%20Art");
  render(<App />);
  await screen.findByText("A");
  expect(screen.getByLabelText("TCG Type")).toHaveValue("OnePiece");
  expect(screen.getByLabelText("Set")).toHaveValue("OP01");
  expect(screen.getByLabelText("Rarity")).toHaveValue("Alt Art");
  expect(screen.queryByText("B")).toBeNull();
});

test("invalid params fall back and duplicate params use last value", async () => {
  window.history.replaceState(
    {},
    "",
    "/dashboard?printStatus=bad&printStatus=in-print&chaseOnly=yes&search=first&search=second&tcgType=BadType&set=BAD&rarity=BAD"
  );
  render(<App />);
  await screen.findByLabelText("Search cards");
  expect(screen.getByLabelText("Print Status")).toHaveValue("in-print");
  expect(screen.getByLabelText("Chase Only")).not.toBeChecked();
  expect(screen.getByLabelText("Search cards")).toHaveValue("second");
  await waitFor(() => {
    expect(screen.getByLabelText("TCG Type")).toHaveValue("all");
    expect(screen.getByLabelText("Set")).toHaveValue("all");
    expect(screen.getByLabelText("Rarity")).toHaveValue("all");
  });
});

test("syncs only non-default filters to query and keeps pathname", async () => {
  const replaceSpy = vi.spyOn(window.history, "replaceState");
  window.history.replaceState({}, "", "/dashboard?foo=bar");
  render(<App />);
  await screen.findByText("A");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "  OP02  " } });
  await waitFor(() => expect(window.location.search).toBe("?search=OP02"));
  expect(window.location.pathname).toBe("/dashboard");
  expect(replaceSpy).toHaveBeenCalled();
});

test("does not call replaceState when serialized query is unchanged", async () => {
  const replaceSpy = vi.spyOn(window.history, "replaceState");
  window.history.replaceState({}, "", "/dashboard?search=OP02");
  render(<App />);
  await screen.findByText("B");
  replaceSpy.mockClear();
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "  OP02  " } });
  await waitFor(() => expect(replaceSpy).not.toHaveBeenCalled());
});

test("whitespace-only search clears search param from URL", async () => {
  window.history.replaceState({}, "", "/dashboard?search=OP02");
  render(<App />);
  await screen.findByText("B");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "   " } });
  await waitFor(() => expect(window.location.search).toBe(""));
  expect(window.location.pathname).toBe("/dashboard");
});

test("query sync preserves hash fragments", async () => {
  window.history.replaceState({}, "", "/dashboard?foo=bar#cards");
  render(<App />);
  await screen.findByText("A");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "OP02" } });
  await waitFor(() => expect(window.location.search).toBe("?search=OP02"));
  expect(window.location.hash).toBe("#cards");
});
