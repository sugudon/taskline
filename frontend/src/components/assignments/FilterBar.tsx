import { useEffect, useState, type ChangeEvent } from 'react';
import {
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Stack,
  Switch,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { GlassCard } from '../ui/GlassCard';
import { AnimatedButton } from '../ui/AnimatedButton';
import { useProjects } from '../../hooks/useProjects';
import {
  ASSIGNMENT_PRIORITIES,
  ASSIGNMENT_STATUSES,
  PRIORITY_LABELS,
  SORT_OPTIONS,
  STATUS_LABELS,
} from '../../lib/constants';
import type { AssignmentFilters, AssignmentPriority, AssignmentSort, AssignmentStatus } from '../../types';
import { DEFAULT_SORT } from './utils';

export interface FilterBarProps {
  filters: AssignmentFilters;
  onChange: (patch: Partial<AssignmentFilters>) => void;
  onReset: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const { data: projects } = useProjects();
  const urlQuery = filters.q ?? '';
  const [search, setSearch] = useState<string>(urlQuery);

  // Keep the input in sync when the URL changes externally (back/forward, reset).
  useEffect(() => {
    setSearch((current) => (current.trim() === urlQuery ? current : urlQuery));
  }, [urlQuery]);

  // Debounce pushing the search term into the URL.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === urlQuery) return undefined;
    const handle = window.setTimeout(() => onChange({ q: trimmed || undefined }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [search, urlQuery, onChange]);

  const hasActiveFilters = Boolean(
    filters.project_id ||
      filters.status ||
      filters.priority ||
      filters.mine ||
      filters.overdue ||
      filters.q ||
      (filters.sort && filters.sort !== DEFAULT_SORT),
  );

  return (
    <GlassCard isStatic p={{ base: 4, md: 5 }} mb={6}>
      <Stack spacing={4}>
        <InputGroup>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="text.muted" />
          </InputLeftElement>
          <Input
            aria-label="Search assignments"
            placeholder="Search by title..."
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            borderRadius="xl"
            bg="bg.surface"
          />
        </InputGroup>

        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={3}>
          <Select
            aria-label="Filter by project"
            placeholder="All projects"
            value={filters.project_id ? String(filters.project_id) : ''}
            onChange={(e) => onChange({ project_id: e.target.value ? Number(e.target.value) : undefined })}
            borderRadius="xl"
          >
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by status"
            placeholder="Any status"
            value={filters.status ?? ''}
            onChange={(e) =>
              onChange({ status: e.target.value ? (e.target.value as AssignmentStatus) : undefined })
            }
            borderRadius="xl"
          >
            {ASSIGNMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by priority"
            placeholder="Any priority"
            value={filters.priority ?? ''}
            onChange={(e) =>
              onChange({ priority: e.target.value ? (e.target.value as AssignmentPriority) : undefined })
            }
            borderRadius="xl"
          >
            {ASSIGNMENT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Sort assignments"
            value={filters.sort ?? DEFAULT_SORT}
            onChange={(e) => onChange({ sort: e.target.value as AssignmentSort })}
            borderRadius="xl"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </SimpleGrid>

        <Stack
          direction={{ base: 'column', sm: 'row' }}
          spacing={{ base: 3, sm: 6 }}
          align={{ base: 'stretch', sm: 'center' }}
        >
          <FormControl display="flex" alignItems="center" w="auto">
            <Switch
              id="filter-mine"
              colorScheme="brand"
              isChecked={Boolean(filters.mine)}
              onChange={(e) => onChange({ mine: e.target.checked || undefined })}
            />
            <FormLabel htmlFor="filter-mine" mb={0} ml={2}>
              Assigned to me
            </FormLabel>
          </FormControl>
          <FormControl display="flex" alignItems="center" w="auto">
            <Switch
              id="filter-overdue"
              colorScheme="red"
              isChecked={Boolean(filters.overdue)}
              onChange={(e) => onChange({ overdue: e.target.checked || undefined })}
            />
            <FormLabel htmlFor="filter-overdue" mb={0} ml={2}>
              Overdue
            </FormLabel>
          </FormControl>
          {hasActiveFilters ? (
            <AnimatedButton size="sm" variant="ghost" ml={{ sm: 'auto' }} onClick={onReset}>
              Clear filters
            </AnimatedButton>
          ) : null}
        </Stack>
      </Stack>
    </GlassCard>
  );
}

export default FilterBar;
