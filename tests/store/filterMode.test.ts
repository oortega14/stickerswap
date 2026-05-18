import { act, renderHook } from "@testing-library/react-native";
import { useFilterMode } from "@/store/filterMode";

describe("useFilterMode", () => {
  beforeEach(() => {
    useFilterMode.setState({ filters: {} });
  });

  it("default es 'all' para secciones no seteadas", () => {
    const { result } = renderHook(() => useFilterMode());
    expect(result.current.getFilter("ARG")).toBe("all");
  });

  it("setFilter cambia el modo para una seccion", () => {
    const { result } = renderHook(() => useFilterMode());
    act(() => result.current.setFilter("ARG", "missing"));
    expect(result.current.getFilter("ARG")).toBe("missing");
    expect(result.current.getFilter("BRA")).toBe("all");
  });
});
