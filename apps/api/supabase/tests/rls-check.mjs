// Apply all Forge migrations to an in-process Postgres (PGlite) with a minimal
// Supabase shim, then check row-level security as anon / authenticated / service_role.
// Usage: npm run test:rls -w @forge/api   (no Docker or Supabase needed)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));
const db = new PGlite();

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const NEW_MIGRATION = '20261119000001_lock_down_orders_printers_models.sql';

// --- Supabase shim (what the hosted platform provides) -----------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant anon, authenticated, service_role to current_user;
  create schema auth;
  create table auth.users (
    id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint);
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Supabase grants full table privileges to these roles by default; RLS is what restricts them.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

// --- migrations, holding back the new one to seed legacy data first ----------
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
for (const file of files.filter((f) => f !== NEW_MIGRATION)) {
  await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
}
console.log(`applied ${files.length - 1} existing migrations`);

// Seed as superuser (the profiles trigger runs on auth.users insert).
await db.exec(`
  insert into auth.users (id, email) values ('${ALICE}', 'alice@x.test'), ('${BOB}', 'bob@x.test');
  insert into public.printers (id, name, lat, lng) values
    ('44444444-4444-4444-8444-444444444444', 'Lab A', 13.87, 100.6);
  insert into public.orders (id, order_number, user_id, model_id, printer_id, material, quality, price_snapshot) values
    ('a0000000-0000-4000-8000-000000000001', 'ALICE01', '${ALICE}', gen_random_uuid(), '44444444-4444-4444-8444-444444444444', 'PLA', 'STANDARD', 10),
    ('b0000000-0000-4000-8000-000000000001', 'BOB0001', '${BOB}',   gen_random_uuid(), '44444444-4444-4444-8444-444444444444', 'PLA', 'STANDARD', 10),
    -- legacy orphan: user that does not exist (Express used to allow user_id null/anything)
    ('c0000000-0000-4000-8000-000000000001', 'ORPHAN1', '99999999-9999-4999-8999-999999999999', gen_random_uuid(), '44444444-4444-4444-8444-444444444444', 'PLA', 'STANDARD', 10);
  insert into public.order_status_events (order_id, status) values
    ('a0000000-0000-4000-8000-000000000001', 'CONFIRMED'),
    ('b0000000-0000-4000-8000-000000000001', 'CONFIRMED');
  insert into public.model_files (id, user_id, file_name, material) values
    (gen_random_uuid(), '${ALICE}', 'alice.stl', 'PLA'), (gen_random_uuid(), '${BOB}', 'bob.stl', 'PLA');
  insert into public.pricing_rules (material, rate) values ('PLA', 0.05) on conflict do nothing;
`);

// BEFORE: prove the hole exists.
async function as(role, sub, sql) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '${sub ?? ''}', false); set role ${role};`,
  );
  try {
    const res = await db.query(sql);
    return { rows: res.rows, affected: res.affectedRows ?? 0 };
  } catch (error) {
    return { error: error.message };
  } finally {
    await db.exec('reset role;');
  }
}

const before = await as('anon', null, 'select count(*)::int as n from public.orders');
console.log(`BEFORE: anon can read ${before.rows?.[0]?.n} orders (expected 3 = the hole)`);

// --- the new migration (must succeed even with the orphan row) ---------------
await db.exec(readFileSync(join(migrationsDir, NEW_MIGRATION), 'utf8'));
console.log(`applied ${NEW_MIGRATION} with a legacy orphan row present`);

// --- checks -------------------------------------------------------------------
let failed = 0;
function check(name, condition, detail) {
  console.log(
    `${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  -> ${JSON.stringify(detail)}`}`,
  );
  if (!condition) failed += 1;
}
const denied = (r) => Boolean(r.error) || r.affected === 0;
const count = (r) => r.rows?.[0]?.n;

// orders
let r = await as('anon', null, 'select count(*)::int as n from public.orders');
check('anon cannot read orders', Boolean(r.error) || count(r) === 0, r);
r = await as('authenticated', ALICE, 'select order_number from public.orders');
check('alice sees only her order', r.rows?.length === 1 && r.rows[0].order_number === 'ALICE01', r);
r = await as(
  'authenticated',
  ALICE,
  `update public.orders set status = 'READY_FOR_PICKUP' where order_number = 'ALICE01'`,
);
check('alice cannot update her own order directly', denied(r), r);
r = await as(
  'authenticated',
  ALICE,
  `update public.orders set price_snapshot = 0 where order_number = 'BOB0001'`,
);
check('alice cannot update bob’s order', denied(r), r);
r = await as(
  'authenticated',
  ALICE,
  `insert into public.orders (order_number, user_id, model_id, printer_id, material, quality, price_snapshot)
   values ('FAKE001', '${ALICE}', gen_random_uuid(), '44444444-4444-4444-8444-444444444444', 'PLA', 'STANDARD', 0)`,
);
check('alice cannot insert orders directly (must use the API)', Boolean(r.error), r);
r = await as('authenticated', ALICE, `delete from public.orders where order_number = 'BOB0001'`);
check('alice cannot delete orders', denied(r), r);

// events
r = await as('authenticated', ALICE, 'select count(*)::int as n from public.order_status_events');
check('alice sees only her order’s timeline (1 event)', count(r) === 1, r);
r = await as(
  'authenticated',
  ALICE,
  `insert into public.order_status_events (order_id, status) values ('b0000000-0000-4000-8000-000000000001', 'DECLINED')`,
);
check('alice cannot add events to orders', Boolean(r.error), r);

// printers
r = await as('anon', null, 'select count(*)::int as n from public.printers');
check('anyone can read the printer catalogue', count(r) === 1, r);
r = await as('authenticated', ALICE, `update public.printers set price_factor = 0.01`);
check('alice cannot change printers', denied(r), r);
r = await as('anon', null, `insert into public.printers (name, lat, lng) values ('Fake', 0, 0)`);
check('anon cannot add printers', Boolean(r.error), r);

// model files
r = await as('authenticated', BOB, 'select file_name from public.model_files');
check(
  'bob sees only his model files',
  r.rows?.length === 1 && r.rows[0].file_name === 'bob.stl',
  r,
);
r = await as('anon', null, 'select count(*)::int as n from public.model_files');
check('anon cannot read model files', Boolean(r.error) || count(r) === 0, r);

// pricing rules
r = await as('anon', null, 'select count(*)::int as n from public.pricing_rules');
check('anyone can read pricing rules', count(r) >= 1, r);
r = await as('authenticated', ALICE, `update public.pricing_rules set rate = 0`);
check('alice cannot change pricing rules', denied(r), r);

// service role (what the API / Edge Function use) is unaffected
r = await as('service_role', null, 'select count(*)::int as n from public.orders');
check('service role (API) still reads all orders', count(r) === 3, r);
r = await as(
  'service_role',
  null,
  `insert into public.orders (order_number, user_id, model_id, printer_id, material, quality, price_snapshot)
   values ('API0001', '${BOB}', gen_random_uuid(), '44444444-4444-4444-8444-444444444444', 'PLA', 'STANDARD', 5)`,
);
check('service role (API) can still create orders', !r.error, r);

// profiles policies from earlier migrations still work
r = await as('authenticated', ALICE, 'select count(*)::int as n from public.profiles');
check('profiles still limited to own row', count(r) === 1, r);

// foreign keys: enforced for new rows, legacy orphan tolerated
r = await as(
  'service_role',
  null,
  `insert into public.orders (order_number, user_id, model_id, printer_id, material, quality, price_snapshot)
   values ('BADUSER', '88888888-8888-4888-8888-888888888888', gen_random_uuid(), '44444444-4444-4444-8444-444444444444', 'PLA', 'STANDARD', 5)`,
);
check(
  'new order with unknown user_id is rejected (FK)',
  Boolean(r.error) && /foreign key/i.test(r.error),
  r,
);
r = await as(
  'service_role',
  null,
  `insert into public.printers (name, lat, lng, provider_id) values ('X', 0, 0, gen_random_uuid())`,
);
check(
  'new printer with unknown provider_id is rejected (FK)',
  Boolean(r.error) && /foreign key/i.test(r.error),
  r,
);
const orphan = await db.query(
  `select count(*)::int as n from public.orders where order_number = 'ORPHAN1'`,
);
check('legacy orphan row kept (NOT VALID)', orphan.rows[0].n === 1, orphan.rows);
const deleted = await db.exec(`delete from auth.users where id = '${BOB}'`).then(
  () => null,
  (e) => e.message,
);
const bobOrders = await db.query(
  `select count(*)::int as n from public.orders where order_number in ('BOB0001','API0001') and user_id is null`,
);
check(
  'deleting a user keeps their orders with user_id = null',
  !deleted && bobOrders.rows[0].n === 2,
  { deleted, rows: bobOrders.rows },
);

// bucket
const bucket = await db.query(
  `select public, file_size_limit from storage.buckets where id = 'models'`,
);
check(
  'models bucket is private with a 50 MB limit',
  bucket.rows[0]?.public === false && Number(bucket.rows[0]?.file_size_limit) === 52428800,
  bucket.rows,
);

// idempotent: running the migration again must not fail
const rerun = await db.exec(readFileSync(join(migrationsDir, NEW_MIGRATION), 'utf8')).then(
  () => null,
  (e) => e.message,
);
check('migration can be re-run safely', rerun === null, rerun);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
