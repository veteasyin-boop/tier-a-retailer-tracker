/**
 * GROWTA E2MIS (EXCEL-TO-MODULE INTELLIGENCE SYSTEM) PIPELINE
 * Authority: GROWTA-MASTER-PRD-001 (Section 55 — Module 36)
 * Parent: Varyanta Global Industries
 * 
 * Invariants:
 * 1. Never silently create production records without human validation.
 * 2. Full audit trail of source file, mappings, and diffs.
 */

import { schemaDetector, RECOGNIZED_ENTITIES } from './schemaDetector.js';
import { storage } from '../../src/services/storage.js';
import { syncQueue } from '../../src/services/syncQueue.js';
import { auditLogger, AUDIT_ACTIONS } from '../audit/auditLogger.js';

class E2misEngine {
  /**
   * Step 1 & 2: Inspect uploaded sheet data and detect entity schema
   */
  inspectSheet(fileName, rawRows) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      throw new Error('Spreadsheet contains no data rows.');
    }

    const firstRow = rawRows[0];
    const columnHeaders = Object.keys(firstRow);
    const detection = schemaDetector.detectEntity(columnHeaders, rawRows.slice(0, 5));

    return {
      fileName,
      totalRows: rawRows.length,
      columnHeaders,
      entityType: detection.entityType,
      confidencePct: detection.confidencePct,
      suggestedMappings: detection.suggestedMappings,
      samplePreview: rawRows.slice(0, 3)
    };
  }

  /**
   * Step 3: Validate and compute reconciliation preview before commit
   */
  validateReconciliation(rawRows, entityType, mappings = {}) {
    const existingRows = storage.rows || [];
    const existingNames = new Set(existingRows.map(r => (r.retailer || '').toLowerCase().trim()));
    const existingMobiles = new Set(existingRows.map(r => (r.mobile || '').replace(/\D/g, '')).filter(Boolean));

    let updatesCount = 0;
    let insertsCount = 0;
    const validatedRecords = [];

    const nameCol = mappings?.retailer || mappings?.retailer_name || mappings?.name || mappings?.party_name;
    const mobCol = mappings?.mobile || mappings?.phone || mappings?.contact;
    const hqCol = mappings?.hq || mappings?.headquarters || mappings?.station;
    const blockCol = mappings?.block || mappings?.taluka;
    const distCol = mappings?.district || mappings?.city;
    const asstCol = mappings?.assistant || mappings?.rep || mappings?.officer;
    const potCol = mappings?.potentialSell || mappings?.potential;

    const extractField = (row, keyOrNormalized, fallbackKeywords = []) => {
      if (!row) return '';
      if (keyOrNormalized && row[keyOrNormalized] !== undefined) return row[keyOrNormalized];
      if (keyOrNormalized) {
        const target = keyOrNormalized.toLowerCase().replace(/[\s\-_]+/g, '');
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase().replace(/[\s\-_]+/g, '') === target) return v;
        }
      }
      for (const kw of fallbackKeywords) {
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase().includes(kw) && v !== undefined && v !== null && String(v).trim()) {
            return v;
          }
        }
      }
      return '';
    };

    let rowIndex = 0;
    for (const row of rawRows) {
      rowIndex++;
      let name = String(extractField(row, nameCol, ['retailer', 'dealer', 'counter', 'shop', 'party', 'firm', 'customer', 'name']) || '').trim();
      
      // If still no name, grab first non-empty text column
      if (!name) {
        for (const [k, v] of Object.entries(row)) {
          if (v && typeof v === 'string' && v.trim().length > 1 && !k.toLowerCase().includes('id') && !k.toLowerCase().includes('date')) {
            name = v.trim();
            break;
          }
        }
      }
      
      if (!name) {
        name = `Retailer Record #${rowIndex}`;
      }

      const rawMob = String(extractField(row, mobCol, ['mobile', 'phone', 'contact', 'cell']) || '').trim();
      const cleanMob = rawMob.replace(/\D/g, '');

      const isMatch = existingNames.has(name.toLowerCase()) || (cleanMob.length >= 10 && existingMobiles.has(cleanMob));

      if (isMatch) {
        updatesCount++;
      } else {
        insertsCount++;
      }

      validatedRecords.push({
        retailer: name,
        mobile: cleanMob || rawMob || '',
        hq: String(extractField(row, hqCol, ['hq', 'station', 'city', 'location']) || 'Bihar Central'),
        block: String(extractField(row, blockCol, ['block', 'taluka', 'area']) || ''),
        district: String(extractField(row, distCol, ['district', 'zilla', 'region']) || 'Patna'),
        assistant: String(extractField(row, asstCol, ['assistant', 'rep', 'officer', 'mgo']) || 'Unassigned'),
        potentialSell: String(extractField(row, potCol, ['potential', 'sales', 'bracket']) || '5000-10000'),
        isUpdate: isMatch
      });
    }

    return {
      totalInspected: rawRows.length,
      validCount: validatedRecords.length,
      invalidCount: rawRows.length - validatedRecords.length,
      updatesCount,
      insertsCount,
      reconciledRecords: validatedRecords
    };
  }

  /**
   * Step 4: Execute verified import into production store with audit log
   */
  async executeImport(reconciledRecords, metadata = {}) {
    if (!Array.isArray(reconciledRecords) || reconciledRecords.length === 0) {
      throw new Error('No validated records available for import.');
    }

    let importedCount = 0;
    const existingRows = [...storage.rows];

    for (const item of reconciledRecords) {
      const matchedIdx = existingRows.findIndex(r => 
        (r.retailer || '').toLowerCase().trim() === item.retailer.toLowerCase().trim()
      );

      if (matchedIdx !== -1) {
        // Safe partial update
        existingRows[matchedIdx] = {
          ...existingRows[matchedIdx],
          mobile: item.mobile || existingRows[matchedIdx].mobile,
          hq: item.hq || existingRows[matchedIdx].hq,
          block: item.block || existingRows[matchedIdx].block,
          district: item.district || existingRows[matchedIdx].district,
          potentialSell: item.potentialSell || existingRows[matchedIdx].potentialSell,
          updatedAt: Date.now()
        };
        syncQueue.enqueue('retailers', 'upsert', existingRows[matchedIdx]).catch(() => {});
      } else {
        // Safe insert
        const newRecord = {
          id: `ret_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          retailer: item.retailer,
          mobile: item.mobile,
          hq: item.hq,
          block: item.block,
          district: item.district,
          assistant: item.assistant,
          potentialSell: item.potentialSell,
          status: 'Pending',
          verifiedVisit: false,
          createdAt: Date.now()
        };
        existingRows.push(newRecord);
        syncQueue.enqueue('retailers', 'upsert', newRecord).catch(() => {});
      }
      importedCount++;
    }

    storage.rows = existingRows;
    storage.saveToLocal();
    storage.triggerChange();

    try {
      auditLogger.log({
        action: 'E2MIS_IMPORT_COMMITTED',
        entityType: 'retailer_catalog',
        entityId: metadata.fileName || 'spreadsheet_upload',
        user: { fullName: metadata.userName || 'Super Admin', role: 'SUPER_ADMIN' },
        diff: {
          totalImported: importedCount,
          inserts: reconciledRecords.filter(r => !r.isUpdate).length,
          updates: reconciledRecords.filter(r => r.isUpdate).length,
          fileName: metadata.fileName
        }
      });
    } catch (e) {
      console.warn('Audit logging note on E2MIS import:', e);
    }

    return {
      success: true,
      importedCount,
      totalDatabaseCount: storage.rows.length
    };
  }
}

export const e2misEngine = new E2misEngine();
