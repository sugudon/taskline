import { screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { makeProject, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

beforeEach(() => {
  resetMockApi();
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === '/projects') return { data: [makeProject({ name: 'Lazy Loaded' })] };
    throw new Error(`Unexpected GET ${url}`);
  });
});

describe('App routes', () => {
  it('lazy-loads protected pages inside the layout', async () => {
    renderWithProviders(<App />, { route: '/projects', auth: { user: makeUser() } });
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(await screen.findByText('Lazy Loaded', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('redirects / to the dashboard route', async () => {
    mockApi.get.mockResolvedValue({ data: null });
    renderWithProviders(<App />, { route: '/', auth: { user: makeUser() } });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
  });
});
