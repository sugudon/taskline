import { FormControl, FormLabel, Select, useToast } from '@chakra-ui/react';
import { useUpdateStatus } from '../../hooks/useAssignments';
import { getErrorMessage } from '../../services/api';
import { ASSIGNMENT_STATUSES, STATUS_LABELS } from '../../lib/constants';
import type { AssignmentResponse, AssignmentStatus } from '../../types';

export interface StatusSelectProps {
  assignment: AssignmentResponse;
  /** e.g. when the project is archived (read-only). */
  isDisabled?: boolean;
}

export function StatusSelect({ assignment, isDisabled = false }: StatusSelectProps) {
  const toast = useToast();
  const updateStatus = useUpdateStatus(assignment.id);

  const handleChange = (status: AssignmentStatus) => {
    if (status === assignment.status) return;
    updateStatus.mutate(status, {
      onSuccess: (data) => {
        toast({
          status: 'success',
          title: data.status === 'done' ? 'Marked as done' : `Moved to ${STATUS_LABELS[data.status]}`,
          duration: 2500,
        });
      },
      onError: (err) => {
        toast({ status: 'error', title: 'Could not update status', description: getErrorMessage(err) });
      },
    });
  };

  return (
    <FormControl>
      <FormLabel htmlFor="assignment-status" fontSize="sm" color="text.muted">
        Status
      </FormLabel>
      <Select
        id="assignment-status"
        value={assignment.status}
        onChange={(e) => handleChange(e.target.value as AssignmentStatus)}
        isDisabled={isDisabled || updateStatus.isPending}
        borderRadius="xl"
      >
        {ASSIGNMENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
    </FormControl>
  );
}

export default StatusSelect;
