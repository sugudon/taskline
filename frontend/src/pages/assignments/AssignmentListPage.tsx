import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Box, Progress, Stack, Text } from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { TextReveal } from '../../components/ui/TextReveal';
import { GradientButton } from '../../components/ui/GradientButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { FilterBar } from '../../components/assignments/FilterBar';
import { AssignmentTable } from '../../components/assignments/AssignmentTable';
import { Pagination } from '../../components/assignments/Pagination';
import { filtersFromSearchParams, filtersToSearchParams } from '../../components/assignments/utils';
import { useAssignments } from '../../hooks/useAssignments';
import { getErrorMessage } from '../../services/api';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants';
import type { AssignmentFilters } from '../../types';

export function AssignmentListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const queryFilters = useMemo<AssignmentFilters>(() => ({ ...filters, size: DEFAULT_PAGE_SIZE }), [filters]);

  const { data, isLoading, isError, error, isFetching, isPlaceholderData, refetch } = useAssignments(queryFilters);

  const updateFilters = useCallback(
    (patch: Partial<AssignmentFilters>) => {
      setSearchParams(
        (prev) => {
          const current = filtersFromSearchParams(prev);
          // Any filter change other than paging sends you back to page 1.
          const page = 'page' in patch ? patch.page : 1;
          return filtersToSearchParams({ ...current, ...patch, page });
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // e.g. after deleting the last item on the last page, or a stale ?page= link: jump to the last page.
  const currentPage = filters.page ?? 1;
  const lastPage = data?.pages ?? 0;
  useEffect(() => {
    if (lastPage > 0 && currentPage > lastPage) {
      updateFilters({ page: lastPage });
    }
  }, [currentPage, lastPage, updateFilters]);

  const resetFilters = useCallback(() => setSearchParams(new URLSearchParams(), { replace: true }), [setSearchParams]);

  const handlePageChange = (page: number) => {
    updateFilters({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasFilters = searchParams.toString().length > 0;
  const items = data?.items ?? [];

  return (
    <PageWrapper>
      <Stack
        direction={{ base: 'column', sm: 'row' }}
        justify="space-between"
        align={{ base: 'flex-start', sm: 'center' }}
        mb={6}
        spacing={4}
      >
        <Box>
          <TextReveal text="Assignments" gradient />
          <Text color="text.muted" mt={1}>
            Everything on your plate, across all your projects.
          </Text>
        </Box>
        <GradientButton leftIcon={<AddIcon />} onClick={() => navigate('/assignments/new')}>
          New assignment
        </GradientButton>
      </Stack>

      <FilterBar filters={filters} onChange={updateFilters} onReset={resetFilters} />

      <Box minH="4px" mb={2}>
        {isFetching && !isLoading ? (
          <Progress size="xs" isIndeterminate colorScheme="brand" borderRadius="full" />
        ) : null}
      </Box>

      {isLoading || (lastPage > 0 && currentPage > lastPage) ? (
        <LoadingState label="Loading assignments..." />
      ) : isError ? (
        <EmptyState
          icon="⚠"
          title="Couldn't load assignments"
          description={getErrorMessage(error)}
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      ) : items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon="🔍"
            title="No assignments match"
            description="Try loosening your filters or searching for something else."
            actionLabel="Clear filters"
            onAction={resetFilters}
          />
        ) : (
          <EmptyState
            icon="📝"
            title="No assignments yet"
            description="Create your first assignment and start roasting through your to-do list."
            actionLabel="New assignment"
            onAction={() => navigate('/assignments/new')}
          />
        )
      ) : (
        <Box opacity={isPlaceholderData ? 0.6 : 1} transition="opacity 0.2s">
          <AssignmentTable assignments={items} />
          <Pagination
            page={data?.page ?? 1}
            pages={data?.pages ?? 1}
            total={data?.total ?? 0}
            onPageChange={handlePageChange}
            isFetching={isPlaceholderData}
          />
        </Box>
      )}
    </PageWrapper>
  );
}

export default AssignmentListPage;
