/**
 * GROWTA NEURONCORE RAG & AGRONOMY KNOWLEDGE ENGINE
 * Authority: GROWTA-MASTER-PRD-001 (Section 50 — Module 31)
 * Parent: Varyanta Global Industries
 * 
 * Strict citation tracking: source_id, version, access_policy, timestamp.
 */

export const AGRONOMY_KNOWLEDGE_BASE = [
  {
    sourceId: 'DOC-AGRO-001',
    title: 'Hybrid Maize Agronomy & Package of Practices (Bihar Agro-Climatic Zone III)',
    owner: 'Agronomy Research Cell',
    version: '1.2.0',
    accessPolicy: 'PUBLIC_INTERNAL',
    category: 'CROP_GUIDE',
    crop: 'Maize',
    season: 'Rabi/Kharif',
    content: `Optimal sowing window for Rabi Maize in Begusarai and Samastipur is October 15 to November 15. Seed rate: 20 kg/ha for grain hybrids. Major pest threat: Fall Armyworm (Spodoptera frugiperda). Spray Emamectin Benzoate 5% SG @ 0.4 g/L at early whorl stage. Critical irrigation stages: Knee-high (30 DAS), Tasseling (55 DAS), and Grain filling (80 DAS).`,
    keywords: ['maize', 'makka', 'fall armyworm', 'begusarai', 'samastipur', 'seed rate', 'irrigation']
  },
  {
    sourceId: 'DOC-AGRO-002',
    title: 'Paddy Crop Protection & High-Yield Cultivation SOP',
    owner: 'Crop Health Advisory',
    version: '2.0.1',
    accessPolicy: 'PUBLIC_INTERNAL',
    category: 'CROP_GUIDE',
    crop: 'Paddy',
    season: 'Kharif',
    content: `Mainfield transplanting: 21-25 day old seedlings. Recommended plant spacing: 20cm x 15cm (2-3 seedlings/hill). Major disease: Bacterial Leaf Blight (BLB) and Sheath Blight. Major pest: Yellow Stem Borer. Application: Cartap Hydrochloride 4G @ 25 kg/ha at 20-25 DAT or Chlorantraniliprole 18.5% SC @ 0.3 ml/L. Stop nitrogen application if BLB is detected.`,
    keywords: ['paddy', 'dhan', 'rice', 'stem borer', 'blb', 'bacterial leaf blight', 'sheath blight', 'cartap']
  },
  {
    sourceId: 'DOC-AGRO-003',
    title: 'Wheat Sowing & Terminal Heat Management (Bihar Central Gangetic Plains)',
    owner: 'Agronomy Research Cell',
    version: '1.1.0',
    accessPolicy: 'PUBLIC_INTERNAL',
    category: 'CROP_GUIDE',
    crop: 'Wheat',
    season: 'Rabi',
    content: `Timely sowing window: November 10 to November 25. Late sowing leads to 35 kg/ha/day yield reduction due to March terminal heat. Seed rate: 100 kg/ha (timely) and 125 kg/ha (late sown). Treat seeds with Trichoderma viride @ 4 g/kg seed or Carboxin + Thiram @ 2 g/kg seed for loose smut control. Apply 1st irrigation at Crown Root Initiation (CRI, 21 DAS).`,
    keywords: ['wheat', 'gehun', 'cri', 'seed rate', 'terminal heat', 'loose smut', 'patna', 'danapur', 'barh']
  },
  {
    sourceId: 'DOC-PROD-001',
    title: 'Varyanta VGY-MZ-101 Certified Hybrid Maize Product Technical Sheet',
    owner: 'Varyanta Product Master',
    version: '3.0.0',
    accessPolicy: 'PUBLIC_INTERNAL',
    category: 'PRODUCT_MANUAL',
    crop: 'Maize',
    season: 'Rabi/Spring',
    content: `VGY-MZ-101 is a premium single-cross hybrid maize variety. Maturity: 115-120 days. Yield potential: 38-42 quintals/acre under assured irrigation. Features bold yellow-orange flint grains with deep kernels and high shellability (84%). High tolerance to Turcicum Leaf Blight and lodging. Pack size: 4 kg vacuum sealed pouch. GST: 0% (Certified Agricultural Seed).`,
    keywords: ['vgy-mz-101', 'mz-101', 'hybrid maize', 'seed', 'yield', '4kg', 'pack']
  },
  {
    sourceId: 'DOC-PROD-002',
    title: 'Varyanta VGY-CP-050 Chlorpyrifos 50% + Cypermethrin 5% EC Technical Bulletin',
    owner: 'Regulatory & Formulations',
    version: '2.1.0',
    accessPolicy: 'RESTRICTED_FIELD',
    category: 'PRODUCT_MANUAL',
    crop: 'Cotton, Vegetables, Maize, Pulses',
    season: 'All Seasons',
    content: `VGY-CP-050 is a broad-spectrum combination insecticide with dual contact and stomach action. Effective against sucking pests and chewing caterpillars. Dosage: 350-400 ml per acre in 150-200 liters of water. Antidote: Atropine sulfate. Storage: Store in original container in cool, well-ventilated warehouse. GST: 18% (Agrochemical Formulations).`,
    keywords: ['chlorpyrifos', 'cypermethrin', 'vgy-cp-050', 'insecticide', 'pest', 'dosage', 'antidote']
  },
  {
    sourceId: 'DOC-SOP-001',
    title: 'Growta 10-Step Daily Operating Rhythm for Field Representatives',
    owner: 'Field Operations Leadership',
    version: '1.5.0',
    accessPolicy: 'PUBLIC_INTERNAL',
    category: 'SOP',
    crop: 'All',
    season: 'All',
    content: `1. 08:30 AM Punch-In with live GPS selfie. 2. Review Smart Tour Beat sequence. 3. Reach Stop 1 by 09:30 AM. 4. Execute On-Site geofenced check-in (<200m). 5. Audit counter stock & liquidations. 6. Book replenishment orders in app. 7. Log farmer demand leads. 8. Conduct farmer sabha/demo plot inspection if scheduled. 9. Capture travel expenses. 10. Complete Daily EOD closure report by 07:00 PM.`,
    keywords: ['sop', 'daily operating rhythm', 'punch-in', 'eod', 'steps', 'check-in', 'field protocol']
  }
];

class RagEngine {
  constructor() {
    this.documents = AGRONOMY_KNOWLEDGE_BASE;
  }

  /**
   * Retrieves relevant documents matching query with permission check and citations
   */
  retrieve(query, options = {}) {
    const q = (query || '').toLowerCase();
    const tokens = q.split(/\s+/).filter(t => t.length > 2);
    const userRole = options.userRole || 'FIELD_OFFICER';

    const scored = this.documents.map(doc => {
      // Permission filter
      if (doc.accessPolicy === 'RESTRICTED_FIELD' && userRole === 'ANONYMOUS') {
        return { doc, score: 0 };
      }

      let score = 0;

      // Exact title match bonus
      if (doc.title.toLowerCase().includes(q)) score += 10;

      // Keyword match
      for (const kw of doc.keywords) {
        if (q.includes(kw)) score += 5;
        for (const token of tokens) {
          if (kw.includes(token)) score += 2;
        }
      }

      // Content match
      for (const token of tokens) {
        if (doc.content.toLowerCase().includes(token)) score += 1;
      }

      return { doc, score };
    });

    const results = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => ({
        sourceId: item.doc.sourceId,
        title: item.doc.title,
        owner: item.doc.owner,
        version: item.doc.version,
        category: item.doc.category,
        content: item.doc.content,
        relevanceScore: item.score
      }));

    return results;
  }

  /**
   * Generates grounded advisory response incorporating retrieved passages and citations
   */
  answerQuestion(question, options = {}) {
    const retrieved = this.retrieve(question, options);
    if (retrieved.length === 0) {
      return {
        answer: 'No directly verified agronomy or product documentation matched your query in the Growta Knowledge Base.',
        citations: []
      };
    }

    const primaryDoc = retrieved[0];
    const citations = retrieved.map(r => `[${r.sourceId} v${r.version} — ${r.title}]`);

    return {
      answer: primaryDoc.content,
      primaryDocument: primaryDoc.title,
      category: primaryDoc.category,
      citations
    };
  }
}

export const ragEngine = new RagEngine();
