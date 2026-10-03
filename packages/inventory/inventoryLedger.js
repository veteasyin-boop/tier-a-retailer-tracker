/**
 * GROWTA ENTERPRISE DEPOT & INVENTORY LEDGER ENGINE
 * Authority: GROWTA-MASTER-PRD-001 (Section 33, 34 — Modules 14, 15)
 */

import { skuMaster } from '../catalog/skuMaster.js';
import { auditLogger, AUDIT_ACTIONS } from '../audit/auditLogger.js';

export const MOVEMENT_TYPES = Object.freeze({
  OPENING_BALANCE: 'OPENING_BALANCE',
  DEPOT_RECEIPT: 'DEPOT_RECEIPT',
  ISSUE_TO_REP: 'ISSUE_TO_REP',
  RETURN_FROM_REP: 'RETURN_FROM_REP',
  DEALER_LIQUIDATION: 'DEALER_LIQUIDATION',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT'
});

export const WAREHOUSES = Object.freeze([
  { id: 'WH-PAT-CENTRAL', name: 'Patna Central Mother Depot', location: 'Transport Nagar, Patna', district: 'Patna' },
  { id: 'WH-BIH-REGIONAL', name: 'Bihta Regional Hub', location: 'Bihta Industrial Area', district: 'Patna' },
  { id: 'WH-DAN-TRANSIT', name: 'Danapur Transit Warehouse', location: 'Saguna More, Danapur', district: 'Patna' }
]);

const LEDGER_STORAGE_KEY = 'tat_inventory_ledger_v2';

class InventoryLedgerService {
  constructor() {
    this.movements = [];
    this.loadLedger();
  }

  loadLedger() {
    try {
      const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.movements = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Inventory ledger read note:', e);
    }
    this.generateSeedMovements();
  }

  generateSeedMovements() {
    const allSkus = skuMaster.getAllSkus();
    const today = new Date().toISOString().split('T')[0];
    const initial = [];

    // Seed opening stock in Patna Central Mother Depot
    allSkus.forEach((sku, idx) => {
      initial.push({
        id: `mov_init_${sku.id}_${idx}`,
        timestamp: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
        date: today,
        warehouse_id: 'WH-PAT-CENTRAL',
        warehouse_name: 'Patna Central Mother Depot',
        sku_id: sku.id,
        sku_code: sku.sku_code,
        product_name: sku.product_name,
        category: sku.category,
        batch_no: `BAT-2026-Q1-${100 + idx}`,
        movement_type: MOVEMENT_TYPES.OPENING_BALANCE,
        quantity: 500, // 500 bags/bottles opening
        unit: sku.unit,
        unit_cost: sku.dealer_price * 0.85,
        total_value: 500 * (sku.dealer_price * 0.85),
        source: 'Mother Factory Inward',
        destination: 'WH-PAT-CENTRAL',
        recorded_by: 'State Warehouse Manager',
        notes: 'Initial fiscal quarter opening balance'
      });
    });

    this.movements = initial;
    this.saveLedger();
  }

  saveLedger() {
    try {
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(this.movements.slice(0, 5000)));
    } catch (e) {
      console.warn('Inventory ledger save error:', e);
    }
  }

  recordMovement(entry) {
    const sku = skuMaster.getSkuById(entry.sku_id);
    if (!sku) throw new Error(`Invalid SKU: ${entry.sku_id}`);

    const clean = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      date: entry.date || new Date().toISOString().split('T')[0],
      warehouse_id: entry.warehouse_id || 'WH-PAT-CENTRAL',
      warehouse_name: entry.warehouse_name || 'Patna Central Mother Depot',
      sku_id: sku.id,
      sku_code: sku.sku_code,
      product_name: sku.product_name,
      category: sku.category,
      batch_no: entry.batch_no || `BAT-2026-${Date.now().toString().slice(-4)}`,
      movement_type: entry.movement_type,
      quantity: Number(entry.quantity) || 0,
      unit: sku.unit,
      unit_cost: entry.unit_cost || sku.dealer_price,
      total_value: (Number(entry.quantity) || 0) * (entry.unit_cost || sku.dealer_price),
      source: entry.source || 'Depot',
      destination: entry.destination || 'Field',
      assistant_name: entry.assistant_name || null,
      retailer_id: entry.retailer_id || null,
      retailer_name: entry.retailer_name || null,
      recorded_by: entry.recorded_by || 'Warehouse Supervisor',
      notes: entry.notes || ''
    };

    this.movements.unshift(clean);
    this.saveLedger();

    // Log to immutable audit
    auditLogger.log({
      action: entry.movement_type === MOVEMENT_TYPES.ISSUE_TO_REP ? AUDIT_ACTIONS.STOCK_ISSUE : AUDIT_ACTIONS.STOCK_RECONCILE,
      entityType: 'inventory_ledger',
      entityId: clean.id,
      user: { fullName: clean.recorded_by, role: 'STATE_HEAD' },
      newData: clean
    }).catch(e => console.warn('Audit note:', e));

    return clean;
  }

  getDepotStockBalances(warehouseId = 'WH-PAT-CENTRAL') {
    const balances = {};
    const allSkus = skuMaster.getAllSkus();

    allSkus.forEach(s => {
      balances[s.id] = {
        sku_id: s.id,
        sku_code: s.sku_code,
        product_name: s.product_name,
        category: s.category,
        pack_size: s.pack_size,
        unit: s.unit,
        unit_price: s.dealer_price,
        current_stock: 0,
        total_inward: 0,
        total_outward: 0,
        stock_value: 0
      };
    });

    this.movements.forEach(m => {
      if (m.warehouse_id !== warehouseId) return;
      if (!balances[m.sku_id]) return;

      const b = balances[m.sku_id];
      if (m.movement_type === MOVEMENT_TYPES.OPENING_BALANCE || m.movement_type === MOVEMENT_TYPES.DEPOT_RECEIPT || m.movement_type === MOVEMENT_TYPES.RETURN_FROM_REP) {
        b.current_stock += m.quantity;
        b.total_inward += m.quantity;
      } else if (m.movement_type === MOVEMENT_TYPES.ISSUE_TO_REP || m.movement_type === MOVEMENT_TYPES.DEALER_LIQUIDATION) {
        b.current_stock -= m.quantity;
        b.total_outward += m.quantity;
      }
      b.stock_value = Math.max(0, b.current_stock * b.unit_price);
    });

    return Object.values(balances);
  }

  getLiquidationRiskAnalysis() {
    const balances = this.getDepotStockBalances('WH-PAT-CENTRAL');
    return balances.map(item => {
      let riskLevel = 'Normal';
      let riskReason = 'Healthy offtake velocity';

      if (item.current_stock > 350) {
        riskLevel = 'Overstock';
        riskReason = `Excess holding (${item.current_stock} units). High capital lockup.`;
      } else if (item.current_stock < 50 && item.current_stock > 0) {
        riskLevel = 'Understock';
        riskReason = `Critical inventory level (${item.current_stock} units). Reorder recommended.`;
      } else if (item.category === 'Seed' && item.total_outward === 0) {
        riskLevel = 'Slow Moving';
        riskReason = 'Zero field liquidation recorded in last 30 days.';
      }

      return {
        ...item,
        riskLevel,
        riskReason
      };
    });
  }
}

export const inventoryLedger = new InventoryLedgerService();
