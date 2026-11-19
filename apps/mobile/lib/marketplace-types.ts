import type {
  BoundingBox,
  Material,
  ModelMetadata,
  Order,
  Quality,
  Sort,
} from '@forge/types';

export type { BoundingBox, ModelFormat, ModelMetadata } from '@forge/types';

export interface ModelDetails extends ModelMetadata {
  viewUrl: string;
}

export interface ProviderResult {
  id: string;
  displayName: string;
  distanceKm: number | null;
  estimate: number;
  availability: string;
  fits: boolean;
  etaHours: number | null;
  buildVolume: BoundingBox;
}

export interface ProviderSearchInput {
  modelId: string;
  material: Material;
  sort: Sort;
}

export interface EstimateInput {
  modelId: string;
  material: Material;
  quality: Quality;
  quantity: number;
}

export interface EstimateResult {
  estimate: number;
}

export type MarketplaceOrder = Order;

export interface CreateMarketplaceOrderInput extends EstimateInput {
  providerId: string;
  color?: string;
}
