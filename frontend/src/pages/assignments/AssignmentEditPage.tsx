import { useNavigate, useParams } from 'react-router';
import { Text, useToast } from '@chakra-ui/react';
import { isAxiosError } from 'axios';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { TextReveal } from '../../components/ui/TextReveal';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { AssignmentForm } from '../../components/assignments/AssignmentForm';
import type { AssignmentFormValues } from '../../components/assignments/utils';
import { useAssignment, useUpdateAssignment } from '../../hooks/useAssignments';
import { getErrorMessage } from '../../services/api';
import type { AssignmentResponse, AssignmentUpdate } from '../../types';

const toFormValues = (a: AssignmentResponse): AssignmentFormValues => ({
  project_id: String(a.project_id),
  title: a.title,
  description: a.description ?? '',
  priority: a.priority,
  status: a.status,
  due_date: a.due_date ?? '',
  assignee_id: a.assignee ? String(a.assignee.id) : '',
});

export function AssignmentEditPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id);
  const { data: assignment, isLoading, isError, error } = useAssignment(assignmentId);
  const updateAssignment = useUpdateAssignment(assignmentId);

  const handleSubmit = async (values: AssignmentFormValues) => {
    const payload: AssignmentUpdate = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      priority: values.priority,
      due_date: values.due_date || null,
    };
    try {
      await updateAssignment.mutateAsync(payload);
      toast({ status: 'success', title: 'Assignment updated', duration: 2500 });
      navigate(`/assignments/${assignmentId}`);
    } catch (err) {
      toast({ status: 'error', title: 'Could not save changes', description: getErrorMessage(err) });
    }
  };

  const notFound =
    !Number.isInteger(assignmentId) ||
    assignmentId <= 0 ||
    (isError && isAxiosError(error) && error.response?.status === 404);

  return (
    <PageWrapper>
      <TextReveal text="Edit assignment" gradient mb={1} />
      <Text color="text.muted" mb={6}>
        Update the details. Status and assignee live on the assignment page.
      </Text>

      {notFound ? (
        <EmptyState
          icon="🧭"
          title="Assignment not found"
          description="It may have been deleted, or you don't have access to its project."
          actionLabel="Back to assignments"
          onAction={() => navigate('/assignments')}
        />
      ) : isLoading ? (
        <LoadingState label="Loading assignment..." />
      ) : isError || !assignment ? (
        <EmptyState
          icon="⚠"
          title="Couldn't load assignment"
          description={getErrorMessage(error)}
          actionLabel="Back to assignments"
          onAction={() => navigate('/assignments')}
        />
      ) : (
        <AssignmentForm
          key={assignment.id}
          mode="edit"
          initialValues={toFormValues(assignment)}
          lockedProjectName={assignment.project_name}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/assignments/${assignment.id}`)}
          isSubmitting={updateAssignment.isPending}
        />
      )}
    </PageWrapper>
  );
}

export default AssignmentEditPage;
