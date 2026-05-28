// Mock supabaseClient because useSession imports it transitively, and it throws
// at module load time when EXPO_PUBLIC_SUPABASE_* envs are not set in Jest.
jest.mock("@/auth/supabaseClient", () => ({ supabase: {} }));

import { useRequiresAuthStore } from "@/auth/useRequiresAuth";

describe("useRequiresAuthStore", () => {
  beforeEach(() => {
    useRequiresAuthStore.setState({ open: false, reason: null });
  });

  it("inicia cerrado y sin reason", () => {
    expect(useRequiresAuthStore.getState().open).toBe(false);
    expect(useRequiresAuthStore.getState().reason).toBeNull();
  });

  it("openPrompt setea reason y abre", () => {
    useRequiresAuthStore.getState().openPrompt("friends");
    expect(useRequiresAuthStore.getState().open).toBe(true);
    expect(useRequiresAuthStore.getState().reason).toBe("friends");
  });

  it("closePrompt cierra pero conserva la última reason", () => {
    useRequiresAuthStore.getState().openPrompt("trades");
    useRequiresAuthStore.getState().closePrompt();
    expect(useRequiresAuthStore.getState().open).toBe(false);
    expect(useRequiresAuthStore.getState().reason).toBe("trades");
  });
});
