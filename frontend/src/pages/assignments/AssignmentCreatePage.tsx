import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Text, useToast } from '@chakra-ui/react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { TextReveal } from '../../components/ui/TextReveal';
import { AssignmentForm } from '../../components/assignments/AssignmentForm';
import type { AssignmentFormValues } from '../../components/assignments/utils';
import { useCreateAssignment } from '../../hooks/useAssignments';
import { getErrorMessage } from '../../services/api';
import type { AssignmentCreate } from '../../types';

export function AssignmentCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const createAssignment = useCreateAssignment();

  const initialValues = useMemo<AssignmentFormValues>(() => {
    const projectParam = searchParams.get('project_id');
    const projectId = projectParam && /^\d+$/.test(projectParam) ? projectParam : '';
    return {
      project_id: projectId,
      title: '',
      description: '',
      priority: 'medium',
      status: 'todo',
      due_date: '',
      assignee_id: '',
    };
  }, [searchParams]);

  const handleSubmit = async (values: AssignmentFormValues) => {
    const payload: AssignmentCreate = {
      project_id: Number(values.project_id),
      title: values.title.trim(),
      description: values.description.trim() || null,
      priority: values.priority,
      status: values.status,
      due_date: values.due_date || null,
      assignee_id: values.assignee_id ? Number(values.assignee_id) : null,
    };
    try {
      const created = await createAssignment.mutateAsync(payload);
      toast({ status: 'success', title: 'Assignment created', duration: 2500 });
      navigate(`/assignments/${created.id}`);
    } catch (err) {
      toast({ status: 'error', title: 'Could not create assignment', description: getErrorMessage(err) });
    }
  };

  return (
    <PageWrapper>
      <TextReveal text="New assignment" gradient mb={1} />
      <Text color="text.muted" mb={6}>
        Give it a clear title, a due date, and someone to own it.
      </Text>
      <AssignmentForm
        mode="create"
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
        isSubmitting={createAssignment.isPending}
      />
    </PageWrapper>
  );
}

export default AssignmentCreatePage;
