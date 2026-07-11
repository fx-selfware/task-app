'use client';

import { useState } from 'react';

export function useToggleSet() {
  const [set, setSet] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return [set, toggle] as const;
}
