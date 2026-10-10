import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { assignmentService } from '../services/assignmentService';
import type {
  AssignmentCreate,
  AssignmentFilters,
  AssignmentResponse,
  AssignmentStatus,
  AssignmentUpdate,
  CommentResponse,
} from '../types';

export const assignmentKeys = {
  all: ['assignments'] as const,
  lists: () => [...assignmentKeys.all, 'list'] as const,
  list: (filters: AssignmentFilters) => [...assignmentKeys.lists(), filters] as const,
  detail: (id: number) => [...assignmentKeys.all, 'detail', id] as const,
  comments: (id: number) => [...assignmentKeys.all, 'detail', id, 'comments'] as const,
};

const invalidateRelated = (qc: QueryClient): Promise<unknown> =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['assignments'] }),
    qc.invalidateQueries({ queryKey: ['projects'] }),
    qc.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);

const isValidId = (id: number | undefined): id is number =>
  typeof id === 'number' && Number.isFinite(id) && id > 0;

export const useAssignments = (filters: AssignmentFilters) =>
  useQuery({
    queryKey: assignmentKeys.list(filters),
    queryFn: () => assignmentService.list(filters),
    placeholderData: keepPreviousData,
  });

export const useAssignment = (id: number | undefined) =>
  useQuery({
    queryKey: assignmentKeys.detail(id ?? 0),
    queryFn: () => assignmentService.get(id as number),
    enabled: isValidId(id),
    retry: (count, error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (status === 404 || status === 403) return false;
      return count < 2;
    },
  });

export const useCreateAssignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignmentCreate) => assignmentService.create(payload),
    onSuccess: () => invalidateRelated(qc),
  });
};

export const useUpdateAssignment = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignmentUpdate) => assignmentService.update(id, payload),
    onSuccess: (data) => {
      qc.setQueryData(assignmentKeys.detail(id), data);
      return invalidateRelated(qc);
    },
  });
};

export const useDeleteAssignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assignmentService.remove(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: assignmentKeys.detail(id) });
      return invalidateRelated(qc);
    },
  });
};

interface OptimisticContext {
  previous: AssignmentResponse | undefined;
}

export const useUpdateStatus = (id: number) => {
  const qc = useQueryClient();
  return useMutation<AssignmentResponse, Error, AssignmentStatus, OptimisticContext>({
    mutationFn: (status) => assignmentService.updateStatus(id, { status }),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: assignmentKeys.detail(id) });
      const previous = qc.getQueryData<AssignmentResponse>(assignmentKeys.detail(id));
      if (previous) {
        qc.setQueryData<AssignmentResponse>(assignmentKeys.detail(id), { ...previous, status });
      }
      return { previous };
    },
    onError: (_err, _status, ctx) => {
      if (ctx?.previous) qc.setQueryData(assignmentKeys.detail(id), ctx.previous);
    },
    onSuccess: (data) => {
      qc.setQueryData(assignmentKeys.detail(id), data);
    },
    onSettled: () => invalidateRelated(qc),
  });
};

export const useUpdateAssignee = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assigneeId: number | null) =>
      assignmentService.updateAssignee(id, { assignee_id: assigneeId }),
    onSuccess: (data) => {
      qc.setQueryData(assignmentKeys.detail(id), data);
      return invalidateRelated(qc);
    },
  });
};

export const useComments = (assignmentId: number | undefined) =>
  useQuery({
    queryKey: assignmentKeys.comments(assignmentId ?? 0),
    queryFn: () => assignmentService.listComments(assignmentId as number),
    enabled: isValidId(assignmentId),
  });

export const useAddComment = (assignmentId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => assignmentService.addComment(assignmentId, { body }),
    onSuccess: (comment) => {
      qc.setQueryData<CommentResponse[]>(assignmentKeys.comments(assignmentId), (old) =>
        old ? [...old, comment] : [comment],
      );
      return invalidateRelated(qc);
    },
  });
};

export const useDeleteComment = (assignmentId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => assignmentService.deleteComment(assignmentId, commentId),
    onSuccess: (_data, commentId) => {
      qc.setQueryData<CommentResponse[]>(assignmentKeys.comments(assignmentId), (old) =>
        old ? old.filter((c) => c.id !== commentId) : old,
      );
      return invalidateRelated(qc);
    },
  });
};
