# @forge/types

Shared TypeScript types for the Forge API contract, used by both the Expo app
(`apps/mobile`) and the API (`apps/api`).

**This package is types only.** It exports no runtime values, so there is no build step
and no `dist/` folder to keep in sync. Always import with `import type`:

```ts
import type { Order, OrderStatus } from '@forge/types';
```

A value import (`import { Order } from '@forge/types'`) will fail to resolve — that is
intentional, so nobody accidentally depends on runtime code that does not exist.

## What lives here

- Enumerations that mirror the database enums: `Material`, `Quality`, `ProviderType`,
  `OrderStatus`, `PaymentMethod`, `Sort`, `DayOfWeek`.
- API entities: `Printer`, `Order`, `OrderStatusEvent`, `Profile`, `Provider`,
  `PublicProvider`, `SavedProvider`, `ProviderIdentity`.
- Request bodies: `CreateOrderInput`, `UpdateProfileInput`, `OnboardProviderInput`.
- `ApiErrorBody`, the error envelope every non-2xx response uses.

## What does not

- Runtime lists of allowed values (`MATERIALS`, `QUALITIES`, `PROVIDER_TYPES`) live next
  to their consumers, because zod enums and pickers need real arrays. Both sides assert
  exhaustiveness against these unions at compile time, so adding a member to a union
  without updating the array is a type error.
- Database row types (`*Row`) and row-to-entity mappers stay in `apps/api`.

## Changing a type

1. Edit `src/index.ts`.
2. Run `npm run typecheck` from the repository root — it checks the app and the API
   against the new shape.
3. If you added an enum member, update the matching array in
   `apps/api/src/modules/profile/profile.types.ts` (or `providers.types.ts`) and in
   `apps/mobile/lib/types.ts`, plus the database enum migration under
   `apps/api/supabase/migrations`.
