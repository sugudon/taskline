import api from './api';
import type {
  AIStatus,
  AssignmentResponse,
  PlanDraft,
  PlanItem,
  PlanRequest,
  ProjectReport,
} from '../types';

export const aiService = {
  async getStatus(): Promise<AIStatus> {
    const { data } = await api.get<AIStatus>('/ai/status');
    return data;
  },

  async generatePlan(projectId: number, request: PlanRequest): Promise<PlanDraft> {
    const { data } = await api.post<PlanDraft>(`/ai/projects/${projectId}/plan`, request);
    return data;
  },

  async applyPlan(projectId: number, items: PlanItem[]): Promise<AssignmentResponse[]> {
    const { data } = await api.post<AssignmentResponse[]>(`/ai/projects/${projectId}/plan/apply`, {
      items,
    });
    return data;
  },

  async generateReport(projectId: number): Promise<ProjectReport> {
    const { data } = await api.post<ProjectReport>(`/ai/projects/${projectId}/report`);
    return data;
  },
};

export default aiService;
