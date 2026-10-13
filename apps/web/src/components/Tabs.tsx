// FR-N/A, NFR-011, ADR-021: Accessible Tabs component with keyboard arrow navigation.
import React, { type ReactNode, useId } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, selectedId, onSelect, ariaLabel = "Tabs" }) => {
  const baseId = useId();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledItems = items
      .map((item, index) => ({ item, index }))
      .filter((x) => !x.item.disabled);
    const enabledCurrentIdx = enabledItems.findIndex((x) => x.index === currentIndex);
    if (enabledCurrentIdx === -1) return;

    let targetIdx = enabledCurrentIdx;

    if (e.key === "ArrowRight") {
      targetIdx = (enabledCurrentIdx + 1) % enabledItems.length;
    } else if (e.key === "ArrowLeft") {
      targetIdx = (enabledCurrentIdx - 1 + enabledItems.length) % enabledItems.length;
    } else if (e.key === "Home") {
      targetIdx = 0;
    } else if (e.key === "End") {
      targetIdx = enabledItems.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const targetItem = enabledItems[targetIdx]?.item;
    if (targetItem) {
      onSelect(targetItem.id);
      const buttonEl = document.getElementById(`${baseId}-tab-${targetItem.id}`);
      buttonEl?.focus();
    }
  };

  const activeItem = items.find((item) => item.id === selectedId) || items[0];

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} className="abh-tablist">
        {items.map((item, index) => {
          const isSelected = item.id === selectedId;
          const tabId = `${baseId}-tab-${item.id}`;
          const panelId = `${baseId}-panel-${item.id}`;

          return (
            <button
              key={item.id}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              className="abh-tab"
              onClick={() => onSelect(item.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {activeItem && (
        <div
          id={`${baseId}-panel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeItem.id}`}
          className="abh-tabpanel"
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
};
