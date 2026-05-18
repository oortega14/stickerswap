import { act, renderHook } from "@testing-library/react-native";
import { useExpandedSections } from "@/store/expandedSections";

describe("useExpandedSections", () => {
  beforeEach(() => {
    useExpandedSections.setState({ expanded: new Set<string>() });
  });

  it("default es Set vacio", () => {
    const { result } = renderHook(() => useExpandedSections());
    expect(result.current.expanded.size).toBe(0);
    expect(result.current.isExpanded("ARG")).toBe(false);
  });

  it("toggle agrega y quita ids", () => {
    const { result } = renderHook(() => useExpandedSections());
    act(() => result.current.toggle("ARG"));
    expect(result.current.isExpanded("ARG")).toBe(true);
    act(() => result.current.toggle("ARG"));
    expect(result.current.isExpanded("ARG")).toBe(false);
  });

  it("permite varias secciones expandidas a la vez", () => {
    const { result } = renderHook(() => useExpandedSections());
    act(() => {
      result.current.toggle("ARG");
      result.current.toggle("BRA");
    });
    expect(result.current.isExpanded("ARG")).toBe(true);
    expect(result.current.isExpanded("BRA")).toBe(true);
    expect(result.current.expanded.size).toBe(2);
  });

  it("collapseAll deja el Set vacio", () => {
    const { result } = renderHook(() => useExpandedSections());
    act(() => {
      result.current.toggle("ARG");
      result.current.toggle("BRA");
    });
    act(() => result.current.collapseAll());
    expect(result.current.expanded.size).toBe(0);
  });
});
