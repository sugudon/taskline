import type { ComponentProps } from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { DndContext as DndContextType, DragEndEvent } from '@dnd-kit/core';
import { AssignmentBoard } from '../components/projects/AssignmentBoard';
import type { AssignmentPage } from '../types';
import { makeAssignment, makeAxiosError } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

// jsdom has no layout, so real pointer drags can't be simulated. Capture the board's
// DndContext props and fire drop events directly; everything else uses the real library.
type DndProps = ComponentProps<typeof DndContextType>;
const dnd: { props: DndProps | null } = { props: null };
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: (props: DndProps) => {
      dnd.props = props;
      return <actual.DndContext {...props} />;
    },
  };
});

const page = (): AssignmentPage => ({
  items: [
    makeAssignment({ id: 3, title: 'Lexer', status: 'todo' }),
    makeAssignment({ id: 4, title: 'Parser', status: 'in_progress' }),
  ],
  total: 2,
  page: 1,
  size: 100,
  pages: 1,
});

const drop = (activeId: number, overId: string | null): void => {
  const event = {
    active: { id: activeId },
    over: overId === null ? null : { id: overId },
  } as unknown as DragEndEvent;
  act(() => dnd.props?.onDragEnd?.(event));
};

const column = (status: string): HTMLElement => screen.getByTestId(`board-column-${status}`);

const renderBoard = (canDrag = true) =>
  renderWithProviders(<AssignmentBoard projectId={7} onNewAssignment={() => {}} canDrag={canDrag} />);

beforeEach(() => {
  resetMockApi();
  dnd.props = null;
  mockApi.get.mockResolvedValue({ data: page() });
});

describe('AssignmentBoard drag and drop', () => {
  it('moves a card to another column and saves the new status', async () => {
    let resolvePatch: (value: { data: unknown }) => void = () => {};
    mockApi.patch.mockImplementation(
      () => new Promise((resolve) => {
        resolvePatch = resolve;
      }),
    );
    renderBoard();
    await screen.findByText('Lexer');
    expect(within(column('todo')).getByText('Lexer')).toBeInTheDocument();
    expect(screen.getByText('Drag a card to another column to change its status.')).toBeInTheDocument();

    drop(3, 'done');

    // Optimistic: the card is in "done" before the server answers.
    expect(await within(column('done')).findByText('Lexer')).toBeInTheDocument();
    expect(within(column('todo')).queryByText('Lexer')).not.toBeInTheDocument();
    expect(mockApi.patch).toHaveBeenCalledWith('/assignments/3/status', { status: 'done' });

    act(() => resolvePatch({ data: makeAssignment({ id: 3, title: 'Lexer', status: 'done' }) }));
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2)); // refetched after saving
  });

  it('ignores drops on the same column or outside any column', async () => {
    renderBoard();
    await screen.findByText('Lexer');
    drop(3, 'todo');
    drop(3, null);
    drop(999, 'done');
    expect(mockApi.patch).not.toHaveBeenCalled();
  });

  it('puts the card back and explains why when the server refuses', async () => {
    mockApi.patch.mockRejectedValue(makeAxiosError(409, { detail: 'Project is archived' }));
    renderBoard();
    await screen.findByText('Lexer');

    drop(3, 'in_review');

    expect(await screen.findByText('Project is archived')).toBeInTheDocument();
    expect(screen.getByText(/Couldn't move “Lexer”/)).toBeInTheDocument();
    await waitFor(() => expect(within(column('todo')).getByText('Lexer')).toBeInTheDocument());
    expect(within(column('in_review')).queryByText('Lexer')).not.toBeInTheDocument();
  });

  it('makes cards keyboard-draggable with a descriptive label', async () => {
    renderBoard();
    const card = await screen.findByTestId('board-card-3');
    expect(card).toHaveAttribute('tabindex', '0');
    expect(card).toHaveAttribute('aria-label', 'Lexer. Press space to move it to another status.');
    expect(card).toHaveAttribute('aria-disabled', 'false');
  });

  it('disables dragging when the board is read-only', async () => {
    renderBoard(false);
    const card = await screen.findByTestId('board-card-3');
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('Drag a card to another column to change its status.')).not.toBeInTheDocument();
  });
});
