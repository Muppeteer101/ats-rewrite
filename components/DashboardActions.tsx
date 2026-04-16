'use client';

import { useState } from 'react';
import { UpsellModal } from './UpsellModal';

export function DashboardActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-[var(--color-accent)] hover:opacity-80"
      >
        Add credits →
      </button>
      {open && <UpsellModal onClose={() => setOpen(false)} />}
    </>
  );
}
