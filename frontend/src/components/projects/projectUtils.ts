import axios from 'axios';

/** Parse a route `:id` param into a positive integer, or undefined. */
export const parseProjectId = (raw: string | undefined): number | undefined => {
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n > 0 ? n : undefined;
};

export const isNotFoundError = (err: unknown): boolean =>
  axios.isAxiosError(err) && err.response?.status === 404;
