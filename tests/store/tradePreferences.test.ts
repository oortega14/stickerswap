import { useTradePrefs } from "@/store/tradePreferences";
import { act } from "@testing-library/react-native";

describe("useTradePrefs", () => {
  it("defaults to groupBySection=true", () => {
    expect(useTradePrefs.getState().groupBySection).toBe(true);
  });

  it("toggles", () => {
    act(() => useTradePrefs.getState().setGroupBySection(false));
    expect(useTradePrefs.getState().groupBySection).toBe(false);
    act(() => useTradePrefs.getState().setGroupBySection(true));
    expect(useTradePrefs.getState().groupBySection).toBe(true);
  });
});
