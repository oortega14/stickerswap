import type { BidirectionalMatch, TradeProposalDraft } from "./types";

export function buildDefaultProposal(
  recipientId: string,
  bidi: BidirectionalMatch
): TradeProposalDraft {
  const proposerGives = bidi.youHaveTheyNeed.map((m) => m.stickerCode);
  const proposerGets = bidi.theyHaveYouNeed.map((m) => m.stickerCode);

  let invalidReason: TradeProposalDraft["invalidReason"] = null;
  if (proposerGives.length === 0) invalidReason = "no_gives";
  else if (proposerGets.length === 0) invalidReason = "no_gets";

  return {
    recipientId,
    proposerGives,
    proposerGets,
    message: "",
    isValid: invalidReason === null,
    invalidReason
  };
}
