import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardCard } from "../lib/api";
import { formatRarity } from "./FilterBar";

const CARDS_PAGE_SIZE = 60;

function formatPrice(price: number | null): string {
  if (price == null) return "N/A";
  return `$${price.toFixed(2)}`;
}

function CardDetailModal({ card, onClose }: { card: DashboardCard; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-card">
          {card.imageUrl && (
            <img className="modal-card-image" src={card.imageUrl} alt={card.cardName} loading="lazy" decoding="async" />
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

export const SetList = React.memo(function SetList({ cards }: { cards: DashboardCard[] }) {
  const [selectedCard, setSelectedCard] = useState<DashboardCard | null>(null);
  const [visibleCount, setVisibleCount] = useState(CARDS_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(CARDS_PAGE_SIZE);
  }, [cards]);

  useEffect(() => {
    if (selectedCard == null) return;
    if (cards.some((card) => card.id === selectedCard.id)) return;
    setSelectedCard(null);
  }, [cards, selectedCard]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + CARDS_PAGE_SIZE, cards.length));
  }, [cards.length]);

  const hasMore = visibleCount < cards.length;

  useEffect(() => {
    if (!hasMore) return;
    if (typeof window.IntersectionObserver === "undefined") return;
    if (sentinelRef.current == null) return;

    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore();
      }
    });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const visibleCards = useMemo(() => cards.slice(0, visibleCount), [cards, visibleCount]);

  if (cards.length === 0) {
    return <p className="empty-state">No cards match the current filter combination.</p>;
  }

  return (
    <>
      {selectedCard && <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
      <ul className="card-list">
        {visibleCards.map((card) => (
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
      {hasMore ? (
        <div className="load-more-wrap">
          <button type="button" className="load-more-button" onClick={loadMore}>
            Load more cards
          </button>
          <div ref={sentinelRef} className="load-more-sentinel" aria-hidden="true" />
        </div>
      ) : null}
    </>
  );
});
