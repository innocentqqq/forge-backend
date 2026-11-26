import { supabase } from "./supabase";
import type {
  CreateOrderInput,
  Material,
  Order,
  OrderMessage,
  OrderMessageRole,
  Printer,
  Profile,
  ProfileStats,
  Quality,
  Sort,
  UpdateProfileInput,
} from "./types";
import type {
  CreateMarketplaceOrderInput,
  EstimateInput,
  EstimateResult,
  MarketplaceOrder,
  ModelDetails,
  ModelFormat,
  ModelMetadata,
  ProviderResult,
  ProviderSearchInput,
} from "./marketplace-types";
import { inspectMockModel } from "./mock-model";
import { progressForStatus } from "./order-status";
import {
  emptyHours,
  legacyPrinterFromProvider,
  type MaterialRate,
  type ProviderAgreements,
  type ProviderPrinter,
  type ProviderPrinterInput,
  type ProviderProfile,
  type ProviderSetup,
  type ProviderSetupInput,
} from "./provider-onboarding";

function inferBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(
    /\/+$/,
    "",
  );
  return supabaseUrl ? `${supabaseUrl}/functions/v1/forge-api` : "";
}

export const API_BASE_URL = inferBaseUrl();

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "API_URL_NOT_CONFIGURED",
      "Missing EXPO_PUBLIC_SUPABASE_URL. Configure the Supabase project URL in .env and restart Expo.",
      0,
    );
  }

  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    apikey: publishableKey,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.auth !== false) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Network error";
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not reach the API at ${API_BASE_URL}. ${detail}`,
      0,
    );
  }

  const raw = await response.text();
  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw;
  }

  if (!response.ok) {
    const envelope = payload as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      envelope?.error?.code ?? "HTTP_ERROR",
      envelope?.error?.message ??
        `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return payload as T;
}

export const USE_MOCK_API = process.env.EXPO_PUBLIC_API_MODE !== "real";

type UploadSession = {
  fileName: string;
  sizeBytes: number;
  format: ModelFormat;
  localUri?: string;
};
const mockUploads = new Map<string, UploadSession>();
const mockModels = new Map<string, ModelDetails>();
const mockOrders = new Map<string, MarketplaceOrder>();
const mockMessages = new Map<string, OrderMessage[]>();
const demoTimers = new Map<string, ReturnType<typeof setInterval>>();
let mockProvider: ProviderProfile | null = null;

const MOCK_TIMESTAMP = "2026-01-01T00:00:00.000Z";
const mockProfile: Profile = {
  id: "mock-user",
  email: "demo@forge.local",
  fullName: "Forge Maker",
  avatarUrl: null,
  phone: "+66 81 234 5678",
  notifications: {
    email: true,
    push: true,
    orderUpdates: true,
    promotions: false,
  },
  preferences: { material: "PLA", quality: "STANDARD", color: "black" },
  provider: null,
  createdAt: MOCK_TIMESTAMP,
  updatedAt: MOCK_TIMESTAMP,
};

const mockProviders: ProviderResult[] = [
  {
    id: "provider-lab-north",
    displayName: "North Campus Print Lab",
    distanceKm: 2.4,
    estimate: 145,
    availability: "Accepting orders",
    fits: true,
    etaHours: 20,
    buildVolume: { x: 256, y: 256, z: 256 },
  },
  {
    id: "provider-makerspace",
    displayName: "Bangkok Makerspace",
    distanceKm: 5.8,
    estimate: 128,
    availability: "2 jobs in queue",
    fits: true,
    etaHours: 36,
    buildVolume: { x: 300, y: 300, z: 400 },
  },
  {
    id: "provider-mini",
    displayName: "Pocket Prints",
    distanceKm: 1.1,
    estimate: 92,
    availability: "One printer available",
    fits: false,
    etaHours: 12,
    buildVolume: { x: 80, y: 50, z: 40 },
  },
];

function mockId() {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_AGREEMENTS: ProviderAgreements = {
  liability: false,
  paymentTerms: false,
  prohibitedItems: false,
  safePickup: false,
};

function mockSetup(
  input: Pick<
    ProviderSetupInput,
    "type" | "pickupArea" | "printers" | "printer" | "rates" | "agreements"
  >,
): ProviderSetup {
  const printers = input.printers ?? [];
  const hasPickupArea = Boolean(input.pickupArea.trim());
  const hasActivePrinter =
    printers.some(
      (printer) => printer.isActive !== false && printer.materials.length > 0,
    ) || Boolean(input.printer);
  const hasMaterialRate =
    Object.values(input.rates ?? {}).some(
      (rate) => Boolean(rate) && rate.ratePerCm3 > 0,
    ) || Boolean(input.printer?.pricePerCm3);
  const agreements = input.agreements ?? EMPTY_AGREEMENTS;
  const hasAgreements =
    agreements.liability &&
    agreements.paymentTerms &&
    agreements.prohibitedItems &&
    (input.type !== "INDIVIDUAL" || agreements.safePickup);
  const missing = [
    ...(hasPickupArea ? [] : ["pickup area"]),
    ...(hasActivePrinter ? [] : ["active printer"]),
    ...(hasMaterialRate ? [] : ["material rate"]),
    ...(hasAgreements ? [] : ["agreements"]),
  ];
  return {
    canAppearInSearch: missing.length === 0,
    missing,
    hasPickupArea,
    hasActivePrinter,
    hasMaterialRate,
    hasAgreements,
  };
}

function mockRatesFromInput(
  input: ProviderSetupInput,
): Partial<Record<Material, MaterialRate>> {
  const rates: Partial<Record<Material, MaterialRate>> = {};
  for (const [material, rate] of Object.entries(input.rates ?? {})) {
    if (!rate || rate.ratePerCm3 <= 0) continue;
    rates[material as Material] = {
      material: material as Material,
      ratePerCm3: rate.ratePerCm3,
      minimumOrder: rate.minimumOrder ?? 0,
      colors: rate.colors ?? [],
    };
  }
  if (input.printer) {
    for (const material of input.printer.materials) {
      rates[material] = {
        material,
        ratePerCm3: input.printer.pricePerCm3,
        minimumOrder: input.printer.minimumOrder,
        colors: [],
      };
    }
  }
  return rates;
}

function mockPrintersFromInput(
  input: ProviderSetupInput,
  now: string,
): ProviderPrinter[] {
  const printers = input.printers ?? [];
  const list = printers.length
    ? printers
    : input.printer
      ? [
          {
            name: input.printer.modelName,
            modelName: input.printer.modelName,
            buildVolume: input.printer.buildVolume,
            materials: input.printer.materials,
            isActive: true,
          },
        ]
      : [];
  const rates = mockRatesFromInput(input);
  return list.map((printer, index) => ({
    id: mockId() + `-printer-${index}`,
    name: printer.name || printer.modelName || "Printer",
    modelName: printer.modelName || printer.name || "Printer",
    technology: "FDM",
    buildVolume: printer.buildVolume,
    materials: printer.materials,
    bestQuality: printer.bestQuality ?? "STANDARD",
    isActive: printer.isActive ?? true,
    rates: printer.materials.flatMap((material) => {
      const rate = rates[material];
      return rate ? [rate] : [];
    }),
    createdAt: now,
  }));
}

function mockProviderFromInput(
  input: ProviderSetupInput,
  existing?: ProviderProfile,
): ProviderProfile {
  const now = new Date().toISOString();
  const availability = input.availability ?? {};
  const rates = mockRatesFromInput(input);
  const printers =
    input.printers || input.printer
      ? mockPrintersFromInput(input, now)
      : (existing?.printers ?? []);
  const setupInput = {
    ...input,
    printers: input.printers ?? (input.printer ? printers : undefined),
  };
  return {
    id: existing?.id ?? "provider-lab-north",
    type: input.type,
    displayName: input.displayName,
    description: input.description ?? existing?.description ?? null,
    bio: input.description ?? existing?.bio ?? null,
    photoUrl: input.photoUrl ?? existing?.photoUrl ?? null,
    pickupArea: input.pickupArea,
    pickupAddress: input.pickupAddress,
    exactAddress: input.exactAddress ?? existing?.exactAddress ?? null,
    pickupInstructions:
      input.pickupInstructions ?? existing?.pickupInstructions ?? null,
    contactPhone: input.contactPhone ?? existing?.contactPhone ?? null,
    latitude: input.latitude ?? existing?.latitude ?? null,
    longitude: input.longitude ?? existing?.longitude ?? null,
    exactLatitude: input.exactLatitude ?? existing?.exactLatitude ?? null,
    exactLongitude: input.exactLongitude ?? existing?.exactLongitude ?? null,
    status: existing?.status ?? "draft",
    turnaroundDays:
      availability.turnaroundDays ?? existing?.turnaroundDays ?? 3,
    maxActiveOrders:
      availability.maxActiveOrders ?? existing?.maxActiveOrders ?? 5,
    agreements: input.agreements ?? existing?.agreements ?? EMPTY_AGREEMENTS,
    availability: {
      isOpen: availability.isOpen ?? existing?.availability.isOpen ?? true,
      maxQueueSize:
        availability.maxQueueSize ?? existing?.availability.maxQueueSize ?? 10,
      pickupHours:
        availability.pickupHours ??
        existing?.availability.pickupHours ??
        emptyHours(),
    },
    verification: existing?.verification ?? {
      isVerified: false,
      verifiedByAdmin: false,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
    },
    setup: mockSetup(setupInput as ProviderSetupInput),
    printers,
    hours: input.hours ?? existing?.hours ?? emptyHours(),
    rates: Object.keys(rates).length ? rates : (existing?.rates ?? {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function formatFromName(fileName: string): ModelFormat {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "stl" || extension === "obj") return extension;
  throw new ApiError(
    "UNSUPPORTED_FORMAT",
    "Choose an STL or OBJ file. 3MF is not supported yet.",
    400,
  );
}

/**
 * Drives the in-memory mock order from 0% to 100% over about a minute. The
 * customer demo does not wait for a second device to accept the order.
 */
function startMockDemoPrint(id: string): MarketplaceOrder {
  const existing = mockOrders.get(id);
  if (!existing) throw new ApiError("ORDER_NOT_FOUND", "Order not found.", 404);
  if (demoTimers.has(id)) return existing;

  let current = existing;
  if (current.status === "PENDING_ACCEPTANCE") {
    current = {
      ...current,
      status: "CONFIRMED",
      progress: 0,
      updated_at: new Date().toISOString(),
    };
    mockOrders.set(id, current);
  }
  if (!["CONFIRMED", "IN_QUEUE", "PRINTING"].includes(current.status)) {
    throw new ApiError(
      "DEMO_NOT_AVAILABLE",
      `A ${current.status} order cannot be used for the demo.`,
      409,
    );
  }

  const startedAt = Date.now();
  const timer = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const progress = Math.min(100, Math.round((elapsed / 60_000) * 100));
    const status: MarketplaceOrder["status"] =
      progress >= 100
        ? "READY_FOR_PICKUP"
        : progress >= 5
          ? "PRINTING"
          : progress > 0
            ? "IN_QUEUE"
            : "CONFIRMED";
    const latest = mockOrders.get(id) ?? current;
    mockOrders.set(id, {
      ...latest,
      status,
      progress,
      updated_at: new Date().toISOString(),
    });

    if (progress >= 100) {
      clearInterval(timer);
      demoTimers.delete(id);
    }
  }, 1000);
  demoTimers.set(id, timer);

  return current;
}

const MATERIAL_RATES: Record<Material, number> = {
  PLA: 0.05,
  ABS: 0.07,
  PETG: 0.08,
  TPU: 0.12,
};
const QUALITY_FACTORS: Record<Quality, number> = {
  DRAFT: 0.8,
  STANDARD: 1,
  HIGH: 1.3,
};
const ORDER_TRANSITIONS: Record<Order["status"], Order["status"][]> = {
  PENDING_ACCEPTANCE: ["CONFIRMED", "DECLINED", "CANCELLED"],
  CONFIRMED: ["IN_QUEUE", "CANCELLED"],
  IN_QUEUE: ["PRINTING", "CANCELLED"],
  PRINTING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["PICKED_UP"],
  PICKED_UP: ["COMPLETED"],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
};

function legacyPrinter(provider: ProviderResult): Printer {
  return {
    id: provider.id,
    name: provider.displayName,
    lat: 13.8708,
    lng: 100.6053,
    printer_count: 1,
    price_factor: 1,
    est_completion_hours_per_unit: provider.etaHours ?? 24,
    contact_info: null,
    location_details: provider.availability,
    created_at: new Date().toISOString(),
    provider_id: provider.id,
    distance_km: provider.distanceKm,
    build_volume: provider.buildVolume,
  };
}

export const api = {
  getPrinters(params: { lat?: number; lng?: number; sort?: Sort } = {}) {
    if (USE_MOCK_API) {
      const providers = [...mockProviders];
      if (params.sort === "cheapest")
        providers.sort((a, b) => a.estimate - b.estimate);
      else if (params.sort === "fastest")
        providers.sort(
          (a, b) => (a.etaHours ?? Infinity) - (b.etaHours ?? Infinity),
        );
      else
        providers.sort(
          (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
        );
      return Promise.resolve({ printers: providers.map(legacyPrinter) });
    }
    const query = new URLSearchParams();
    if (params.lat !== undefined) query.set("lat", String(params.lat));
    if (params.lng !== undefined) query.set("lng", String(params.lng));
    if (params.sort) query.set("sort", params.sort);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<{ printers: Printer[] }>(`/printers${suffix}`, {
      auth: false,
    });
  },

  getPrinter(id: string) {
    if (USE_MOCK_API) {
      const provider = mockProviders.find((item) => item.id === id);
      if (!provider)
        throw new ApiError("PROVIDER_NOT_FOUND", "Provider not found.", 404);
      return Promise.resolve({ printer: legacyPrinter(provider) });
    }
    return request<{ printer: Printer }>(`/printers/${id}`, { auth: false });
  },

  getOrders() {
    return request<{ orders: Order[] }>("/orders");
  },

  async getMarketplaceOrders() {
    if (USE_MOCK_API) {
      return [...mockOrders.values()].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
    }
    const result = await request<{ orders: MarketplaceOrder[] }>("/orders");
    return result.orders;
  },

  getProviderOrders() {
    return request<{ orders: Order[] }>("/orders/provider");
  },

  getOrder(id: string) {
    return request<{ order: Order }>(`/orders/${id}`);
  },

  async getMarketplaceOrder(id: string) {
    if (USE_MOCK_API) {
      const order = mockOrders.get(id);
      if (!order)
        throw new ApiError("ORDER_NOT_FOUND", "Order not found.", 404);
      return order;
    }
    const result = await request<{ order: MarketplaceOrder }>(
      `/orders/${encodeURIComponent(id)}`,
    );
    return result.order;
  },

  async getOrderMessages(id: string) {
    if (USE_MOCK_API) return mockMessages.get(id) ?? [];
    const result = await request<{ messages: OrderMessage[] }>(
      `/orders/${encodeURIComponent(id)}/messages`,
    );
    return result.messages;
  },

  async sendOrderMessage(id: string, body: string, senderRole: OrderMessageRole = 'CUSTOMER') {
    const text = body.trim();
    if (!text) throw new ApiError("VALIDATION_ERROR", "Enter a message.", 400);
    if (text.length > 2000) {
      throw new ApiError("VALIDATION_ERROR", "Messages are limited to 2000 characters.", 400);
    }
    if (USE_MOCK_API) {
      if (!mockOrders.has(id)) {
        throw new ApiError("ORDER_NOT_FOUND", "Order not found.", 404);
      }
      const message: OrderMessage = {
        id: mockId(),
        orderId: id,
        senderId: senderRole === 'PROVIDER' ? mockProvider?.id ?? 'mock-provider' : mockProfile.id,
        senderRole,
        body: text,
        createdAt: new Date().toISOString(),
      };
      mockMessages.set(id, [...(mockMessages.get(id) ?? []), message]);
      return message;
    }
    const result = await request<{ message: OrderMessage }>(
      `/orders/${encodeURIComponent(id)}/messages`,
      { method: "POST", body: { body: text } },
    );
    return result.message;
  },

  async getMarketplaceProviderOrders() {
    if (USE_MOCK_API) {
      // There is only one provider profile in the in-memory demo. Showing all
      // local orders keeps the one-device flow usable whichever card was picked.
      return [...mockOrders.values()];
    }
    const result = await request<{ orders: MarketplaceOrder[] }>(
      "/orders/provider",
    );
    return result.orders;
  },

  createOrder(input: CreateOrderInput) {
    return request<{ order: Order }>("/orders", {
      method: "POST",
      body: input,
    });
  },

  async createModelUploadUrl(fileName: string, sizeBytes?: number) {
    if (USE_MOCK_API) {
      const path = `${mockId()}/${encodeURIComponent(fileName)}`;
      mockUploads.set(path, {
        fileName,
        sizeBytes: sizeBytes ?? 0,
        format: formatFromName(fileName),
      });
      return { path, signedUrl: `mock://upload/${encodeURIComponent(path)}` };
    }
    if (sizeBytes === undefined) {
      throw new ApiError(
        "FILE_SIZE_REQUIRED",
        "File size is required to request an upload URL.",
        400,
      );
    }
    return request<{ path: string; signedUrl: string }>("/models/upload-url", {
      method: "POST",
      body: { fileName, sizeBytes },
    });
  },

  async uploadModelToSignedUrl(
    signedUrl: string,
    uri: string,
    mimeType: string | null | undefined,
    onProgress: (progress: number) => void,
    localBlob?: Blob,
  ) {
    if (USE_MOCK_API) {
      const prefix = "mock://upload/";
      if (signedUrl.startsWith(prefix)) {
        const path = decodeURIComponent(signedUrl.slice(prefix.length));
        const upload = mockUploads.get(path);
        if (upload) upload.localUri = uri;
      }
      for (const progress of [12, 38, 67, 91, 100]) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        onProgress(progress);
      }
      return;
    }

    const blob =
      localBlob ??
      (await fetch(uri).then(async (response) => {
        if (!response.ok)
          throw new ApiError(
            "FILE_READ_FAILED",
            "Could not read the selected file.",
            0,
          );
        return response.blob();
      }));

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader(
        "Content-Type",
        mimeType || "application/octet-stream",
      );
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else {
          reject(
            new ApiError(
              "UPLOAD_FAILED",
              `Storage upload failed (${xhr.status}).`,
              xhr.status,
            ),
          );
        }
      };
      xhr.onerror = () =>
        reject(
          new ApiError(
            "UPLOAD_FAILED",
            "Could not upload the selected file.",
            0,
          ),
        );
      xhr.onabort = () =>
        reject(new ApiError("UPLOAD_CANCELLED", "Upload was cancelled.", 0));
      xhr.send(blob);
    });
  },

  async createModel(path: string) {
    if (USE_MOCK_API) {
      const upload = mockUploads.get(path);
      if (!upload)
        throw new ApiError(
          "UPLOAD_NOT_FOUND",
          "Upload session expired. Select the file again.",
          404,
        );
      if (!upload.localUri) {
        throw new ApiError(
          "UPLOAD_SOURCE_MISSING",
          "The selected file is no longer available. Choose it again.",
          400,
        );
      }

      let metrics: Awaited<ReturnType<typeof inspectMockModel>>;
      try {
        metrics = await inspectMockModel(upload.localUri, upload.format);
      } catch (err) {
        const detail =
          err instanceof Error
            ? err.message
            : "Could not read this model file.";
        throw new ApiError("MODEL_PREVIEW_FAILED", detail, 422);
      }

      const model: ModelDetails = {
        id: mockId(),
        fileName: upload.fileName,
        format: upload.format,
        sizeBytes: upload.sizeBytes,
        storagePath: path,
        triangleCount: metrics.triangleCount,
        boundingBox: metrics.boundingBox,
        volumeCm3: metrics.volumeCm3,
        units: "mm",
        isWatertight: metrics.isWatertight,
        createdAt: new Date().toISOString(),
        // Keep the real picked file so every screen shows the customer's model.
        viewUrl: upload.localUri,
      };
      mockModels.set(model.id, model);
      mockUploads.delete(path);
      return model;
    }
    return request<ModelMetadata>("/models", {
      method: "POST",
      body: { path },
    });
  },

  async getModel(id: string) {
    if (USE_MOCK_API) {
      const model = mockModels.get(id);
      if (!model)
        throw new ApiError(
          "MODEL_NOT_FOUND",
          "Model not found. Upload it again to continue.",
          404,
        );
      return model;
    }
    return request<ModelDetails>(`/models/${encodeURIComponent(id)}`);
  },

  async estimate(input: EstimateInput): Promise<EstimateResult> {
    if (USE_MOCK_API) {
      const model = mockModels.get(input.modelId);
      if (!model)
        throw new ApiError(
          "MODEL_NOT_FOUND",
          "Model not found. Upload it again to continue.",
          404,
        );
      return {
        estimate:
          MATERIAL_RATES[input.material] *
          model.volumeCm3 *
          input.quantity *
          QUALITY_FACTORS[input.quality],
      };
    }
    return request<EstimateResult>("/pricing/estimate", {
      method: "POST",
      body: input,
    });
  },

  async getProviders(input: ProviderSearchInput) {
    if (USE_MOCK_API) {
      const model = mockModels.get(input.modelId);
      if (!model)
        throw new ApiError(
          "MODEL_NOT_FOUND",
          "Model not found. Upload it again to continue.",
          404,
        );
      const results = mockProviders.map((provider) => ({
        ...provider,
        fits:
          provider.buildVolume.x >= model.boundingBox.x &&
          provider.buildVolume.y >= model.boundingBox.y &&
          provider.buildVolume.z >= model.boundingBox.z,
      }));
      if (input.sort === "cheapest")
        results.sort((a, b) => a.estimate - b.estimate);
      else if (input.sort === "fastest")
        results.sort(
          (a, b) => (a.etaHours ?? Infinity) - (b.etaHours ?? Infinity),
        );
      else
        results.sort(
          (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
        );
      return results;
    }
    const query = new URLSearchParams({
      modelId: input.modelId,
      material: input.material,
      sort: input.sort,
    });
    const result = await request<{ providers: ProviderResult[] }>(
      `/providers?${query.toString()}`,
      { auth: false },
    );
    return result.providers;
  },

  async createMarketplaceOrder(input: CreateMarketplaceOrderInput) {
    if (USE_MOCK_API) {
      const provider = mockProviders.find(
        (item) => item.id === input.providerId,
      );
      if (!provider)
        throw new ApiError("PROVIDER_NOT_FOUND", "Provider not found.", 404);
      const order: MarketplaceOrder = {
        id: mockId(),
        order_number: String(Math.floor(100000 + Math.random() * 900000)),
        user_id: null,
        modelId: input.modelId,
        printer_id: provider.id,
        material: input.material,
        quality: input.quality,
        color: input.color,
        infill: 20,
        quantity: input.quantity,
        price_snapshot: provider.estimate,
        // Mock mode skips the other party's acceptance so the customer can go
        // straight from placing the order to the 3D build preview.
        status: "CONFIRMED",
        progress: 0,
        eta: new Date(
          Date.now() + (provider.etaHours ?? 24) * 3600000,
        ).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        printers: legacyPrinter(provider),
        provider: {
          id: provider.id,
          type: "LAB",
          displayName: provider.displayName,
          pickupArea: mockProvider?.pickupArea ?? "Campus pickup area",
          pickupAddress: "Main campus pickup point",
          phone: mockProvider?.contactPhone ?? "+66 2 123 4567",
        },
        customer: {
          id: mockProfile.id,
          fullName: mockProfile.fullName,
          phone: mockProfile.phone,
        },
      };
      mockOrders.set(order.id, order);
      mockMessages.set(order.id, [
        {
          id: mockId(),
          orderId: order.id,
          senderId: provider.id,
          senderRole: "PROVIDER",
          body: `Hi! I have your order ${order.order_number}. Message me here if you need anything before pickup.`,
          createdAt: order.created_at,
        },
      ]);
      return startMockDemoPrint(order.id);
    }
    const result = await request<{ order: MarketplaceOrder }>("/orders", {
      method: "POST",
      body: input,
    });
    return result.order;
  },

  async updateMarketplaceProgress(
    id: string,
    progress: number,
    status?: MarketplaceOrder["status"],
  ) {
    if (USE_MOCK_API) {
      const order = mockOrders.get(id);
      if (!order)
        throw new ApiError("ORDER_NOT_FOUND", "Order not found.", 404);
      if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
        throw new ApiError(
          "INVALID_PROGRESS",
          "Progress must be between 0 and 100.",
          400,
        );
      }
      if (status === "PICKED_UP") {
        throw new ApiError(
          "FORBIDDEN",
          "Only the customer can confirm pickup.",
          403,
        );
      }
      if (
        status &&
        status !== order.status &&
        !ORDER_TRANSITIONS[order.status].includes(status)
      ) {
        throw new ApiError(
          "INVALID_STATUS_TRANSITION",
          `Cannot change ${order.status} to ${status}.`,
          400,
        );
      }
      const timer = demoTimers.get(id);
      if (timer) {
        clearInterval(timer);
        demoTimers.delete(id);
      }
      const updated = {
        ...order,
        progress,
        status: status ?? order.status,
        updated_at: new Date().toISOString(),
      };
      mockOrders.set(id, updated);
      return updated;
    }
    const result = await request<{ order: MarketplaceOrder }>(
      `/orders/${encodeURIComponent(id)}/progress`,
      {
        method: "PATCH",
        body: { progress, ...(status ? { status } : {}) },
      },
    );
    return result.order;
  },

  /** Customer confirmation of pickup. The provider closes the order separately. */
  async updateMarketplaceStatus(
    id: string,
    status: MarketplaceOrder["status"],
    notes?: string,
  ) {
    if (USE_MOCK_API) {
      const order = mockOrders.get(id);
      if (!order)
        throw new ApiError("ORDER_NOT_FOUND", "Order not found.", 404);
      if (
        status !== order.status &&
        !ORDER_TRANSITIONS[order.status].includes(status)
      ) {
        throw new ApiError(
          "INVALID_STATUS_TRANSITION",
          `Cannot change ${order.status} to ${status}.`,
          400,
        );
      }
      const timer = demoTimers.get(id);
      if (timer) {
        clearInterval(timer);
        demoTimers.delete(id);
      }
      const updated = {
        ...order,
        status,
        progress: progressForStatus(status, order.progress),
        updated_at: new Date().toISOString(),
      };
      mockOrders.set(id, updated);
      return updated;
    }
    const result = await request<{ order: MarketplaceOrder }>(
      `/orders/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: { status, ...(notes ? { notes } : {}) },
      },
    );
    return result.order;
  },

  /** Dev-only: accept if needed, then advance 0 → 100 over about a minute. */
  async startDemoPrint(id: string) {
    if (!USE_MOCK_API) {
      const result = await request<{ order: MarketplaceOrder }>(
        `/orders/${encodeURIComponent(id)}/demo/start`,
        { method: "POST" },
      );
      return result.order;
    }

    return startMockDemoPrint(id);
  },

  createLegacyModelUploadUrl(fileName: string) {
    return request<{ url: string; token: string; path: string }>(
      "/models/upload-url",
      {
        method: "POST",
        body: { fileName },
      },
    );
  },

  processModel(id: string, material: Material) {
    return request<{
      id: string;
      dimensions: { x: number; y: number; z: number };
      volume: number;
    }>(`/models/${encodeURIComponent(id)}/process`, {
      method: "POST",
      body: { material },
    });
  },

  updateOrderStatus(id: string, status: string, notes?: string) {
    return request<{ order: Order }>(`/orders/${id}/status`, {
      method: "PATCH",
      body: { status, notes },
    });
  },

  getProfile() {
    if (USE_MOCK_API) return Promise.resolve(mockProfile);
    return request<Profile>("/profile");
  },

  updateProfile(input: UpdateProfileInput) {
    if (USE_MOCK_API) {
      Object.assign(mockProfile, input, {
        updatedAt: new Date().toISOString(),
      });
      return Promise.resolve(mockProfile);
    }
    return request<Profile>("/profile", { method: "PATCH", body: input });
  },

  getProfileStats() {
    if (USE_MOCK_API) {
      const orders = [...mockOrders.values()];
      return Promise.resolve<ProfileStats>({
        printsCompleted: orders.filter(
          (order) => order.status === "COMPLETED",
        ).length,
        totalOrders: orders.length,
        savedProviders: 0,
      });
    }
    return request<ProfileStats>("/profile/stats");
  },

  getMyProvider() {
    if (USE_MOCK_API) {
      if (!mockProvider)
        throw new ApiError(
          "PROVIDER_NOT_FOUND",
          "No provider profile exists yet.",
          404,
        );
      return Promise.resolve(mockProvider);
    }
    return request<ProviderProfile>("/providers/me");
  },

  getMyPrinters() {
    if (USE_MOCK_API) {
      return Promise.resolve({
        printers: (mockProvider?.printers ?? []).map((printer) =>
          legacyPrinterFromProvider(printer, mockProvider?.pickupArea ?? ""),
        ),
      });
    }
    return request<{ printers: ProviderPrinter[] }>(
      "/providers/me/printers",
    ).then((result) => ({
      printers: result.printers.map((printer) =>
        legacyPrinterFromProvider(printer, ""),
      ),
    }));
  },

  getMyProviderPrinters() {
    if (USE_MOCK_API) {
      return Promise.resolve({ printers: mockProvider?.printers ?? [] });
    }
    return request<{ printers: ProviderPrinter[] }>("/providers/me/printers");
  },

  onboardProvider(input: ProviderSetupInput) {
    if (USE_MOCK_API) {
      mockProvider = mockProviderFromInput(input, mockProvider ?? undefined);
      return Promise.resolve(mockProvider);
    }
    return request<ProviderProfile>("/providers", {
      method: "POST",
      body: input,
    });
  },

  updateMyProvider(input: Partial<ProviderSetupInput>) {
    if (USE_MOCK_API) {
      if (!mockProvider)
        throw new ApiError(
          "PROVIDER_NOT_FOUND",
          "No provider profile exists yet.",
          404,
        );
      const merged = { ...mockProvider, ...input } as ProviderSetupInput &
        ProviderProfile;
      mockProvider = mockProviderFromInput(merged, mockProvider);
      return Promise.resolve(mockProvider);
    }
    return request<ProviderProfile>("/providers/me", {
      method: "PATCH",
      body: input,
    });
  },

  saveMyPrinter(input: ProviderPrinterInput) {
    if (USE_MOCK_API) {
      const now = new Date().toISOString();
      const printer: ProviderPrinter = {
        id: mockId(),
        name: input.name || input.modelName || "Printer",
        modelName: input.modelName || input.name || "Printer",
        technology: "FDM",
        buildVolume: input.buildVolume,
        materials: input.materials,
        bestQuality: input.bestQuality ?? "STANDARD",
        isActive: input.isActive ?? true,
        rates: [],
        createdAt: now,
      };
      if (mockProvider)
        mockProvider = {
          ...mockProvider,
          printers: [...mockProvider.printers, printer],
        };
      return Promise.resolve(printer);
    }
    return request<ProviderPrinter>("/providers/me/printers", {
      method: "POST",
      body: input,
    });
  },

  updateMyPrinter(id: string, input: Partial<ProviderPrinterInput>) {
    if (USE_MOCK_API) {
      if (!mockProvider)
        throw new ApiError(
          "PROVIDER_NOT_FOUND",
          "No provider profile exists yet.",
          404,
        );
      const current = mockProvider.printers.find(
        (printer) => printer.id === id,
      );
      if (!current)
        throw new ApiError("PRINTER_NOT_FOUND", "Printer not found.", 404);
      const { rates: _rates, ...printerChanges } = input;
      const next: ProviderPrinter = {
        ...current,
        ...printerChanges,
        id: current.id,
        createdAt: current.createdAt,
      };
      mockProvider = {
        ...mockProvider,
        printers: mockProvider.printers.map((printer) =>
          printer.id === id ? next : printer,
        ),
      };
      return Promise.resolve(next);
    }
    return request<ProviderPrinter>(
      `/providers/me/printers/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: input,
      },
    );
  },

  deleteMyPrinter(id: string) {
    if (USE_MOCK_API) {
      if (mockProvider) {
        mockProvider = {
          ...mockProvider,
          printers: mockProvider.printers.filter(
            (printer) => printer.id !== id,
          ),
        };
      }
      return Promise.resolve({ success: true });
    }
    return request<{ success: true }>(
      `/providers/me/printers/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  },

  setMyPrinterMaterials(
    id: string,
    input: {
      materials: Material[];
      rates: Partial<
        Record<
          Material,
          { ratePerCm3: number; minimumOrder?: number; colors?: string[] }
        >
      >;
    },
  ) {
    if (USE_MOCK_API) {
      if (!mockProvider)
        throw new ApiError(
          "PROVIDER_NOT_FOUND",
          "No provider profile exists yet.",
          404,
        );
      const current = mockProvider.printers.find(
        (printer) => printer.id === id,
      );
      if (!current)
        throw new ApiError("PRINTER_NOT_FOUND", "Printer not found.", 404);
      const rates: MaterialRate[] = input.materials.flatMap((material) => {
        const rate = input.rates[material];
        return rate
          ? [
              {
                material,
                ratePerCm3: rate.ratePerCm3,
                minimumOrder: rate.minimumOrder ?? 0,
                colors: rate.colors ?? [],
              },
            ]
          : [];
      });
      const next: ProviderPrinter = {
        ...current,
        materials: input.materials,
        rates,
      };
      mockProvider = {
        ...mockProvider,
        printers: mockProvider.printers.map((printer) =>
          printer.id === id ? next : printer,
        ),
      };
      return Promise.resolve(next);
    }
    return request<ProviderPrinter>(
      `/providers/me/printers/${encodeURIComponent(id)}/materials`,
      {
        method: "PUT",
        body: input,
      },
    );
  },

  setMyProviderHours(hours: ProviderProfile["hours"]) {
    if (USE_MOCK_API) {
      if (!mockProvider)
        throw new ApiError(
          "PROVIDER_NOT_FOUND",
          "No provider profile exists yet.",
          404,
        );
      mockProvider = {
        ...mockProvider,
        hours,
        availability: { ...mockProvider.availability, pickupHours: hours },
      };
      return Promise.resolve({ hours });
    }
    return request<{ hours: ProviderProfile["hours"] }>("/providers/me/hours", {
      method: "PUT",
      body: { hours },
    });
  },

  activateMyProvider() {
    if (USE_MOCK_API) {
      if (!mockProvider)
        throw new ApiError(
          "PROVIDER_NOT_FOUND",
          "No provider profile exists yet.",
          404,
        );
      if (!mockProvider.setup.canAppearInSearch) {
        throw new ApiError(
          "PROVIDER_SETUP_INCOMPLETE",
          `Complete your setup first: ${mockProvider.setup.missing.join(", ")}.`,
          422,
        );
      }
      mockProvider = { ...mockProvider, status: "active" };
      return Promise.resolve(mockProvider);
    }
    return request<ProviderProfile>("/providers/me/activate", {
      method: "POST",
    });
  },

  /**
   * Called after a social sign-in. The API deletes the account when it was
   * created by this exact OAuth sign-in, which is how the sign-in screen keeps
   * unknown users out while the sign-up screen can still create them.
   */
  rejectNewOAuthUser() {
    return request<{ deleted: boolean }>("/auth/oauth-signin-check", {
      method: "POST",
    });
  },
};

export function estimatePrice(input: {
  material: Material;
  quality: Quality;
  quantity: number;
  priceFactor: number;
  volumeCm3?: number;
}): number {
  const rates: Record<Material, number> = {
    PLA: 0.05,
    ABS: 0.07,
    PETG: 0.08,
    TPU: 0.12,
  };
  const multipliers: Record<Quality, number> = {
    DRAFT: 1,
    STANDARD: 1.3,
    HIGH: 1.7,
  };
  const volume = input.volumeCm3 ?? 20;
  const base = 5 + volume * rates[input.material] * multipliers[input.quality];
  return base * input.priceFactor * Math.max(1, input.quantity);
}
