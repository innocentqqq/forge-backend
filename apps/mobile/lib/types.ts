/**
 * App-facing types.
 *
 * The API contract itself lives in `@forge/types` (shared with `apps/api`). This module
 * re-exports it so screens can keep importing from `lib/types`, and adds the runtime
 * lists that a types-only package cannot provide.
 */
import type { Material, Quality } from '@forge/types';

export type {
  ApiErrorBody,
  CreateOrderInput,
  DayOfWeek,
  Material,
  NotificationSettings,
  OnboardProviderInput,
  Order,
  OrderCustomerContact,
  OrderMessage,
  OrderMessageRole,
  OrderProviderContact,
  OrderStatus,
  OrderStatusEvent,
  PaymentMethod,
  PickupHourRange,
  PickupHours,
  Preferences,
  Printer,
  Profile,
  ProfileStats,
  Provider,
  ProviderAvailability,
  ProviderIdentity,
  ProviderType,
  ProviderVerification,
  PublicProvider,
  Quality,
  SavedProvider,
  Sort,
  UpdateProfileInput,
} from '@forge/types';

const MATERIAL_VALUES = ['PLA', 'ABS', 'PETG', 'TPU'] as const satisfies readonly Material[];
const QUALITY_VALUES = ['DRAFT', 'STANDARD', 'HIGH'] as const satisfies readonly Quality[];

export const MATERIALS: Material[] = [...MATERIAL_VALUES];
export const QUALITIES: Quality[] = [...QUALITY_VALUES];

// Compile-time guards: if a member is added to a shared union without being added to the
// list above, these become `false` and the typecheck fails.
type Exact<T extends boolean> = T;
export type MaterialsAreExhaustive = Exact<
  [Exclude<Material, (typeof MATERIAL_VALUES)[number]>] extends [never] ? true : false
>;
export type QualitiesAreExhaustive = Exact<
  [Exclude<Quality, (typeof QUALITY_VALUES)[number]>] extends [never] ? true : false
>;
