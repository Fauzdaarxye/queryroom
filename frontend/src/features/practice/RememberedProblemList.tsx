import React, { useCallback, useLayoutEffect, useRef } from 'react';

import { localRead } from '../../lib/storage.ts';
import { localWrite } from '../../lib/storage.ts';
export default function RememberedProblemList({
  viewKey,
  activeSlug,
  position,
  children,
}: {
  viewKey: string;
  activeSlug: string;
  position: React.RefObject<{ viewKey: string; activeSlug: string; top: number } | null>;
  children: React.ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const remember = useCallback(
    (node: HTMLDivElement) => {
      const saved = { viewKey, activeSlug, top: node.scrollTop };
      position.current = saved;
      localWrite('queryroom-problem-list-position', saved);
    },
    [viewKey, activeSlug, position],
  );
  useLayoutEffect(() => {
    const node = list.current!;
    const saved =
      position.current ||
      localRead<{ viewKey: string; activeSlug: string; top: number } | null>(
        'queryroom-problem-list-position',
        null,
      );
    // Restore before paint, so reopening the drawer doesn't flash its first row.
    node.scrollTop =
      saved?.viewKey === viewKey && Number.isFinite(saved.top) ? Math.max(0, saved.top) : 0;
    // A fresh visit or navigation with Previous/Next should reveal the current question.
    // Otherwise preserve the exact place where the user was browsing.
    if (!saved || saved.activeSlug !== activeSlug) {
      const active = node.querySelector('[aria-current="true"]');
      if (active) {
        const viewport = node.getBoundingClientRect(),
          card = active.getBoundingClientRect();
        if (card.top < viewport.top || card.bottom > viewport.bottom) {
          node.scrollTop +=
            card.top - viewport.top - Math.max(0, (node.clientHeight - card.height) / 2);
        }
      }
    }
    remember(node);
    return () => remember(node);
  }, [viewKey, activeSlug, position, remember]);
  return (
    <div className="drawer-problems" ref={list} onScroll={(event) => remember(event.currentTarget)}>
      {children}
    </div>
  );
}
