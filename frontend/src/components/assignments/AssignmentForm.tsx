import { useState, type FormEvent } from 'react';
import {
  chakra,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
} from '@chakra-ui/react';
import { AnimatedInput } from '../ui/AnimatedInput';
import { AnimatedButton } from '../ui/AnimatedButton';
import { GradientButton } from '../ui/GradientButton';
import { GlassCard } from '../ui/GlassCard';
import { useProjectMembers, useProjects } from '../../hooks/useProjects';
import {
  ASSIGNMENT_PRIORITIES,
  ASSIGNMENT_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '../../lib/constants';
import type { AssignmentPriority, AssignmentStatus } from '../../types';
import {
  TITLE_MAX,
  userDisplayName,
  validateAssignmentForm,
  type AssignmentFormErrors,
  type AssignmentFormValues,
} from './utils';

export interface AssignmentFormProps {
  mode: 'create' | 'edit';
  initialValues: AssignmentFormValues;
  onSubmit: (values: AssignmentFormValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Shown in the locked project field in edit mode. */
  lockedProjectName?: string;
}

export function AssignmentForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  lockedProjectName,
}: AssignmentFormProps) {
  const isCreate = mode === 'create';
  const [values, setValues] = useState<AssignmentFormValues>(initialValues);
  const [errors, setErrors] = useState<AssignmentFormErrors>({});

  const { data: allProjects, isLoading: projectsLoading } = useProjects();
  // Archived projects are read-only: never offer them as a target.
  const projects = allProjects?.filter((p) => !p.is_archived);
  const selectedProjectId = values.project_id ? Number(values.project_id) : undefined;
  const { data: members, isLoading: membersLoading } = useProjectMembers(
    isCreate ? selectedProjectId : undefined,
  );

  const setField = <K extends keyof AssignmentFormValues>(key: K, value: AssignmentFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleProjectChange = (projectId: string) => {
    // Members differ per project — reset the assignee whenever the project changes.
    setValues((prev) => ({ ...prev, project_id: projectId, assignee_id: '' }));
    if (errors.project_id) setErrors((prev) => ({ ...prev, project_id: undefined }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validateAssignmentForm(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    await onSubmit(values);
  };

  return (
    <GlassCard isStatic maxW="3xl">
      <chakra.form onSubmit={handleSubmit} noValidate>
        <Stack spacing={5}>
          {isCreate ? (
            <FormControl isRequired isInvalid={Boolean(errors.project_id)}>
              <FormLabel htmlFor="project_id">Project</FormLabel>
              <Select
                id="project_id"
                placeholder={projectsLoading ? 'Loading projects...' : 'Select a project'}
                value={values.project_id}
                onChange={(e) => handleProjectChange(e.target.value)}
                borderRadius="xl"
              >
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              {errors.project_id ? (
                <FormErrorMessage>{errors.project_id}</FormErrorMessage>
              ) : !projectsLoading && (projects ?? []).length === 0 ? (
                <FormHelperText>You need a project first — create one from the Projects page.</FormHelperText>
              ) : null}
            </FormControl>
          ) : (
            <AnimatedInput
              label="Project"
              name="project_locked"
              value={lockedProjectName ?? ''}
              isReadOnly
              isDisabled
              helperText="An assignment can't be moved to another project."
            />
          )}

          <AnimatedInput
            label="Title"
            name="title"
            value={values.title}
            onChange={(e) => setField('title', e.target.value)}
            error={errors.title}
            isRequired
            maxLength={TITLE_MAX}
            placeholder="e.g. Write the project proposal"
            autoFocus={!isCreate}
          />

          <FormControl>
            <FormLabel htmlFor="description">Description</FormLabel>
            <Textarea
              id="description"
              value={values.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Add details, acceptance criteria, links..."
              rows={5}
              borderRadius="xl"
              bg="bg.surface"
            />
          </FormControl>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
            <FormControl>
              <FormLabel htmlFor="priority">Priority</FormLabel>
              <Select
                id="priority"
                value={values.priority}
                onChange={(e) => setField('priority', e.target.value as AssignmentPriority)}
                borderRadius="xl"
              >
                {ASSIGNMENT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </FormControl>

            <AnimatedInput
              label="Due date"
              name="due_date"
              type="date"
              value={values.due_date}
              onChange={(e) => setField('due_date', e.target.value)}
              error={errors.due_date}
            />

            {isCreate ? (
              <FormControl>
                <FormLabel htmlFor="status">Status</FormLabel>
                <Select
                  id="status"
                  value={values.status}
                  onChange={(e) => setField('status', e.target.value as AssignmentStatus)}
                  borderRadius="xl"
                >
                  {ASSIGNMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </FormControl>
            ) : null}

            {isCreate ? (
              <FormControl isDisabled={!selectedProjectId}>
                <FormLabel htmlFor="assignee_id">Assignee</FormLabel>
                <Select
                  id="assignee_id"
                  value={values.assignee_id}
                  onChange={(e) => setField('assignee_id', e.target.value)}
                  borderRadius="xl"
                >
                  <option value="">{membersLoading ? 'Loading members...' : 'Unassigned'}</option>
                  {(members ?? []).map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {userDisplayName(m.user)}
                    </option>
                  ))}
                </Select>
                {!selectedProjectId ? <FormHelperText>Select a project to choose an assignee.</FormHelperText> : null}
              </FormControl>
            ) : null}
          </SimpleGrid>

          <HStack justify="flex-end" spacing={3} pt={2}>
            <AnimatedButton variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
              Cancel
            </AnimatedButton>
            <GradientButton type="submit" isLoading={isSubmitting} loadingText="Saving">
              {isCreate ? 'Create assignment' : 'Save changes'}
            </GradientButton>
          </HStack>
        </Stack>
      </chakra.form>
    </GlassCard>
  );
}

export default AssignmentForm;
