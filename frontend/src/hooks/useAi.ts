import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { aiService } from '../services/aiService';
import type {
  AIStatus,
  AssignmentResponse,
  PlanDraft,
  PlanItem,
  PlanRequest,
  ProjectReport,
} from '../types';

export const aiKeys = {
  status: ['ai', 'status'] as const,
};

export const useAIStatus = (enabled = true): UseQueryResult<AIStatus, Error> =>
  useQuery({
    queryKey: aiKeys.status,
    queryFn: aiService.getStatus,
    staleTime: 60_000,
    enabled,
  });

export const useGeneratePlan = (
  projectId: number,
): UseMutationResult<PlanDraft, Error, PlanRequest> => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: PlanRequest) => aiService.generatePlan(projectId, request),
    onSettled: () => qc.invalidateQueries({ queryKey: aiKeys.status }),
  });
};

export const useApplyPlan = (
  projectId: number,
): UseMutationResult<AssignmentResponse[], Error, PlanItem[]> => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: PlanItem[]) => aiService.applyPlan(projectId, items),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['assignments'] }),
        qc.invalidateQueries({ queryKey: ['projects'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
};

export const useGenerateReport = (
  projectId: number,
): UseMutationResult<ProjectReport, Error, void> => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => aiService.generateReport(projectId),
    onSettled: () => qc.invalidateQueries({ queryKey: aiKeys.status }),
  });
};
