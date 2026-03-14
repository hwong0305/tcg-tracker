import React from "react";

export function SetList({ cards }: { cards: Array<{ id: string; cardName: string; isChase: boolean }> }) {
  return (
    <ul>
      {cards.map((card) => (
        <li key={card.id} data-testid={card.isChase ? "chase-row" : "non-chase-row"}>
          <span>{card.cardName}</span>
          {card.isChase ? <span data-testid="chase-badge">Chase</span> : null}
        </li>
      ))}
    </ul>
  );
}
