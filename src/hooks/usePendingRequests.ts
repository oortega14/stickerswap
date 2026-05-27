import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPendingRequests,
  fetchOutgoingRequests,
  acceptFriendRequest,
  declineFriendRequest,
  deleteMyOutgoingRequest
} from "@/social/nearbyMatches";
import { useSessionStore } from "@/auth/useSession";

export function usePendingRequests() {
  const session = useSessionStore((s) => s.session);
  return useQuery({
    queryKey: ["pendingRequests"],
    queryFn: fetchPendingRequests,
    staleTime: 30_000,
    enabled: !!session
  });
}

export function usePendingRequestsCount() {
  const q = usePendingRequests();
  return q.data?.length ?? 0;
}

export function useOutgoingRequests() {
  const session = useSessionStore((s) => s.session);
  return useQuery({
    queryKey: ["outgoingRequests"],
    queryFn: fetchOutgoingRequests,
    staleTime: 30_000,
    enabled: !!session
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingRequests"] });
      qc.invalidateQueries({ queryKey: ["outgoingRequests"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["pendingRequests"] });
    }
  });
}

export function useDeclineRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingRequests"] });
      qc.invalidateQueries({ queryKey: ["outgoingRequests"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["pendingRequests"] });
    }
  });
}

export function useDeleteMyOutgoingRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMyOutgoingRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outgoingRequests"] });
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] });
    }
  });
}
