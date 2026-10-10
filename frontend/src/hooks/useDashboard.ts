import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import type { DashboardSummary } from '../types';

export const dashboardKeys = {
  all: ['dashboard'] as const,
};

export const useDashboardSummary = (): UseQueryResult<DashboardSummary, Error> =>
  useQuery({
    queryKey: dashboardKeys.all,
    queryFn: dashboardService.getSummary,
    // Pick up tasks assigned or reassigned by teammates without a manual reload.
    refetchInterval: 30_000,
  });

export default useDashboardSummary;
