import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

vi.spyOn(api, "fetchDashboard").mockResolvedValue(fixture as any);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  cleanup();
});

test("renders single-page filters and applies client-side filtering", async () => {
  render(<App />);
  await screen.findByLabelText("Print Status");
  await screen.findByText("A");
  expect(screen.getByLabelText("TCG Type")).toBeInTheDocument();
  expect(screen.getByLabelText("Set")).toBeInTheDocument();
  expect(screen.getByLabelText("Rarity")).toBeInTheDocument();
  expect(screen.getByLabelText("Chase Only")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Print Status"), { target: { value: "in-print" } });
  expect(screen.getByText("A")).toBeInTheDocument();
  expect(screen.queryByText("B")).toBeNull();
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
