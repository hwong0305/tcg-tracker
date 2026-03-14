import React from "react";
import type { DashboardCard } from "../lib/api";

function formatPrice(price: number | null): string {
  if (price == null) return "N/A";
  return `$${price.toFixed(2)}`;
}

export function SetList({ cards }: { cards: DashboardCard[] }) {
  if (cards.length === 0) {
    return <p className="empty-state">No cards match the current filter combination.</p>;
  }

  return (
    <ul className="card-list">
      {cards.map((card) => (
        <li key={card.id} className="card-row" data-testid={card.isChase ? "chase-row" : "non-chase-row"}>
          <div className="card-media">
            {card.imageUrl ? (
              <img className="card-thumb" src={card.imageUrl} alt={card.cardName} loading="lazy" />
            ) : (
              <div className="card-thumb-fallback" data-testid="card-image-fallback" />
            )}
          </div>
          <div className="card-details">
            <span className="card-name">{card.cardName}</span>
            <span className="card-source-id">{card.sourceCardId}</span>
            <span className="card-set">{card.setName}</span>
          </div>
          <div className="card-meta">
            {card.rarity && <span className="rarity-badge">{card.rarity}</span>}
            <span className="card-price">{formatPrice(card.marketPrice)}</span>
            {card.isChase ? (
              <span className="chase-badge" data-testid="chase-badge">
                Chase
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
