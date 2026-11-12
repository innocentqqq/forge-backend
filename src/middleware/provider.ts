import type { Request, RequestHandler } from 'express';
import { getAuthUser } from './auth';
import { AppError } from './error';
import { getProviderIdentity } from '../modules/providers/providers.service';
import type { ProviderIdentity } from '../modules/providers/providers.types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      provider?: ProviderIdentity;
    }
  }
}

export const requireProvider: RequestHandler = async (req, _res, next) => {
  try {
    const user = getAuthUser(req);
    const provider = await getProviderIdentity(user.id);

    if (!provider) {
      throw new AppError(403, 'NOT_A_PROVIDER', 'A provider account is required');
    }

    req.provider = provider;
    next();
  } catch (error) {
    next(error);
  }
};

export function getRequestProvider(req: Request): ProviderIdentity {
  if (!req.provider) {
    throw new AppError(403, 'NOT_A_PROVIDER', 'A provider account is required');
  }
  return req.provider;
}
