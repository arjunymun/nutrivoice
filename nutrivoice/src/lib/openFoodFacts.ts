/** Barcode lookup against the public Open Food Facts database. */

export interface ScannedProduct {
  barcode: string;
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  servingG: number | null;
  imageUrl: string | null;
}

export type LookupResult =
  | { ok: true; product: ScannedProduct }
  | { ok: false; reason: 'not_found' | 'no_nutrition' | 'network' };

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product/';

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export async function lookupBarcode(barcode: string): Promise<LookupResult> {
  const code = barcode.trim();
  if (!/^\d{6,14}$/.test(code)) return { ok: false, reason: 'not_found' };

  let json: any;
  try {
    const res = await fetch(`${OFF_URL}${encodeURIComponent(code)}.json`, {
      headers: { 'User-Agent': 'NutriVoice/1.0 (portfolio project)' },
    });
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (!res.ok) return { ok: false, reason: 'network' };
    json = await res.json();
  } catch {
    return { ok: false, reason: 'network' };
  }

  const product = json?.product;
  if (json?.status !== 1 || !product) return { ok: false, reason: 'not_found' };

  const n = product.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy_100g']); // sometimes only kJ is present
    if (kj != null) kcal = kj / 4.184;
  }
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  if (kcal == null && protein == null && carbs == null && fat == null) {
    return { ok: false, reason: 'no_nutrition' };
  }

  const p = protein ?? 0;
  const c = carbs ?? 0;
  const f = fat ?? 0;
  return {
    ok: true,
    product: {
      barcode: code,
      name: product.product_name?.trim() || 'Unknown product',
      brand: product.brands?.split(',')[0]?.trim() || null,
      kcal_100g: Math.round(kcal ?? 4 * p + 4 * c + 9 * f),
      protein_100g: p,
      carbs_100g: c,
      fat_100g: f,
      servingG: num(product.serving_quantity),
      imageUrl: product.image_front_small_url ?? null,
    },
  };
}
