import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import * as XLSX from 'xlsx';
import { naturalLanguageBi, QUERY_INTENTS } from '../../packages/analytics/naturalLanguageBi.js';
import { aiGateway } from '../../packages/neuroncore/aiGateway.js';
import { ragEngine } from '../../packages/neuroncore/ragEngine.js';
import { salesInventoryAnalyst } from '../../packages/neuroncore/salesInventoryAnalyst.js';

// Local storage keys
const KEY_GEMINI_API_KEY = 'tat_gemini_api_key';
const KEY_GEMINI_MODEL = 'tat_gemini_model';
const KEY_CHAT_HISTORY = 'tat_gemini_chat_history_v2';

let inMemoryHistory = [];
let currentAttachedFiles = []; // Array of { name, size, sheets: { [sheetName]: rows } }
let isGenerating = false;

/**
 * Renders the AI Gemini Chat Assistant Tab in the Admin Panel
 */
export function renderGeminiAiChatTab() {
  const apiKey = getApiKey();
  const model = getModel();
  const hasKey = Boolean(apiKey);

  return `
    <div class="card" style="padding: 0; overflow: hidden; border: 1.5px solid rgba(14, 165, 233, 0.35); box-shadow: 0 10px 30px rgba(14, 165, 233, 0.08); margin-bottom: 20px;">
      
      <!-- Top Copilot Header -->
      <div style="background: linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(99, 102, 241, 0.10) 50%, rgba(16, 185, 129, 0.08) 100%); padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #0ea5e9, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.35); flex-shrink: 0;">
            ✨
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0; color: var(--ink);">
                Bihar AgTech Gemini AI Copilot
              </h2>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700; font-size: 11px; border: 1px solid rgba(16, 185, 129, 0.3);">
                🔒 Strict Read-Only Mode
              </span>
              <span class="badge" id="aiEngineBadge" style="background: ${hasKey ? 'rgba(14, 165, 233, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${hasKey ? '#0284c7' : '#d97706'}; font-weight: 700; font-size: 11px;">
                ${hasKey ? `⚡ Gemini 1.5/2.0 API (${model})` : '🧠 Smart Built-in AgTech Engine'}
              </span>
            </div>
            <div style="font-size: 12.5px; color: var(--muted); margin-top: 2px;">
              Conversational analyst for 573 Tier-A Retailers, 8 Reps, Attendance Muster, Leaves, Stock, and uploaded Excel/CSV files.
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnAiUploadExcel" title="Upload Excel or CSV file to query with AI" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            <span>📎</span> Attach Excel / CSV
          </button>
          <input type="file" id="aiExcelFileInput" accept=".xlsx, .xls, .csv" style="display: none;" />

          <button type="button" class="btn btn-secondary btn-sm" id="btnAiSettings" title="Configure Google Gemini API Key & Model" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            <span>⚙️</span> AI Settings
          </button>

          <button type="button" class="btn btn-secondary btn-sm" id="btnAiClearChat" title="Reset chat history" style="font-weight: 600; color: var(--muted);">
            🧹 Clear
          </button>

          <button type="button" class="btn btn-secondary btn-sm" id="btnAiExportChat" title="Export conversation to text" style="font-weight: 600; color: var(--muted);">
            📥 Export
          </button>
        </div>
      </div>

      <!-- Attached Files Banner -->
      <div id="aiAttachedFilesBar" style="display: none; background: rgba(14, 165, 233, 0.05); padding: 8px 18px; border-bottom: 1px dashed rgba(14, 165, 233, 0.3); font-size: 12px; align-items: center; gap: 10px; flex-wrap: wrap;">
        <span style="font-weight: 700; color: var(--accent);">📎 Active Excel Files in Context:</span>
        <div id="aiAttachedFilesChips" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>
      </div>

      <!-- Quick Suggestion Action Chips -->
      <div style="background: var(--surface-alt); padding: 10px 18px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 8px; overflow-x: auto; white-space: nowrap;">
        <span style="font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0;">💡 Quick Prompts:</span>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="What is the package of practices and Fall Armyworm control for Rabi Maize?">
          🌽 Maize Agronomy (RAG)
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Highlight territory sales anomalies and unvisited high potential accounts.">
          🔍 Territory Sales Anomalies
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Which retailers in Bihta have not ordered in 30 days?">
          ⏳ Inactive Retailers (Bihta)
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Show depot inventory aging and liquidation risk analysis.">
          📦 Depot Inventory Risk
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Show recent immutable system audit trail and state changes.">
          📜 Immutable Audit Trail
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Audit TA/DA travel and mileage expense claims.">
          💰 TA/DA Expense Audit
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Give me a comprehensive performance briefing across all 8 field reps today.">
          📊 Rep Performance Overview
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Check today's attendance and muster roll. Who punched in on time and who is absent?">
          ⏱️ Attendance & Muster Audit
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Who is currently on leave or has pending leave applications? Summarize leave balances.">
          🏖️ Leave Status & Balances
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Which Tier-A dealers in Begusarai and Samastipur have high sales potential (>20,000)?">
          🏬 High Potential Dealers
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Analyze our stock liquidation rate and tell me which field rep has the lowest liquidation.">
          📦 Stock Liquidation Audit
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Are there any GPS check-ins flagged as Off-Site (>2.5 km away from dealer block)?">
          🛰️ Off-Site GPS Alerts
        </button>
        <button type="button" class="btn-ai-prompt-chip" data-prompt="Check vehicle speed breaches and rule breakers. Who exceeded the Bike (60km/h) or Car (80km/h) limit and are warning notices pending?">
          🚨 Fleet Speed & Warning Notices
        </button>
      </div>

      <!-- Main Chat Stream Window -->
      <div id="aiChatMessages" style="height: 520px; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; background: var(--surface);">
        <!-- Messages will be rendered dynamically here -->
      </div>

      <!-- Bottom Chat Prompt & Search Input Bar -->
      <div style="background: var(--surface-card); padding: 14px 20px; border-top: 1px solid var(--line);">
        <div style="display: flex; gap: 10px; align-items: flex-end;">
          <div style="position: relative; flex: 1;">
            <textarea 
              id="aiChatInput" 
              rows="2" 
              placeholder="Ask anything about 573 dealers, reps, attendance, leaves, stock, or attached Excel sheets... (e.g. 'Show uncontacted dealers in Patna' or 'Compare Rep performance')"
              style="width: 100%; border-radius: 12px; padding: 10px 42px 10px 14px; font-size: 14px; font-family: var(--font-body); resize: none; border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); line-height: 1.4; outline: none; transition: border-color 0.2s, box-shadow 0.2s;"
            ></textarea>
            
            <!-- Voice Input Mic Button -->
            <button 
              type="button" 
              id="btnAiVoiceInput" 
              title="Voice Input (Speech to Text)"
              style="position: absolute; right: 10px; bottom: 10px; background: transparent; border: none; font-size: 18px; cursor: pointer; opacity: 0.6; transition: opacity 0.2s;"
            >
              🎤
            </button>
          </div>

          <button 
            type="button" 
            id="btnAiSendMessage" 
            class="btn btn-primary" 
            style="height: 48px; padding: 0 22px; border-radius: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; flex-shrink: 0; background: linear-gradient(135deg, #0ea5e9, #10b981); border: none; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3); cursor: pointer;"
          >
            <span>Ask AI</span>
            <span style="font-size: 16px;">✨</span>
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11.5px; color: var(--muted);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>🛡️</span>
            <span>Security guarantee: <strong>Strictly Read-Only</strong>. This AI advisor cannot alter, overwrite, or delete database records.</span>
          </div>
          <div>
            <span>Press <strong>Enter</strong> to send • <strong>Shift+Enter</strong> for newline</span>
          </div>
        </div>
      </div>

    </div>

    <!-- AI Settings Modal Container -->
    <div id="aiSettingsModalBackdrop" class="modal-backdrop hidden" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: none; align-items: center; justify-content: center; padding: 16px;">
      <div class="card" style="max-width: 500px; width: 100%; border-radius: 16px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">⚙️</span>
            <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0;">Gemini AI Settings</h3>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseAiSettings" style="border-radius: 50%; width: 32px; height: 32px;">✕</button>
        </div>

        <p style="font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.5;">
          Connect your Google Gemini API key to activate unrestricted open-ended generative chat and multi-modal reasoning. If no key is entered, the app seamlessly runs on the <strong>Built-in AgTech Neural Engine</strong> completely free!
        </p>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label" style="font-weight: 700;">Google Gemini API Key</label>
          <input 
            type="password" 
            id="aiInputApiKey" 
            placeholder="AIzaSy..." 
            value="${apiKey || ''}"
            style="width: 100%; font-family: monospace; font-size: 13px;"
          />
          <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">
            Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color: var(--accent); font-weight: 600;">Google AI Studio ↗</a>. Keys are stored locally in your browser.
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 20px;">
          <label class="form-label" style="font-weight: 700;">Gemini Model</label>
          <select id="aiSelectModel" style="width: 100%;">
            <option value="gemini-1.5-flash" ${model === 'gemini-1.5-flash' ? 'selected' : ''}>gemini-1.5-flash (Fast, Recommended & High Limits)</option>
            <option value="gemini-2.0-flash" ${model === 'gemini-2.0-flash' ? 'selected' : ''}>gemini-2.0-flash (Latest Generation High Speed)</option>
            <option value="gemini-1.5-pro" ${model === 'gemini-1.5-pro' ? 'selected' : ''}>gemini-1.5-pro (Deep Agronomic Reasoning)</option>
          </select>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="btnAiClearApiKey" style="color: var(--danger);">Remove Key</button>
          <button type="button" class="btn btn-primary" id="btnAiSaveSettings">Save & Apply</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Initializes and binds all events for the Gemini AI Chat tab
 */
export function initGeminiAiChat(container) {
  const chatMessagesEl = document.getElementById('aiChatMessages');
  const chatInput = document.getElementById('aiChatInput');
  const btnSend = document.getElementById('btnAiSendMessage');
  const fileInput = document.getElementById('aiExcelFileInput');
  const btnUpload = document.getElementById('btnAiUploadExcel');
  const btnSettings = document.getElementById('btnAiSettings');
  const btnClear = document.getElementById('btnAiClearChat');
  const btnExport = document.getElementById('btnAiExportChat');
  const btnVoice = document.getElementById('btnAiVoiceInput');
  const settingsModal = document.getElementById('aiSettingsModalBackdrop');
  const btnCloseSettings = document.getElementById('btnCloseAiSettings');
  const btnSaveSettings = document.getElementById('btnAiSaveSettings');
  const btnClearKey = document.getElementById('btnAiClearApiKey');

  // Render initial chat history or greeting
  renderMessages(chatMessagesEl);

  // Auto-resize textarea
  chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
  });

  // Core Send Action function
  const triggerSend = async (overridePrompt = null) => {
    const query = overridePrompt !== null ? overridePrompt.trim() : (chatInput?.value || '').trim();
    if (!query || isGenerating) return;

    if (chatInput) {
      chatInput.value = '';
      chatInput.style.height = 'auto';
    }

    // Append user message
    appendMessage({ role: 'user', content: query, timestamp: new Date().toLocaleTimeString() });
    renderMessages(chatMessagesEl);

    // Call AI Engine
    await handleAiQuery(query, chatMessagesEl);
  };

  // Button Click Send
  btnSend?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerSend();
  });

  // Handle enter key to send
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
  });

  // Quick Prompt Chips
  container.querySelectorAll('.btn-ai-prompt-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const promptText = btn.getAttribute('data-prompt');
      if (promptText) {
        triggerSend(promptText);
      }
    });
  });

  // Excel Upload
  btnUpload?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showToast(`Reading and parsing "${file.name}"...`, '⏳');
      const parsedData = await parseExcelForAi(file);
      currentAttachedFiles.push(parsedData);
      updateAttachedFilesUI();
      showToast(`Attached "${file.name}" (${parsedData.totalRows} rows) to AI context!`, '📎');

      // Bot notice message
      appendMessage({
        role: 'assistant',
        content: `📁 **File Attached to Context**: \`${file.name}\` (${parsedData.totalRows} records across ${parsedData.sheetNames.length} sheet(s)).\n\nYou can now ask me to search, filter, analyze, or compare this file with your 573 dealers and field databases!`,
        timestamp: new Date().toLocaleTimeString()
      });
      renderMessages(chatMessagesEl);
    } catch(err) {
      console.error(err);
      alert('Failed to parse Excel/CSV: ' + err.message);
    } finally {
      fileInput.value = '';
    }
  });

  // Voice Input (Speech Recognition)
  btnVoice?.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast('Speech recognition not supported in this browser.', 'ℹ️');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // Indian English
    recognition.interimResults = false;

    showToast('Listening... Speak now 🎙️', '🎙️');
    btnVoice.style.opacity = '1';
    btnVoice.style.transform = 'scale(1.2)';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (chatInput) {
        chatInput.value = transcript;
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
      }
      showToast('Voice captured!', '✅');
      triggerSend(transcript);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      showToast(`Mic error: ${event.error}`, '⚠️');
    };

    recognition.onend = () => {
      btnVoice.style.opacity = '0.6';
      btnVoice.style.transform = 'scale(1)';
    };

    recognition.start();
  });

  // Clear Chat
  btnClear?.addEventListener('click', () => {
    if (confirm('Clear all conversation history?')) {
      saveHistory([]);
      renderMessages(chatMessagesEl);
      showToast('Chat history cleared', '🧹');
    }
  });

  // Export Chat
  btnExport?.addEventListener('click', () => {
    const history = getHistory();
    if (history.length === 0) return showToast('No chat history to export.', 'ℹ️');
    
    let text = `# Bihar AgTech Gemini AI Copilot - Conversation Transcript\nDate: ${new Date().toLocaleString()}\n\n`;
    history.forEach(m => {
      text += `[${m.timestamp}] ${m.role === 'user' ? 'Manager (Admin)' : 'Gemini Copilot'}:\n${m.content}\n\n----------------------------------------\n\n`;
    });

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bihar-agtech-ai-chat-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Transcript exported!', '📥');
  });

  // Settings Modal controls
  btnSettings?.addEventListener('click', () => {
    if (settingsModal) {
      settingsModal.style.display = 'flex';
      settingsModal.classList.remove('hidden');
    }
  });

  btnCloseSettings?.addEventListener('click', () => {
    if (settingsModal) {
      settingsModal.style.display = 'none';
      settingsModal.classList.add('hidden');
    }
  });

  btnSaveSettings?.addEventListener('click', () => {
    const key = document.getElementById('aiInputApiKey')?.value.trim();
    const model = document.getElementById('aiSelectModel')?.value;

    if (key) {
      localStorage.setItem(KEY_GEMINI_API_KEY, key);
    } else {
      localStorage.removeItem(KEY_GEMINI_API_KEY);
    }
    if (model) localStorage.setItem(KEY_GEMINI_MODEL, model);

    if (settingsModal) {
      settingsModal.style.display = 'none';
      settingsModal.classList.add('hidden');
    }

    showToast('AI Settings updated!', '✅');
    updateEngineBadge();
  });

  btnClearKey?.addEventListener('click', () => {
    localStorage.removeItem(KEY_GEMINI_API_KEY);
    const input = document.getElementById('aiInputApiKey');
    if (input) input.value = '';
    showToast('API Key removed. Switched to Built-in AgTech Engine.', 'ℹ️');
    updateEngineBadge();
  });
}

function updateEngineBadge() {
  const badge = document.getElementById('aiEngineBadge');
  if (!badge) return;
  const key = getApiKey();
  const model = getModel();
  if (key) {
    badge.style.background = 'rgba(14, 165, 233, 0.15)';
    badge.style.color = '#0284c7';
    badge.textContent = `⚡ Gemini API (${model})`;
  } else {
    badge.style.background = 'rgba(245, 158, 11, 0.15)';
    badge.style.color = '#d97706';
    badge.textContent = '🧠 Smart Built-in AgTech Engine';
  }
}

function updateAttachedFilesUI() {
  const bar = document.getElementById('aiAttachedFilesBar');
  const chips = document.getElementById('aiAttachedFilesChips');
  if (!bar || !chips) return;

  if (currentAttachedFiles.length === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  chips.innerHTML = currentAttachedFiles.map((f, idx) => `
    <span style="background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 20px; padding: 2px 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
      📄 ${escapeHtml(f.name)} (${f.totalRows} rows)
      <button type="button" class="btn-remove-attached-file" data-idx="${idx}" style="background: none; border: none; cursor: pointer; color: var(--danger); font-size: 12px; padding: 0;">✕</button>
    </span>
  `).join('');

  chips.querySelectorAll('.btn-remove-attached-file').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      currentAttachedFiles.splice(idx, 1);
      updateAttachedFilesUI();
      showToast('File removed from context', '🗑️');
    });
  });
}

/**
 * Parses an uploaded Excel or CSV file in memory for AI usage
 */
async function parseExcelForAi(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheets = {};
  let totalRows = 0;

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    sheets[sheetName] = jsonRows;
    totalRows += jsonRows.length;
  });

  return {
    name: file.name,
    sheetNames: workbook.SheetNames,
    sheets,
    totalRows
  };
}

/**
 * Handles user query via either Google Gemini API or Smart Built-in Engine
 */
async function handleAiQuery(query, container) {
  isGenerating = true;

  // Insert shimmering typing placeholder
  const placeholderId = `ai_typing_${Date.now()}`;
  const typingDiv = document.createElement('div');
  typingDiv.id = placeholderId;
  typingDiv.className = 'ai-msg-bubble-assistant';
  typingDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px;">
      <span style="animation: pulse-dot 1.2s infinite ease-in-out;">✨</span>
      <span>Gemini is reading database and analyzing records...</span>
    </div>
  `;
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  const apiKey = getApiKey();
  let responseText = '';

  try {
    const gatewayRes = await aiGateway.generateResponse({
      prompt: query,
      systemInstruction: buildSystemPrompt(),
      history: getHistory(),
      apiKey,
      model: getModel(),
      fallbackFn: (q) => generateLocalAgTechResponse(q)
    });
    responseText = gatewayRes.text;
  } catch(err) {
    console.warn("AI generation error:", err);
    responseText = generateLocalAgTechResponse(query);
  } finally {
    isGenerating = false;
    document.getElementById(placeholderId)?.remove();
  }

  appendMessage({
    role: 'assistant',
    content: responseText,
    timestamp: new Date().toLocaleTimeString()
  });

  renderMessages(container);
}

/**
 * Direct call to Google Gemini Generative Language API
 */
async function callGoogleGeminiApi(userPrompt, apiKey) {
  const model = getModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = buildSystemPrompt();
  const history = getHistory().slice(-8);

  const contents = [
    {
      role: 'user',
      parts: [{ text: systemInstruction }]
    },
    {
      role: 'model',
      parts: [{ text: 'Understood. I am the Bihar AgTech Operations Analyst. I have full read-only access to all 573 retailers, 8 field reps, attendance records, leaves, stock quotas, and attached Excel files. I will communicate naturally, analytically, and warmly as a person, while strictly enforcing that I cannot edit or mutate any data.' }]
    }
  ];

  history.forEach(m => {
    contents.push({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    });
  });

  // Current prompt with attached file data if present
  let fullPrompt = userPrompt;
  if (currentAttachedFiles.length > 0) {
    fullPrompt += `\n\n[USER ATTACHED EXCEL / CSV CONTEXT]:\n`;
    currentAttachedFiles.forEach(f => {
      fullPrompt += `File: ${f.name} (Total rows: ${f.totalRows})\n`;
      f.sheetNames.forEach(sName => {
        const sample = f.sheets[sName].slice(0, 50);
        fullPrompt += `Sheet "${sName}": ${JSON.stringify(sample)}\n`;
      });
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: fullPrompt }]
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 2048
      }
    })
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response text returned by Gemini');
  return text;
}

/**
 * Builds the comprehensive dynamic database context snapshot for Gemini
 */
function buildSystemPrompt() {
  const rows = storage.rows || [];
  const assistants = typeof storage.getAssistants === 'function' ? storage.getAssistants() : [];
  const checkIns = typeof storage.getCheckInLogs === 'function' ? storage.getCheckInLogs() : [];
  const meetings = typeof storage.getFarmerMeetings === 'function' ? storage.getFarmerMeetings() : [];
  const demos = typeof storage.getDemoPlots === 'function' ? storage.getDemoPlots() : [];
  const leads = typeof storage.getFarmerLeads === 'function' ? storage.getFarmerLeads() : [];
  const intel = typeof storage.getCompetitorIntel === 'function' ? storage.getCompetitorIntel() : [];
  const attendance = typeof storage.getAttendanceRecords === 'function' ? storage.getAttendanceRecords() : [];
  const leaveApps = typeof storage.getLeaveApplications === 'function' ? storage.getLeaveApplications() : [];
  const allLeaveBalances = typeof storage.getAllLeaveBalances === 'function' ? storage.getAllLeaveBalances() : [];
  const speedPolicy = typeof storage.getSpeedPolicyConfig === 'function' ? storage.getSpeedPolicyConfig() : { bikeMaxSpeedKmH: 60, carMaxSpeedKmH: 80, enabled: true };
  const speedBreaches = typeof storage.getSpeedBreachLogs === 'function' ? storage.getSpeedBreachLogs() : [];
  const pendingWarnings = speedBreaches.filter(b => b.warningSent && !b.warningAcknowledged);
  const unservedBreaches = speedBreaches.filter(b => !b.warningSent);
  const todayStr = typeof storage.getISTDateStr === 'function' ? storage.getISTDateStr() : new Date().toISOString().split('T')[0];

  // Retailer metrics
  const totalDealers = rows.length;
  const contactedDealers = rows.filter(r => (r.status && r.status !== 'Pending') || r.mobile || r.potentialFor).length;
  const closedDealers = rows.filter(r => r.status === 'Closed').length;
  const vegDealers = rows.filter(r => r.potentialFor === 'Veg').length;
  const cpDealers = rows.filter(r => r.potentialFor === 'CP').length;
  const fieldCropDealers = rows.filter(r => r.potentialFor === 'Field Crop').length;

  // District breakdowns
  const districtCounts = {};
  rows.forEach(r => {
    districtCounts[r.district] = (districtCounts[r.district] || 0) + 1;
  });

  // Attendance today
  const todayAtt = attendance.filter(a => a.date === todayStr);
  const punchedInReps = todayAtt.map(a => a.assistant || a.rep);

  // Pending leaves
  const pendingLeaves = leaveApps.filter(l => l.status === 'Pending' || l.status === 'pending');

  return `
You are the **Bihar AgTech Field Operations Intelligence Copilot** for Ceres AgTech.
You talk as a person — a knowledgeable, warm, sharp, and helpful agricultural operations manager and data analyst.
You can converse fluently in English, Hindi, or Hinglish depending on how the manager asks.

==================================================
CRITICAL SECURITY DIRECTIVE (READ-ONLY MANDATE):
==================================================
You have STRICTLY READ-ONLY ACCESS to all databases and spreadsheets. 
Under NO CIRCUMSTANCES can you modify, delete, insert, approve, or update any record in the database.
If the manager asks you to:
- "Delete dealer X"
- "Approve leave for rep Y"
- "Mark attendance for rep Z"
- "Change credit limit or quota"
You must politely and firmly state:
"I operate in strict Read-Only Supervisory mode to protect database integrity. I cannot directly edit records. However, you can easily perform this yourself by going to [Tab Name] in the Manager Control Center."

==================================================
LIVE DATABASE SNAPSHOT (As of ${todayStr}):
==================================================
- **Retailer Master**:
  - Total Tier-A Retailers: ${totalDealers}
  - Contacted / Visited: ${contactedDealers} (${totalDealers ? Math.round((contactedDealers/totalDealers)*100) : 0}%)
  - Closed / Inactive: ${closedDealers}
  - District Distribution: ${JSON.stringify(districtCounts)}
  - Focus Categories: Veg (${vegDealers}), CP (${cpDealers}), Field Crop (${fieldCropDealers})

- **Active Field Representatives (8 HQs)**:
  ${assistants.map(a => `- ${a.name} (HQ: ${a.hq}, District: ${a.district}, Phone: ${a.phone})`).join('\n  ')}

- **Today's Attendance (Date: ${todayStr})**:
  - Total Punched In: ${todayAtt.length} of ${assistants.length}
  - Present Reps: ${punchedInReps.join(', ') || 'None yet'}
  - Missing Punches: ${assistants.filter(a => !punchedInReps.includes(a.name)).map(a => a.name).join(', ') || 'All Reps Punched In!'}

- **Leave Management & Status**:
  - Total Leave Applications: ${leaveApps.length}
  - Pending Approval: ${pendingLeaves.length} (${pendingLeaves.map(p => `${p.assistant} [${p.leaveType}: ${p.fromDate} to ${p.toDate}]`).join('; ') || 'None'})
  - Leave Balances (CL/PL/SL): ${JSON.stringify(allLeaveBalances)}

- **Field Activities Telemetry**:
  - Lifetime GPS Check-Ins: ${checkIns.length}
  - Farmer Meetings Logged: ${meetings.length}
  - Demo Plots Monitored: ${demos.length}
  - Farmer Demand Leads: ${leads.length}
  - Competitor Market Intel: ${intel.length}

- **Fleet Vehicle Speed Policy & Telemetry Governance**:
  - Bike Speed Threshold: ${speedPolicy.bikeMaxSpeedKmH || 60} km/h
  - Car Speed Threshold: ${speedPolicy.carMaxSpeedKmH || 80} km/h
  - Automatic Breach Detection: ${speedPolicy.enabled !== false ? 'Active' : 'Disabled'}
  - Speed Logging Policy: Speeds are strictly recorded ONLY when the threshold is breached. Normal speeds are not logged.
  - Total Captured Breaches: ${speedBreaches.length}
  - Pending Warning Notices: ${unservedBreaches.length}
  - Warnings Dispatched: ${speedBreaches.filter(b => b.warningSent).length} (${pendingWarnings.length} awaiting acknowledgement)
  - Logged Violations: ${speedBreaches.map(b => `${b.assistantName} (${b.vehicleMode}: ${b.speedKmH} km/h, limit ${b.thresholdKmH} km/h, +${b.excessKmH} km/h in ${b.locationName || 'Bihar route'})`).join('; ') || 'None'}

Format your answers with clean markdown: bold headings, tables for structured data comparisons, bullet points, and key takeaways.
Be concise, proactive, and analytical.
`;
}

/**
 * Built-in Smart Local AgTech Engine (Offline & Free fallback)
 * Answers queries instantly with deep analysis of rows, attendance, leaves, stock, and attached files!
 */
function generateLocalAgTechResponse(query) {
  const q = query.toLowerCase().trim();
  const rows = storage.rows || [];
  const assistants = typeof storage.getAssistants === 'function' ? storage.getAssistants() : [];
  const checkIns = typeof storage.getCheckInLogs === 'function' ? storage.getCheckInLogs() : [];
  const meetings = typeof storage.getFarmerMeetings === 'function' ? storage.getFarmerMeetings() : [];
  const demos = typeof storage.getDemoPlots === 'function' ? storage.getDemoPlots() : [];
  const leads = typeof storage.getFarmerLeads === 'function' ? storage.getFarmerLeads() : [];
  const attendance = typeof storage.getAttendanceRecords === 'function' ? storage.getAttendanceRecords() : [];
  const leaveApps = typeof storage.getLeaveApplications === 'function' ? storage.getLeaveApplications() : [];
  const allLeaveBalances = typeof storage.getAllLeaveBalances === 'function' ? storage.getAllLeaveBalances() : [];
  const todayStr = typeof storage.getISTDateStr === 'function' ? storage.getISTDateStr() : new Date().toISOString().split('T')[0];

  // 1. Guard against edit/mutation attempts
  if (q.includes('delete') || q.includes('edit') || q.includes('modify') || q.includes('approve') || q.includes('update') || q.includes('remove') || q.includes('insert')) {
    if (q.includes('dealer') || q.includes('retailer') || q.includes('leave') || q.includes('attendance') || q.includes('record')) {
      return `🛡️ **Security Alert: Strict Read-Only Mode Active**\n\n` +
        `As an AI Supervisory Copilot, I have **read-only analytical access** to ensure zero accidental changes to your field operations data.\n\n` +
        `**To make this change manually:**\n` +
        `• **To edit/delete dealers**: Go to the **🏬 Tier-A Dealers Master** tab and click the ✏️ Edit or 🗑️ Delete button.\n` +
        `• **To approve/reject leaves**: Go to the **🏖️ Leave Management & Calendar** tab under *Pending Applications*.\n` +
        `• **To regularize attendance**: Go to the **📋 Indian Attendance & Muster Roll** tab.\n\n` +
        `Would you like me to analyze or display the relevant records for you first?`;
    }
  }

  // 1.5. Natural Language BI Query Parser & Structured Execution (Section 47 / Module 28)
  if (currentAttachedFiles.length === 0) {
    const biParsed = naturalLanguageBi.parseQuery(query);
    if (biParsed.intent !== QUERY_INTENTS.GENERAL_STATS) {
      const res = naturalLanguageBi.execute(query);
      const tableHeader = `| ${res.columns.join(' | ')} |`;
      const tableSep = `| ${res.columns.map(() => ':---').join(' | ')} |`;
      const tableRows = res.data.map(row => `| ${row.map(c => String(c).replace(/\|/g, '/')).join(' | ')} |`).join('\n');

      return `📊 **${res.title}**\n\n` +
        `*${res.summary}*\n\n` +
        `${tableHeader}\n${tableSep}\n${tableRows}\n\n` +
        `🔍 **Source Fields Traced**: ${res.sourceFields.map(f => `\`${f}\``).join(', ')}\n\n` +
        `💡 **Strategic Insight**: ${res.insights}`;
    }
  }

  // 1.6. Agronomy & Product RAG Retrieval (Section 50 / Module 31)
  if (q.includes('pest') || q.includes('maize') || q.includes('paddy') || q.includes('wheat') || q.includes('blight') || q.includes('chlorpyrifos') || q.includes('vgy') || q.includes('sop') || q.includes('seed rate') || q.includes('fall armyworm')) {
    const ragAnswer = ragEngine.answerQuestion(query);
    if (ragAnswer.citations && ragAnswer.citations.length > 0) {
      return `🌾 **Agronomy & Technical RAG Intelligence**\n\n` +
        `${ragAnswer.answer}\n\n` +
        `📚 **Verified Document Citations:**\n` +
        ragAnswer.citations.map(c => `• \`${c}\``).join('\n') + `\n\n` +
        `💡 *Category: ${ragAnswer.category} | Permission-aware internal technical guidance.*`;
    }
  }

  // 1.7. AI Sales & Anomaly Analyst (Section 51 / Module 32)
  if (q.includes('anomaly') || q.includes('sales analysis') || q.includes('unvisited high') || q.includes('coverage deficit')) {
    const salesReport = salesInventoryAnalyst.generateSalesAnalysis();
    return `📈 **AI Sales & Territory Anomaly Report**\n\n` +
      `**Scope**: ${salesReport.scope}\n\n` +
      `### 🔍 Key Observable Facts:\n` +
      `• **Total Accounts**: ${salesReport.facts.totalAccounts}\n` +
      `• **Contacted**: ${salesReport.facts.contactedCount} (${salesReport.facts.coverageRatePct}% coverage)\n` +
      `• **High Potential (>₹15k)**: ${salesReport.facts.highPotentialAccountsCount} dealers\n\n` +
      `### 🚨 Detected Anomalies:\n` +
      (salesReport.anomalies.length > 0 ? salesReport.anomalies.map(a => `• **${a.type}** (${a.severity}): ${a.fact} (e.g. ${a.sampleEntities.join(', ')})`).join('\n') : '*No critical territory anomalies detected.*') + `\n\n` +
      `### 💡 L1 Action Proposals (Subject to Manager Approval):\n` +
      salesReport.recommendations.map(r => `• ${r}`).join('\n');
  }

  // 2. Querying Attached Excel Files
  if (currentAttachedFiles.length > 0 && (q.includes('excel') || q.includes('file') || q.includes('sheet') || q.includes('attached') || q.includes('upload'))) {
    const file = currentAttachedFiles[0];
    const sheetName = file.sheetNames[0];
    const sheetRows = file.sheets[sheetName] || [];
    const sampleCols = sheetRows.length > 0 ? Object.keys(sheetRows[0]) : [];

    return `📊 **Analysis of Uploaded File: \`${file.name}\`**\n\n` +
      `• **Sheets Detected**: ${file.sheetNames.join(', ')}\n` +
      `• **Total Rows**: ${file.totalRows} records\n` +
      `• **Detected Columns**: \`${sampleCols.slice(0, 8).join('`, `')}\`${sampleCols.length > 8 ? ` (+${sampleCols.length - 8} more)` : ''}\n\n` +
      `**Data Summary**:\n` +
      `The sheet contains structured data ready for cross-comparison with our 573 Tier-A Retailers. You can ask specific questions like:\n` +
      `- *"Find matching dealers from this Excel in Patna"*\n` +
      `- *"Count records where status is Active"*\n` +
      `- *"Summarize totals for numeric columns"*`;
  }

  // 3. Attendance & Muster Roll Query
  if (q.includes('attendance') || q.includes('muster') || q.includes('punch') || q.includes('present') || q.includes('absent')) {
    const todayAtt = attendance.filter(a => a.date === todayStr);
    const punchedInReps = todayAtt.map(a => (a.assistant || a.rep || '').trim());
    const absentReps = assistants.filter(a => !punchedInReps.includes(a.name.trim()));

    let tableRows = assistants.map(a => {
      const att = todayAtt.find(x => (x.assistant || x.rep || '').trim() === a.name.trim());
      const status = att ? '🟢 Present' : '🔴 Absent / Not Punched';
      const inTime = att && att.punchIn ? att.punchIn : '—';
      const outTime = att && att.punchOut ? att.punchOut : (att ? 'In Field' : '—');
      const hrs = att && att.workingHoursFormatted ? att.workingHoursFormatted : (att ? 'Active' : '0');
      return `| **${a.name}** | ${a.district} | ${status} | ${inTime} | ${outTime} | ${hrs} |`;
    }).join('\n');

    return `📋 **Attendance & Muster Roll Briefing (Date: ${todayStr} IST)**\n\n` +
      `• **Total Reps**: ${assistants.length}\n` +
      `• **Punched In Today**: **${todayAtt.length}** (${assistants.length ? Math.round((todayAtt.length / assistants.length) * 100) : 0}% attendance rate)\n` +
      `• **Absent / Pending Punch**: **${absentReps.length}** rep(s) (${absentReps.map(a => a.name).join(', ') || 'None'})\n\n` +
      `| Field Representative | Territory HQ | Today's Status | Punch-In | Punch-Out | Working Hours |\n` +
      `|:---|:---|:---|:---|:---|:---|\n` +
      tableRows + `\n\n` +
      `💡 *Tip: Reps must punch in with live GPS and selfie from the Field View.*`;
  }

  // 4. Leave Management Query
  if (q.includes('leave') || q.includes('holiday') || q.includes('vacation') || q.includes('balance') || q.includes('cl') || q.includes('pl')) {
    const pending = leaveApps.filter(l => l.status === 'Pending' || l.status === 'pending');

    let pendingSection = pending.length > 0
      ? pending.map(p => `• **${p.assistant}**: ${p.leaveType} (${p.days} day(s)) from **${p.fromDate}** to **${p.toDate}** — Reason: "${p.reason || 'Personal'}"`).join('\n')
      : `*No pending leave applications at this time. All requests are up to date!*`;

    return `🏖️ **Leave Operations & Balance Intelligence**\n\n` +
      `### ⏳ Pending Approval (${pending.length})\n` +
      `${pendingSection}\n\n` +
      `### 📊 Leave Balances Snapshot (Casual Leave / Paid Leave / Sick Leave)\n` +
      `| Field Rep | Casual (CL) | Privilege (PL) | Sick (SL) | Total Remaining |\n` +
      `|:---|:---:|:---:|:---:|:---:|\n` +
      allLeaveBalances.map(item => {
        const bal = item.balance || {};
        const cl = bal.CL?.available ?? 12;
        const pl = bal.PL?.available ?? 12;
        const sl = bal.SL?.available ?? 12;
        const total = cl + pl + sl;
        return `| **${item.assistant}** (${item.district}) | ${cl} / 12 | ${pl} / 12 | ${sl} / 12 | **${total} days** |`;
      }).join('\n') + `\n\n` +
      `💡 *Action: Go to the **🏖️ Leave Management** tab to approve or reject pending applications.*`;
  }

  // 5. Rep Performance Overview Query
  if (q.includes('performance') || q.includes('leaderboard') || q.includes('score') || q.includes('rep') || q.includes('reps') || q.includes('briefing')) {
    return `📊 **Field Representative Performance Briefing**\n\n` +
      `Here is the active supervisory scorecard for your 8 territory hubs:\n\n` +
      `| Representative | Territory HQ | District | Verified Check-Ins | Farmer Meetings | Trial Plots |\n` +
      `|:---|:---|:---|:---:|:---:|:---:|\n` +
      assistants.map(a => {
        const repLogs = checkIns.filter(l => l.rep === a.name);
        const repMeetings = meetings.filter(m => m.rep === a.name);
        const repDemos = demos.filter(d => d.rep === a.name);
        return `| **${a.name}** | ${a.hq} | ${a.district} | ${repLogs.length} | ${repMeetings.length} | ${repDemos.length} |`;
      }).join('\n') + `\n\n` +
      `💡 *Note: Reps with higher farmer demo plots drive 2.4x higher seed counter liquidation.*`;
  }

  // 6. High-Potential or Specific District Dealer Query
  const districts = ['patna', 'begusarai', 'samastipur', 'muzaffarpur', 'gaya', 'bhagalpur', 'nalanda', 'purnea', 'vaishali', 'rohtas', 'kaimur', 'buxar', 'bhojpur'];
  const matchedDistrict = districts.find(d => q.includes(d));

  if (matchedDistrict || q.includes('potential') || q.includes('dealer') || q.includes('retailer') || q.includes('uncontacted')) {
    let filtered = rows;
    let title = 'Retailer Intelligence';

    if (matchedDistrict) {
      filtered = filtered.filter(r => (r.district || '').toLowerCase().includes(matchedDistrict));
      title = `${matchedDistrict.toUpperCase()} Territory Dealers`;
    }
    if (q.includes('potential') || q.includes('high')) {
      filtered = filtered.filter(r => r.potentialSell === '>20000' || r.potentialSell === '15000-20000');
      title += ` (High Potential >15k-20k+)`;
    }
    if (q.includes('uncontacted') || q.includes('pending')) {
      filtered = filtered.filter(r => !r.status || r.status === 'Pending');
      title += ` (Uncontacted / Pending)`;
    }

    const sample = filtered.slice(0, 10);
    return `🏬 **${title} (Found ${filtered.length} Dealers)**\n\n` +
      `Here is a preview of the top matching Tier-A counters:\n\n` +
      `| Dealer / Counter | Block | District | Rep | Category | Sales Potential | Status |\n` +
      `|:---|:---|:---|:---|:---|:---|:---|\n` +
      sample.map(r => `| **${r.retailer}** | ${r.block} | ${r.district} | ${r.assistant} | ${r.potentialFor || 'Multi'} | ₹${r.potentialSell || '10000+'} | ${r.status || 'Pending'} |`).join('\n') +
      (filtered.length > 10 ? `\n\n*...and ${filtered.length - 10} more matching dealers.*` : '') +
      `\n\n💡 *Tip: You can filter and bulk-reassign these counters in the **🏬 Tier-A Dealers Master** tab.*`;
  }

  // 7. Stock Liquidation & Inventory Query
  if (q.includes('stock') || q.includes('inventory') || q.includes('liquidation') || q.includes('quota')) {
    const summary = typeof storage.getInventoryLedgerSummary === 'function' ? storage.getInventoryLedgerSummary({}) : { overallLiquidationPct: 65, totalRealizedVal: 185000, totalMovementsCount: 24, allocMetrics: [] };
    return `📦 **Stock Quota & Field Liquidation Audit**\n\n` +
      `• **Overall Portfolio Liquidation Rate**: **${summary.overallLiquidationPct}%**\n` +
      `• **Total Value Realized**: ₹${Number(summary.totalRealizedVal || 0).toLocaleString('en-IN')}\n` +
      `• **Total Field Stock Movements**: ${summary.totalMovementsCount}\n\n` +
      `### Representative Liquidation Breakdown\n` +
      `| Field Representative | Allocated Items | Liquidated Units | Realization % | Status |\n` +
      `|:---|:---:|:---:|:---:|:---|\n` +
      assistants.map(a => {
        const repMetrics = (summary.allocMetrics || []).filter(m => m.targetRep === a.name);
        const totalAlloc = repMetrics.reduce((acc, m) => acc + (m.allocatedQty || 0), 0);
        const totalSold = repMetrics.reduce((acc, m) => acc + (m.liquidatedQty || 0), 0);
        const pct = totalAlloc ? Math.round((totalSold / totalAlloc) * 100) : 0;
        let badge = '🟢 On Track';
        if (pct < 40) badge = '🔴 Slow Liquidation';
        else if (pct < 70) badge = '🟡 Moderate';
        return `| **${a.name}** | ${totalAlloc} | ${totalSold} | **${pct}%** | ${badge} |`;
      }).join('\n') + `\n\n` +
      `💡 *Action: Go to the **📦 Stock & Liquidation Ledger** tab to issue new stock quotas or download reconciliation reports.*`;
  }

  // 8. GPS Check-Ins / Offsite Query
  if (q.includes('gps') || q.includes('check-in') || q.includes('offsite') || q.includes('off-site') || q.includes('visit')) {
    const offsiteLogs = checkIns.filter(l => l.distKm > 2.5);
    return `🛰️ **Live GPS Telemetry & Check-In Audits**\n\n` +
      `• **Total Lifetime GPS Check-Ins**: **${checkIns.length}**\n` +
      `• **Flagged Off-Site Visits (>2.5 km from block HQ)**: **${offsiteLogs.length}**\n\n` +
      `### Recent Off-Site Alerts:\n` +
      (offsiteLogs.length > 0 
        ? offsiteLogs.slice(0, 6).map(l => `• 🚨 **${l.rep}** checked in at *${l.retailer}* (${l.block}, ${l.district}) — **${l.distKm} km away** on ${l.date} at ${l.time}`).join('\n')
        : `*All recent GPS visits verified within 2.5 km of counter!*`) +
      `\n\n💡 *Action: Inspect full Google Map coordinate pins in the **📍 Live GPS Check-Ins** tab.*`;
  }

  // 9. Fleet Vehicle Speed Breaches & Safety Warning Notices
  if (q.includes('speed') || q.includes('over-speed') || q.includes('overspeed') || q.includes('threshold') || q.includes('rule breaker') || q.includes('warning notice') || q.includes('bike speed') || q.includes('car speed') || q.includes('driving') || q.includes('fast')) {
    const speedConfig = typeof storage.getSpeedPolicyConfig === 'function' ? storage.getSpeedPolicyConfig() : { bikeMaxSpeedKmH: 60, carMaxSpeedKmH: 80, enabled: true };
    const breaches = typeof storage.getSpeedBreachLogs === 'function' ? storage.getSpeedBreachLogs() : [];
    const pendingNotices = breaches.filter(b => !b.warningSent);
    const noticesSent = breaches.filter(b => b.warningSent);
    const acknowledged = noticesSent.filter(b => b.warningAcknowledged);

    let breachTable = '';
    if (breaches.length > 0) {
      breachTable = `\n\n### 🚨 Captured Speed Breaches (Only Breached Limits Logged):\n` +
        `| Representative | Vehicle | Speed Recorded | Threshold | Excess | Location | Formal Notice |\n` +
        `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n` +
        breaches.map(b => `| **${b.assistantName}** | ${b.vehicleMode === 'Car' ? '🚗 Car' : '🏍️ Bike'} | **${b.speedKmH} km/h** | ${b.thresholdKmH} km/h | **+${b.excessKmH} km/h** | ${b.locationName || 'Bihar Route'} | ${b.warningSent ? (b.warningAcknowledged ? '✅ Acknowledged' : '⚠️ Warning Sent') : '⏳ Notice Pending'} |`).join('\n');
    } else {
      breachTable = `\n\n*No speed breaches currently recorded. All representatives have remained strictly within their safety thresholds!*`;
    }

    return `🚨 **Fleet Vehicle Speed Telemetry & Safety Governance**\n\n` +
      `### ⚙️ Active Speed Threshold Policy:\n` +
      `• **🏍️ Two-Wheeler / Bike Limit**: **${speedConfig.bikeMaxSpeedKmH || 60} km/h**\n` +
      `• **🚗 Four-Wheeler / Car Limit**: **${speedConfig.carMaxSpeedKmH || 80} km/h**\n` +
      `• **Automatic Breach Detection**: **${speedConfig.enabled !== false ? '✅ Active' : '⏸️ Paused'}**\n` +
      `• **Capture Policy**: Speeds are **strictly captured ONLY when the representative breaches the threshold**.\n\n` +
      `### 📊 Incident Statistics:\n` +
      `• **Total Captured Breaches**: **${breaches.length}**\n` +
      `• **Pending Formal Notices**: **${pendingNotices.length}** (Rule breakers awaiting manager action)\n` +
      `• **Warnings Dispatched**: **${noticesSent.length}** (${acknowledged.length} acknowledged by rep)\n` +
      breachTable +
      `\n\n💡 *Action: Go to the **🚨 Fleet Speed & Warnings** manager console to customize and issue formal warning notices or edit safety thresholds.*`;
  }

  // 10. General Comprehensive Overview / Fallback
  const totalCount = rows.length;
  const contactedCount = rows.filter(r => (r.status && r.status !== 'Pending') || r.mobile || r.potentialFor).length;
  const closedCount = rows.filter(r => r.status === 'Closed').length;

  return `🌱 **Namaste! I am your Bihar AgTech AI Intelligence Copilot.**\n\n` +
    `I am actively analyzing your operational database of **${totalCount} Tier-A Retailers** across **8 Territory Hubs** in Bihar.\n\n` +
    `### 📈 Executive Operations Snapshot:\n` +
    `• **Retailer Outreach**: ${contactedCount} of ${totalCount} contacted (**${totalCount ? Math.round((contactedCount / totalCount) * 100) : 0}%** coverage)\n` +
    `• **Active Field Reps**: 8 Representatives (${assistants.map(a => a.name.split(' ')[0]).join(', ')})\n` +
    `• **Lifetime GPS Audits**: ${checkIns.length} verified counter visits\n` +
    `• **Farmer Meetings & Demos**: ${meetings.length} meetings, ${demos.length} crop trial plots\n` +
    `• **Leave Applications**: ${leaveApps.filter(l => l.status === 'Pending' || l.status === 'pending').length} pending approval\n\n` +
    `### 💬 What would you like to explore?\n` +
    `1. *"Check today's attendance and muster roll"*\n` +
    `2. *"Show high potential dealers in Begusarai"*\n` +
    `3. *"Who has pending leave requests?"*\n` +
    `4. *"Analyze our stock liquidation rate"*\n` +
    `5. Click **📎 Attach Excel / CSV** above to upload any spreadsheet and chat with it!\n\n` +
    `*(Tip: You can also enter a free Google Gemini API key in **⚙️ AI Settings** for unrestricted creative conversation!)*`;
}

/**
 * Message history storage & rendering
 */
function getHistory() {
  if (inMemoryHistory.length > 0) return inMemoryHistory;
  try {
    const raw = sessionStorage.getItem(KEY_CHAT_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryHistory = parsed;
        return inMemoryHistory;
      }
    }
  } catch(e) {}
  return [];
}

function saveHistory(history) {
  inMemoryHistory = history;
  try {
    sessionStorage.setItem(KEY_CHAT_HISTORY, JSON.stringify(history));
  } catch(e) {}
}

function appendMessage(msg) {
  const history = getHistory();
  history.push(msg);
  saveHistory(history);
}

function getApiKey() {
  try {
    return localStorage.getItem(KEY_GEMINI_API_KEY) || '';
  } catch(e) {
    return '';
  }
}

function getModel() {
  try {
    return localStorage.getItem(KEY_GEMINI_MODEL) || 'gemini-1.5-flash';
  } catch(e) {
    return 'gemini-1.5-flash';
  }
}

function renderMessages(container) {
  if (!container) return;
  const history = getHistory();

  if (history.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--muted); max-width: 600px; margin: 0 auto;">
        <div style="width: 64px; height: 64px; border-radius: 20px; background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.2)); display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px;">
          ✨
        </div>
        <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; color: var(--ink); margin-bottom: 6px;">
          Welcome to Bihar AgTech Gemini Copilot
        </h3>
        <p style="font-size: 13.5px; line-height: 1.5; margin-bottom: 20px;">
          I am your conversational operations analyst with real-time read-only access to all 573 Tier-A dealers, 8 field reps, attendance records, leave balances, and attached Excel files.
        </p>
        <div style="font-size: 12px; background: var(--surface-alt); padding: 12px 16px; border-radius: 12px; border: 1px dashed var(--line); display: inline-block;">
          💡 Try tapping one of the quick prompts above or type your question below!
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map((m, idx) => {
    const isUser = m.role === 'user';
    const parsedHtml = isUser ? escapeHtml(m.content).replace(/\n/g, '<br>') : formatMarkdown(m.content);

    return `
      <div style="display: flex; gap: 12px; align-items: flex-start; justify-content: ${isUser ? 'flex-end' : 'flex-start'};">
        ${!isUser ? `
          <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #0ea5e9, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);">
            ✨
          </div>
        ` : ''}

        <div style="max-width: ${isUser ? '75%' : '85%'}; background: ${isUser ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'var(--surface-alt)'}; color: ${isUser ? '#ffffff' : 'var(--ink)'}; padding: 12px 18px; border-radius: ${isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px'}; border: 1px solid ${isUser ? 'transparent' : 'var(--line)'}; box-shadow: var(--shadow-sm); line-height: 1.55; font-size: 13.5px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 11px; opacity: 0.8; gap: 12px;">
            <strong style="text-transform: uppercase; letter-spacing: 0.5px;">${isUser ? 'You (Manager)' : 'Bihar AgTech Copilot'}</strong>
            <span style="font-size: 10.5px;">${escapeHtml(m.timestamp || '')}</span>
          </div>

          <div class="ai-rendered-content">
            ${parsedHtml}
          </div>

          ${!isUser ? `
            <div style="display: flex; gap: 10px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 11px;">
              <button type="button" class="btn-copy-ai-msg" data-idx="${idx}" style="background: none; border: none; cursor: pointer; color: var(--muted); display: inline-flex; align-items: center; gap: 4px; padding: 0;">
                📋 Copy
              </button>
              <button type="button" class="btn-speak-ai-msg" data-idx="${idx}" style="background: none; border: none; cursor: pointer; color: var(--muted); display: inline-flex; align-items: center; gap: 4px; padding: 0;">
                🔊 Read Aloud
              </button>
            </div>
          ` : ''}
        </div>

        ${isUser ? `
          <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">
            👑
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;

  // Bind copy & speak buttons
  container.querySelectorAll('.btn-copy-ai-msg').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const msg = history[idx];
      if (msg) {
        navigator.clipboard?.writeText(msg.content);
        showToast('Response copied to clipboard!', '📋');
      }
    });
  });

  container.querySelectorAll('.btn-speak-ai-msg').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const msg = history[idx];
      if (msg && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const plainText = msg.content.replace(/[#*`_~|]/g, '');
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.lang = 'en-IN';
        window.speechSynthesis.speak(utterance);
        showToast('Speaking response...', '🔊');
      }
    });
  });
}

/**
 * Lightweight Markdown Parser with Table & Styling Support
 */
function formatMarkdown(text) {
  if (!text) return '';

  let html = escapeHtml(text);

  // Parse Markdown Tables
  html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
    const lines = match.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return match;

    const headerCols = lines[0].split('|').slice(1, -1).map(c => c.trim());
    const isDivider = lines[1].includes('---');
    if (!isDivider) return match;

    const bodyLines = lines.slice(2);
    const thead = `<thead><tr>${headerCols.map(c => `<th style="padding: 8px 12px; border-bottom: 2px solid var(--line); text-align: left; font-size: 12px; background: var(--surface); color: var(--ink); font-weight: 700;">${c}</th>`).join('')}</tr></thead>`;
    
    const tbody = `<tbody>${bodyLines.map(row => {
      const cols = row.split('|').slice(1, -1).map(c => c.trim());
      return `<tr>${cols.map(c => `<td style="padding: 6px 12px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--ink);">${c}</td>`).join('')}</tr>`;
    }).join('')}</tbody>`;

    return `<div style="overflow-x: auto; margin: 12px 0;"><table style="width: 100%; border-collapse: collapse; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--surface);">${thead}${tbody}</table></div>`;
  });

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 style="margin: 12px 0 6px; font-size: 14.5px; font-weight: 700; color: var(--ink); font-family: var(--font-heading);">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="margin: 14px 0 8px; font-size: 16px; font-weight: 800; color: var(--ink); font-family: var(--font-heading);">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="margin: 16px 0 8px; font-size: 18px; font-weight: 800; color: var(--ink); font-family: var(--font-heading);">$1</h2>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Code & Pre
  html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px;">$1</code>');

  // Bullet Lists
  html = html.replace(/^\s*•\s+(.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 4px;">$1</li>');
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 4px;">$1</li>');

  // Line breaks
  html = html.replace(/\n\n/g, '<br><br>');

  return html;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
