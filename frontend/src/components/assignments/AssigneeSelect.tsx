import { FormControl, FormLabel, Select, useToast } from '@chakra-ui/react';
import { useUpdateAssignee } from '../../hooks/useAssignments';
import { useProjectMembers } from '../../hooks/useProjects';
import { getErrorMessage } from '../../services/api';
import type { AssignmentResponse } from '../../types';
import { userDisplayName } from './utils';

export interface AssigneeSelectProps {
  assignment: AssignmentResponse;
  /** e.g. when the project is archived (read-only). */
  isDisabled?: boolean;
  /** Called with the new assignee id (or null) after a successful change. */
  onReassigned?: (assigneeId: number | null) => void;
}

export function AssigneeSelect({ assignment, isDisabled = false, onReassigned }: AssigneeSelectProps) {
  const toast = useToast();
  const { data: members, isLoading } = useProjectMembers(assignment.project_id);
  const updateAssignee = useUpdateAssignee(assignment.id);
  const currentId = assignment.assignee?.id;

  // Make sure the current assignee is selectable even if the member list is stale.
  const options = members?.map((m) => m.user) ?? [];
  if (assignment.assignee && !options.some((u) => u.id === assignment.assignee?.id)) {
    options.unshift(assignment.assignee);
  }

  const handleChange = (raw: string) => {
    const next = raw ? Number(raw) : null;
    if (next === (currentId ?? null)) return;
    updateAssignee.mutate(next, {
      onSuccess: (data) => {
        toast({
          status: 'success',
          title: data.assignee ? `Assigned to ${userDisplayName(data.assignee)}` : 'Assignment unassigned',
          duration: 2500,
        });
        onReassigned?.(data.assignee?.id ?? null);
      },
      onError: (err) => {
        toast({ status: 'error', title: 'Could not change assignee', description: getErrorMessage(err) });
      },
    });
  };

  return (
    <FormControl>
      <FormLabel htmlFor="assignment-assignee" fontSize="sm" color="text.muted">
        Assignee
      </FormLabel>
      <Select
        id="assignment-assignee"
        value={currentId ? String(currentId) : ''}
        onChange={(e) => handleChange(e.target.value)}
        isDisabled={isDisabled || updateAssignee.isPending || isLoading}
        borderRadius="xl"
      >
        <option value="">Unassigned</option>
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {userDisplayName(u)}
          </option>
        ))}
      </Select>
    </FormControl>
  );
}

export default AssigneeSelect;
