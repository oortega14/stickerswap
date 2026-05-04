import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPendingRequests,
  acceptFriendRequest,
  declineFriendRequest
} from "@/social/nearbyMatches";

export function usePendingRequests() {
  return useQuery({
    queryKey: ["pendingRequests"],
    queryFn: fetchPendingRequests,
    staleTime: 30_000
  });
}

export function usePendingRequestsCount() {
  const q = usePendingRequests();
  return q.data?.length ?? 0;
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingRequests"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] });
    },
    onError: () => {
      // Si el row pending no existe o la operación falló, refrescamos para que
      // el inbox se sincronice con el server-state real.
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
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["pendingRequests"] });
    }
  });
}
