import { computeStats } from "@/domain/stats";
import type { StickerWithStatus, Friend, FriendMatchSummary } from "@/domain/types";

const baseSticker = (overrides: Partial<StickerWithStatus>): StickerWithStatus => ({
  code: "X-1",
  number: 1,
  name: "Player",
  team: null,
  section: "Intro",
  type: "player",
  count: 0,
  ...overrides
});

describe("computeStats", () => {
  it("retorna ceros para un album vacio", () => {
    const s = computeStats([], [], []);
    expect(s.collected).toBe(0);
    expect(s.missing).toBe(0);
    expect(s.duplicates).toBe(0);
    expect(s.pct).toBe(0);
    expect(s.teamsComplete).toBe(0);
    expect(s.teamsOneAway).toBe(0);
    expect(s.teamsZero).toBe(0);
    expect(s.badgesCollected).toBe(0);
    expect(s.legendsCollected).toBe(0);
    expect(s.cokeCollected).toBe(0);
    expect(s.friendsCount).toBe(0);
    expect(s.matchesCount).toBe(0);
    expect(s.lastAdded).toBeNull();
  });

  it("cuenta collected y missing", () => {
    const stickers = [
      baseSticker({ code: "A-1", count: 1 }),
      baseSticker({ code: "A-2", count: 0 }),
      baseSticker({ code: "A-3", count: 2 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.collected).toBe(2);
    expect(s.missing).toBe(1);
    expect(s.pct).toBeCloseTo(2 / 3);
  });

  it("cuenta duplicates como suma de extras (count-1)", () => {
    const stickers = [
      baseSticker({ code: "A-1", count: 3 }),
      baseSticker({ code: "A-2", count: 2 }),
      baseSticker({ code: "A-3", count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.duplicates).toBe(3); // 2 + 1 + 0
  });

  it("cuenta solo equipos (teamCode != null) en teamsComplete/OneAway/Zero", () => {
    const stickers: StickerWithStatus[] = [
      // ARG completo (2 stickers, count >= 1)
      baseSticker({ code: "ARG-1", team: "ARG", section: "Argentina", count: 1 }),
      baseSticker({ code: "ARG-2", team: "ARG", section: "Argentina", count: 1 }),
      // BRA a uno (2 stickers, uno faltante)
      baseSticker({ code: "BRA-1", team: "BRA", section: "Brasil", count: 1 }),
      baseSticker({ code: "BRA-2", team: "BRA", section: "Brasil", count: 0 }),
      // MEX sin empezar
      baseSticker({ code: "MEX-1", team: "MEX", section: "México", count: 0 }),
      // Intro: NO cuenta como equipo aunque este completo
      baseSticker({ code: "FWC-1", team: null, section: "Intro", count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.teamsComplete).toBe(1); // ARG
    expect(s.teamsOneAway).toBe(1);  // BRA
    expect(s.teamsZero).toBe(1);     // MEX
  });

  it("cuenta badges por type=team_badge", () => {
    const stickers = [
      baseSticker({ code: "ARG-1", type: "team_badge", count: 1 }),
      baseSticker({ code: "BRA-1", type: "team_badge", count: 0 }),
      baseSticker({ code: "ARG-2", type: "player",     count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.badgesCollected).toBe(1);
    expect(s.badgesTotal).toBe(48);
  });

  it("cuenta legends por section=Extras", () => {
    const stickers = [
      baseSticker({ code: "L1", section: "Extras", count: 1 }),
      baseSticker({ code: "L2", section: "Extras", count: 0 }),
      baseSticker({ code: "X1", section: "Intro",  count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.legendsCollected).toBe(1);
    expect(s.legendsTotal).toBe(11);
  });

  it("cuenta coke por section=Coca-Cola", () => {
    const stickers = [
      baseSticker({ code: "CC1", section: "Coca-Cola", count: 1 }),
      baseSticker({ code: "CC2", section: "Coca-Cola", count: 1 }),
      baseSticker({ code: "X1",  section: "Intro",      count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.cokeCollected).toBe(2);
    expect(s.cokeTotal).toBe(14);
  });

  it("cuenta friends solo accepted", () => {
    const friends: Friend[] = [
      { id: "1", username: "a", displayName: null, avatarUrl: null, status: "accepted", source: "qr_code",         createdAt: 1 },
      { id: "2", username: "b", displayName: null, avatarUrl: null, status: "pending",  source: "username_search", createdAt: 1 },
      { id: "3", username: "c", displayName: null, avatarUrl: null, status: "accepted", source: "qr_code",         createdAt: 1 }
    ];
    const s = computeStats([], friends, []);
    expect(s.friendsCount).toBe(2);
  });

  it("matchesCount cuenta amigos con al menos una lista no vacia", () => {
    const matches: FriendMatchSummary[] = [
      { friendId: "1", username: "a", displayName: null, theyHaveYouNeed: ["X"], youHaveTheyNeed: [],    matchCount: 1, sample: ["X"] },
      { friendId: "2", username: "b", displayName: null, theyHaveYouNeed: [],    youHaveTheyNeed: ["Y"], matchCount: 0, sample: [] },
      { friendId: "3", username: "c", displayName: null, theyHaveYouNeed: [],    youHaveTheyNeed: [],    matchCount: 0, sample: [] }
    ];
    const s = computeStats([], [], matches);
    expect(s.matchesCount).toBe(2);
  });

  it("lastAdded devuelve el sticker con max updatedAt y count>=1", () => {
    const stickers = [
      baseSticker({ code: "A-1", name: "Messi",  count: 1, updatedAt: 100 } as any),
      baseSticker({ code: "A-2", name: "Lautaro", count: 1, updatedAt: 200 } as any),
      baseSticker({ code: "A-3", name: "DiMaria", count: 0, updatedAt: 300 } as any) // ignorado (count 0)
    ];
    const s = computeStats(stickers, [], []);
    expect(s.lastAdded).toEqual({
      stickerCode: "A-2",
      stickerName: "Lautaro",
      updatedAt: 200
    });
  });

  it("lastAdded es null cuando nada esta pegado", () => {
    const stickers = [
      baseSticker({ code: "A-1", count: 0 }),
      baseSticker({ code: "A-2", count: 0 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.lastAdded).toBeNull();
  });
});
