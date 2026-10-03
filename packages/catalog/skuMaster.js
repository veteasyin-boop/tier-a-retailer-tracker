/**
 * GROWTA ENTERPRISE PRODUCT & SKU MASTER MODULE
 * Authority: GROWTA-MASTER-PRD-001 (Section 31, 32 — Modules 12, 13)
 */

export const SKU_CATEGORIES = Object.freeze({
  SEED: 'Seed',
  CROP_PROTECTION: 'Crop Protection',
  CROP_NUTRITION: 'Crop Nutrition'
});

export const STANDARD_PRODUCT_CATALOG = Object.freeze([
  // --- FIELD CROPS: SEEDS ---
  {
    id: 'SKU-SEED-MAZ-3355',
    sku_code: 'MAZ-3355-4KG',
    product_name: 'Pioneer 3355 Hybrid Maize',
    brand: 'Varyanta Agritech',
    crop: 'Maize',
    category: SKU_CATEGORIES.SEED,
    variety: 'Yellow Dent Hybrid',
    pack_size: '4 Kg Bag',
    unit: 'Bag',
    dealer_price: 1850,
    mrp: 2150,
    gst_rate: 0, // 0% on certified seeds
    is_active: true
  },
  {
    id: 'SKU-SEED-MAZ-9108',
    sku_code: 'MAZ-9108-4KG',
    product_name: 'Shaktiman 9108 Super Maize',
    brand: 'Varyanta Agritech',
    crop: 'Maize',
    category: SKU_CATEGORIES.SEED,
    variety: 'Orange Semi-Flint Hybrid',
    pack_size: '4 Kg Bag',
    unit: 'Bag',
    dealer_price: 1650,
    mrp: 1950,
    gst_rate: 0,
    is_active: true
  },
  {
    id: 'SKU-SEED-PAD-6444',
    sku_code: 'PAD-6444-3KG',
    product_name: 'Arize 6444 Gold Hybrid Paddy',
    brand: 'Varyanta Agritech',
    crop: 'Paddy',
    category: SKU_CATEGORIES.SEED,
    variety: 'Sub1 Flood Tolerant Hybrid',
    pack_size: '3 Kg Bag',
    unit: 'Bag',
    dealer_price: 980,
    mrp: 1150,
    gst_rate: 0,
    is_active: true
  },
  {
    id: 'SKU-SEED-PAD-7444',
    sku_code: 'PAD-7444-3KG',
    product_name: 'Super Ganga 7444 Paddy',
    brand: 'Varyanta Agritech',
    crop: 'Paddy',
    category: SKU_CATEGORIES.SEED,
    variety: 'High-Yield Long Grain',
    pack_size: '3 Kg Bag',
    unit: 'Bag',
    dealer_price: 920,
    mrp: 1080,
    gst_rate: 0,
    is_active: true
  },
  {
    id: 'SKU-SEED-MUS-PBOLD',
    sku_code: 'MUS-PBOLD-1KG',
    product_name: 'Pusa Bold Mustard Certified',
    brand: 'Varyanta Agritech',
    crop: 'Mustard',
    category: SKU_CATEGORIES.SEED,
    variety: 'High Oil Content (42%)',
    pack_size: '1 Kg Pouch',
    unit: 'Pouch',
    dealer_price: 240,
    mrp: 290,
    gst_rate: 0,
    is_active: true
  },
  {
    id: 'SKU-SEED-WHT-2967',
    sku_code: 'WHT-2967-40KG',
    product_name: 'HD-2967 Certified Wheat Seed',
    brand: 'Varyanta Agritech',
    crop: 'Wheat',
    category: SKU_CATEGORIES.SEED,
    variety: 'Rust Resistant High Biomass',
    pack_size: '40 Kg Bag',
    unit: 'Bag',
    dealer_price: 1550,
    mrp: 1750,
    gst_rate: 0,
    is_active: true
  },

  // --- CROP PROTECTION: AGROCHEMICALS (18% GST) ---
  {
    id: 'SKU-CP-CHLOR-20EC',
    sku_code: 'CHLOR-20EC-1L',
    product_name: 'Chlorpyrifos 20% EC Insecticide',
    brand: 'Varyanta CropCare',
    crop: 'Multi-Crop',
    category: SKU_CATEGORIES.CROP_PROTECTION,
    variety: 'Termite & Borer Control',
    pack_size: '1 Litre Bottle',
    unit: 'Bottle',
    dealer_price: 480,
    mrp: 590,
    gst_rate: 18,
    is_active: true
  },
  {
    id: 'SKU-CP-EMAMEC-5SG',
    sku_code: 'EMAMEC-5SG-100G',
    product_name: 'Emamectin Benzoate 5% SG',
    brand: 'Varyanta CropCare',
    crop: 'Vegetables & Maize',
    category: SKU_CATEGORIES.CROP_PROTECTION,
    variety: 'Fall Armyworm Specialist',
    pack_size: '100 Gram Pack',
    unit: 'Pack',
    dealer_price: 360,
    mrp: 450,
    gst_rate: 18,
    is_active: true
  },
  {
    id: 'SKU-CP-MANCO-75WP',
    sku_code: 'MANCO-75WP-500G',
    product_name: 'Mancozeb 75% WP Broad Spectrum Fungicide',
    brand: 'Varyanta CropCare',
    crop: 'Potato & Tomato',
    category: SKU_CATEGORIES.CROP_PROTECTION,
    variety: 'Late Blight Protection',
    pack_size: '500 Gram Pouch',
    unit: 'Pouch',
    dealer_price: 290,
    mrp: 360,
    gst_rate: 18,
    is_active: true
  },
  {
    id: 'SKU-CP-PRETIL-50EC',
    sku_code: 'PRETIL-50EC-1L',
    product_name: 'Pretilachlor 50% EC Pre-Emergence Herbicide',
    brand: 'Varyanta CropCare',
    crop: 'Paddy',
    category: SKU_CATEGORIES.CROP_PROTECTION,
    variety: 'Transplanted Rice Weed Control',
    pack_size: '1 Litre Bottle',
    unit: 'Bottle',
    dealer_price: 520,
    mrp: 640,
    gst_rate: 18,
    is_active: true
  },

  // --- CROP NUTRITION: BIO-STIMULANTS & MICRONUTRIENTS (12% GST) ---
  {
    id: 'SKU-NUT-ZINC-395',
    sku_code: 'ZINC-395-1L',
    product_name: 'Chelated Zinc 39.5% Suspension',
    brand: 'Varyanta NutriCare',
    crop: 'Paddy & Maize',
    category: SKU_CATEGORIES.CROP_NUTRITION,
    variety: 'Khaira Disease Shield',
    pack_size: '1 Litre Bottle',
    unit: 'Bottle',
    dealer_price: 450,
    mrp: 550,
    gst_rate: 12,
    is_active: true
  },
  {
    id: 'SKU-NUT-HUMIC-MAX',
    sku_code: 'HUMIC-MAX-500ML',
    product_name: 'Humic Acid 12% + Seaweed Extract Bio-Stimulant',
    brand: 'Varyanta NutriCare',
    crop: 'Multi-Crop',
    category: SKU_CATEGORIES.CROP_NUTRITION,
    variety: 'Root Architecture Developer',
    pack_size: '500 ml Bottle',
    unit: 'Bottle',
    dealer_price: 320,
    mrp: 410,
    gst_rate: 12,
    is_active: true
  }
]);

class SkuMasterService {
  constructor() {
    this.catalog = [...STANDARD_PRODUCT_CATALOG];
  }

  getAllSkus(activeOnly = true) {
    if (!activeOnly) return this.catalog;
    return this.catalog.filter(s => s.is_active);
  }

  getSkuById(skuId) {
    if (!skuId) return null;
    return this.catalog.find(s => s.id === skuId || s.sku_code === skuId || s.product_name === skuId) || null;
  }

  getSkusByCategory(category) {
    if (!category) return this.getAllSkus();
    return this.catalog.filter(s => s.category.toLowerCase() === category.toLowerCase() && s.is_active);
  }

  calculateOrderTotal({ skuId, qty, overrideRate = null, discountPercent = 0 }) {
    const sku = this.getSkuById(skuId);
    if (!sku) return { subtotal: 0, gstAmount: 0, grandTotal: 0, unitRate: 0 };

    const unitRate = overrideRate !== null ? Number(overrideRate) : sku.dealer_price;
    const gross = unitRate * qty;
    const discount = Math.round(gross * (discountPercent / 100));
    const taxable = gross - discount;
    const gstAmount = Math.round(taxable * (sku.gst_rate / 100));
    const grandTotal = taxable + gstAmount;

    return {
      skuId: sku.id,
      productName: sku.product_name,
      category: sku.category,
      packSize: sku.pack_size,
      unitRate,
      qty,
      gross,
      discount,
      taxable,
      gstRate: sku.gst_rate,
      gstAmount,
      grandTotal
    };
  }
}

export const skuMaster = new SkuMasterService();
