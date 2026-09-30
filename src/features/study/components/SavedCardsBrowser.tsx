"use client";

import { useId, useMemo, useState } from "react";
import { Card as UiCard } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { Card } from "@/lib/cards/schema";
import { useT } from "@/i18n/I18nProvider";

export function SavedCardsBrowser({ cards }: { cards: Card[] }) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const searchId = useId();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards
      .filter((card) =>
        [card.front, card.back, card.concept, card.errorType, card.context]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      );
  }, [cards, query]);

  return (
    <UiCard className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Saved practice phrases")}</p>
          <p className="text-xs text-ink-muted">{t("{count} total", { count: cards.length })}</p>
        </div>
        {cards.length > 0 && <div className="w-full sm:w-auto">
          <label htmlFor={searchId} className="sr-only">{t("Search saved phrases")}</label>
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setVisibleCount(30); }}
            placeholder={t("Search phrases")}
            className="h-9 w-full text-sm sm:w-72"
          />
        </div>}
      </div>

      {cards.length === 0 ? (
        <p className="text-xs text-ink-muted">{t("Practice phrases you save will appear here.")}</p>
      ) : filtered.length === 0 ? (
        <div className="space-y-3"><p className="text-sm text-ink-muted">{t("No phrases match that search.")}</p><Button variant="secondary" size="sm" onClick={() => setQuery("")}>{t("Clear search")}</Button></div>
      ) : (
        <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto pr-1">
          {filtered.slice(0, visibleCount).map((card) => (
            <li key={card.id} className="grid gap-1 py-3 [overflow-wrap:anywhere] sm:grid-cols-2 sm:gap-x-6">
              <p className="text-sm leading-relaxed text-ink">{card.front}</p>
              <p className="text-sm leading-relaxed text-ink-soft">{card.back}</p>
              {(card.direction || card.concept || card.errorType || card.context) && (
                <p className="text-xs text-ink-muted sm:col-span-2">
                  {/* A phrase pair shows up twice; the direction says which half this is. */}
                  {card.direction === "production"
                    ? t("PT → EN")
                    : card.direction === "recognition"
                      ? t("EN → PT")
                      : null}
                  {card.direction && (card.concept || card.errorType || card.context) ? " · " : ""}
                  {[card.concept, card.errorType, card.context].filter(Boolean).map(value => t(value!)).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {filtered.length > visibleCount && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p role="status" className="text-xs text-ink-muted">{t("Showing {shown} of {total} phrases", { shown: Math.min(visibleCount, filtered.length), total: filtered.length })}</p>
        <Button variant="secondary" size="sm" onClick={() => setVisibleCount(count => count + 30)}>{t("Show more phrases")}</Button>
      </div>}
    </UiCard>
  );
}
