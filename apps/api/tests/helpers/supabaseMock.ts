/**
 * Minimal chainable fake of the supabase-js query builder for controller tests.
 *
 * Every `from(table)` call records its operations (select/eq/in/insert/update/…)
 * so tests can assert, e.g., that a query was scoped with `.eq('user_id', …)`.
 * Results come from a resolver you provide per test.
 */

export type QueryOp = { method: string; args: unknown[] };
export type QueryCall = {
  table: string;
  ops: QueryOp[];
  terminal: 'single' | 'maybeSingle' | 'many';
};
export type QueryResult = { data: unknown; error: unknown };
export type Resolver = (call: QueryCall) => QueryResult;

const CHAIN_METHODS = [
  'select',
  'eq',
  'in',
  'order',
  'insert',
  'update',
  'delete',
  'limit',
] as const;

export function createQueryMock(resolve: Resolver) {
  const calls: QueryCall[] = [];

  function from(table: string) {
    const ops: QueryOp[] = [];
    const finish = (terminal: QueryCall['terminal']) => {
      const call: QueryCall = { table, ops, terminal };
      calls.push(call);
      return Promise.resolve(resolve(call));
    };

    const builder: Record<string, unknown> = {};
    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        ops.push({ method, args });
        return builder;
      };
    }
    builder.single = () => finish('single');
    builder.maybeSingle = () => finish('maybeSingle');
    // `await query` without single/maybeSingle (lists, inserts without select).
    builder.then = (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => finish('many').then(onFulfilled, onRejected);
    return builder;
  }

  return { from: jest.fn(from), calls };
}

/** Helpers for assertions. */
export function hasOp(call: QueryCall, method: string, ...args: unknown[]): boolean {
  return call.ops.some(
    (op) => op.method === method && args.every((arg, index) => op.args[index] === arg),
  );
}

export function isWrite(call: QueryCall): boolean {
  return call.ops.some(
    (op) => op.method === 'insert' || op.method === 'update' || op.method === 'delete',
  );
}

export const ok = (data: unknown): QueryResult => ({ data, error: null });
export const none: QueryResult = { data: null, error: null };

/** First item, failing the test clearly when the list is empty. */
export function first<T>(items: T[]): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error('Expected at least one item');
  }
  return item;
}
