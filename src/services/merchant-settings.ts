import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { Merchant } from '../models/merchant.js';
import { decimalToString } from '../utils/money.js';
import { getJsonCache, setJsonCache } from '../redis.js';

export interface MerchantSettings {
  merchantId: string;
  feePercent: string;
  webhookSecret: string;
  status: 'active' | 'disabled';
}

export async function getMerchantSettings(merchantId: string): Promise<MerchantSettings> {
  const cacheKey = `merchant:settings:${merchantId}`;
  const cached = await getJsonCache<MerchantSettings>(cacheKey);

  if (cached) {
    if (cached.status !== 'active') {
      throw new HttpError(403, 'merchant is disabled');
    }

    return cached;
  }

  const merchant = await Merchant.findById(merchantId).lean();

  if (!merchant) {
    throw new HttpError(404, 'merchant not found');
  }

  const settings: MerchantSettings = {
    merchantId,
    feePercent: decimalToString(merchant.feePercent),
    webhookSecret: merchant.webhookSecret,
    status: merchant.status as 'active' | 'disabled',
  };

  await setJsonCache(cacheKey, settings, config.merchantCacheTtlSeconds);

  if (settings.status !== 'active') {
    throw new HttpError(403, 'merchant is disabled');
  }

  return settings;
}
