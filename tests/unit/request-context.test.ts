import { expect, it } from 'vitest';
import { getRequestId } from '@/shared/request-context';

it('preserves an incoming request id', () => {
  expect(getRequestId(new Headers({ 'x-request-id': 'req_existing' }))).toBe('req_existing');
});

it('generates a request id when one is absent', () => {
  expect(getRequestId(new Headers())).toMatch(/^req_[a-f0-9-]+$/);
});
