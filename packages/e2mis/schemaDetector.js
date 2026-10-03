/**
 * GROWTA E2MIS SCHEMA DETECTOR
 * Authority: GROWTA-MASTER-PRD-001 (Section 55 — Module 36)
 * Parent: Varyanta Global Industries
 * 
 * Inspects tabular rows from Excel / CSV, detects entity types,
 * maps polymorphic column synonyms, and computes confidence scores.
 */

export const RECOGNIZED_ENTITIES = Object.freeze({
  RETAILERS: 'RETAILERS',
  ORDERS: 'ORDERS',
  INVENTORY: 'INVENTORY',
  ATTENDANCE: 'ATTENDANCE',
  FARMER_LEADS: 'FARMER_LEADS',
  COMPETITOR_INTEL: 'COMPETITOR_INTEL',
  UNKNOWN: 'UNKNOWN'
});

export const CANONICAL_MAPPINGS = {
  RETAILERS: {
    retailer: ['retailer', 'dealer', 'counter', 'shop', 'party_name', 'account_name', 'firm_name', 'store'],
    mobile: ['mobile', 'phone', 'contact', 'cell', 'mobile_no', 'whatsapp'],
    hq: ['hq', 'headquarters', 'station', 'base_hq', 'hub', 'depot'],
    block: ['block', 'taluka', 'tehsil', 'circle', 'sub_district'],
    district: ['district', 'zilla', 'city', 'region'],
    assistant: ['assistant', 'rep', 'officer', 'field_rep', 'assigned_to', 'sales_officer', 'mgo'],
    potentialSell: ['potential_sell', 'potential', 'sales_potential', 'monthly_turnover', 'bracket', 'tier'],
    potentialFor: ['potential_for', 'focus_category', 'category', 'segment', 'crop_focus']
  },
  ORDERS: {
    retailer_name: ['retailer', 'dealer', 'party', 'customer', 'counter'],
    product_sku: ['sku', 'product', 'item', 'variety', 'material'],
    quantity_bags: ['quantity', 'qty', 'bags', 'units', 'packets', 'volume'],
    unit_price: ['price', 'rate', 'unit_price', 'dealer_price', 'amount_per_unit'],
    total_order_value: ['total', 'order_value', 'grand_total', 'net_amount']
  },
  INVENTORY: {
    sku_id: ['sku_id', 'item_code', 'product_id', 'code'],
    product_name: ['product', 'item_name', 'sku_name', 'description'],
    quantity: ['stock', 'current_stock', 'quantity', 'balance', 'on_hand', 'inventory'],
    batch_number: ['batch', 'lot', 'lot_number', 'batch_no']
  }
};

class SchemaDetector {
  /**
   * Inspects sheet column headers and sample rows to classify entity type
   */
  detectEntity(columnHeaders, sampleRows = []) {
    const normalizedHeaders = (columnHeaders || []).map(h => String(h || '').trim().toLowerCase().replace(/[\s\-_]+/g, '_'));

    const scores = {
      [RECOGNIZED_ENTITIES.RETAILERS]: 0,
      [RECOGNIZED_ENTITIES.ORDERS]: 0,
      [RECOGNIZED_ENTITIES.INVENTORY]: 0,
      [RECOGNIZED_ENTITIES.ATTENDANCE]: 0
    };

    // 1. Retailer indicators
    if (normalizedHeaders.some(h => ['retailer', 'dealer', 'counter', 'shop', 'firm_name', 'party', 'customer', 'name', 'store', 'agency', 'outlet'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.RETAILERS] += 4;
    if (normalizedHeaders.some(h => ['block', 'taluka', 'tehsil', 'area', 'location', 'address', 'city', 'town'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.RETAILERS] += 3;
    if (normalizedHeaders.some(h => ['hq', 'station', 'base_station', 'district', 'zilla'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.RETAILERS] += 2;
    if (normalizedHeaders.some(h => ['mobile', 'phone', 'contact', 'cell'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.RETAILERS] += 3;
    if (normalizedHeaders.some(h => ['potential', 'sales_bracket', 'bracket', 'target'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.RETAILERS] += 2;

    // 2. Orders indicators
    if (normalizedHeaders.some(h => ['order_id', 'booking', 'order_date', 'po_number'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.ORDERS] += 4;
    if (normalizedHeaders.some(h => ['qty', 'quantity', 'bags'].some(s => h.includes(s))) && normalizedHeaders.some(h => ['price', 'rate', 'amount'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.ORDERS] += 3;

    // 3. Inventory indicators
    if (normalizedHeaders.some(h => ['stock', 'lot_number', 'batch_no', 'warehouse', 'depot'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.INVENTORY] += 4;
    if (normalizedHeaders.some(h => ['expiry_date', 'manufacturing_date', 'shelf_life'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.INVENTORY] += 3;

    // 4. Attendance indicators
    if (normalizedHeaders.some(h => ['punch_in', 'punch_out', 'muster', 'working_hours', 'shift'].some(s => h.includes(s)))) scores[RECOGNIZED_ENTITIES.ATTENDANCE] += 5;

    // Find highest score
    let highestEntity = RECOGNIZED_ENTITIES.RETAILERS; // Default to RETAILERS for tabular dealer rosters
    let maxScore = scores[RECOGNIZED_ENTITIES.RETAILERS];
    for (const [entity, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        highestEntity = entity;
      }
    }

    const confidencePct = Math.max(70, Math.min(100, Math.round((maxScore / 7) * 100)));

    return {
      entityType: highestEntity,
      confidencePct,
      suggestedMappings: this.suggestFieldMappings(highestEntity, normalizedHeaders)
    };
  }

  /**
   * Suggests column-by-column mapping to canonical domain model
   */
  suggestFieldMappings(entityType, headers) {
    const canonical = CANONICAL_MAPPINGS[entityType];
    if (!canonical) return {};

    const mapping = {};
    for (const [canonField, synonyms] of Object.entries(canonical)) {
      for (const header of headers) {
        if (synonyms.includes(header) || synonyms.some(syn => header.includes(syn))) {
          mapping[canonField] = header;
          break;
        }
      }
    }
    return mapping;
  }
}

export const schemaDetector = new SchemaDetector();
