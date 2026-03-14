import React, { useState } from "react";
import type { DashboardCard } from "../lib/api";
import { formatRarity } from "./FilterBar";

function formatPrice(price: number | null): string {
  if (price == null) return "N/A";
  return `$${price.toFixed(2)}`;
}

function CardDetailModal({ card, onClose }: { card: DashboardCard; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-card">
          {card.imageUrl && (
            <img className="modal-card-image" src={card.imageUrl} alt={card.cardName} />
          )}
          <div className="modal-card-info">
            <h2>{card.cardName}</h2>
            <p className="modal-card-set">{card.setName}</p>
            <div className="modal-card-meta">
              <span className="rarity-badge">{formatRarity(card.rarity || "")} ({card.rarity})</span>
              <span className="card-price">{formatPrice(card.marketPrice)}</span>
            </div>
            <p className="modal-card-id">Card ID: {card.sourceCardId}</p>
            {card.isChase && <span className="chase-badge">Chase</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SetList({ cards }: { cards: DashboardCard[] }) {
  const [selectedCard, setSelectedCard] = useState<DashboardCard | null>(null);

  if (cards.length === 0) {
    return <p className="empty-state">No cards match the current filter combination.</p>;
  }

  return (
    <>
      {selectedCard && <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
      <ul className="card-list">
        {cards.map((card) => (
          <li key={card.id} className="card-row" data-testid={card.isChase ? "chase-row" : "non-chase-row"} onClick={() => setSelectedCard(card)}>
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
              {card.rarity && <span className="rarity-badge">{formatRarity(card.rarity)} ({card.rarity})</span>}
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
    </>
  );
}
