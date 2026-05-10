/**
 * UI store — small bag of cross-screen UI state. Currently:
 *   - `pendingConfirmation`: a destructive action awaiting the user's
 *     verdict on the confirm modal (set by callers, cleared when the
 *     modal resolves)
 */

import { create } from 'zustand';

export interface PendingConfirmation {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly destructive: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export interface UiStore {
  readonly pendingConfirmation: PendingConfirmation | null;
  request: (c: PendingConfirmation) => void;
  resolve: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  pendingConfirmation: null,
  request: (c) => set({ pendingConfirmation: c }),
  resolve: () => set({ pendingConfirmation: null }),
}));
