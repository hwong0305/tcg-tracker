import React from "react";

export function SetList({ cards }: { cards: Array<{ id: string; cardName: string; isChase: boolean }> }) {
  if (cards.length === 0) {
    return <p className="empty-state">No cards match the current filter combination.</p>;
  }

  return (
    <ul className="card-list">
      {cards.map((card) => (
        <li key={card.id} className="card-row" data-testid={card.isChase ? "chase-row" : "non-chase-row"}>
          <span>{card.cardName}</span>
          {card.isChase ? (
            <span className="chase-badge" data-testid="chase-badge">
              Chase
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
