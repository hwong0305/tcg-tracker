import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { afterEach, expect, test } from "vitest";
import App from "./App";
import * as api from "./lib/api";

const fixture = {
  sets: [
    { id: "OP01", setName: "OP01", printStatus: "in-print", tcgType: "OnePiece" },
    { id: "OP02", setName: "OP02", printStatus: "out-of-print", tcgType: "OnePiece" }
  ],
  cards: [
    { id: "1", cardName: "A", printStatus: "in-print", tcgType: "OnePiece", setId: "OP01", rarity: "Alt Art", isChase: true },
    { id: "2", cardName: "B", printStatus: "out-of-print", tcgType: "OnePiece", setId: "OP02", rarity: "R", isChase: false }
  ]
};

vi.spyOn(api, "fetchDashboard").mockResolvedValue(fixture as any);

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
