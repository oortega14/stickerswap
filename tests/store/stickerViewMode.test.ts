import { act, renderHook } from "@testing-library/react-native";
import { useStickerViewMode } from "@/store/stickerViewMode";

// Mock AsyncStorage para que persist no rompa en tests
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

describe("useStickerViewMode", () => {
  beforeEach(() => {
    // Reset store entre tests
    useStickerViewMode.setState({ mode: "compact" });
  });

  it("default es 'compact'", () => {
    const { result } = renderHook(() => useStickerViewMode());
    expect(result.current.mode).toBe("compact");
  });

  it("setMode actualiza el mode", async () => {
    const { result } = renderHook(() => useStickerViewMode());
    await act(async () => result.current.setMode("full"));
    expect(result.current.mode).toBe("full");
  });
});
