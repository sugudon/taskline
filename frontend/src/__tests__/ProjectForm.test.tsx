import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectForm, type ProjectFormValues } from '../components/projects/ProjectForm';
import { renderWithProviders } from './utils/render';

const setup = (props: Partial<Parameters<typeof ProjectForm>[0]> = {}) => {
  const onSubmit = vi.fn<(values: ProjectFormValues) => void>();
  renderWithProviders(<ProjectForm onSubmit={onSubmit} submitLabel="Create project" {...props} />);
  return { onSubmit, user: userEvent.setup() };
};

const nameInput = (): HTMLElement => screen.getByLabelText(/^name/i);
const hexInput = (): HTMLElement => screen.getByLabelText(/^hex/i);
const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Create project' }));

describe('ProjectForm', () => {
  it('requires a name', async () => {
    const { user, onSubmit } = setup();
    await user.type(nameInput(), '   ');
    await submit(user);
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects an invalid hex color', async () => {
    const { user, onSubmit } = setup();
    await user.type(nameInput(), 'Thesis');
    await user.clear(hexInput());
    await user.type(hexInput(), '#12zz56');
    await submit(user);
    expect(await screen.findByText('Use a hex color like #805AD5')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    // Editing the field clears the error.
    await user.clear(hexInput());
    expect(screen.queryByText('Use a hex color like #805AD5')).not.toBeInTheDocument();
  });

  it('submits trimmed values with the default color', async () => {
    const { user, onSubmit } = setup();
    await user.type(nameInput(), '  Thesis  ');
    await user.type(screen.getByLabelText('Description'), '  Final year  ');
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Thesis',
      description: 'Final year',
      color: '#805AD5',
      is_archived: false,
    });
  });

  it('applies a color preset', async () => {
    const { user, onSubmit } = setup();
    await user.type(nameInput(), 'P');
    const preset = screen.getByRole('button', { name: 'Use color #3182CE' });
    expect(preset).toHaveAttribute('aria-pressed', 'false');
    await user.click(preset);
    expect(preset).toHaveAttribute('aria-pressed', 'true');
    expect(hexInput()).toHaveValue('#3182CE');
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ color: '#3182CE' }));
  });

  it('prefills edit values and toggles archive', async () => {
    const { user, onSubmit } = setup({
      showArchive: true,
      initialValues: { name: 'Old', description: 'd', color: '#000000', is_archived: false },
    });
    expect(nameInput()).toHaveValue('Old');
    await user.click(screen.getByLabelText('Archived'));
    await submit(user);
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Old', description: 'd', color: '#000000', is_archived: true });
  });

  it('does not show the archive switch in create mode and supports cancel', async () => {
    const onCancel = vi.fn<() => void>();
    const { user } = setup({ onCancel });
    expect(screen.queryByLabelText('Archived')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
