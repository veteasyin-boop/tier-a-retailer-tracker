// ========================================================
// MGO SUCCESS MODEL & AGRONOMY KNOWLEDGE HUB
// Sections 1, 15, 16 of SOP & Bihar Crop Package of Practices (POP)
// ========================================================

import { escapeHtml } from '../utils/geo.js';

export function openMgoSuccessModal() {
  const existing = document.getElementById('mgoSuccessModal');
  if (existing) existing.remove();

  const modalHtml = `
    <div class="modal-backdrop open" id="mgoSuccessModal">
      <div class="modal-box modal-content" style="max-width: 760px; animation: popIn 0.25s ease-out;">
        
        <!-- Header -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 20px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 26px;">🌱</span>
              <h2 style="font-family: var(--font-heading); font-size: 20px; font-weight: 800; margin: 0;">
                MGO SOP Master Guide & Success Model
              </h2>
            </div>
            <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">
              Standard Operating Procedure & Agronomy Knowledge Repository
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseSuccessModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <!-- Purpose Banner -->
        <div style="background: linear-gradient(135deg, rgba(21, 128, 61, 0.08), rgba(2, 132, 199, 0.08)); border: 1.5px solid rgba(21, 128, 61, 0.3); border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 22px;">
          <div style="font-weight: 800; font-size: 14.5px; color: #166534; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>🎯</span> The MGO Critical Link & Organizational Purpose
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; font-weight: 700; color: var(--ink); margin: 8px 0; background: var(--surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
            <span>Company</span> ➔ <span>Market</span> ➔ <span>Dealer/Retailer</span> ➔ <span>Farmer</span> ➔ <span>Product Adoption</span> ➔ <span>Business Growth</span>
          </div>
          <p style="font-size: 12.5px; color: var(--ink-secondary); line-height: 1.5; margin: 0;">
            <em>"The objective is not merely to maximize visits. The objective is to ensure that field activities generate measurable market impact, farmer engagement, product adoption, and sustainable business opportunities."</em>
          </p>
        </div>

        <!-- 10-Step Success Model Roadmap -->
        <div style="margin-bottom: 26px;">
          <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span>🔄</span> The 10-Step MGO Success Model
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px;">
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #0284c7;">
              <strong style="color: #0284c7; font-size: 13px;">1. LEARN</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Master crop agronomy, product differentiation & competitor specs.</p>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #ea580c;">
              <strong style="color: #ea580c; font-size: 13px;">2. PLAN</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Set Daily PJP, prioritize high-potential villages, crops & progressive farmers.</p>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #16a34a;">
              <strong style="color: #16a34a; font-size: 13px;">3. ENGAGE</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Conduct group meetings, build trust with Mukhiyas & leading growers.</p>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #7c3aed;">
              <strong style="color: #7c3aed; font-size: 13px;">4. DEMONSTRATE</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Run trial plots across 4 key stages & showcase visual differentiation.</p>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #0d9488;">
              <strong style="color: #0d9488; font-size: 13px;">5. GENERATE DEMAND</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Convert awareness into verified farmer purchase interest & trial orders.</p>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #d97706;">
              <strong style="color: #d97706; font-size: 13px;">6. FOLLOW UP</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Track crop germination, address objections, ensure no lead goes cold.</p>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #22c55e;">
              <strong style="color: #22c55e; font-size: 13px;">7. CONVERT</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Link farmer demand to assigned dealer counter to liquidate retail stock.</p>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #6366f1;">
              <strong style="color: #6366f1; font-size: 13px;">8. COLLECT FEEDBACK</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Capture retailer stock sentiment, pricing moves & competitor promotional schemes.</p>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #ec4899;">
              <strong style="color: #ec4899; font-size: 13px;">9. ANALYSE</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Identify crop shift trends, dealer stocking gaps & competitor weaknesses.</p>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #14b8a6;">
              <strong style="color: #14b8a6; font-size: 13px;">10. IMPROVE</strong>
              <p style="font-size: 11.5px; color: var(--muted); margin: 4px 0 0 0;">Refine pitch, sharpen targeting, and scale repeat orders for the territory.</p>
            </div>
          </div>
        </div>

        <!-- 5 Core Capabilities (Section 16) -->
        <div style="background: var(--surface-alt); border-radius: var(--radius-md); padding: 16px; margin-bottom: 24px;">
          <h3 style="font-family: var(--font-heading); font-size: 15px; font-weight: 800; margin-bottom: 10px;">
            🎖️ 5 Core Capabilities of a Star MGO
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; text-align: center;">
            <div style="background: var(--surface); padding: 10px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="font-size: 20px;">🔬</div>
              <strong style="font-size: 12px; display: block; margin-top: 4px;">Technical Competence</strong>
            </div>
            <div style="background: var(--surface); padding: 10px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="font-size: 20px;">🤝</div>
              <strong style="font-size: 12px; display: block; margin-top: 4px;">Farmer Relations</strong>
            </div>
            <div style="background: var(--surface); padding: 10px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="font-size: 20px;">📈</div>
              <strong style="font-size: 12px; display: block; margin-top: 4px;">Market Development</strong>
            </div>
            <div style="background: var(--surface); padding: 10px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="font-size: 20px;">💼</div>
              <strong style="font-size: 12px; display: block; margin-top: 4px;">Sales Orientation</strong>
            </div>
            <div style="background: var(--surface); padding: 10px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="font-size: 20px;">⏱️</div>
              <strong style="font-size: 12px; display: block; margin-top: 4px;">Execution Discipline</strong>
            </div>
          </div>
        </div>

        <!-- Bihar Package of Practices (POP) Quick Reference -->
        <div>
          <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span>📖</span> Bihar Crop Agronomy & POP Advisory Guide
          </h3>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <details style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 14px;">
              <summary style="font-weight: 700; cursor: pointer; color: var(--ink);">🌽 Maize (Corn) — Hy-Maize Gold 910 vs DKC 9108 & Pioneer 3355</summary>
              <div style="font-size: 12.5px; color: var(--ink-secondary); line-height: 1.6; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line);">
                <strong>Key Critical Stages:</strong> V3–V4 (weed management), Tasseling & Silking (moisture critical — avoid stress), Black layer maturity.<br>
                <strong>Company Differentiation:</strong> 16–18 uniform kernel rows, stay-green foliage for fodder, tight husk cover resisting cob borer and ear rot.<br>
                <strong>Advisory Note:</strong> Basal application of DAP + Zinc; split urea at knee-high and pre-tasseling stage.
              </div>
            </details>

            <details style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 14px;">
              <summary style="font-weight: 700; cursor: pointer; color: var(--ink);">🌾 Paddy (Rice) — Super Paddy 64 vs Arize 6444 Gold</summary>
              <div style="font-size: 12.5px; color: var(--ink-secondary); line-height: 1.6; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line);">
                <strong>Key Critical Stages:</strong> 21-day seedling nursery, active tillering (15–30 DAT), panicle initiation, flowering, dough stage.<br>
                <strong>Company Differentiation:</strong> 25–28 productive tillers/hill, strong lodging tolerance, excellent milling recovery (&gt;68%), tolerance to Bacterial Leaf Blight (BLB).<br>
                <strong>Advisory Note:</strong> Transplant 1–2 seedlings per hill; maintain 2–3 cm shallow standing water during early tillering.
              </div>
            </details>

            <details style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 14px;">
              <summary style="font-weight: 700; cursor: pointer; color: var(--ink);">🥦 Vegetables (Chilli, Cauliflower, Tomato) — Super Hybrid Series</summary>
              <div style="font-size: 12.5px; color: var(--ink-secondary); line-height: 1.6; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line);">
                <strong>Key Critical Stages:</strong> Pro-tray nursery raising, 25-day transplanting, early flowering, continuous fruit pickings.<br>
                <strong>Company Differentiation:</strong> High virus tolerance (LCV / leaf curl), compact curd firmness in cauliflower (no yellowing during transport), premium market price realization in Hajipur mandi.<br>
                <strong>Advisory Note:</strong> Drip fertigation with 19:19:19; prophylactic spray for thrips & mites during flowering.
              </div>
            </details>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('mgoSuccessModal');
  const closeBtn = document.getElementById('btnCloseSuccessModal');

  const close = () => modalEl.remove();
  closeBtn?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });
}
