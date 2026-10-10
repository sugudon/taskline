import api from './api';
import type {
  AddMemberRequest,
  AssignmentPage,
  ProjectCreate,
  ProjectDetail,
  ProjectMemberResponse,
  ProjectResponse,
  ProjectUpdate,
} from '../types';

export const projectService = {
  async list(includeArchived = false): Promise<ProjectResponse[]> {
    const { data } = await api.get<ProjectResponse[]>('/projects', {
      params: { include_archived: includeArchived },
    });
    return data;
  },

  async get(id: number): Promise<ProjectDetail> {
    const { data } = await api.get<ProjectDetail>(`/projects/${id}`);
    return data;
  },

  async create(payload: ProjectCreate): Promise<ProjectDetail> {
    const { data } = await api.post<ProjectDetail>('/projects', payload);
    return data;
  },

  async update(id: number, payload: ProjectUpdate): Promise<ProjectDetail> {
    const { data } = await api.put<ProjectDetail>(`/projects/${id}`, payload);
    return data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  async listMembers(projectId: number): Promise<ProjectMemberResponse[]> {
    const { data } = await api.get<ProjectMemberResponse[]>(`/projects/${projectId}/members`);
    return data;
  },

  async addMember(projectId: number, payload: AddMemberRequest): Promise<ProjectMemberResponse> {
    const { data } = await api.post<ProjectMemberResponse>(`/projects/${projectId}/members`, payload);
    return data;
  },

  async removeMember(projectId: number, userId: number): Promise<void> {
    await api.delete(`/projects/${projectId}/members/${userId}`);
  },

  async listAssignments(projectId: number): Promise<AssignmentPage> {
    const { data } = await api.get<AssignmentPage>('/assignments', {
      params: { project_id: projectId, size: 100 },
    });
    return data;
  },
};

export default projectService;
