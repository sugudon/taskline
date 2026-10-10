import api from './api';
import type {
  AssigneeUpdate,
  AssignmentCreate,
  AssignmentFilters,
  AssignmentPage,
  AssignmentResponse,
  AssignmentUpdate,
  CommentCreate,
  CommentResponse,
  StatusUpdate,
} from '../types';

type QueryParams = Record<string, string | number | boolean>;

/** Drop undefined / empty / false values so the API only sees active filters. */
const toParams = (filters: AssignmentFilters): QueryParams => {
  const params: QueryParams = {};
  (Object.keys(filters) as (keyof AssignmentFilters)[]).forEach((key) => {
    const value = filters[key];
    if (value === undefined || value === '' || value === false) return;
    params[key] = value;
  });
  return params;
};

export const assignmentService = {
  async list(filters: AssignmentFilters): Promise<AssignmentPage> {
    const { data } = await api.get<AssignmentPage>('/assignments', { params: toParams(filters) });
    return data;
  },

  async get(id: number): Promise<AssignmentResponse> {
    const { data } = await api.get<AssignmentResponse>(`/assignments/${id}`);
    return data;
  },

  async create(payload: AssignmentCreate): Promise<AssignmentResponse> {
    const { data } = await api.post<AssignmentResponse>('/assignments', payload);
    return data;
  },

  async update(id: number, payload: AssignmentUpdate): Promise<AssignmentResponse> {
    const { data } = await api.put<AssignmentResponse>(`/assignments/${id}`, payload);
    return data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/assignments/${id}`);
  },

  async updateStatus(id: number, payload: StatusUpdate): Promise<AssignmentResponse> {
    const { data } = await api.patch<AssignmentResponse>(`/assignments/${id}/status`, payload);
    return data;
  },

  async updateAssignee(id: number, payload: AssigneeUpdate): Promise<AssignmentResponse> {
    const { data } = await api.patch<AssignmentResponse>(`/assignments/${id}/assignee`, payload);
    return data;
  },

  async listComments(assignmentId: number): Promise<CommentResponse[]> {
    const { data } = await api.get<CommentResponse[]>(`/assignments/${assignmentId}/comments`);
    return data;
  },

  async addComment(assignmentId: number, payload: CommentCreate): Promise<CommentResponse> {
    const { data } = await api.post<CommentResponse>(`/assignments/${assignmentId}/comments`, payload);
    return data;
  },

  async deleteComment(assignmentId: number, commentId: number): Promise<void> {
    await api.delete(`/assignments/${assignmentId}/comments/${commentId}`);
  },
};

export default assignmentService;
