import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { projectService } from '../services/projectService';
import type {
  AddMemberRequest,
  AssignmentPage,
  ProjectCreate,
  ProjectDetail,
  ProjectMemberResponse,
  ProjectResponse,
  ProjectUpdate,
} from '../types';

export const projectKeys = {
  all: ['projects'] as const,
  list: (includeArchived: boolean) => ['projects', { includeArchived }] as const,
  detail: (id: number | undefined) => ['projects', id] as const,
  members: (id: number | undefined) => ['projects', id, 'members'] as const,
  assignments: (id: number | undefined) => ['assignments', 'project', id] as const,
};

const invalidateProjects = async (qc: QueryClient, includeAssignments = false): Promise<void> => {
  const tasks: Promise<void>[] = [
    qc.invalidateQueries({ queryKey: ['projects'] }),
    qc.invalidateQueries({ queryKey: ['dashboard'] }),
  ];
  if (includeAssignments) {
    tasks.push(qc.invalidateQueries({ queryKey: ['assignments'] }));
  }
  await Promise.all(tasks);
};

export const useProjects = (includeArchived = false) =>
  useQuery<ProjectResponse[]>({
    queryKey: projectKeys.list(includeArchived),
    queryFn: () => projectService.list(includeArchived),
  });

export const useProject = (id: number | undefined) =>
  useQuery<ProjectDetail>({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectService.get(id as number),
    enabled: typeof id === 'number' && Number.isFinite(id),
  });

export const useProjectMembers = (projectId: number | undefined) =>
  useQuery<ProjectMemberResponse[]>({
    queryKey: projectKeys.members(projectId),
    queryFn: () => projectService.listMembers(projectId as number),
    enabled: typeof projectId === 'number' && Number.isFinite(projectId),
  });

/** Assignments of a single project (up to 100) for the project board. */
export const useProjectAssignments = (projectId: number | undefined) =>
  useQuery<AssignmentPage>({
    queryKey: projectKeys.assignments(projectId),
    queryFn: () => projectService.listAssignments(projectId as number),
    enabled: typeof projectId === 'number' && Number.isFinite(projectId),
  });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation<ProjectDetail, Error, ProjectCreate>({
    mutationFn: (payload) => projectService.create(payload),
    onSuccess: () => invalidateProjects(qc),
  });
};

export const useUpdateProject = (id: number) => {
  const qc = useQueryClient();
  return useMutation<ProjectDetail, Error, ProjectUpdate>({
    mutationFn: (payload) => projectService.update(id, payload),
    onSuccess: (data) => {
      qc.setQueryData(projectKeys.detail(id), data);
      return invalidateProjects(qc);
    },
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => projectService.remove(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: projectKeys.detail(id) });
      return invalidateProjects(qc, true);
    },
  });
};

export const useAddMember = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation<ProjectMemberResponse, Error, AddMemberRequest>({
    mutationFn: (payload) => projectService.addMember(projectId, payload),
    onSuccess: () => invalidateProjects(qc),
  });
};

export const useRemoveMember = (projectId: number) => {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (userId) => projectService.removeMember(projectId, userId),
    onSuccess: () => invalidateProjects(qc, true),
  });
};
