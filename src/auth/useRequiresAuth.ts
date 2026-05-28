import { create } from "zustand";
import { useSessionStore } from "./useSession";

export type AuthPromptReason = "friends" | "trades" | "sync" | "share" | "nearby";

interface RequiresAuthState {
  open: boolean;
  reason: AuthPromptReason | null;
  openPrompt: (reason: AuthPromptReason) => void;
  closePrompt: () => void;
}

export const useRequiresAuthStore = create<RequiresAuthState>((set) => ({
  open: false,
  reason: null,
  openPrompt: (reason) => set({ open: true, reason }),
  closePrompt: () => set({ open: false })
}));

export function useRequiresAuth() {
  const session = useSessionStore((s) => s.session);
  const openPrompt = useRequiresAuthStore((s) => s.openPrompt);
  return {
    isGuest: !session,
    /** Si no hay sesión abre el sheet. Si la hay, llama a `onAuthed` (si se pasa). */
    requireAuth: (reason: AuthPromptReason, onAuthed?: () => void) => {
      if (!session) {
        openPrompt(reason);
      } else if (onAuthed) {
        onAuthed();
      }
    }
  };
}
