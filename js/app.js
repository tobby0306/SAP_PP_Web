/**
 * SAP S/4HANA PP Go-Live Interactive Triage Suite
 * Core Application Logic & State Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Data Initialization
  const knowledge = window.PP_KNOWLEDGE || null;
  if (!knowledge) {
    console.error("SAP PP Knowledge Base failed to load.");
    return;
  }

  // App State
  const state = {
    activeTab: 'tab-cheat-sheet',
    searchQuery: '',
    selectedCategory: 'ALL',
    activeTreeKey: 'mrp_tree',
    currentTreeStep: 1,
    treeHistory: [],
    checkedItems: JSON.parse(localStorage.getItem('sap_pp_teco_checklist') || '{}'),
    theme: localStorage.getItem('sap_pp_theme') || 'dark',
    activeScenarioId: 'scene_master_data',
    selectedScenarioCat: 'ALL',
    tcodeViewMode: 'flow',
    tcodeCardQuery: '',
    cheatQuery: '',
    cheatCategory: 'ALL'
  };

  // Apply saved theme
  if (state.theme === 'light') {
    document.body.classList.add('light-theme');
  }

  // DOM Elements
  const globalOmniSearch = document.getElementById('global-omni-search');
  const issuesGrid = document.getElementById('issues-grid');
  const filterPillsContainer = document.getElementById('filter-pills');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const toast = document.getElementById('app-toast');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');

  // ==========================================================================
  // Toast Helper
  // ==========================================================================
  let toastTimer = null;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  // Copy to clipboard helper
  window.copyTCode = function (tcode, e) {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(tcode).then(() => {
      showToast(`⚡ 已複製交易碼：${tcode}`);
    }).catch(() => {
      showToast(`已選取交易碼：${tcode}`);
    });
  };

  // ==========================================================================
  // Module 1: Cheat Sheet Issues Renderer & Tab 1 Dedicated Filter Engine
  // ==========================================================================
  window.handleCheatSearch = function (val) {
    state.cheatQuery = val;
    renderIssues();
  };

  window.handleCheatCategory = function (cat, btnEl) {
    state.cheatCategory = cat;
    const filterPills = document.getElementById('filter-pills');
    if (filterPills) {
      filterPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    }
    if (btnEl) btnEl.classList.add('active');
    renderIssues();
  };

  function renderIssues() {
    if (!issuesGrid) return;
    const query = state.cheatQuery.toLowerCase().trim();
    const cat = state.cheatCategory;

    const filtered = knowledge.issues.filter(issue => {
      // Category filter
      if (cat !== 'ALL') {
        if (cat === 'CRITICAL' && issue.severity !== 'CRITICAL') return false;
        if (cat === '開單與轉單' && !issue.category.includes('開單') && !issue.category.includes('版本')) return false;
        if (cat === '領料與發料' && !issue.category.includes('領料') && !issue.category.includes('發料')) return false;
        if (cat === '退料與改單' && !issue.category.includes('退料') && !issue.category.includes('元件')) return false;
        if (cat === '報工與入庫' && !issue.category.includes('報工') && !issue.category.includes('入庫')) return false;
        if (cat === '工序委外' && !issue.category.includes('委外') && !issue.category.includes('外協')) return false;
      }

      // Search query filter
      if (!query) return true;
      const matchId = issue.id.toLowerCase().includes(query);
      const matchTitle = issue.title.toLowerCase().includes(query);
      const matchCause = issue.root_cause.toLowerCase().includes(query);
      const matchTcode = issue.trigger_tcode.some(t => t.toLowerCase().includes(query));
      const matchStep = issue.resolution_steps.some(s => s.toLowerCase().includes(query));
      const matchBadge = issue.badge.toLowerCase().includes(query);

      return matchId || matchTitle || matchCause || matchTcode || matchStep || matchBadge;
    });

    // Update count in tab header and tab toolbar
    const cheatCountBadge = document.getElementById('count-cheat-sheet');
    if (cheatCountBadge) cheatCountBadge.textContent = filtered.length;

    const cheatStatsEl = document.getElementById('cheat-results-count');
    if (cheatStatsEl) cheatStatsEl.textContent = `顯示 ${filtered.length} / ${knowledge.issues.length} 項`;

    if (filtered.length === 0) {
      issuesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🔍</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-main);">未找到匹配之急救代碼或故障</div>
          <p style="font-size: 0.9rem; margin-top: 0.35rem;">請嘗試搜尋其他代碼 (如 E005、ZPP020、九宮格、備料單) 或清空過濾條件</p>
        </div>
      `;
      return;
    }

    issuesGrid.innerHTML = filtered.map(issue => {
      const tcodeChips = issue.trigger_tcode.map(t =>
        `<span class="tcode-chip" onclick="copyTCode('${t}', event)" title="點擊複製交易碼">${t} 📋</span>`
      ).join(' ');

      const stepsList = issue.resolution_steps.map(s =>
        `<li>${s}</li>`
      ).join('');

      const forbiddenHtml = issue.forbidden_action ? `
        <div class="forbidden-box">
          ${issue.forbidden_action}
        </div>
      ` : '';

      return `
        <div class="issue-card severity-${issue.severity}" id="issue-${issue.id}">
          <div class="card-header">
            <div class="card-title-group">
              <span class="issue-id-badge">${issue.id}</span>
              <span class="badge-tag badge-${issue.severity === 'CRITICAL' ? 'rose' : issue.severity === 'HIGH' ? 'amber' : 'cyan'}">
                ${issue.severity}
              </span>
              <span class="badge-tag badge-cyan">${issue.badge}</span>
            </div>
          </div>
          
          <h3 class="issue-title">${issue.title}</h3>

          <div class="trigger-tcodes-row">
            <span class="trigger-label">觸發交易：</span>
            ${tcodeChips}
          </div>

          <div class="root-cause-box">
            <strong>根本原因：</strong> ${issue.root_cause}
          </div>

          <ul class="resolution-list">
            ${stepsList}
          </ul>

          ${forbiddenHtml}

          <div class="card-footer">
            <span class="owner-tag">👤 責任單位：${issue.raci_owner}</span>
            <span>分類：${issue.category}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // Global Omni-Search Engine (Header Instant Cross-Module Triage)
  // ==========================================================================
  window.handleOmniSearch = function (query) {
    const dropdown = document.getElementById('omni-dropdown');
    if (!dropdown) return;

    const q = (query || '').toLowerCase().trim();
    if (!q) {
      dropdown.style.display = 'none';
      return;
    }

    // 1. Issues (E001~E023)
    const matchedIssues = knowledge.issues.filter(i =>
      i.id.toLowerCase().includes(q) ||
      i.title.toLowerCase().includes(q) ||
      i.trigger_tcode.some(t => t.toLowerCase().includes(q)) ||
      i.root_cause.toLowerCase().includes(q)
    ).slice(0, 4);

    // 2. Scenario Flows (13 Scenarios)
    const matchedScenarios = (knowledge.scenario_flows || []).filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      s.steps.some(st => st.tcode.toLowerCase().includes(q) || st.name.toLowerCase().includes(q))
    ).slice(0, 3);

    // 3. T-Codes (68 T-Codes)
    const matchedTcodes = knowledge.tcodes.filter(t =>
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q)
    ).slice(0, 4);

    // 4. Decision Trees
    const matchedTrees = [
      { id: 'mrp_tree', title: '1. MRP 跑不出資料六步標準排查樹 (VA03 ➔ C223)', tags: 'mrp,va03,c223,查無資料' },
      { id: 'return_tree', title: '2. 現場退料與元件抽換防呆鏈條 (解鎖 E005)', tags: '退料,e005,改單,zpp024,zpp010' },
      { id: 'order_transfer_tree', title: '3. SIT-626 業務訂單挪單生管因應處置流程', tags: '挪單,sit-626,轉單,va02' },
      { id: 'sandbox_e005', title: '4. 現場退料與 ECN 改單防呆模擬沙盒 (E005 解鎖沙盤)', tags: '沙盤,沙盒,e005,模擬,禁忌' },
      { id: 'sandbox_subcontract', title: '5. 製程委外 (PP02 / 541 / 543) 防呆模擬沙盒 (委外閉環沙盤)', tags: '沙盤,沙盒,委外,製程委外,外協,pp02,541,543,me27,me11,me2o' }
    ].filter(tr => tr.title.toLowerCase().includes(q) || tr.tags.includes(q)).slice(0, 2);

    // 5. Order Types (ZP01~ZP07)
    const matchedOrders = knowledge.order_types.filter(o =>
      o.type.toLowerCase().includes(q) ||
      o.name.toLowerCase().includes(q) ||
      o.scenario.toLowerCase().includes(q)
    ).slice(0, 2);

    // 6. WO Inspector Presets (7維穿透診斷器)
    const inspectorItems = [
      { id: 'PRESET_HEALTHY', title: '工單穿透體檢: 標準量產工單 (100028475901)', tags: '穿透,體檢,診斷,健康,100028475901,zp01,正常' },
      { id: 'PRESET_E005_ERROR', title: '工單穿透體檢: E005 領料後改單阻擋 (100028475902)', tags: '穿透,體檢,診斷,e005,改單,100028475902,zp02,resb' },
      { id: 'PRESET_SUB_541_LACK', title: '工單穿透體檢: 製程委外缺 541 原料外發 (100028475903)', tags: '穿透,體檢,診斷,委外,pp02,541,543,100028475903' },
      { id: 'PRESET_ROUTING_AUTOGR_ERR', title: '工單穿透體檢: 末站途程控制碼錯誤 (100028475904)', tags: '穿透,體檢,診斷,途程,pp03,自動入庫,100028475904' },
      { id: 'PRESET_COGI_MONTH_END', title: '工單穿透體檢: 月結前夕 COGI 殘留未清 (100028475905)', tags: '穿透,體檢,診斷,cogi,affw,月結,co88,100028475905' }
    ];
    const matchedInspectors = inspectorItems.filter(item => item.title.toLowerCase().includes(q) || item.tags.includes(q)).slice(0, 2);

    const totalMatches = matchedIssues.length + matchedScenarios.length + matchedTcodes.length + matchedTrees.length + matchedOrders.length + matchedInspectors.length;

    if (totalMatches === 0) {
      dropdown.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          🔍 未找到與「<strong style="color: var(--primary);">${query}</strong>」匹配之項目
        </div>
      `;
      dropdown.style.display = 'block';
      return;
    }

    let html = '';

    if (matchedIssues.length > 0) {
      html += `<div class="omni-group-title">🚨 秒級急救代碼 (${matchedIssues.length})</div>`;
      matchedIssues.forEach(i => {
        html += `
          <div class="omni-result-item" onclick="jumpToOmniResult('issue', '${i.id}')">
            <span class="omni-item-badge">${i.id}</span>
            <span class="omni-item-main">${i.title} (${i.trigger_tcode.join(', ')})</span>
            <span class="omni-item-action">急救排查 ➔</span>
          </div>
        `;
      });
    }

    if (matchedScenarios.length > 0) {
      html += `<div class="omni-group-title">🗺️ 業務情境循序流程 (${matchedScenarios.length})</div>`;
      matchedScenarios.forEach(s => {
        html += `
          <div class="omni-result-item" onclick="jumpToOmniResult('scenario', '${s.id}')">
            <span class="omni-item-badge">${s.icon || '📌'}</span>
            <span class="omni-item-main">${s.title}</span>
            <span class="omni-item-action">查看循序流程 ➔</span>
          </div>
        `;
      });
    }

    if (matchedTcodes.length > 0) {
      html += `<div class="omni-group-title">📋 68 大 SAP 交易碼 (${matchedTcodes.length})</div>`;
      matchedTcodes.forEach(t => {
        html += `
          <div class="omni-result-item" onclick="jumpToOmniResult('tcode', '${t.code}')">
            <span class="omni-item-badge">${t.code}</span>
            <span class="omni-item-main">${t.name}</span>
            <span class="omni-item-action">複製代碼 / 字典 ➔</span>
          </div>
        `;
      });
    }

    if (matchedTrees.length > 0) {
      html += `<div class="omni-group-title">🌳 互動排查決策樹 (${matchedTrees.length})</div>`;
      matchedTrees.forEach(tr => {
        html += `
          <div class="omni-result-item" onclick="jumpToOmniResult('tree', '${tr.id}')">
            <span class="omni-item-badge">決策</span>
            <span class="omni-item-main">${tr.title}</span>
            <span class="omni-item-action">開始排查 ➔</span>
          </div>
        `;
      });
    }

    if (matchedOrders.length > 0) {
      html += `<div class="omni-group-title">🏭 工單類型 ZP01~07 (${matchedOrders.length})</div>`;
      matchedOrders.forEach(o => {
        html += `
          <div class="omni-result-item" onclick="jumpToOmniResult('order', '${o.type}')">
            <span class="omni-item-badge">${o.type}</span>
            <span class="omni-item-main">${o.name} - ${o.scenario}</span>
            <span class="omni-item-action">查看工單屬性 ➔</span>
          </div>
        `;
      });
    }

    if (matchedInspectors.length > 0) {
      html += `<div class="omni-group-title">🔬 工單穿透診斷 (${matchedInspectors.length})</div>`;
      matchedInspectors.forEach(ins => {
        html += `
          <div class="omni-result-item" onclick="jumpToOmniResult('inspector', '${ins.id}')">
            <span class="omni-item-badge">體檢</span>
            <span class="omni-item-main">${ins.title}</span>
            <span class="omni-item-action">穿透診斷 ➔</span>
          </div>
        `;
      });
    }

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
  };

  window.closeOmniResults = function () {
    const dropdown = document.getElementById('omni-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  };

  window.jumpToOmniResult = function (type, id) {
    closeOmniResults();
    const omniInput = document.getElementById('global-omni-search');
    if (omniInput) omniInput.value = '';

    if (type === 'issue') {
      const tabBtn = document.getElementById('tab-btn-cheat-sheet');
      if (tabBtn) tabBtn.click();
      state.cheatCategory = 'ALL';
      state.cheatQuery = id;
      const cheatInput = document.getElementById('cheat-search-input');
      if (cheatInput) cheatInput.value = id;
      renderIssues();
      const el = document.getElementById(`issue-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 20px var(--primary)';
        setTimeout(() => { el.style.boxShadow = ''; }, 2000);
      }
    } else if (type === 'scenario') {
      jumpToScenario(id);
    } else if (type === 'tcode') {
      copyTCode(id);
      const tabBtn = document.getElementById('tab-btn-tcode-dictionary');
      if (tabBtn) tabBtn.click();
      switchTCodeViewMode('grid');
      filterTCodeCards(id);
      const filterInput = document.getElementById('tcode-filter-input');
      if (filterInput) filterInput.value = id;
    } else if (type === 'tree') {
      const tabBtn = document.getElementById('tab-btn-decision-tree');
      if (tabBtn) tabBtn.click();
      switchTree(id);
    } else if (type === 'order') {
      const tabBtn = document.getElementById('tab-btn-order-matrix');
      if (tabBtn) tabBtn.click();
    } else if (type === 'inspector') {
      const tabBtn = document.getElementById('tab-btn-wo-inspector');
      if (tabBtn) tabBtn.click();
      if (id && woPresets[id]) {
        loadWoPreset(id);
      }
    }
  };

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    const container = document.getElementById('omni-search-container');
    if (container && !container.contains(e.target)) {
      closeOmniResults();
    }
  });

  // ==========================================================================
  // Module 2: Interactive Decision Tree Engine
  // ==========================================================================
  function renderDecisionTree() {
    const treeData = knowledge.decision_trees[state.activeTreeKey];
    if (!treeData) return;

    const titleEl = document.getElementById('tree-title');
    const rootQuestionEl = document.getElementById('tree-root-question');
    const wizardContentEl = document.getElementById('wizard-content');

    if (titleEl) titleEl.textContent = treeData.title;
    if (rootQuestionEl) rootQuestionEl.textContent = treeData.root_question;

    const currentStep = treeData.steps.find(s => s.step_id === state.currentTreeStep);
    if (!currentStep) return;

    const totalSteps = treeData.steps.length;

    const optionsHtml = currentStep.options.map((opt, idx) => {
      const isFail = opt.status === 'FAIL';
      const isSafe = opt.status === 'SAFE';
      const badgeClass = isFail ? 'badge-rose' : isSafe ? 'badge-emerald' : 'badge-cyan';

      return `
        <button class="wizard-option-btn" onclick="selectTreeOption(${idx})">
          <div class="opt-title">
            <span class="opt-status-badge ${badgeClass}">${opt.status}</span>
            <span>${opt.label}</span>
          </div>
        </button>
      `;
    }).join('');

    wizardContentEl.innerHTML = `
      <div class="wizard-card">
        <div class="wizard-step-header">
          <span class="step-indicator">步驟 ${currentStep.step_id} / ${totalSteps} (交易碼: ${currentStep.tcode})</span>
          <button class="btn-icon" onclick="copyTCode('${currentStep.tcode}', event)">📋 複製 ${currentStep.tcode}</button>
        </div>

        <h3 class="wizard-step-title">${currentStep.name}</h3>
        <p class="wizard-step-desc">${currentStep.check}</p>

        <div class="wizard-options-grid">
          ${optionsHtml}
        </div>

        <div id="tree-outcome-container"></div>

        <div class="wizard-actions">
          <button class="btn-icon" onclick="resetDecisionTree()">🔄 重新診斷</button>
        </div>
      </div>
    `;
  }

  window.selectTreeOption = function (optionIndex) {
    const treeData = knowledge.decision_trees[state.activeTreeKey];
    const currentStep = treeData.steps.find(s => s.step_id === state.currentTreeStep);
    const chosen = currentStep.options[optionIndex];
    const outcomeContainer = document.getElementById('tree-outcome-container');

    if (chosen.next_step) {
      state.currentTreeStep = chosen.next_step;
      renderDecisionTree();
      showToast(`已前進至步驟 ${chosen.next_step}`);
    } else if (chosen.msg) {
      const isFail = chosen.status === 'FAIL';
      outcomeContainer.innerHTML = `
        <div class="wizard-result-box ${isFail ? 'fail' : ''}">
          <div class="wizard-result-title">
            ${isFail ? '🛑 排查結論與責任指派' : '✅ 處置指引'}
          </div>
          <div class="wizard-result-text">
            ${chosen.msg}
          </div>
        </div>
      `;
      showToast(isFail ? '診斷出卡單根本原因' : '取得標準處置指引');
    }
  };

  window.resetDecisionTree = function () {
    state.currentTreeStep = 1;
    renderDecisionTree();
    showToast('已重置決策診斷流程');
  };

  window.switchTree = function (treeKey) {
    state.activeTreeKey = treeKey;
    state.currentTreeStep = 1;
    document.querySelectorAll('.tree-select-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tree === treeKey);
    });

    const wizardSection = document.getElementById('tree-wizard-container');
    const sandboxSection = document.getElementById('sandbox-e005-container');
    const sandboxSubSection = document.getElementById('sandbox-subcontract-container');

    if (treeKey === 'sandbox_e005') {
      if (wizardSection) wizardSection.style.display = 'none';
      if (sandboxSection) sandboxSection.style.display = 'block';
      if (sandboxSubSection) sandboxSubSection.style.display = 'none';
      showToast('已進入 4. 現場退料與 ECN 改單模擬沙盒');
    } else if (treeKey === 'sandbox_subcontract') {
      if (wizardSection) wizardSection.style.display = 'none';
      if (sandboxSection) sandboxSection.style.display = 'none';
      if (sandboxSubSection) sandboxSubSection.style.display = 'block';
      showToast('已進入 5. 製程委外 (PP02 / 541 / 543) 防呆模擬沙盒');
      simulateSubAction('ACT_SUB_INSPECT');
    } else {
      if (wizardSection) wizardSection.style.display = 'block';
      if (sandboxSection) sandboxSection.style.display = 'none';
      if (sandboxSubSection) sandboxSubSection.style.display = 'none';
      renderDecisionTree();
    }
  };

  // ==========================================================================
  // Module 3: ZP01~ZP07 Order Matrix & Control Keys
  // ==========================================================================
  function renderOrderMatrix() {
    const tableBody = document.getElementById('order-matrix-tbody');
    if (!tableBody) return;

    tableBody.innerHTML = knowledge.order_types.map(row => `
      <tr>
        <td><strong style="color: var(--primary); font-family: var(--font-mono); font-size: 1rem;">${row.type}</strong></td>
        <td><strong>${row.name}</strong></td>
        <td>${row.scenario}</td>
        <td><span class="tcode-chip" onclick="copyTCode('${row.trigger_tcode}', event)">${row.trigger_tcode} 📋</span></td>
        <td>${row.pick_type}</td>
        <td><span class="${row.mes_dispatch.includes('V') ? 'status-dot-green' : 'status-dot-red'}">${row.mes_dispatch}</span></td>
        <td><span class="${row.sap_confirm.includes('V') ? 'status-dot-green' : 'status-dot-red'}">${row.sap_confirm}</span></td>
        <td><span class="${row.auto_gr.includes('V') ? 'status-dot-green' : 'status-dot-red'}">${row.auto_gr}</span></td>
        <td style="font-size: 0.82rem; color: var(--text-secondary);">${row.cost_rule}</td>
      </tr>
    `).join('');
  }

  function renderControlKeys() {
    const tableBody = document.getElementById('control-keys-tbody');
    if (!tableBody) return;

    tableBody.innerHTML = knowledge.control_keys.map(k => `
      <tr>
        <td><strong style="color: var(--amber); font-family: var(--font-mono); font-size: 1rem;">${k.key}</strong></td>
        <td>${k.type}</td>
        <td>${k.confirm}</td>
        <td>${k.external}</td>
        <td><strong style="color: ${k.auto_gr.includes('自動') ? '#10b981' : 'var(--text-muted)'};">${k.auto_gr}</strong></td>
        <td>${k.schedule_cost}</td>
        <td style="line-height: 1.45;">${k.desc}</td>
      </tr>
    `).join('');
  }

  // ==========================================================================
  // Module 4: Pre-TECO & Month-End Audit Checklist
  // ==========================================================================
  function renderChecklist() {
    const container = document.getElementById('checklist-items');
    const progressBar = document.getElementById('checklist-progress');
    const progressText = document.getElementById('checklist-progress-text');
    if (!container) return;

    const total = knowledge.teco_checklist.length;
    let checkedCount = 0;

    container.innerHTML = knowledge.teco_checklist.map(item => {
      const isChecked = !!state.checkedItems[item.id];
      if (isChecked) checkedCount++;

      return `
        <div class="checklist-item ${isChecked ? 'checked' : ''}" onclick="toggleCheckItem('${item.id}')">
          <input type="checkbox" class="custom-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleCheckItem('${item.id}');">
          <div class="checklist-content">
            <div class="checklist-title-row">
              <span class="badge-tag ${item.critical ? 'badge-rose' : 'badge-cyan'}">${item.step}</span>
              <span class="checklist-title">${item.title}</span>
              <span class="tcode-chip" onclick="copyTCode('${item.tcode}', event)">${item.tcode} 📋</span>
            </div>
            <div class="checklist-desc">${item.detail}</div>
          </div>
        </div>
      `;
    }).join('');

    const percentage = Math.round((checkedCount / total) * 100);
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = `稽核完成度：${checkedCount} / ${total} 項 (${percentage}%)`;
  }

  window.toggleCheckItem = function (id) {
    state.checkedItems[id] = !state.checkedItems[id];
    localStorage.setItem('sap_pp_teco_checklist', JSON.stringify(state.checkedItems));
    renderChecklist();
    showToast(state.checkedItems[id] ? '已標記完成此稽核項目' : '已取消此稽核項目');
  };

  window.resetChecklist = function () {
    state.checkedItems = {};
    localStorage.removeItem('sap_pp_teco_checklist');
    renderChecklist();
    showToast('已重置所有稽核檢查狀態');
  };

  // ==========================================================================
  // Module 5: RACI Matrix
  // ==========================================================================
  function renderRaci() {
    const tbody = document.getElementById('raci-tbody');
    if (!tbody) return;

    tbody.innerHTML = knowledge.raci_matrix.map(r => `
      <tr>
        <td><strong>${r.process}</strong></td>
        <td><span class="badge-tag ${r.pp.includes('R') ? 'badge-rose' : 'badge-cyan'}">${r.pp}</span></td>
        <td><span class="badge-tag ${r.bom.includes('R') ? 'badge-rose' : 'badge-cyan'}">${r.bom}</span></td>
        <td><span class="badge-tag ${r.sd.includes('R') ? 'badge-rose' : 'badge-cyan'}">${r.sd}</span></td>
        <td><span class="badge-tag ${r.mm.includes('R') ? 'badge-rose' : 'badge-cyan'}">${r.mm}</span></td>
        <td><span class="badge-tag ${r.qm.includes('R') ? 'badge-rose' : 'badge-cyan'}">${r.qm}</span></td>
        <td><span class="badge-tag ${r.co.includes('R') ? 'badge-rose' : 'badge-cyan'}">${r.co}</span></td>
        <td style="font-size: 0.85rem; color: var(--text-secondary);">${r.output}</td>
      </tr>
    `).join('');
  }

  // ==========================================================================
  // Module 6: Scenario-Driven Sequential Workflow Hub & 68 T-Code Suite
  // ==========================================================================
  function getRoleBadgeClass(roleStr) {
    if (!roleStr) return 'stepper-role-pp';
    if (roleStr.includes('PP') || roleStr.includes('生管')) return 'stepper-role-pp';
    if (roleStr.includes('MM') || roleStr.includes('倉管') || roleStr.includes('資材') || roleStr.includes('採購')) return 'stepper-role-mm';
    if (roleStr.includes('SD') || roleStr.includes('業務')) return 'stepper-role-sd';
    if (roleStr.includes('CO') || roleStr.includes('財務') || roleStr.includes('會計')) return 'stepper-role-co';
    if (roleStr.includes('QM') || roleStr.includes('品管')) return 'stepper-role-qm';
    if (roleStr.includes('BOM') || roleStr.includes('工程') || roleStr.includes('開發')) return 'stepper-role-eng';
    return 'stepper-role-pp';
  }

  function renderScenarioFlows() {
    const pillsList = document.getElementById('scenario-pills-list');
    const banner = document.getElementById('scenario-banner');
    const stepperContainer = document.getElementById('scenario-stepper-container');
    if (!pillsList || !banner || !stepperContainer) return;

    const scenarios = knowledge.scenario_flows || [];
    if (scenarios.length === 0) return;

    // Filter scenarios by category
    const currentCat = state.selectedScenarioCat;
    const filteredScenarios = scenarios.filter(s => {
      if (currentCat === 'ALL') return true;
      return s.category === currentCat;
    });

    // Verify if activeScenarioId is within filtered scenarios, else default to first
    let activeScenario = scenarios.find(s => s.id === state.activeScenarioId);
    if (!activeScenario || (currentCat !== 'ALL' && activeScenario.category !== currentCat)) {
      activeScenario = filteredScenarios[0] || scenarios[0];
      state.activeScenarioId = activeScenario.id;
    }

    // 1. Render Scenario Pills
    pillsList.innerHTML = filteredScenarios.map(s => {
      const isActive = s.id === state.activeScenarioId ? 'active' : '';
      return `
        <button class="scenario-pill ${isActive}" onclick="selectScenario('${s.id}')">
          <span>${s.icon || '📌'}</span>
          <span>${s.title}</span>
          <span style="font-size: 0.75rem; opacity: 0.75;">(${s.steps.length} 步)</span>
        </button>
      `;
    }).join('');

    // 2. Render Active Scenario Banner
    banner.innerHTML = `
      <div class="scenario-banner-top">
        <div class="scenario-banner-title">
          <span style="font-size: 1.5rem;">${activeScenario.icon || '⚡'}</span>
          <span>${activeScenario.title}</span>
        </div>
        <div class="scenario-tags-group">
          <span class="badge-tag badge-cyan">類別：${activeScenario.category}</span>
          <span class="badge-tag badge-amber">共 ${activeScenario.steps.length} 道循序關卡</span>
        </div>
      </div>
      <div class="scenario-banner-desc">
        ${activeScenario.desc}
      </div>
    `;

    // 3. Render Stepper Timeline Steps
    stepperContainer.innerHTML = activeScenario.steps.map((step, idx) => {
      const roleClass = getRoleBadgeClass(step.role);
      const isLast = idx === activeScenario.steps.length - 1;
      const stepNumStr = step.step_num < 10 ? `0${step.step_num}` : `${step.step_num}`;

      // Support multi-tcodes separated by slash or comma
      const tcodeChipsHtml = step.tcode.split('/').map(t => t.trim()).map(tc => {
        const cleanTcode = tc.split(' ')[0].replace(/[^a-zA-Z0-9_]/g, '');
        return `
          <div class="stepper-tcode-chip" onclick="copyTCode('${cleanTcode}', event)" title="點擊複製 ${cleanTcode}">
            <span>${tc}</span>
            <span style="font-size: 0.8rem;">📋</span>
          </div>
        `;
      }).join('');

      return `
        <div class="stepper-step-node">
          <div class="stepper-indicator-track">
            <div class="stepper-num-bubble">${stepNumStr}</div>
            ${!isLast ? '<div class="stepper-line"></div>' : ''}
          </div>

          <div class="stepper-step-card">
            <div class="stepper-card-header">
              <div class="stepper-tcode-row">
                ${tcodeChipsHtml}
                <div class="stepper-step-name">${step.name}</div>
              </div>
              <span class="stepper-role-badge ${roleClass}">
                👤 ${step.role}
              </span>
            </div>

            <div class="stepper-step-action">
              ${step.action}
            </div>

            <div class="stepper-output-box">
              <span style="font-size: 1.05rem;">🏁</span>
              <div>
                <strong style="color: #a7f3d0;">交付成果 (Handoff)：</strong>
                <span>${step.output}</span>
              </div>
            </div>

            ${step.caution ? `
              <div class="stepper-caution-box">
                <span style="font-size: 1.05rem;">⚠️</span>
                <div>
                  <strong style="color: #fca5a5;">避坑提醒 / 鐵律禁忌：</strong>
                  <span>${step.caution}</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Window-level Scenario Actions
  window.selectScenario = function (sceneId) {
    state.activeScenarioId = sceneId;
    renderScenarioFlows();
  };

  window.filterScenarioCategory = function (cat) {
    state.selectedScenarioCat = cat;
    const catBar = document.getElementById('scenario-cat-bar');
    if (catBar) {
      catBar.querySelectorAll('.pill-btn').forEach(btn => {
        if (btn.dataset.cat === cat) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
    renderScenarioFlows();
  };

  window.switchTCodeViewMode = function (mode) {
    state.tcodeViewMode = mode;
    const flowView = document.getElementById('scenario-flow-view');
    const gridView = document.getElementById('tcode-grid-view');
    const btnFlow = document.getElementById('view-mode-flow');
    const btnGrid = document.getElementById('view-mode-grid');

    if (mode === 'flow') {
      if (flowView) flowView.style.display = 'block';
      if (gridView) gridView.style.display = 'none';
      if (btnFlow) btnFlow.classList.add('active');
      if (btnGrid) btnGrid.classList.remove('active');
      renderScenarioFlows();
    } else {
      if (flowView) flowView.style.display = 'none';
      if (gridView) gridView.style.display = 'block';
      if (btnFlow) btnFlow.classList.remove('active');
      if (btnGrid) btnGrid.classList.add('active');
      renderTcodes();
    }
  };

  window.filterTCodeCards = function (val) {
    state.tcodeCardQuery = val.toLowerCase().trim();
    renderTcodes();
  };

  window.jumpToScenario = function (sceneId) {
    const tabBtn = document.getElementById('tab-btn-tcode-dictionary');
    if (tabBtn) tabBtn.click();

    switchTCodeViewMode('flow');

    state.selectedScenarioCat = 'ALL';
    const catBar = document.getElementById('scenario-cat-bar');
    if (catBar) {
      catBar.querySelectorAll('.pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === 'ALL');
      });
    }
    selectScenario(sceneId);

    const banner = document.getElementById('scenario-banner');
    if (banner) {
      banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 68 T-Codes Dictionary Cards Renderer (with scenario linkage)
  function renderTcodes() {
    const container = document.getElementById('tcode-cards-grid');
    if (!container) return;

    const query = (state.tcodeCardQuery || '').toLowerCase().trim();

    const filtered = knowledge.tcodes.filter(t => {
      if (!query) return true;
      const matchCode = t.code.toLowerCase().includes(query);
      const matchName = t.name.toLowerCase().includes(query);
      const matchCat = t.category.toLowerCase().includes(query);
      const matchDesc = t.desc.toLowerCase().includes(query);
      const matchRole = t.role ? t.role.toLowerCase().includes(query) : false;
      const matchScene = t.scenarios ? t.scenarios.some(s => s.toLowerCase().includes(query)) : false;
      return matchCode || matchName || matchCat || matchDesc || matchRole || matchScene;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🔍</div>
          <div style="font-size: 1.05rem; font-weight: 600; color: var(--text-main);">查無此 T-Code</div>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">請嘗試搜尋其他交易碼或中文名稱</p>
        </div>
      `;
      return;
    }

    const scenarioTitleToId = {
      "【場景 1】PP 基礎主檔建置標準循序": "scene_master_data",
      "【場景 2】正式訂單需求運算循序": "scene_mto_demand",
      "【場景 3】滾動預測 PIR 與 LTP 模擬循序": "scene_pir_ltp",
      "【場景 4】工單轉開與釋放循序": "scene_wo_release",
      "【場景 5】現場領料單開立與檢貨循序": "scene_gi_pick",
      "【場景 6】現場退料與 ECN 抽換元件循序": "scene_return_ecn",
      "【場景 7】現場不良報廢開立補料單循序": "scene_scrap_order",
      "【場景 8】委外加工發包與收貨循序": "scene_subcontract",
      "【場景 9】現場報工與完工入庫循序": "scene_confirmation_gr",
      "【場景 10】報工撤銷與回沖重報循序": "scene_cancel_conf",
      "【場景 11】月結 TECO 與財務結案循序": "scene_month_end_teco",
      "【場景 12】包裝工單與 VAS 客製加值循序": "scene_packing_vas",
      "【場景 13】業務訂單挪單因應處置循序": "scene_order_transfer"
    };

    container.innerHTML = filtered.map(t => {
      const scenarioChips = (t.scenarios || []).map(sc => {
        const sceneId = scenarioTitleToId[sc] || 'scene_master_data';
        return `
          <button class="pill-btn" style="font-size: 0.72rem; padding: 0.18rem 0.5rem; border-radius: 4px;" onclick="jumpToScenario('${sceneId}')" title="點擊切換至此情境流程">
            📍 ${sc} ➔
          </button>
        `;
      }).join(' ');

      return `
        <div class="issue-card" style="padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
              <strong style="color: var(--primary); font-family: var(--font-mono); font-size: 1.15rem; cursor: pointer;" onclick="copyTCode('${t.code}', event)" title="點擊複製">
                ${t.code}
              </strong>
              <button class="tcode-chip" onclick="copyTCode('${t.code}', event)">複製 📋</button>
            </div>
            <div style="font-weight: 700; font-size: 0.96rem; color: var(--text-main); margin-bottom: 0.35rem;">
              ${t.name}
            </div>
            <div style="font-size: 0.83rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.75rem;">
              ${t.desc}
            </div>
          </div>

          <div>
            ${scenarioChips ? `
              <div style="margin-bottom: 0.65rem;">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.3rem;">業務循序流程：</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">${scenarioChips}</div>
              </div>
            ` : ''}
            <div class="card-footer" style="padding-top: 0.5rem; margin-top: 0.4rem;">
              <span class="badge-tag badge-cyan">${t.category}</span>
              <span class="owner-tag" style="font-size: 0.76rem;">👤 ${t.role || 'PP'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // Event Listeners & Global Shortcuts
  // ==========================================================================

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      state.activeTab = targetTab;

      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(targetTab);
      if (panel) panel.classList.add('active');
    });
  });

  // Keyboard shortcut: '/' or 'Ctrl+K' focuses Omni-Search, 'Escape' closes dropdown
  window.addEventListener('keydown', (e) => {
    const omniInput = document.getElementById('global-omni-search');
    const cheatInput = document.getElementById('cheat-search-input');
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    if ((e.key === '/' && !isTyping) || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      if (omniInput) {
        omniInput.focus();
        omniInput.select();
        handleOmniSearch(omniInput.value);
      } else if (cheatInput) {
        cheatInput.focus();
        cheatInput.select();
      }
    }

    if (e.key === 'Escape') {
      closeOmniResults();
      if (activeEl && isTyping) {
        activeEl.blur();
      }
    }
  });

  // Theme toggle
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      state.theme = isLight ? 'light' : 'dark';
      localStorage.setItem('sap_pp_theme', state.theme);
      themeToggleBtn.textContent = isLight ? '🌙 暗色 HUD' : '☀️ 亮色 Fiori';
      showToast(`已切換為 ${isLight ? '企業亮色 Fiori' : '深色戰情 HUD'} 主題`);
    });
  }

  // ==========================================================================
  // Module 7: TSK-05 Advanced Routing Calculator & Line Simulator
  // ==========================================================================

  // Sub-Navigation for Lab Panels
  const labButtons = document.querySelectorAll('.lab-pill-btn');
  const labPanels = document.querySelectorAll('.lab-content-panel');
  labButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      labButtons.forEach(b => b.classList.remove('active'));
      labPanels.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.lab);
      if (target) {
        target.classList.add('active');
        target.style.display = 'block';
      }
    });
  });

  // --- Calculator Logic ---
  const calcInputs = [
    { num: 'calc-af', range: 'slider-af' },
    { num: 'calc-ak', range: 'slider-ak' },
    { num: 'calc-yield', range: 'slider-yield' },
    { num: 'calc-split', range: 'slider-split' },
    { num: 'calc-shift-hours', range: 'slider-shift-hours' }
  ];

  calcInputs.forEach(pair => {
    const numEl = document.getElementById(pair.num);
    const rangeEl = document.getElementById(pair.range);

    if (numEl && rangeEl) {
      numEl.addEventListener('input', () => {
        rangeEl.value = numEl.value;
        updateCalculations();
      });
      rangeEl.addEventListener('input', () => {
        numEl.value = rangeEl.value;
        updateCalculations();
      });
    }
  });

  const calcPresets = {
    cutting: {
      af: 1200, ak: 480, yieldQty: 2400, split: 4, shiftHours: 8,
      name: '👞 慢跑鞋裁斷線',
      afDesc: '裁斷線 1 班（8 小時）標準產出 1,200 雙',
      akDesc: '1 台裁斷機 / 人員作業 1 班（8 小時 = 480 分鐘）'
    },
    stitching: {
      af: 600, ak: 960, yieldQty: 1800, split: 10, shiftHours: 8,
      name: '🪡 高階針車組',
      afDesc: '針車組以每 600 雙作為標準計算批量',
      akDesc: '2 名核心針車工做完 1 班（2人 × 480分 = 960 分鐘）'
    },
    assembly: {
      af: 1800, ak: 720, yieldQty: 3600, split: 6, shiftHours: 8,
      name: '⚙️ 自動化成型線',
      afDesc: '自動化成型線以 1,800 雙作為標準基準批量',
      akDesc: '自動線機台與操作員合計投入 720 分鐘（12 小時人時）'
    },
    as001_co: {
      af: 117, ak: 3900, yieldQty: 2500, split: 65, shiftHours: 8,
      name: '🔎 實戰：成型線 AS001 (117雙/3900分)',
      afDesc: '成型 1 線 (AS001) 每 1 小時標準產出 117 雙鞋',
      akDesc: '全線配置 65 名作業員同時做 1 小時（65人 × 60分 = 3,900 分鐘）'
    }
  };

  function updateCalculations() {
    const af = parseFloat(document.getElementById('calc-af')?.value || 1000);
    const ak = parseFloat(document.getElementById('calc-ak')?.value || 480);
    const yieldQty = parseFloat(document.getElementById('calc-yield')?.value || 2500);
    const split = parseFloat(document.getElementById('calc-split')?.value || 5);
    const shiftHours = parseFloat(document.getElementById('calc-shift-hours')?.value || 8);

    if (af <= 0 || ak <= 0 || yieldQty <= 0 || split <= 0 || shiftHours <= 0) return;

    // Check if current inputs match a preset & toggle active state on preset buttons
    let matchedKey = null;
    Object.keys(calcPresets).forEach(k => {
      const p = calcPresets[k];
      if (p.af === af && p.ak === ak && p.yieldQty === yieldQty && p.split === split && p.shiftHours === shiftHours) {
        matchedKey = k;
      }
    });

    const presetPillsContainer = document.getElementById('calc-preset-pills');
    if (presetPillsContainer) {
      presetPillsContainer.querySelectorAll('.preset-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === matchedKey);
      });
    }

    const activePresetObj = matchedKey ? calcPresets[matchedKey] : null;
    const scenarioLabel = activePresetObj ? activePresetObj.name : '🎛️ 自訂試算參數';

    // 1. 單雙標準工時 (分/雙)
    const cycleTimeMin = ak / af;
    const cycleTimeSec = cycleTimeMin * 60;
    const lineTaktSec = cycleTimeSec / split;

    // 2. 系統報工總工時 (分鐘 & 人時)
    const totalMinutes = cycleTimeMin * yieldQty;
    const totalHours = totalMinutes / 60;

    // 3. 產線實際排程耗時 (小時)
    const leadHours = totalHours / split;

    // 4. 排程天數 (工作天)
    const leadDays = leadHours / shiftHours;

    // 5. 每日產能極限 (雙/天)
    const dailyCapacity = (shiftHours * 60 * split) / cycleTimeMin;
    const co1000Minutes = cycleTimeMin * 1000;
    const co1000Hours = co1000Minutes / 60;

    // Update UI Elements
    const cycleEl = document.getElementById('kpi-cycle-time');
    const cycleSecEl = document.getElementById('kpi-cycle-sec');
    const totalMinEl = document.getElementById('kpi-total-minutes');
    const totalHrsEl = document.getElementById('kpi-total-hours');
    const leadHrsEl = document.getElementById('kpi-lead-hours');
    const leadSplitEl = document.getElementById('kpi-lead-split-desc');
    const leadDaysEl = document.getElementById('kpi-lead-days');
    const dailyCapEl = document.getElementById('kpi-daily-capacity');

    if (cycleEl) cycleEl.textContent = cycleTimeMin.toFixed(2);
    if (cycleSecEl) cycleSecEl.textContent = `約 ${cycleTimeSec.toFixed(1)} 秒 / 雙 (單人累計) ｜ 產線節拍約 ${lineTaktSec.toFixed(1)} 秒 / 雙`;
    if (totalMinEl) totalMinEl.textContent = Math.round(totalMinutes).toLocaleString();
    if (totalHrsEl) totalHrsEl.textContent = `累計 ${totalHours.toFixed(1)} 人工工時 (Man-hours)`;
    if (leadHrsEl) leadHrsEl.textContent = leadHours.toFixed(1);
    if (leadSplitEl) leadSplitEl.textContent = `已透過 ${split} 台機台/人員分割並行加速`;
    if (leadDaysEl) leadDaysEl.textContent = leadDays.toFixed(2);
    if (dailyCapEl) dailyCapEl.textContent = `每日極限產能：${Math.round(dailyCapacity).toLocaleString()} 雙 / 天`;

    // 6. 動態更新公式驗證卡片與 CO 千雙標準工時對照
    const formulaCardEl = document.getElementById('formula-card-content');
    if (formulaCardEl) {
      formulaCardEl.innerHTML = `
        <strong style="color: var(--primary);">📐 手冊標準計算公式即時驗證（${scenarioLabel}）：</strong><br>
        1. <strong>系統報工工時</strong> = (AK ÷ AF) × 報工量 = (${ak.toLocaleString()} ÷ ${af.toLocaleString()}) × ${yieldQty.toLocaleString()} = <strong>${Math.round(totalMinutes).toLocaleString()} 分鐘 (${totalHours.toFixed(1)} H)</strong><br>
        2. <strong>產線排程實際耗時</strong> = 總作業工時 ÷ 最大分割數 = ${totalHours.toFixed(1)} 小時 ÷ ${split} = <strong>${leadHours.toFixed(1)} 小時</strong><br>
        3. <strong>排程天數</strong> = ${leadHours.toFixed(1)} 小時 ÷ ${shiftHours} 小時/天 = <strong>${leadDays.toFixed(2)} 天</strong><br>
        4. <strong style="color: var(--amber);">CO 成本估算 (CK40N 批量 1,000 PR) 標準工時</strong> = (${ak.toLocaleString()} ÷ ${af.toLocaleString()}) × 1,000 ÷ 60 = <strong>${co1000Hours.toFixed(3)} H (小時)</strong>
      `;
    }

    // 7. 動態同步底部三大白話文備註區塊的所有數值
    const badgeEl = document.getElementById('note-active-preset-badge');
    if (badgeEl) badgeEl.textContent = `當前對照：${scenarioLabel}`;

    const coSummaryEl = document.getElementById('note-co-summary-steps');
    if (coSummaryEl) {
      coSummaryEl.innerHTML = `
        <strong>生管自檢 2 步驟（依目前上方【${scenarioLabel}】設定值即時帶入）</strong>：<br>
        &nbsp;&nbsp;1️⃣ 先看右下角<strong>「每日極限產能」</strong>：目前設定 <code>AF = <span class="dyn-num">${af.toLocaleString()} 雙</span></code>、<code>AK = <span class="dyn-num">${ak.toLocaleString()} 分鐘</span></code>、<code>分割數 = <span class="dyn-num">${split} 機台/人</span></code>、<code>每日 <span class="dyn-num">${shiftHours} 小時</span></code>，算出日產能為 <span class="dyn-num">${Math.round(dailyCapacity).toLocaleString()} 雙 / 天</span>，單雙累計人工 <code>${cycleTimeSec.toFixed(1)} 秒</code>（${split} 台/人並行後產線節拍約 <code>${lineTaktSec.toFixed(1)} 秒/雙</code>）。只要日產能符合現場實際產量，就代表<strong>生管途程工時 100% 正確！</strong><br>
        &nbsp;&nbsp;2️⃣ 再對照 CO 的 <code>CK11N / CK40N</code> 畫面：CO 預設以 <code>1,000 雙 (PR)</code> 估算成本，目前千雙總工時 = <code>(${ak.toLocaleString()} ÷ ${af.toLocaleString()}) × 1,000 = ${co1000Minutes.toFixed(1)} 分鐘 =</code> <span class="dyn-num">${co1000Hours.toFixed(3)} 小時 (H)</span>。若工時合理但成本金額過高，即代表 <strong>CO 在 <code>KP26</code> 將每小時工資率設得太高了</strong>！
      `;
    }

    const noteAfEl = document.getElementById('note-param-af');
    if (noteAfEl) {
      const afHint = activePresetObj ? `（${activePresetObj.afDesc}）` : '';
      noteAfEl.innerHTML = `
        <strong>計算工時的「基準產量（分母）」</strong>。<br>
        也就是拿「幾雙鞋」當作一個測量單位。目前設定為 <span class="dyn-num">${af.toLocaleString()} 雙</span>${afHint}，代表以產出 <span class="dyn-num">${af.toLocaleString()} 雙</span> 作為計算標準工時的分母基準。
      `;
    }

    const noteAkEl = document.getElementById('note-param-ak');
    if (noteAkEl) {
      const akHint = activePresetObj ? `（${activePresetObj.akDesc}）` : '';
      noteAkEl.innerHTML = `
        <strong>做出上面那批「基礎數量」所需投入的「總人時分鐘數（分子）」</strong>。<br>
        目前設定：為了做出上方 <span class="dyn-num">${af.toLocaleString()} 雙</span> 基礎數量，全線加起來共需投入 <span class="dyn-num">${ak.toLocaleString()} 分鐘</span>（約 <span class="dyn-num">${(ak / 60).toFixed(1)} 小時人時</span>）的直接人工${akHint}。
      `;
    }

    const noteYieldEl = document.getElementById('note-param-yield');
    if (noteYieldEl) {
      noteYieldEl.innerHTML = `
        <strong>這張工單總共要做幾雙鞋？</strong><br>
        • 目前試算工單雙數為 <span class="dyn-num">${yieldQty.toLocaleString()} 雙</span>（總報工工時為 <span class="dyn-num">${Math.round(totalMinutes).toLocaleString()} 分鐘 / ${totalHours.toFixed(1)} H</span>）。<br>
        • <strong>與 CO 對帳時</strong>：請看千雙批量（<code>1,000 雙</code> 標準工時為 <span class="dyn-num">${co1000Hours.toFixed(3)} H</span>）。
      `;
    }

    const noteSplitEl = document.getElementById('note-param-split');
    if (noteSplitEl) {
      noteSplitEl.innerHTML = `
        <strong>現場同時有「幾個人（或幾台機台）」並排一起做這道工序？</strong><br>
        目前設定現場有 <span class="dyn-num">${split} 機台/人</span> 同時並行作業，系統算排程時會把總人工 <span class="dyn-num">${totalHours.toFixed(1)} 小時</span> 除以 <span class="dyn-num">${split}</span>，縮短為 <span class="dyn-num">${leadHours.toFixed(1)} 小時</span>。
      `;
    }

    const noteSplitLowEl = document.getElementById('note-param-split-low');
    if (noteSplitLowEl) {
      noteSplitLowEl.innerHTML = `
        同時做的人/機台越少：<br>
        • <strong>產線排程天數 大幅拉長 👆</strong>（若漏填變 <code>1</code>，系統會以為只有 1 個人從頭做到尾，排程耗時會暴增 <span class="dyn-num">${split} 倍</span> 變成 <span class="dyn-num">${totalHours.toFixed(1)} 小時</span>！）<br>
        • ⚠️ <strong style="color: var(--amber);">完全不影響 CO 成本！</strong>
      `;
    }

    const noteShiftEl = document.getElementById('note-param-shift');
    if (noteShiftEl) {
      noteShiftEl.innerHTML = `
        <strong>這條產線一天開工幾個小時？</strong><br>
        目前設定為每天開工 <span class="dyn-num">${shiftHours} 小時/天</span>，將產線排程耗時 <span class="dyn-num">${leadHours.toFixed(1)} 小時</span> 除以 <span class="dyn-num">${shiftHours} 小時</span>，即可換算為 <span class="dyn-num">${leadDays.toFixed(2)} 個工作天</span>。
      `;
    }

    const kpi1El = document.getElementById('note-kpi-1');
    if (kpi1El) {
      kpi1El.innerHTML = `
        • <strong>白話文</strong>：平均做完 <strong>1 雙鞋</strong>，需要累積花費多少個人的分鐘數（單雙總人時）。<br>
        • <strong>當前數值對照</strong>：<code>${ak.toLocaleString()}分 ÷ ${af.toLocaleString()}雙 =</code> <span class="dyn-num">${cycleTimeMin.toFixed(2)} 分鐘/雙</span>（單人累計約 <span class="dyn-num">${cycleTimeSec.toFixed(1)} 秒</span>；由 <span class="dyn-num">${split}</span> 機台/人分攤，產線每 <span class="dyn-num">${lineTaktSec.toFixed(1)} 秒</span> 產出一雙鞋）。若算出來變成幾百分鐘，代表 <code>AF</code> 或 <code>AK</code> 填錯了！
      `;
    }

    const kpi2El = document.getElementById('note-kpi-2');
    if (kpi2El) {
      kpi2El.innerHTML = `
        • <strong>白話文</strong>：這批鞋子做完報工時，SAP 系統<strong>真正認列入帳的「總人工工時 (Man-hours)」</strong>。<br>
        • <strong>當前數值對照</strong>：生產 <span class="dyn-num">${yieldQty.toLocaleString()} 雙</span> 時，系統報工總工時為 <span class="dyn-num">${Math.round(totalMinutes).toLocaleString()} 分鐘</span>（累計 <span class="dyn-num">${totalHours.toFixed(1)} H</span>）；若以 CO <code>CK40N</code> 預設 <code>1,000 雙</code> 計算則為 <span class="dyn-num">${co1000Hours.toFixed(3)} H</span>，CO 就是拿這個小時數去乘以每小時工資率算出總工費！
      `;
    }

    const kpi3El = document.getElementById('note-kpi-3');
    if (kpi3El) {
      kpi3El.innerHTML = `
        • <strong>白話文</strong>：考慮到現場有多人同時並排做，<strong>這條產線實際需要「開線運轉幾個小時（看手錶的時間）」</strong>才能做完這張單。<br>
        • <strong>當前數值對照</strong>：<span class="dyn-num">${yieldQty.toLocaleString()} 雙</span> 雖然總共要花 <span class="dyn-num">${totalHours.toFixed(1)} 個人工小時</span>，但因為現場有 <span class="dyn-num">${split} 機台/人</span> 同時做，所以產線實際只要開機 <code>${totalHours.toFixed(1)} ÷ ${split} =</code> <span class="dyn-num">${leadHours.toFixed(1)} 小時</span> 就全部做完了！
      `;
    }

    const kpi4El = document.getElementById('note-kpi-4');
    if (kpi4El) {
      kpi4El.innerHTML = `
        • <strong>白話文</strong>：這張工單要排程<strong>「幾個工作天」</strong>才能完工，以及這條線<strong>「一天最多能做幾雙鞋」</strong>。<br>
        • <strong>當前數值對照</strong>：<code>${leadHours.toFixed(1)} 小時 ÷ 每天 ${shiftHours} 小時 =</code> <span class="dyn-num">${leadDays.toFixed(2)} 個工作天</span>，且卡片下方算出<strong>「每日極限產能：<span class="dyn-num">${Math.round(dailyCapacity).toLocaleString()} 雙 / 天</span>」</strong>！問現場組長：「這條線一天是不是做 <span class="dyn-num">${Math.round(dailyCapacity).toLocaleString()}</span> 雙左右？」如果是，這條途程就 100% 設對了！
      `;
    }
  }

  window.loadCalcPreset = function (presetKey) {
    const p = calcPresets[presetKey];
    if (!p) return;

    document.getElementById('calc-af').value = p.af;
    document.getElementById('slider-af').value = p.af;
    document.getElementById('calc-ak').value = p.ak;
    document.getElementById('slider-ak').value = p.ak;
    document.getElementById('calc-yield').value = p.yieldQty;
    document.getElementById('slider-yield').value = p.yieldQty;
    document.getElementById('calc-split').value = p.split;
    document.getElementById('slider-split').value = p.split;
    document.getElementById('calc-shift-hours').value = p.shiftHours;
    document.getElementById('slider-shift-hours').value = p.shiftHours;

    updateCalculations();
    showToast(`已載入範本：${p.name}`);
  };

  // --- Order Type Recommender Logic ---
  const recommenderScenarios = [
    {
      id: "dev_sample",
      icon: "🧪",
      title: "開發樣試做 (不一定有料號)",
      desc: "由開發部備料，純研發試做鞋型，不對接正式量產訂單。",
      type: "NA (不開立工單)",
      tcode: "NA (線下處理)",
      pick: "NA (線下領料)",
      cost: "研發試驗專案費用",
      dispatch: "🔴 X", confirm: "🔴 X", upload: "🔴 X", gr: "🔴 X",
      cautions: "研發樣品嚴禁開立量產工單，避免佔用工廠正式料帳與排程！"
    },
    {
      id: "dev_sales",
      icon: "🏷️",
      title: "開發階段銷樣 (有料號，但 BOM/途程不完整需出貨)",
      desc: "業務需出貨給客戶看樣，但各階 BOM 與生產版本尚未量產化完整。",
      type: "NA (走借項訂單 ZD01)",
      tcode: "VA01 (訂單類型 ZD01)",
      pick: "NA (不開領料單)",
      cost: "樣品銷售成本",
      dispatch: "🔴 X", confirm: "🔴 X", upload: "🔴 X", gr: "🔴 X",
      cautions: "主檔未完整時切勿強開 ZP02，業務應透過 SD 借項訂單 ZD01 辦理出貨出庫。"
    },
    {
      id: "zp01_trial",
      icon: "👟",
      title: "量產主檔已維護，沒有客戶訂單 (試量產/技轉)",
      desc: "大貨前試產投產，產成品由現場技轉保留或研發部保留展示。",
      type: "ZP01 (試量生產工單)",
      tcode: "CO01 / FSH_PCW",
      pick: "正單 (ZP01 / ZP02)",
      cost: "試產專案成本 (SIT-609)",
      dispatch: "🔴 X (不派工)", confirm: "🟢 V (SAP手動報工)", upload: "🔴 X", gr: "🟢 V (101成品入庫)",
      cautions: "無正式 SO 派工需求，MES 輪次不派工，由生管在 SAP 手動報工，完工後 101 入庫保留。"
    },
    {
      id: "zp02_mass",
      icon: "🏭",
      title: "正式客戶訂單大貨量產 / 首單試做 (依訂單出貨)",
      desc: "客戶正式下單 (MTO / MTS)，大貨生產，全流程自動貫通。",
      type: "ZP02 (量產工單)",
      tcode: "FSH_PCW / ZPP015",
      pick: "正單 (ZP01 / ZP02)",
      cost: "庫存產成品 / 銷貨成本",
      dispatch: "🟢 V (MES輪次派工)", confirm: "🟢 V (SAP報工)", upload: "🟢 V (產量上傳MES)", gr: "🟢 V (101入庫)",
      cautions: "主力工單！必填利潤中心，末站 PP03 自動 101 入庫。"
    },
    {
      id: "zp03_scrap",
      icon: "🧩",
      title: "正單未完成（未入庫）個別超耗/瑕疵補料",
      desc: "現場加工損耗、人為不良，正單仍在線邊加工，尚未完工入庫。",
      type: "ZP03 (超耗單補料工單)",
      tcode: "ZPP022",
      pick: "補料工單 (ZP03 / ZP05)",
      cost: "獨立超耗成本歸集",
      dispatch: "🔴 X (不派工)", confirm: "🔴 X (不報工)", upload: "🔴 X", gr: "🔴 X (不入庫)",
      cautions: "⚠️ 關鍵鐵律：正單未入庫前的個別補料！不走 MES 報工與入庫，純開領料單補料回線邊。"
    },
    {
      id: "zp04_pack",
      icon: "📦",
      title: "成品鞋 VAS 客製化加值包裝 / 外包材 (不展BOM)",
      desc: "依訂單國別決定之外箱、鞋撐、吊牌、乾燥劑加值包裝。",
      type: "ZP04 (包裝工單)",
      tcode: "CO07",
      pick: "包裝工單 (ZP04)",
      cost: "銷貨成本-重工 G/L 51110099",
      dispatch: "🔴 X", confirm: "🔴 X", upload: "🔴 X", gr: "🔴 X",
      cautions: "外包材不展階、不進 MES、不入庫，直接領料扣帳結轉 51110099。"
    },
    {
      id: "zp05_remake",
      icon: "🔄",
      title: "正單已完成入庫後之 B/C 品成套補料重做",
      desc: "正單已整批入庫結案，檢驗發現瑕疵需整雙成套重做投產。",
      type: "ZP05 (成套補料工單)",
      tcode: "ZPP022",
      pick: "補料工單 (ZP03 / ZP05)",
      cost: "自動帶結算規則",
      dispatch: "🟢 V (MES派工)", confirm: "🟢 V (SAP報工)", upload: "🟢 V (上傳MES)", gr: "🟢 V (101入庫)",
      cautions: "⚠️ 與 ZP03 截然不同：入庫結案後整套重做，必須完整走 MES 派工、報工與入庫流程！"
    },
    {
      id: "zp06_oem_out",
      icon: "🤝",
      title: "全製程委外代工 (委託廠追蹤工單)",
      desc: "委託集團外協代工廠生產，本廠開立之追蹤單據。",
      type: "ZP06 (全代工工單)",
      tcode: "ZPP015 / CO08",
      pick: "委託廠代工領料單",
      cost: "外協代工費用",
      dispatch: "同品牌受託廠", confirm: "🔴 X (本廠不報工)", upload: "不對接", gr: "🟢 V (驗收入庫)",
      cautions: "追蹤外發材料耗用與成品驗收入庫，受託廠現場不對接本廠 SAP 報工。"
    },
    {
      id: "zp07_oem_in",
      icon: "⚙️",
      title: "製程代工 (本廠承接集團其他廠區委託加工)",
      desc: "作為受託方加工特定工序（受託廠不需要完整成品 BOM/途程）。",
      type: "ZP07 (製程代工工單)",
      tcode: "CO07",
      pick: "受託廠領料單",
      cost: "銷貨成本-加工 51110002",
      dispatch: "🔴 X", confirm: "🟢 V (SAP報工)", upload: "🔴 X", gr: "🔴 X",
      cautions: "受託廠不需成品 BOM/途程，結算至加工 51110002，純在 SAP 報工。"
    }
  ];

  function renderRecommender() {
    const gridEl = document.getElementById('recommender-scenarios');
    if (!gridEl) return;

    gridEl.innerHTML = recommenderScenarios.map((sc, idx) => `
      <div class="scenario-card ${idx === 3 ? 'active' : ''}" onclick="selectRecommenderScenario('${sc.id}')" id="sc-${sc.id}">
        <div>
          <div style="font-size: 1.5rem; margin-bottom: 0.35rem;">${sc.icon}</div>
          <strong style="font-size: 0.95rem; color: var(--text-main); display: block; margin-bottom: 0.3rem;">${sc.title}</strong>
          <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45;">${sc.desc}</p>
        </div>
        <div style="margin-top: 0.75rem;">
          <span class="badge-tag badge-cyan">${sc.type.split(' ')[0]}</span>
        </div>
      </div>
    `).join('');

    // Select default mass production (zp02_mass)
    selectRecommenderScenario('zp02_mass');
  }

  window.selectRecommenderScenario = function (scId) {
    const sc = recommenderScenarios.find(s => s.id === scId);
    if (!sc) return;

    document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));
    const chosenCard = document.getElementById(`sc-${scId}`);
    if (chosenCard) chosenCard.classList.add('active');

    const resultEl = document.getElementById('recommender-result');
    if (!resultEl) return;

    resultEl.innerHTML = `
      <div class="rec-result-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span class="badge-tag badge-cyan">情境判定結果</span>
            <h3 style="font-size: 1.3rem; font-weight: 700; color: var(--primary); margin-top: 0.25rem;">
              推薦採用工單：${sc.type}
            </h3>
          </div>
          <div>
            ${sc.tcode !== 'NA' ? `<button class="tcode-chip" onclick="copyTCode('${sc.tcode}', event)">開單 T-Code：${sc.tcode} 📋</button>` : ''}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
          <div style="background: rgba(0,0,0,0.2); padding: 0.75rem 1rem; border-radius: 8px;">
            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">領料單類別 (ZPP020)</span>
            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main); margin-top: 0.2rem;">${sc.pick}</div>
          </div>
          <div style="background: rgba(0,0,0,0.2); padding: 0.75rem 1rem; border-radius: 8px;">
            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">成本歸集與結算</span>
            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main); margin-top: 0.2rem;">${sc.cost}</div>
          </div>
          <div style="background: rgba(0,0,0,0.2); padding: 0.75rem 1rem; border-radius: 8px;">
            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">MES 輪次派工</span>
            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main); margin-top: 0.2rem;">${sc.dispatch}</div>
          </div>
          <div style="background: rgba(0,0,0,0.2); padding: 0.75rem 1rem; border-radius: 8px;">
            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">SAP 報工 / 入庫</span>
            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main); margin-top: 0.2rem;">報工: ${sc.confirm} | 入庫: ${sc.gr}</div>
          </div>
        </div>

        <div style="background: var(--amber-bg); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 0.85rem 1.15rem; font-size: 0.88rem; color: #fde68a; line-height: 1.55;">
          <strong>⚠️ 關鍵防呆與大雷警示：</strong><br>
          ${sc.cautions}
        </div>
      </div>
    `;
  };

  // --- Routing Pipeline Simulator Logic ---
  let pipelineStations = [
    { op: "10", name: "裁斷工段 (Cutting)", key: "PP01" },
    { op: "20", name: "針車鞋面工段 (Stitching)", key: "PP01" },
    { op: "30", name: "委外貼合工段 (Subcontract)", key: "PP02" },
    { op: "40", name: "成型組裝 (Assembly)", key: "PP05" },
    { op: "50", name: "成品檢驗包裝 (Packing)", key: "PP03" }
  ];

  function renderRoutingPipeline() {
    const container = document.getElementById('pipeline-stations');
    if (!container) return;

    const controlKeyOptions = knowledge.control_keys.map(k =>
      `<option value="${k.key}">${k.key} (${k.type.split(' ')[0]} / ${k.auto_gr.includes('自動') ? '自動入庫' : '手動/不可入庫'})</option>`
    ).join('');

    container.innerHTML = pipelineStations.map((st, idx) => {
      const isLast = idx === pipelineStations.length - 1;
      const keyInfo = knowledge.control_keys.find(k => k.key === st.key) || {};
      const isAutoGR = keyInfo.auto_gr && keyInfo.auto_gr.includes('自動');
      const isSubcontract = keyInfo.external && keyInfo.external.includes('+');
      const isMilestone = keyInfo.confirm && keyInfo.confirm.includes('里程碑');

      return `
        <div class="pipeline-station-card">
          <div class="pipeline-station-header">
            <span class="station-op-badge">Op ${st.op}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${isLast ? '🏁 最後一站' : `站點 ${idx + 1}`}</span>
          </div>

          <div class="station-title">${st.name}</div>

          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">控制碼 (Control Key)</label>
            <select class="station-select" onchange="updateStationControlKey(${idx}, this.value)">
              ${knowledge.control_keys.map(k => `
                <option value="${k.key}" ${k.key === st.key ? 'selected' : ''}>${k.key} - ${k.type}</option>
              `).join('')}
            </select>
          </div>

          <div class="station-behavior-tags">
            ${isAutoGR ? '<span class="behavior-tag behavior-auto-gr">✔ 報工自動 101 入庫</span>' : '<span class="behavior-tag behavior-manual">需手動入庫或不入庫</span>'}
            ${isSubcontract ? '<span class="behavior-tag behavior-subcontract">🔄 釋放自動開 PR (委外)</span>' : '<span class="behavior-tag behavior-manual">廠內自製站點</span>'}
            ${isMilestone ? '<span class="behavior-tag behavior-milestone">⚡ 里程碑連帶補報工</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    validatePipeline();
  }

  window.updateStationControlKey = function (idx, newKey) {
    if (pipelineStations[idx]) {
      pipelineStations[idx].key = newKey;
      renderRoutingPipeline();
      showToast(`已將 Op ${pipelineStations[idx].op} 控制碼設為 ${newKey}`);
    }
  };

  window.resetRoutingPipeline = function () {
    pipelineStations = [
      { op: "10", name: "裁斷工段 (Cutting)", key: "PP01" },
      { op: "20", name: "針車鞋面工段 (Stitching)", key: "PP01" },
      { op: "30", name: "委外貼合工段 (Subcontract)", key: "PP02" },
      { op: "40", name: "成型組裝 (Assembly)", key: "PP05" },
      { op: "50", name: "成品檢驗包裝 (Packing)", key: "PP03" }
    ];
    renderRoutingPipeline();
    showToast("已重置為標準 5 站產線途程配置");
  };

  function validatePipeline() {
    const alertContainer = document.getElementById('pipeline-validation-container');
    if (!alertContainer) return;

    const errors = [];
    const info = [];

    // Check Auto-GR rules
    const autoGRStations = [];
    pipelineStations.forEach((st, idx) => {
      const keyInfo = knowledge.control_keys.find(k => k.key === st.key);
      if (keyInfo && keyInfo.auto_gr && keyInfo.auto_gr.includes('自動')) {
        autoGRStations.push({ ...st, index: idx });
      }
    });

    const lastIdx = pipelineStations.length - 1;

    // Rule 1: Multi auto-GR check
    if (autoGRStations.length > 1) {
      errors.push(`💥 嚴重違規：整張途程只能放【一次】自動入庫控制碼！目前檢測到 ${autoGRStations.length} 站具備自動入庫 (${autoGRStations.map(s => `Op ${s.op}[${s.key}]`).join(', ')})，將導致背景入庫完全失效或重複扣帳！`);
    }

    // Rule 2: Auto-GR not on last operation
    autoGRStations.forEach(st => {
      if (st.index !== lastIdx) {
        errors.push(`💥 嚴重違規：自動入庫控制碼 (${st.key}) 放在了非末站 (Op ${st.op})！鐵律規定整張工單只能放一次且【必須在最後一站】，否則半成品將過早入庫！`);
      }
    });

    // Rule 3: Subcontract stations
    const subStations = pipelineStations.filter(st => {
      const keyInfo = knowledge.control_keys.find(k => k.key === st.key);
      return keyInfo && keyInfo.external && keyInfo.external.includes('+');
    });

    if (subStations.length > 0) {
      info.push(`ℹ️ 委外外發站點：${subStations.map(s => `Op ${s.op}[${s.key}]`).join(', ')}。工單下發釋放 (REL) 時，系統將【自動開立採購申請 (PR)】，廠商收貨時透過 MIGO 101 過帳完工。`);
    }

    // Rule 4: Milestone stations
    const milestoneStations = pipelineStations.filter(st => {
      const keyInfo = knowledge.control_keys.find(k => k.key === st.key);
      return keyInfo && keyInfo.confirm && keyInfo.confirm.includes('里程碑');
    });

    if (milestoneStations.length > 0) {
      info.push(`⚡ 里程碑報工：${milestoneStations.map(s => `Op ${s.op}[${s.key}]`).join(', ')}。報工該站時，系統自動連帶完成前面所有尚未報工的自製工序！`);
    }

    if (errors.length > 0) {
      alertContainer.innerHTML = `
        <div class="pipeline-alert alert-error">
          <div style="font-size: 1.4rem;">🚨</div>
          <div>
            <strong>途程防呆檢測未通過 (違規阻擋)：</strong><br>
            ${errors.join('<br>')}
          </div>
        </div>
      `;
    } else {
      alertContainer.innerHTML = `
        <div class="pipeline-alert alert-success">
          <div style="font-size: 1.4rem;">✅</div>
          <div>
            <strong>途程防呆檢測全數通過！</strong> 符合集團標準途程配置規範 (自動入庫放置末站、無重複衝突)。<br>
            ${info.join('<br>')}
          </div>
        </div>
      `;
    }
  }

  // ==========================================================================
  // Module 8: TSK-06 Return & ECN Component Change Sandbox Engine
  // ==========================================================================
  let currentSimState = 'STATE_ISSUED';

  window.setSimState = function (stateKey) {
    currentSimState = stateKey;
    document.querySelectorAll('.state-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.state === stateKey);
    });

    const stateNames = {
      STATE_ISSUED: '已實體領料扣帳 (RESB-ENMNG > 0)',
      STATE_NOT_ISSUED: '尚未發料 (RESB-ENMNG = 0)',
      STATE_LOCKED_ZMMT046: '倉庫備料單處理中 (ZMMT046 狀態 I/M)',
      STATE_TECO: '工單已技術完成 (TECO 結案)',
      STATE_PHANTOM: '虛擬階材料 (SOBSL=50 貼合餘料)'
    };

    showToast(`工單狀態已切換為：${stateNames[stateKey]}`);
    simulateAction('ACTION_STATE_INSPECT');
  };

  window.simulateAction = function (actionKey) {
    const screenBody = document.getElementById('sim-screen-body');
    const simTimestamp = document.getElementById('sim-timestamp');
    const simRaciFooter = document.getElementById('sim-raci-footer');
    if (!screenBody) return;

    // Dynamically highlight clicked action button in Step 2
    const e005Box = document.getElementById('sandbox-e005-container');
    if (e005Box) {
      e005Box.querySelectorAll('.actions-buttons-grid .sim-action-btn').forEach(btn => {
        const matches = btn.getAttribute('onclick')?.includes(actionKey);
        btn.classList.toggle('active', !!matches);
      });
    }

    if (simTimestamp) {
      const now = new Date();
      simTimestamp.textContent = `TCODE RUN: ${now.toLocaleTimeString()}`;
    }

    let statusType = 'msg-error';
    let statusText = '';
    let explanationHtml = '';
    let raciOwner = 'PP 生管 + MM 倉管';

    if (actionKey === 'ACTION_STATE_INSPECT') {
      if (currentSimState === 'STATE_ISSUED') {
        statusType = 'msg-warning';
        statusText = '[W] 狀態警示：該元件在 Table RESB 中領料數量 > 0，處於已發料鎖定模式！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            <strong>📋 當前工單實體現狀：</strong><br>
            • 元件實發扣帳已產生（異動類型 261 已過帳）。<br>
            • 此時若欲更換元件或刪除，系統會強制跳出 <code>E005</code> 阻擋。<br>
            • 請點擊下方動作按鈕（如動作 B 或動作 E）檢視系統反應與解鎖路徑。
          </div>
        `;
      } else if (currentSimState === 'STATE_NOT_ISSUED') {
        statusType = 'msg-success';
        statusText = '[S] 狀態良好：工單尚未實體發料扣帳 (RESB-ENMNG = 0)。';
        explanationHtml = `
          <div class="sim-solution-timeline">
            <strong>📋 當前工單實體現狀：</strong><br>
            • 倉庫尚未過帳發料，元件預留額度尚未扣減。<br>
            • 生管可直接透過專用改單程式 <code>ZPP010</code> 抽換料件，或在 <code>ZPP020</code> 依訂單作廢領料單。
          </div>
        `;
      } else if (currentSimState === 'STATE_LOCKED_ZMMT046') {
        statusType = 'msg-error';
        statusText = '[E] 鎖定中：Table ZMMT046 備料單旗標處於待處理 (I) 或處理中 (M)！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            <strong>📋 當前工單實體現狀：</strong><br>
            • 倉庫人員已於 ZMM046 掃描產生備料單 (記錄於 Table ZMMT046)，正在揀料中。<br>
            • 系統啟動嚴格併發保護鎖，生管畫面全面凍結刪單權限，防止線上揀錯料。
          </div>
        `;
        raciOwner = 'MM 倉庫人員 (解鎖責任方)';
      } else if (currentSimState === 'STATE_TECO') {
        statusType = 'msg-error';
        statusText = '[E] 結案凍結：工單狀態為 TECO (技術完成)，物料預留單已全數結案關閉！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            <strong>📋 當前工單實體現狀：</strong><br>
            • 工單已打上 TECO，不再參與 MRP 展開與一般發料。<br>
            • 任何線上修改或補料，必須透過 <code>ZPP022</code> 開立 <code>ZP03</code> 補料工單，不得直接修改原單。
          </div>
        `;
      } else if (currentSimState === 'STATE_PHANTOM') {
        statusType = 'msg-warning';
        statusText = '[W] 虛擬階材料 (SOBSL=50)：系統中無實體庫存帳 (走現場手工帳)！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            <strong>📋 當前工單實體現狀 (Task #62286)：</strong><br>
            • 虛擬階材料 (如 RD 貼合材料) 不獨立開立工單，MRP 穿透至底層料。<br>
            • 日常作業剩餘材料應留線邊後續耗用，<strong>日常不需要 by 指令退料</strong>！<br>
            • 若訂單取消或年度盤點，必須走「成本中心退料」，無法走標準 262 退料。
          </div>
        `;
      }
    } else if (actionKey === 'ACTION_CO02_CHANGE') {
      statusType = 'msg-error';
      statusText = '💥 致命大忌：切勿在 CO02 手動修改元件！(首投製程脫鉤)';
      explanationHtml = `
        <div class="sim-solution-timeline" style="border-left: 3px solid var(--rose);">
          <strong style="color: #fda4af;">🚨 違規後果深度剖析：</strong><br>
          • <code>CO02</code> 手動修改之元件<strong>無法與 BOM 建立關聯</strong>，系統無法寫入 <code>STPO-ZZFIRST</code>（首投製程代碼）。<br>
          • 後續生管在 <code>ZPP020</code> 依成型日開領料單時，<strong>完全無法帶出首投製程，導致拆單程式癱瘓</strong>，現場無法分批發料！<br><br>
          <strong style="color: var(--primary);">✔ 正確處置 SOP：</strong><br>
          1. 立即進入 <code>CO02</code> 將手動元件打上刪除標記。<br>
          2. 改用集團專用程式 <strong><code>ZPP010</code> (ECN調整工單)</strong> 進行調整，系統將自動匹配部位代碼並帶出首投製程！
        </div>
      `;
      raciOwner = 'PP 生管人員';
    } else if (actionKey === 'ACTION_DELETE_ELEMENT') {
      if (currentSimState === 'STATE_NOT_ISSUED') {
        statusType = 'msg-success';
        statusText = '✅ 允許刪除：實領數 RESB-ENMNG = 0，未發料狀態允許抽換元件。';
        explanationHtml = `
          <div class="sim-solution-timeline">
            <strong>處置指引：</strong> 請直接使用專用程式 <strong><code>ZPP010</code></strong> 輸入工單號進行元件刪除或替代料抽換，存檔後系統將自動釋放預留額度。
          </div>
        `;
      } else if (currentSimState === 'STATE_ISSUED') {
        statusType = 'msg-error';
        statusText = '🛑 E005 阻擋：已領料不可刪除元件 (RESB-ENMNG > 0 硬阻擋)！';
        explanationHtml = `
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--rose);">
            <strong>💥 錯誤代碼：E005</strong><br>
            • <strong>底層原因：</strong> 該料件在工單已有實發數量 (<code>RESB-ENMNG > 0</code>)，SAP 啟動硬保護，嚴禁直接刪除，防止帳面已領扣帳與庫存實物脫節！<br><br>
            <strong>⚡ 第一線秒級解鎖 3 步閉環：</strong><br>
            1. 生管至 <strong><code>ZPP024</code></strong> (退料單維護)，選擇原工單與原首投製程開立退料單。<br>
            2. 倉管至 <strong><code>ZMM047</code></strong> (MM退料單過帳)，點收實物執行 <strong>Mvt 262 工單發料沖銷</strong>，直至 <code>RESB-ENMNG = 0</code>。<br>
            3. 實領數歸零後，生管回 <strong><code>ZPP010</code></strong>，系統自動解除 E005 鎖定，允許正常刪除或替換！
          </div>
        `;
        raciOwner = 'PP 生管 (開退料單) ➔ MM 倉管 (過帳262)';
      } else if (currentSimState === 'STATE_LOCKED_ZMMT046') {
        statusType = 'msg-error';
        statusText = '🛑 阻擋：倉庫備料單處理中，工單架構被 Table ZMMT046 鎖定！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            倉庫人員正在檢貨揀料中，禁止變更工單元件！必須先由倉庫在 <code>ZMM046</code> 取消備料單復原狀態。
          </div>
        `;
      } else if (currentSimState === 'STATE_TECO') {
        statusType = 'msg-error';
        statusText = '🛑 E010 阻擋：工單已技術完成 (TECO)，禁止刪除或變更元件！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            工單已結案。若需補料請開立 <code>ZP03</code> (<code>ZPP022</code>)；若當月未關帳需更正，請在 <code>CO02</code> 撤銷 TECO 狀態。
          </div>
        `;
      } else if (currentSimState === 'STATE_PHANTOM') {
        statusType = 'msg-error';
        statusText = '🛑 E008 阻擋：虛擬階料件不可在工單層級刪除！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            虛擬階材料必須在 BOM (<code>CS02</code>) 層級進行 ECN 變更，工單層級無實體預留行可供刪除。
          </div>
        `;
      }
    } else if (actionKey === 'ACTION_DELETE_ZPP020') {
      if (currentSimState === 'STATE_LOCKED_ZMMT046') {
        statusType = 'msg-error';
        statusText = '🛑 領料單無法刪除：ZMMT046 狀態為 I (待處理) 或 M (處理中)！';
        explanationHtml = `
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--amber);">
            <strong>💥 第一線最常求救故障：</strong><br>
            • 倉庫人員已在 <code>ZMM046</code> 產生備料單並調撥至待發料倉，系統嚴格禁止生管在 <code>ZPP020</code> 刪單！<br><br>
            <strong>⚡ 標準解鎖 SOP：</strong><br>
            1. 生管聯絡倉庫人員。<br>
            2. 倉管進入 <code>ZMM046</code> 找到該筆備料單，點擊「取消備料單」將 <code>ZMMT046-ZZSTATUS</code> 復原。<br>
            3. 倉庫復原後，生管至 <code>ZPP020</code> 依<strong>【銷售訂單號】整張查詢並作廢</strong>！（⚠️ 嚴禁依單一工單勾選刪除，避免項次殘留！）
          </div>
        `;
        raciOwner = 'MM 倉管 ➔ PP 生管';
      } else if (currentSimState === 'STATE_ISSUED') {
        statusType = 'msg-warning';
        statusText = '⚠️ 警告：工單已實體發料扣帳，嚴禁隨意作廢領料單！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            現場已依該單據領料出庫，若刪除領料單會造成實物在產線流動卻無領料單據溯源。若需退料請走 <code>ZPP024</code> 退料程序。
          </div>
        `;
      } else {
        statusType = 'msg-success';
        statusText = '✅ 領料單作廢成功！(已落實依銷售訂單整張刪除防呆)';
        explanationHtml = `
          <div class="sim-solution-timeline">
            生管依銷售訂單號整張作廢刪除領料單，後台無項次殘留，允許重新依新成型日開立領料單。
          </div>
        `;
      }
    } else if (actionKey === 'ACTION_MIXED_RETURN') {
      statusType = 'msg-error';
      statusText = '💥 財務月結大雷：嚴禁未指定工單的彙總混退料！';
      explanationHtml = `
        <div class="sim-solution-timeline" style="border-left: 3px solid var(--rose);">
          <strong style="color: #fda4af;">🚨 嚴重後果警示：</strong><br>
          • 跨工單或跨製程彙總混退料，系統會自動按比例攤提沖銷，產生小數點尾差！<br>
          • 到了每月 25 號財務月結計算生產差異 (<code>KKS2</code>) 與工單結算 (<code>CO88</code>) 時，將產生龐大「重工借貸尾差」，導致工單無法關閉、財務無法關帳！<br><br>
          <strong>✔ 鐵律規則：</strong> 退料必須嚴格依照【原發料工單號】與【原首投製程】在 <code>ZPP024</code> 開立退料單！
        </div>
      `;
      raciOwner = 'PP 生管 + CO 成本會計';
    } else if (actionKey === 'ACTION_STANDARD_CLOSED_LOOP') {
      statusType = 'msg-success';
      statusText = '🎉 綠燈貫通！標準現場退料 ➔ 元件抽換 ECN 閉環流程成功！';
      explanationHtml = `
        <div class="sim-solution-timeline" style="border-left: 3px solid var(--emerald);">
          <strong style="color: #a7f3d0; font-size: 0.95rem;">🏆 標準三步閉環執行軌跡：</strong><br><br>
          <strong>步驟 1：生管開退料單 (ZPP024)</strong><br>
          生管進入 <code>ZPP024</code>，精確輸入原工單號、原首投製程與料號數量，列印實體退料單交由倉庫點收。<br><br>
          <strong>步驟 2：倉庫點收過帳 (ZMM047)</strong><br>
          倉管人員進入 <code>ZMM047</code> 掃描退料單，背景呼叫 BAPI 執行 <strong>異動類型 262 (工單發料沖銷)</strong>。實物庫存即時回沖原料儲位，工單實領數 <code>RESB-ENMNG</code> 沖銷歸零！<br><br>
          <strong>步驟 3：專用程式改單 (ZPP010)</strong><br>
          實領數歸零後，<code>E005</code> 硬阻擋自動解除！生管進入專用程式 <strong><code>ZPP010</code></strong>，輸入 ECN 號碼抽換新材料，系統自動維護 BOM 關聯並精確繼承首投製程！<br><br>
          <span style="color: var(--primary);">✔ 完美防呆：無孤兒預留、無尾差殘留、領料單拆單 100% 正常！</span>
        </div>
      `;
      raciOwner = 'PP 生管 ➔ MM 倉管 ➔ PP 生管 (全閉環)';
    }

    screenBody.innerHTML = `
      <div class="sim-sap-msg-bar ${statusType}">
        <span>${statusType.includes('error') ? '🛑' : statusType.includes('warning') ? '⚠️' : '✅'}</span>
        <span>${statusText}</span>
      </div>
      ${explanationHtml}
    `;

    if (simRaciFooter) simRaciFooter.textContent = `責任單位：${raciOwner}`;
  };

  // ==========================================================================
  // Module 2-B: Subcontracting PP02 / 541 / 543 Interactive Sandbox (TSK-M3-02)
  // ==========================================================================
  let currentSubSimState = 'SUB_STATE_HEALTHY';

  window.setSubSimState = function (stateKey) {
    currentSubSimState = stateKey;
    const container = document.getElementById('sandbox-subcontract-container');
    if (container) {
      container.querySelectorAll('.state-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subState === stateKey);
      });
    }

    const stateNames = {
      SUB_STATE_HEALTHY: '標準合規狀態 (ME11 齊全 / 已REL / 541 在庫 1,000 YD)',
      SUB_STATE_NO_ME11: '缺少採購資訊記錄 (ME11 遺失導致釋放 PR 阻擋)',
      SUB_STATE_NO_REL: '工單尚未釋放 (CRTD 草稿狀態，未生委外 PR)',
      SUB_STATE_NO_541: '出廠漏過帳 541 (委外供應商特殊庫存 = 0)',
      SUB_STATE_541_PARTIAL: '委外庫存不足 (541 發料短缺)'
    };

    showToast(`製程委外狀態已切換為：${stateNames[stateKey] || stateKey}`);
    simulateSubAction('ACT_SUB_INSPECT');
  };

  window.simulateSubAction = function (actionKey) {
    const screenBody = document.getElementById('sim-sub-screen-body');
    const simTimestamp = document.getElementById('sim-sub-timestamp');
    const simRaciFooter = document.getElementById('sim-sub-raci-footer');
    if (!screenBody) return;

    // Dynamically highlight clicked action button in Step 2
    const subBox = document.getElementById('sandbox-subcontract-container');
    if (subBox) {
      subBox.querySelectorAll('.actions-buttons-grid .sim-action-btn').forEach(btn => {
        const matches = btn.getAttribute('onclick')?.includes(actionKey);
        btn.classList.toggle('active', !!matches);
      });
    }

    if (simTimestamp) {
      const now = new Date();
      simTimestamp.textContent = `TCODE RUN: ${now.toLocaleTimeString()}`;
    }

    let statusType = 'msg-error';
    let statusText = '';
    let explanationHtml = '';
    let raciOwner = 'PP 生管 + MM 採購 + MM 倉管';

    function getGaugeHtml(loc0001, scStock, opStatus, poDoc) {
      return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem; margin-bottom: 0.85rem; background: rgba(0,0,0,0.3); padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.82rem; border: 1px solid var(--border-subtle);">
          <div><span style="color: var(--text-muted); display: block; font-size: 0.75rem;">廠內庫存 (0001)</span><strong>${loc0001}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 0.75rem;">委外特殊庫存 (541)</span><strong>${scStock}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 0.75rem;">工單 PP02 工序</span><strong>${opStatus}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 0.75rem;">委外 PO (POUR)</span><strong>${poDoc}</strong></div>
        </div>
      `;
    }

    if (actionKey === 'ACT_SUB_INSPECT') {
      if (currentSubSimState === 'SUB_STATE_HEALTHY') {
        statusType = 'msg-success';
        statusText = '[S] 就緒良好：ME11 (類別 3) 齊全、工單 REL 已生 PR、PO 已下達、541 已發 1,000 YD！';
        explanationHtml = `
          ${getGaugeHtml('4,000 YD', '<span style="color: #10b981;">🟢 1,000 YD (在庫)</span>', '<span style="color: #38bdf8;">REL (已釋放)</span>', '4500018821')}
          <div class="sim-solution-timeline">
            <strong>📋 當前委外閉環現狀：</strong><br>
            • 採購資訊記錄已建立（加工費淨價 $12.5/雙，計畫交期 5 天）。<br>
            • 倉庫已於 <code>ME27</code> / <code>MIGO 541</code> 將 1,000 YD 面料移轉至委外供應商庫存（帳面無會計分錄，產權屬廠內）。<br>
            • 委外加工品隨時完工送回廠內，倉管可點選【動作 D】執行 <code>MIGO 101</code> 體驗雙重自動連動！
          </div>
        `;
      } else if (currentSubSimState === 'SUB_STATE_NO_ME11') {
        statusType = 'msg-error';
        statusText = '[E] 缺少採購主檔：途程設 PP02，但 Table EINA/EINE 查無委外加工資訊記錄！';
        explanationHtml = `
          ${getGaugeHtml('5,000 YD', '<span style="color: #f43f5e;">🔴 0 YD</span>', '<span style="color: #fbbf24;">CRTD (阻擋釋放)</span>', '<span style="color: #f43f5e;">❌ 無單據</span>')}
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--rose);">
            <strong style="color: #fda4af;">🚨 核心異常：E_SUB_NO_ME11 (製程委外缺資訊記錄)</strong><br>
            • 工程建立了 PP02 途程，但採購端未在 <code>ME11</code> 建立對應料號與委外廠商之「類別 3 委外加工」資訊記錄。<br>
            • 此時若嘗試點選【動作 A】釋放工單，系統會立即拋錯阻擋，無法生成委外請購單 (PR)。<br>
            • <strong>秒級解鎖：</strong> 通知採購人員進 <code>ME11</code> 維護委外資訊記錄（類別選 3）後即可解鎖。
          </div>
        `;
        raciOwner = 'MM 採購人員 (建 ME11)';
      } else if (currentSubSimState === 'SUB_STATE_NO_REL') {
        statusType = 'msg-warning';
        statusText = '[W] 流程卡關：工單處於 CRTD (建立中)，物料預留與委外請購單 (PR) 尚未生成！';
        explanationHtml = `
          ${getGaugeHtml('5,000 YD', '<span style="color: #fbbf24;">🟡 0 YD</span>', '<span style="color: #fbbf24;">CRTD (草稿)</span>', '<span style="color: var(--text-muted);">⏳ 待生 PR</span>')}
          <div class="sim-solution-timeline">
            <strong>📋 當前委外閉環現狀：</strong><br>
            • SAP 鐵律：只有工單打上 <code>REL</code> (已釋放) 的瞬間，系統才會為 PP02 站點自動產出委外 PR (項目類別 L)。<br>
            • 工單未打 REL 之前，採購無法在 <code>ME57</code> 查到請購單，亦無法開立委外 PO。<br>
            • 請點選【動作 A】執行工單釋放。
          </div>
        `;
        raciOwner = 'PP 生管人員 (執行釋放 REL)';
      } else if (currentSubSimState === 'SUB_STATE_NO_541') {
        statusType = 'msg-error';
        statusText = '[E] 庫存嚴重失衡：材料實物已送出廠，但 SAP 尚未過帳 Mvt 541 移轉委外特殊庫存！';
        explanationHtml = `
          ${getGaugeHtml('5,000 YD (卡廠內)', '<span style="color: #f43f5e;">💥 0 YD (委外無帳)</span>', '<span style="color: #38bdf8;">REL</span>', '4500018821')}
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--rose);">
            <strong style="color: #fda4af;">🚨 現場高頻隱形地雷：出廠漏做 541</strong><br>
            • 現場物料已隨貨車送交委外代工廠，但倉管在系統中<strong>忘記過帳 541</strong>。<br>
            • 委外加工品一旦送回廠內，倉管於 <code>MIGO 101</code> 收貨時，將引發 <strong><code>E_SUB_541_LACK</code> (Deficit of SC stock)</strong> 扣料阻擋！<br>
            • 請點擊【動作 D】檢視系統報錯與秒級補單路徑。
          </div>
        `;
        raciOwner = 'MM 倉管人員 (出廠漏發料)';
      } else if (currentSubSimState === 'SUB_STATE_541_PARTIAL') {
        statusType = 'msg-warning';
        statusText = '[W] 庫存短缺：工單標準耗用需 1,000 YD，但目前委外特殊庫存僅移轉 600 YD！';
        explanationHtml = `
          ${getGaugeHtml('4,400 YD', '<span style="color: #fbbf24;">🟠 600 YD (缺 400 YD)</span>', '<span style="color: #38bdf8;">REL</span>', '4500018821')}
          <div class="sim-solution-timeline">
            <strong>📋 當前委外閉環現狀：</strong><br>
            • 倉庫先前在 541 發料時數量不足，委外廠商處帳面僅有 600 碼庫存。<br>
            • 若整批加工品 1,000 雙回廠收貨，背景 543 倒扣會因缺少 400 碼直接阻擋過帳！
          </div>
        `;
        raciOwner = 'MM 倉管人員 (補足 541)';
      }
    } else if (actionKey === 'ACT_SUB_REL_ORDER') {
      if (currentSubSimState === 'SUB_STATE_NO_ME11') {
        statusType = 'msg-error';
        statusText = '💥 E_SUB_NO_ME11 阻擋：工單釋放中斷！途程 PP02 缺乏採購資訊記錄 (類別 3)。';
        explanationHtml = `
          ${getGaugeHtml('5,000 YD', '<span style="color: #f43f5e;">0 YD</span>', '<span style="color: #f43f5e;">CRTD (釋放阻擋)</span>', '無')}
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--rose);">
            <strong style="color: #fda4af;">🚨 錯誤訊息剖析：</strong><br>
            • <code>Message no. 06 019: Info record for vendor V1002 and material M1001 not found.</code><br>
            • 途程控制碼為 <code>PP02</code> (外部處理 '+')，釋放時系統需抓取 <code>ME11</code> 價格生成採購申請（PR）。缺乏資訊記錄導致 PR 無法計價，系統啟動硬阻擋！<br><br>
            <strong style="color: var(--primary);">⚡ 第一線秒級解鎖 3 步 SOP：</strong><br>
            1. 通知採購人員進入 <strong><code>ME11</code></strong>，輸入供應商與物料號碼，<strong>資訊類別務必勾選「3 (委外加工)」</strong>。<br>
            2. 維護加工單價、稅碼、計畫交貨天數與採購組織參數後存檔。<br>
            3. 生管回 <code>CO02</code> 重新讀取外部處理資料，點選「釋放 (REL)」，系統順利產出委外 PR (項目類別 L)！
          </div>
        `;
        raciOwner = 'MM 採購 (補建 ME11) ➔ PP 生管 (重新釋放)';
      } else {
        statusType = 'msg-success';
        statusText = '✅ 工單釋放成功 (REL)：系統背景自動產出委外請購單 (PR: 1000845210)！';
        explanationHtml = `
          ${getGaugeHtml('5,000 YD', '0 YD', '<span style="color: #10b981;">REL (已釋放)</span>', 'PR: 1000845210 (待轉 PO)')}
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--emerald);">
            <strong style="color: #a7f3d0;">🎉 釋放連動成果：</strong><br>
            • 工單狀態正式轉為 <code>REL</code>。<br>
            • 系統背景自動生成【委外採購申請單 (PR)】：項目類別固定為 <strong><code>L</code> (委外加工)</strong>，科目分配固定為 <strong><code>F</code> (訂單)</strong>。<br>
            • 採購部門可在 <code>ME57</code> / <code>ME21N</code> 查到該 PR，隨時可下達委外採購單 (PO)！
          </div>
        `;
        raciOwner = 'PP 生管人員';
      }
    } else if (actionKey === 'ACT_SUB_CONVERT_PO') {
      if (currentSubSimState === 'SUB_STATE_NO_REL') {
        statusType = 'msg-error';
        statusText = '🛑 轉 PO 失敗：工單處於 CRTD 狀態，尚未產生委外 PR，ME57 查無請購單！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            採購無法開立委外 PO！必須先生管至 <code>CO02</code> / <code>ZPP019</code> 執行工單釋放打 <code>REL</code>，PR 才會拋轉至採購清單。
          </div>
        `;
        raciOwner = 'PP 生管人員';
      } else if (currentSubSimState === 'SUB_STATE_NO_ME11') {
        statusType = 'msg-error';
        statusText = '🛑 轉 PO 失敗：ME21N 提示找不到有效加工費淨價條件 (缺少 ME11 類別 3)！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            採購無法儲存委外 PO！必須先於 <code>ME11</code> 維護委外資訊記錄（類別 3）。
          </div>
        `;
        raciOwner = 'MM 採購人員';
      } else {
        statusType = 'msg-success';
        statusText = '✅ 轉 PO 成功：產出委外採購訂單 (PO: 4500018821，單據類型 POUR)！';
        explanationHtml = `
          ${getGaugeHtml('5,000 YD', '0 YD', '<span style="color: #38bdf8;">REL</span>', '<span style="color: #10b981;">PO 4500018821 (POUR)</span>')}
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--emerald);">
            <strong>📋 委外採購單屬性：</strong><br>
            • 單據類型：<code>POUR</code> (製程委外採購單)。<br>
            • 項目類別：<code>L</code> (委外加工)。<br>
            • 表身組件清單自動帶出工單所需原材料 (面料 1,000 YD)。<br>
            • 倉庫可依據此採購單進行下一步出廠發料 (Mvt 541)。
          </div>
        `;
        raciOwner = 'MM 採購人員';
      }
    } else if (actionKey === 'ACT_SUB_ISSUE_541') {
      if (currentSubSimState === 'SUB_STATE_NO_REL') {
        statusType = 'msg-error';
        statusText = '🛑 發料阻擋：工單尚未釋放且無採購單，倉庫無法執行委外發料過帳！';
        explanationHtml = `
          <div class="sim-solution-timeline">
            倉庫必須依據正式工單或委外 PO 才能辦理 541 移轉。
          </div>
        `;
      } else {
        statusType = 'msg-success';
        statusText = '✅ 541 委外發料過帳成功：產生物料憑證 4900125488 (移轉至委外特殊庫存)！';
        explanationHtml = `
          ${getGaugeHtml('4,000 YD (-1,000)', '<span style="color: #10b981;">🟢 1,000 YD (移入供應商)</span>', 'REL', 'PO 4500018821')}
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--emerald);">
            <strong style="color: #a7f3d0;">📦 庫存異動與會計狀態深度解析：</strong><br>
            • 異動類型：<strong><code>Mvt 541</code> (提供物料給委外廠商 / Subcontractor Stock)</strong>。<br>
            • 庫存轉移：廠內可用庫存 (0001) 減少 1,000 YD，委外廠商 (V1002) 特殊庫存增加 1,000 YD。<br>
            • 💡 **會計憑證：無財務分錄產生！** 因為物料實體送出廠，但法律產權仍屬本工廠，不產生借貸。<br>
            • 現場貨物與 SAP 帳面已 100% 同步，為後續收貨 101/543 奠定完美基礎！
          </div>
        `;
        raciOwner = 'MM 倉管人員 (ME27 / MIGO 541)';
      }
    } else if (actionKey === 'ACT_SUB_RECEIVE_101') {
      if (currentSubSimState === 'SUB_STATE_NO_541') {
        statusType = 'msg-error';
        statusText = '💥 E_SUB_541_LACK 致命阻擋：Deficit of SC stock (委外特殊庫存短缺 1,000 YD)！';
        explanationHtml = `
          ${getGaugeHtml('5,000 YD', '<span style="color: #f43f5e;">💥 0 YD (缺 1,000 YD)</span>', 'REL', 'PO 4500018821')}
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--rose);">
            <strong style="color: #fda4af;">🚨 錯誤訊息：Message no. M7 021 - Deficit of SC stock</strong><br><br>
            <strong>💥 底層原因剖析：</strong><br>
            • 委外廠商將加工品送回，倉管至 <code>MIGO</code> 選擇「A01 收貨 ➔ R01 採購單」過帳 <code>101</code>。<br>
            • SAP 底層機制規定：<strong>101 過帳的瞬間，背景必須同時觸發 <code>Mvt 543</code> 扣減該委外廠商名下的原物料！</strong><br>
            • 但因為倉庫出廠時**漏做了 541 移轉**，委外廠商名下庫存為 0，系統啟動硬阻擋，嚴禁「無中生有」入庫！<br><br>
            <strong style="color: var(--primary);">⚡ 第一線秒級解鎖 SOP：</strong><br>
            1. 生管或資材至 <strong><code>ME2O</code> (委外庫存監控報表)</strong> 查核該廠商庫存，確認特殊庫存結存為 0。<br>
            2. 倉管至 <strong><code>ME27</code> 或 <code>MIGO</code> (A08移轉過帳 / Mvt 541)</strong> 補足 1,000 YD 原料移轉至該供應商。<br>
            3. 補足後重新回 <code>MIGO 101</code> 收貨，系統即可順利自動帶出 543 扣帳並將工序標記完工！
          </div>
        `;
        raciOwner = 'MM 倉管人員 (補做 541)';
      } else if (currentSubSimState === 'SUB_STATE_541_PARTIAL') {
        statusType = 'msg-error';
        statusText = '💥 E_SUB_541_LACK 數量不足阻擋：543 需扣 1,000 YD，但委外庫存僅 600 YD (短缺 400 YD)！';
        explanationHtml = `
          ${getGaugeHtml('4,400 YD', '<span style="color: #f43f5e;">🟠 600 YD (短缺 400)</span>', 'REL', 'PO 4500018821')}
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--rose);">
            <strong>處置指引：</strong> 倉庫必須再至 <code>ME27</code> / <code>MIGO 541</code> 補發 400 YD 至委外特殊庫存，方可進行 1,000 雙加工品全數收貨。
          </div>
        `;
        raciOwner = 'MM 倉管人員 (補發 541)';
      } else {
        statusType = 'msg-success';
        statusText = '🌟 雙重自動連動大成功！委外加工品入庫 + Mvt 543 自動倒扣 + PP02 工序自動確認 (CNF)！';
        explanationHtml = `
          ${getGaugeHtml('4,000 YD', '<span style="color: #10b981;">0 YD (543 已全數耗用)</span>', '<span style="color: #10b981;">🟢 CNF (自動完工確認)</span>', 'PO 4500018821 (已交貨)')}
          <div class="sim-solution-timeline" style="border-left: 3px solid var(--emerald);">
            <strong style="color: #a7f3d0; font-size: 0.95rem;">🏆 雙重自動連動機制成果揭示：</strong><br><br>
            <strong>【連動 1：原物料背景自動 543 倒扣與財務拋帳】</strong><br>
            • 系統自動在背景產生 <strong><code>Mvt 543</code></strong>，將委外供應商處之 1,000 YD 特殊庫存扣除歸零。<br>
            • 財務會計憑證同步生成：<br>
              &nbsp;&nbsp;借：委外加工費用科目 (加工費 $12,500) / 貸：應付帳款 (委外加工廠)<br>
              &nbsp;&nbsp;借：半成品庫存 (加工後鞋面 $35,000) / 貸：原材料消耗科目 ($22,500)<br><br>
            <strong>【連動 2：生產工單 PP02 工序自動確認完工 (CNF)】</strong><br>
            • <strong>工單該站 PP02 狀態自動由 REL 變更為 CNF (已完全確認)！</strong><br>
            • 💡 <strong>生管現場完全免進 CO11N 手動報工</strong>！無人為漏報或多報，單據無縫流轉至下一站 (成型針車)！
          </div>
        `;
        raciOwner = 'MM 倉管 + FI 財務會計 (全閉環達成)';
      }
    } else if (actionKey === 'ACT_SUB_MANUAL_CO11N') {
      statusType = 'msg-error';
      statusText = '🚫 嚴重違規：PP02 控制碼嚴禁在 CO11N 手動報工！(破壞 101 自動連動與月結)';
      explanationHtml = `
        <div class="sim-solution-timeline" style="border-left: 3px solid var(--rose);">
          <strong style="color: #fda4af;">🚨 違規後果深度剖析：</strong><br>
          • 途程控制碼 <code>PP02</code> (外部處理 '+') 在系統定義為<strong>製程委外站，無廠內人工工時</strong>。<br>
          • 若生管強行在 <code>CO11N</code> 或現場 MES 刷卡報工：<br>
            1. 會虛增現場直接人工工時，嚴重污染產線成本中心。<br>
            2. 後續委外加工品送回做 <code>MIGO 101</code> 時，系統又會再次觸發自動確認，產生重複確認衝突！<br><br>
          <strong style="color: var(--primary);">✔ 鐵律規則：</strong> PP02 站點生管完全放空即可，唯一的完工訊號就是委外廠商送回之 <strong><code>MIGO 101</code> 收貨憑證</strong>！
        </div>
      `;
      raciOwner = 'PP 生管人員 (糾正操作習慣)';
    } else if (actionKey === 'ACT_SUB_FULL_CLOSED_LOOP') {
      statusType = 'msg-success';
      statusText = '🎉 5 步製程委外閉環標準 SOP 完美全通關演示！(ME11 ➔ REL ➔ PO ➔ 541 ➔ 101/543)';
      explanationHtml = `
        ${getGaugeHtml('4,000 YD', '0 YD (543 已核銷)', '<span style="color: #10b981;">🟢 CNF (完全報工)</span>', 'PO 4500018821 (結案)')}
        <div class="sim-solution-timeline" style="border-left: 3px solid var(--emerald);">
          <strong style="color: #a7f3d0; font-size: 0.95rem;">🏆 5 步標準製程委外閉環軌跡：</strong><br><br>
          <strong>步驟 1：維護 ME11 委外資訊記錄</strong> ➔ 採購維護委外價格與交期（類別 3）✅<br>
          <strong>步驟 2：生管釋放工單打 REL</strong> ➔ 系統背景自動產出委外 PR (項目類別 L / 科目 F) ✅<br>
          <strong>步驟 3：採購轉 PO (ME21N)</strong> ➔ 開立 POUR 採購單並帶出外發材料明細 ✅<br>
          <strong>步驟 4：倉庫外發料件 (ME27 / Mvt 541)</strong> ➔ 原料移轉至供應商特殊庫存 (產權屬本公司) ✅<br>
          <strong>步驟 5：加工品回廠收貨 (MIGO 101)</strong> ➔ 系統背景自動觸發 543 原料扣帳 + 工單自動報工 CNF ✅<br><br>
          <span style="color: var(--primary);">✔ 完美防呆：現場零手動報工、供應商庫存帳實精準核銷、財務月結差異歸零！</span>
        </div>
      `;
      raciOwner = 'PP 生管 ➔ MM 採購 ➔ MM 倉管 (全閉環完成)';
    }

    screenBody.innerHTML = `
      <div class="sim-sap-msg-bar ${statusType}">
        <span>${statusType.includes('error') ? '🛑' : statusType.includes('warning') ? '⚠️' : '✅'}</span>
        <span>${statusText}</span>
      </div>
      ${explanationHtml}
    `;

    if (simRaciFooter) simRaciFooter.textContent = `責任單位：${raciOwner}`;
  };

  // ==========================================================================
  // Module 10: WO Lifecycle Inspector Engine (工單全生命週期穿透診斷器)
  // ==========================================================================

  const woPresets = {
    PRESET_HEALTHY: {
      id: 'PRESET_HEALTHY',
      woNumber: '100028475901',
      orderType: 'ZP01',
      label: '🟢 標準量產工單 (健康標竿)',
      badge: '100 分 (健康)',
      badgeClass: 'badge-emerald',
      sub: 'ZP01 正常投產 / 末站 PP03 / 無卡單',
      tweakers: { opt_rel: true, opt_resb_balance: true, opt_sub_541: true, opt_cogi_clean: true, opt_routing_pp03: true },
      stepper: [
        { step: '01', name: '建立 (CRTD)', detail: 'BOM / 途程展開正常', status: 'passed' },
        { step: '02', name: '釋放 (REL)', detail: 'ZMMT046 無鎖定 / 可調度', status: 'passed' },
        { step: '03', name: '發料 (GI)', detail: 'RESB 扣帳平衡無斷鏈', status: 'passed' },
        { step: '04', name: '報工 (CNF)', detail: 'AFRU 正常記錄 / 工時吻合', status: 'passed' },
        { step: '05', name: '入庫/TECO', detail: 'PP03 自動 101 / 結算就緒', status: 'passed' }
      ],
      ticket: {
        id: 'TICKET-WO-901-OK',
        raci: 'PP 生管人員 (常態排程監控)',
        problem: '✅ 工單全生命週期體質優良：無 E005 預留斷鏈、無 AFFW/COGI 失敗異動，途程配置符合鞋業標準。',
        actions: [
          '維持現場正常 MES 輪次派工，定期查核報工工時。',
          '完工入庫後直接排入月底批次 TECO 作業 (FSH_PCW / COHV)。'
        ]
      },
      pillars: [
        {
          id: 'p1_status',
          icon: '🛡️',
          name: 'Pillar 1: 工單狀態與釋放鎖定',
          table: 'JEST / TJ02T / ZMMT046',
          status: 'pass',
          badge: 'REL / NORMAL',
          metrics: [
            { label: '系統狀態 (JEST)', val: 'REL PRT MACM' },
            { label: '業務凍結標記', val: '無 (正常流轉)' },
            { label: '備料單鎖定 (ZMMT046)', val: '未鎖定 (無卡單)' },
            { label: '是否允許異動', val: '🟢 允許發料與報工' }
          ],
          analysis: '工單已於 ZPP015 正常釋放，系統狀態碼為 I0002 (REL)，無任何品質檢驗或排程凍結標記。ZMMT046 備料單處於非處理態，隨時可進行調度與領料。'
        },
        {
          id: 'p2_resb',
          icon: '📦',
          name: 'Pillar 2: 物料平衡與 E005 預留鏈',
          table: 'RESB / AFPO / STPO',
          status: 'pass',
          badge: 'BALANCED',
          metrics: [
            { label: '需求數量 (RESB-BDMNG)', val: '1,000 YD' },
            { label: '實領扣帳 (RESB-ENMNG)', val: '1,000 YD' },
            { label: '首件投料識別 (STPO)', val: 'ZZFIRST 完整有效' },
            { label: 'E005 斷鏈風險', val: '🟢 0 筆異常' }
          ],
          analysis: '所有 BOM 階層之物料預留單（Reservation）皆已完成實體 261 扣帳，帳實平衡。首件投料製程關聯完備，未在領料後擅用 CO02 增刪元件，無斷鏈風險。'
        },
        {
          id: 'p3_routing',
          icon: '🗺️',
          name: 'Pillar 3: 途程控制碼與自動入庫合法性',
          table: 'PLPO / AFVC / AFVV',
          status: 'pass',
          badge: 'PP03_LEGAL',
          metrics: [
            { label: '末站工序代碼', val: 'Op 0080 包裝站' },
            { label: '末站控制碼 (STEUS)', val: 'PP03 (自動 101 入庫)' },
            { label: '自動入庫碼全單次數', val: '嚴格 1 次 (合法)' },
            { label: '前置站點控制碼', val: 'PP01 / PP01 / PP01' }
          ],
          analysis: '途程配置完全符合鞋業防呆規範：全單末站（包裝入庫站）精準配置 PP03，整張工單無重複入庫碼，現場最後一道工序報工確認即自動增加產成品 101 庫存。'
        },
        {
          id: 'p4_subcontract',
          icon: '🤝',
          name: 'Pillar 4: 製程委外閉環狀態',
          table: 'EINA / EKPO / MSLB',
          status: 'pass',
          badge: 'INTERNAL / N/A',
          metrics: [
            { label: '工序委外屬性', val: '全廠內自製加工' },
            { label: 'PP02 外部工序', val: '0 站 (無外發需求)' },
            { label: '委外採購單 (EKPO)', val: '不適用 (N/A)' },
            { label: '供應商特殊庫存 (541)', val: '不適用 (0 佔用)' }
          ],
          analysis: '本工單為廠內一貫化生產工單，無 PP02 製程委外加工工序，不牽涉 ME11 委外資訊記錄、ME21N 委外 PO 或 541/543 原料移轉核銷。'
        },
        {
          id: 'p5_cogi',
          icon: '🧹',
          name: 'Pillar 5: COGI / AFFW 錯誤異動清理度',
          table: 'AFFW / AFRU / MARD',
          status: 'pass',
          badge: 'AFFW_0',
          metrics: [
            { label: 'AFFW 失敗記錄', val: '0 筆 (完全清空)' },
            { label: '線邊倉可用庫存', val: '充足 (未引發負庫存)' },
            { label: '庫存地點鎖定 (M7022)', val: '無' },
            { label: '月結 CO88 通道', val: '🟢 暢通無阻' }
          ],
          analysis: '線邊倉庫存足以支應倒扣，無 M7021 (欠缺庫存) 或會計期間未開之異動失敗記錄。工單月結時可順利執行 KKS2 差異計算與 CO88 成本結算。'
        },
        {
          id: 'p6_afru',
          icon: '⏱️',
          name: 'Pillar 6: 工時確認與產能飽和度',
          table: 'AFRU / CRCO',
          status: 'pass',
          badge: 'CONF_NORMAL',
          metrics: [
            { label: '工單確認狀態', val: 'PCNF (部分確認 80%)' },
            { label: '已報人工工時 (AFRU)', val: '384 分鐘' },
            { label: '標準額定工時 (AK/AF)', val: '480 分鐘' },
            { label: '超報比率警示', val: '正常 (80.0%)' }
          ],
          analysis: '現場 MES 條碼刷卡或 SAP CO11N 報工正常回傳，工時消耗與工單目標數量成正比，未發生超報或人工工時漏報情形，成本中心分攤精準。'
        },
        {
          id: 'p7_settlement',
          icon: '⚖️',
          name: 'Pillar 7: 成本結算規則與 TECO 準備度',
          table: 'COBRA / COBRB / AFPO',
          status: 'pass',
          badge: 'TECO_READY',
          metrics: [
            { label: '結算規則 (COBRA)', val: '已維護 (類別 MAT)' },
            { label: '結算百分比', val: '100% 結算至產成品' },
            { label: '利潤中心 (PRCTR)', val: 'PC-1100 (鞋業量產處)' },
            { label: '四重結案檢核', val: '🟢 具備結案條件' }
          ],
          analysis: '工單結算規則與利潤中心齊備，在製品 WIP 餘額吻合生產進度。待剩餘 20% 雙數入庫完畢後，即可於 FSH_PCW 或 CO02 執行技術完成 (TECO)。'
        }
      ]
    },

    PRESET_E005_ERROR: {
      id: 'PRESET_E005_ERROR',
      woNumber: '100028475902',
      orderType: 'ZP02',
      label: '🔴 E005 領料後改單 (嚴重阻擋)',
      badge: '35 分 (高危)',
      badgeClass: 'badge-rose',
      sub: 'RESB-ENMNG>0 / 違規進 CO02 改元件',
      tweakers: { opt_rel: true, opt_resb_balance: false, opt_sub_541: false, opt_cogi_clean: false, opt_routing_pp03: true },
      stepper: [
        { step: '01', name: '建立 (CRTD)', detail: 'BOM / 途程展開正常', status: 'passed' },
        { step: '02', name: '釋放 (REL)', detail: '正常釋放', status: 'passed' },
        { step: '03', name: '發料 (GI)', detail: 'E005 斷鏈！RESB-ENMNG>0 遭擅改', status: 'blocked' },
        { step: '04', name: '報工 (CNF)', detail: '元件扣帳關係混亂', status: 'warning' },
        { step: '05', name: '入庫/TECO', detail: '預留未平阻擋月結', status: 'blocked' }
      ],
      ticket: {
        id: 'TICKET-ERR-E005',
        raci: 'PP 生管人員 ➔ MM 倉庫人員',
        problem: '🚨 違規操作大忌！工單已實體領料扣帳 (RESB-ENMNG=300 YD)，生管未走退料程序即在 CO02 直接增刪元件，引發 STPO-ZZFIRST 斷鏈與 E005 系統阻擋！',
        actions: [
          '1. 嚴禁在 CO02 繼續手動修改元件清單，避免資料庫結構進一步毀損。',
          '2. 生管立即至 ZPP024 開立退料申請單 (數量需完全吻合實領數 300 YD)。',
          '3. 倉庫人員至 ZMM047 / MIGO (262) 執行退料過帳，將 RESB-ENMNG 歸零。',
          '4. 生管使用集團標準交易碼 ZPP010 重新讀取 BOM 並抽換正確規格料件。'
        ]
      },
      pillars: [
        {
          id: 'p1_status',
          icon: '🛡️',
          name: 'Pillar 1: 工單狀態與釋放鎖定',
          table: 'JEST / TJ02T / ZMMT046',
          status: 'pass',
          badge: 'REL / NORMAL',
          metrics: [
            { label: '系統狀態 (JEST)', val: 'REL PRT' },
            { label: '業務凍結標記', val: '無' },
            { label: '備料單鎖定 (ZMMT046)', val: '未鎖定' },
            { label: '是否允許異動', val: '🟡 警告 (元件異動鎖定)' }
          ],
          analysis: '工單基本狀態已釋放，但內部資料表存在未平衡之物料預留單，阻礙後續領料單開立。'
        },
        {
          id: 'p2_resb',
          icon: '📦',
          name: 'Pillar 2: 物料平衡與 E005 預留鏈',
          table: 'RESB / AFPO / STPO',
          status: 'fail',
          badge: 'E005_BLOCKED',
          metrics: [
            { label: '需求數量 (RESB-BDMNG)', val: '500 YD' },
            { label: '實領扣帳 (RESB-ENMNG)', val: '300 YD (非零)' },
            { label: '首件投料識別 (STPO)', val: '🔴 ZZFIRST 斷鏈丟失' },
            { label: 'E005 阻擋代碼', val: '🛑 已實發料不可直接刪改' }
          ],
          analysis: '【致命違規】RESB-ENMNG 為 300 YD，生管強行在 CO02 手動刪除並重掛料件，破壞 STPO 關聯碼，導致 ZPP020 無法開立領料單，月結 TECO 判定未發料完成！'
        },
        {
          id: 'p3_routing',
          icon: '🗺️',
          name: 'Pillar 3: 途程控制碼與自動入庫合法性',
          table: 'PLPO / AFVC / AFVV',
          status: 'pass',
          badge: 'PP03_LEGAL',
          metrics: [
            { label: '末站工序代碼', val: 'Op 0070 包裝站' },
            { label: '末站控制碼 (STEUS)', val: 'PP03 (自動 101 入庫)' },
            { label: '自動入庫碼全單次數', val: '嚴格 1 次 (合法)' },
            { label: '途程合法性', val: '🟢 合格' }
          ],
          analysis: '途程本身配置正確，但前置物料階段卡死將導致末站無法順暢執行入庫。'
        },
        {
          id: 'p4_subcontract',
          icon: '🤝',
          name: 'Pillar 4: 製程委外閉環狀態',
          table: 'EINA / EKPO / MSLB',
          status: 'pass',
          badge: 'INTERNAL / N/A',
          metrics: [
            { label: '工序委外屬性', val: '全廠內自製加工' },
            { label: 'PP02 外部工序', val: '0 站' },
            { label: '委外採購單 (EKPO)', val: 'N/A' },
            { label: '供應商特殊庫存 (541)', val: 'N/A' }
          ],
          analysis: '無委外工序干擾。'
        },
        {
          id: 'p5_cogi',
          icon: '🧹',
          name: 'Pillar 5: COGI / AFFW 錯誤異動清理度',
          table: 'AFFW / AFRU / MARD',
          status: 'pass',
          badge: 'AFFW_0',
          metrics: [
            { label: 'AFFW 失敗記錄', val: '0 筆' },
            { label: '線邊倉可用庫存', val: '充足' },
            { label: '庫存地點鎖定', val: '無' },
            { label: '狀態', val: '🟢 目前無倒扣卡單' }
          ],
          analysis: '目前尚無倒扣失敗記錄，但若強行手動報工，將引發未發料元件之負庫存報錯。'
        },
        {
          id: 'p6_afru',
          icon: '⏱️',
          name: 'Pillar 6: 工時確認與產能飽和度',
          table: 'AFRU / CRCO',
          status: 'warn',
          badge: 'CONF_HOLD',
          metrics: [
            { label: '工單確認狀態', val: 'PCNF (30%)' },
            { label: '已報人工工時 (AFRU)', val: '120 分鐘' },
            { label: '元件扣帳關聯', val: '🟡 報工扣帳料號與現場投料不符' },
            { label: '工時分攤風險', val: '存在成本分攤偏差' }
          ],
          analysis: '因為元件遭擅改，後續報工時倒扣之原料批次與現場實際產線投料不同步。'
        },
        {
          id: 'p7_settlement',
          icon: '⚖️',
          name: 'Pillar 7: 成本結算規則與 TECO 準備度',
          table: 'COBRA / COBRB / AFPO',
          status: 'fail',
          badge: 'TECO_BLOCKED',
          metrics: [
            { label: '結算規則 (COBRA)', val: '已維護' },
            { label: 'RESB 預留結存狀態', val: '🔴 存在未清孤兒預留' },
            { label: 'TECO 結案門檻', val: '🛑 嚴禁上 TECO' },
            { label: '預期財務影響', val: '跨月產生退料借貸差額' }
          ],
          analysis: '若在此狀態下強行 TECO，未領用預留將被強制關閉，後續補退料需透過 COHV 拆旗標，引發跨月重工成本差異！'
        }
      ]
    },

    PRESET_SUB_541_LACK: {
      id: 'PRESET_SUB_541_LACK',
      woNumber: '100028475903',
      orderType: 'ZP01',
      label: '🔴 製程委外缺 541 原料外發',
      badge: '40 分 (高危)',
      badgeClass: 'badge-rose',
      sub: 'PP02 工序 / 缺 Mvt 541 / 報工受阻',
      tweakers: { opt_rel: true, opt_resb_balance: true, opt_sub_541: false, opt_cogi_clean: false, opt_routing_pp03: false },
      stepper: [
        { step: '01', name: '建立 (CRTD)', detail: 'BOM / 途程展開正常', status: 'passed' },
        { step: '02', name: '釋放 (REL)', detail: '自動拋轉委外 PR (項目類別 L)', status: 'passed' },
        { step: '03', name: '外發 (541)', detail: '未執行 Mvt 541 移轉過帳！', status: 'blocked' },
        { step: '04', name: '委外加工', detail: '供應商庫存短缺，阻擋 101/543', status: 'blocked' },
        { step: '05', name: '入庫/TECO', detail: '委外站未完工，無法入庫', status: 'pending' }
      ],
      ticket: {
        id: 'TICKET-ERR-SUB541',
        raci: 'MM 倉管人員 ➔ MM 採購人員',
        problem: '🚨 委外供應商在庫不足！工單 Op 0040 為 PP02 製程委外站，已開立採購單 4500018821，但倉庫尚未將原料以 541 外發至廠商庫存，後續加工品回廠時 101/543 將直接報錯阻擋！',
        actions: [
          '1. 嚴禁現場在 CO11N 手動報工 PP02 委外站 (違規產生多餘直接人工)。',
          '2. 倉庫人員至 ME27 或 MIGO (541) 執行原料移轉至供應商特殊庫存 (O 庫存)。',
          '3. 至 ME2O 查核供應商在庫數量，確認 4,000 YD 充足。',
          '4. 委外加工品送回後，倉庫執行 MIGO 101 收貨，系統自動觸發 543 扣帳並自動完工報工。'
        ]
      },
      pillars: [
        {
          id: 'p1_status',
          icon: '🛡️',
          name: 'Pillar 1: 工單狀態與釋放鎖定',
          table: 'JEST / TJ02T / ZMMT046',
          status: 'pass',
          badge: 'REL / NORMAL',
          metrics: [
            { label: '系統狀態 (JEST)', val: 'REL PRT' },
            { label: '委外 PR 產生狀態', val: 'PR 100054210 已產生' },
            { label: '備料單鎖定', val: '未鎖定' },
            { label: '流轉狀態', val: '🟢 正常流轉中' }
          ],
          analysis: '工單釋放時系統已依 PP02 控制碼自動拋轉項目類別 L 之委外採購申請。'
        },
        {
          id: 'p2_resb',
          icon: '📦',
          name: 'Pillar 2: 物料平衡與 E005 預留鏈',
          table: 'RESB / AFPO / STPO',
          status: 'pass',
          badge: 'BALANCED',
          metrics: [
            { label: '廠內料需求數量', val: '2,500 YD' },
            { label: '廠內料實領扣帳', val: '2,500 YD' },
            { label: '外發料預留標記', val: '外發專屬元件預留清單' },
            { label: 'E005 斷鏈風險', val: '🟢 無斷鏈' }
          ],
          analysis: '廠內自製段原料扣帳正常，外發原料已載入採購單組件清單中。'
        },
        {
          id: 'p3_routing',
          icon: '🗺️',
          name: 'Pillar 3: 途程控制碼與自動入庫合法性',
          table: 'PLPO / AFVC / AFVV',
          status: 'pass',
          badge: 'PP02_LEGAL',
          metrics: [
            { label: '委外工序代碼', val: 'Op 0040 (鞋面電腦針車)' },
            { label: '工序控制碼 (STEUS)', val: 'PP02 (外部處理)' },
            { label: '末站控制碼', val: 'PP03 (全單唯一次數: 1)' },
            { label: '外部處理標記', val: '外部標記 +' }
          ],
          analysis: '途程結構符合標準：中間站點 Op 0040 設置 PP02 製程委外，末站保留 PP03。'
        },
        {
          id: 'p4_subcontract',
          icon: '🤝',
          name: 'Pillar 4: 製程委外閉環狀態',
          table: 'EINA / EKPO / MSLB',
          status: 'fail',
          badge: '541_LACKING',
          metrics: [
            { label: '委外採購單 (EKPO)', val: 'PO 4500018821 (已開立)' },
            { label: '外發原料需求量', val: '4,000 YD' },
            { label: '541 移轉過帳數量', val: '🔴 0 YD (短缺 4,000 YD)' },
            { label: '廠商在庫結存 (ME2O)', val: '0 YD (阻擋 MIGO 101/543)' }
          ],
          analysis: '【閉環中斷】採購已開立委外 PO，但倉庫未透過 ME27 / MIGO 541 進行實體外發原料過帳！供應商特殊庫存為 0，廠商送回加工品時無法執行 MIGO 101/543。'
        },
        {
          id: 'p5_cogi',
          icon: '🧹',
          name: 'Pillar 5: COGI / AFFW 錯誤異動清理度',
          table: 'AFFW / AFRU / MARD',
          status: 'pass',
          badge: 'AFFW_0',
          metrics: [
            { label: 'AFFW 失敗記錄', val: '0 筆' },
            { label: '線邊倉可用庫存', val: '充足' },
            { label: '庫存地點鎖定', val: '無' },
            { label: '狀態', val: '🟢 暫無倒扣失敗' }
          ],
          analysis: '尚未到達收貨倒扣 543 步驟，目前無 AFFW 記錄。'
        },
        {
          id: 'p6_afru',
          icon: '⏱️',
          name: 'Pillar 6: 工時確認與產能飽和度',
          table: 'AFRU / CRCO',
          status: 'warn',
          badge: 'EXT_PENDING',
          metrics: [
            { label: 'PP02 報工規範', val: '無廠內人工工時 (不手動報工)' },
            { label: '完工確認訊號', val: '🟡 待 MIGO 101 收貨過帳' },
            { label: '現場刷卡狀態', val: '嚴禁現場在 CO11N 刷卡' },
            { label: '風險警示', val: '防止重複工時確認' }
          ],
          analysis: 'PP02 為純委外工序，現場不得手動報工。唯一的完工回傳為供應商交貨之 MIGO 101 憑證。'
        },
        {
          id: 'p7_settlement',
          icon: '⚖️',
          name: 'Pillar 7: 成本結算規則與 TECO 準備度',
          table: 'COBRA / COBRB / AFPO',
          status: 'warn',
          badge: 'PO_UNSETTLED',
          metrics: [
            { label: '委外採購單狀態', val: '未收貨未發票驗證' },
            { label: '加工費暫估 (GR/IR)', val: '待收貨認列' },
            { label: 'TECO 結案門檻', val: '🟡 採購單未結清' },
            { label: '處置建議', val: '收貨並勾選最終交貨後結案' }
          ],
          analysis: '委外 PO 尚未收貨，加工費用尚未過入工單成本，此時不可執行 TECO。'
        }
      ]
    },

    PRESET_ROUTING_AUTOGR_ERR: {
      id: 'PRESET_ROUTING_AUTOGR_ERR',
      woNumber: '100028475904',
      orderType: 'ZP01',
      label: '🟡 末站途程控制碼錯誤',
      badge: '60 分 (警告)',
      badgeClass: 'badge-amber',
      sub: '末站誤設 PP01 / 遺漏 PP03 自動入庫',
      tweakers: { opt_rel: true, opt_resb_balance: true, opt_sub_541: true, opt_cogi_clean: false, opt_routing_pp03: false },
      stepper: [
        { step: '01', name: '建立 (CRTD)', detail: 'BOM / 途程展開正常', status: 'passed' },
        { step: '02', name: '釋放 (REL)', detail: '正常釋放', status: 'passed' },
        { step: '03', name: '發料 (GI)', detail: '原料正常領料', status: 'passed' },
        { step: '04', name: '報工 (CNF)', detail: '末站已確認，但未觸發入庫', status: 'warning' },
        { step: '05', name: '入庫/TECO', detail: '成品庫存未增 (101 缺失)', status: 'blocked' }
      ],
      ticket: {
        id: 'TICKET-WARN-RT01',
        raci: 'PP 生管人員 ➔ IE 生產工程',
        problem: '⚠️ 途程末站控制碼配置錯誤！工單最後一道包裝工序誤設為 PP01 (一般廠內)，缺少 PP03/PP08 自動入庫碼，現場報工後成品庫存不會自動增加！',
        actions: [
          '1. 現場若已在 MES/SAP 完成報工，生管需手動使用 MB31 (101) 補辦成品入庫過帳。',
          '2. 聯絡 IE 工程人員至 CA02 修正量產標準途程，將末站控制碼改為 PP03。',
          '3. 檢查全單是否有其他站點誤掛 PP03，確保整張工單自動入庫碼僅出現一次。'
        ]
      },
      pillars: [
        {
          id: 'p1_status',
          icon: '🛡️',
          name: 'Pillar 1: 工單狀態與釋放鎖定',
          table: 'JEST / TJ02T / ZMMT046',
          status: 'pass',
          badge: 'REL / NORMAL',
          metrics: [
            { label: '系統狀態 (JEST)', val: 'REL PRT CNF' },
            { label: '業務凍結標記', val: '無' },
            { label: '備料單鎖定', val: '未鎖定' },
            { label: '流轉狀態', val: '🟢 正常' }
          ],
          analysis: '工單已釋放並已完成各工序報工。'
        },
        {
          id: 'p2_resb',
          icon: '📦',
          name: 'Pillar 2: 物料平衡與 E005 預留鏈',
          table: 'RESB / AFPO / STPO',
          status: 'pass',
          badge: 'BALANCED',
          metrics: [
            { label: '需求數量 (RESB)', val: '1,500 YD' },
            { label: '實領扣帳 (RESB)', val: '1,500 YD' },
            { label: '首件投料識別', val: '正常' },
            { label: 'E005 斷鏈風險', val: '🟢 0 筆異常' }
          ],
          analysis: '發料完整無異常。'
        },
        {
          id: 'p3_routing',
          icon: '🗺️',
          name: 'Pillar 3: 途程控制碼與自動入庫合法性',
          table: 'PLPO / AFVC / AFVV',
          status: 'fail',
          badge: 'NO_AUTOGR',
          metrics: [
            { label: '末站工序代碼', val: 'Op 0080 包裝站' },
            { label: '末站控制碼 (STEUS)', val: '🔴 PP01 (一般廠內加工)' },
            { label: '自動入庫碼次數', val: '0 次 (缺少 PP03/PP08)' },
            { label: '成品自動入庫連動', val: '🛑 未連動 (101 缺失)' }
          ],
          analysis: '【途程防呆缺陷】工單最後一道工序 Op 0080 未設置 PP03 或 PP08，現場完成最後報工後，系統未自動過帳 Mvt 101，產成品庫存未增加，導致工單交付數量為 0！'
        },
        {
          id: 'p4_subcontract',
          icon: '🤝',
          name: 'Pillar 4: 製程委外閉環狀態',
          table: 'EINA / EKPO / MSLB',
          status: 'pass',
          badge: 'INTERNAL / N/A',
          metrics: [
            { label: '工序委外屬性', val: '全廠內自製加工' },
            { label: 'PP02 外部工序', val: '0 站' },
            { label: '委外採購單', val: 'N/A' },
            { label: '狀態', val: '🟢 不受影響' }
          ],
          analysis: '無委外問題。'
        },
        {
          id: 'p5_cogi',
          icon: '🧹',
          name: 'Pillar 5: COGI / AFFW 錯誤異動清理度',
          table: 'AFFW / AFRU / MARD',
          status: 'pass',
          badge: 'AFFW_0',
          metrics: [
            { label: 'AFFW 失敗記錄', val: '0 筆' },
            { label: '線邊倉可用庫存', val: '充足' },
            { label: '狀態', val: '🟢 無倒扣卡單' }
          ],
          analysis: '無倒扣失敗。'
        },
        {
          id: 'p6_afru',
          icon: '⏱️',
          name: 'Pillar 6: 工時確認與產能飽和度',
          table: 'AFRU / CRCO',
          status: 'pass',
          badge: 'CONF_OK',
          metrics: [
            { label: '工單確認狀態', val: 'CNF (全數報工確認)' },
            { label: '已報人工工時', val: '600 分鐘' },
            { label: '報工量', val: '1,000 雙 (100%)' },
            { label: '工時狀態', val: '🟢 工時已如實結算' }
          ],
          analysis: '各站點報工皆已全數確認（CNF），人工與機器工時正常入帳。'
        },
        {
          id: 'p7_settlement',
          icon: '⚖️',
          name: 'Pillar 7: 成本結算規則與 TECO 準備度',
          table: 'COBRA / COBRB / AFPO',
          status: 'warn',
          badge: 'GR_INCOMPLETE',
          metrics: [
            { label: '工單目標數量', val: '1,000 雙' },
            { label: '產成品入庫數量 (AFPO)', val: '🔴 0 雙 (尚未 101 入庫)' },
            { label: 'TECO 結案門檻', val: '🟡 待手動補入庫' },
            { label: '月結差異影響', val: '投入未產出，全數列入 WIP' }
          ],
          analysis: '因末站漏設自動入庫，入庫數量為 0。若直接打 TECO，所有已發原料與工時將被判定為巨大的生產報廢或負差異，必須由生管手動 MB31 補入庫後再行結案。'
        }
      ]
    },

    PRESET_COGI_MONTH_END: {
      id: 'PRESET_COGI_MONTH_END',
      woNumber: '100028475905',
      orderType: 'ZP01',
      label: '🔴 月結前夕 COGI 殘留未清',
      badge: '55 分 (高危)',
      badgeClass: 'badge-rose',
      sub: 'AFFW 殘留 3 筆 / 負庫存 / 阻擋 CO88',
      tweakers: { opt_rel: true, opt_resb_balance: false, opt_sub_541: true, opt_cogi_clean: false, opt_routing_pp03: true },
      stepper: [
        { step: '01', name: '建立 (CRTD)', detail: 'BOM / 途程展開正常', status: 'passed' },
        { step: '02', name: '釋放 (REL)', detail: '正常釋放', status: 'passed' },
        { step: '03', name: '發料 (GI)', detail: '倒扣發料失敗形成懸掛', status: 'blocked' },
        { step: '04', name: '報工 (CNF)', detail: '報工成功但異動失敗', status: 'warning' },
        { step: '05', name: '入庫/TECO', detail: 'AFFW 鎖定！阻擋 CO88 月結', status: 'blocked' }
      ],
      ticket: {
        id: 'TICKET-ERR-COGI',
        raci: 'PP 生管人員 ➔ MM 倉庫人員',
        problem: '🚨 線邊庫存不足引發 3 筆 COGI 殘留！報工倒扣 (261) 失敗，AFFW 記錄未清，月結財務差異計算 (KKS2) 與工單結算 (CO88) 將直接強制中斷！',
        actions: [
          '1. 生管至 COGI 查詢詳細錯誤訊息 (M7021 庫存不足 / 欠缺 120 M 補強布)。',
          '2. 倉庫人員執行 MB1B / MIGO (311) 由總倉調撥原料至線邊儲位。',
          '3. 生管於 COGI 全選錯誤記錄並點擊儲存，完成背景重新過帳。',
          '4. 確認 COGI 歸零後，方可執行 TECO 並通知財務進行 CO88 結算。'
        ]
      },
      pillars: [
        {
          id: 'p1_status',
          icon: '🛡️',
          name: 'Pillar 1: 工單狀態與釋放鎖定',
          table: 'JEST / TJ02T / ZMMT046',
          status: 'pass',
          badge: 'REL / NORMAL',
          metrics: [
            { label: '系統狀態 (JEST)', val: 'REL PRT CNF' },
            { label: '業務凍結標記', val: '無' },
            { label: '備料單鎖定', val: '未鎖定' },
            { label: '流轉狀態', val: '🟢 正常' }
          ],
          analysis: '基本單據狀態正常。'
        },
        {
          id: 'p2_resb',
          icon: '📦',
          name: 'Pillar 2: 物料平衡與 E005 預留鏈',
          table: 'RESB / AFPO / STPO',
          status: 'warn',
          badge: 'PARTIAL_POST',
          metrics: [
            { label: '需求數量 (RESB)', val: '800 YD' },
            { label: '實領扣帳 (RESB)', val: '680 YD' },
            { label: '欠扣掛帳量', val: '🔴 120 YD (卡在 AFFW)' },
            { label: '帳實狀態', val: '🟡 帳面少扣，現場已耗用' }
          ],
          analysis: '倒扣失敗導致實扣數量小於現場實際耗用數量，工單成本投入不完整。'
        },
        {
          id: 'p3_routing',
          icon: '🗺️',
          name: 'Pillar 3: 途程控制碼與自動入庫合法性',
          table: 'PLPO / AFVC / AFVV',
          status: 'pass',
          badge: 'PP03_LEGAL',
          metrics: [
            { label: '末站控制碼', val: 'PP03 (自動 101 入庫)' },
            { label: '全單次數', val: '嚴格 1 次' },
            { label: '途程合規性', val: '🟢 合格' }
          ],
          analysis: '途程末站正確掛載 PP03。'
        },
        {
          id: 'p4_subcontract',
          icon: '🤝',
          name: 'Pillar 4: 製程委外閉環狀態',
          table: 'EINA / EKPO / MSLB',
          status: 'pass',
          badge: 'INTERNAL / N/A',
          metrics: [
            { label: '工序委外屬性', val: '全廠內自製加工' },
            { label: 'PP02 外部工序', val: '0 站' },
            { label: '狀態', val: '🟢 無委外影響' }
          ],
          analysis: '無委外問題。'
        },
        {
          id: 'p5_cogi',
          icon: '🧹',
          name: 'Pillar 5: COGI / AFFW 錯誤異動清理度',
          table: 'AFFW / AFRU / MARD',
          status: 'fail',
          badge: 'COGI_STUCK_3',
          metrics: [
            { label: 'AFFW 失敗記錄', val: '🔴 3 筆 (嚴禁月結)' },
            { label: '主要錯誤代碼', val: 'M7021 (欠缺庫存 120 M)' },
            { label: '受阻過帳類型', val: 'Mvt 261 (自動倒扣)' },
            { label: '月結 CO88 阻擋', val: '🛑 強制中斷月結' }
          ],
          analysis: '【月結高危阻擋】現場報工時線邊倉庫存不足，系統產生 3 筆 AFFW 錯誤異動懸掛。財務執行月結 CO88 時將被直接中止，且嚴禁在 COGI 未清前強上 TECO！'
        },
        {
          id: 'p6_afru',
          icon: '⏱️',
          name: 'Pillar 6: 工時確認與產能飽和度',
          table: 'AFRU / CRCO',
          status: 'pass',
          badge: 'CONF_OK',
          metrics: [
            { label: '工單確認狀態', val: 'CNF (100% 報工)' },
            { label: '報工筆數', val: '5 筆' },
            { label: '人工工時入帳', val: '🟢 人工工時已認列' }
          ],
          analysis: '工時部分已過入成本中心，但物料倒扣部分卡死。'
        },
        {
          id: 'p7_settlement',
          icon: '⚖️',
          name: 'Pillar 7: 成本結算規則與 TECO 準備度',
          table: 'COBRA / COBRB / AFPO',
          status: 'fail',
          badge: 'CO88_BLOCKED',
          metrics: [
            { label: '結算規則 (COBRA)', val: '已維護 (MAT 100%)' },
            { label: 'COGI 清零狀態', val: '🔴 未清零 (3 筆掛帳)' },
            { label: 'TECO 結案門檻', val: '🛑 嚴禁執行 TECO' },
            { label: '財務結算影響', val: 'CO88 結算強制中止' }
          ],
          analysis: '月結四大鐵律第一條：COGI 必須清零！若未清即 TECO，庫存帳將永遠與財務總帳產生斷層差額。'
        }
      ]
    }
  };

  let activeWoPresetKey = 'PRESET_HEALTHY';
  let activeWoTweakers = { ...woPresets.PRESET_HEALTHY.tweakers };

  // Calculate dynamic health score
  function computeHealthScore(tweaks) {
    let score = 0;
    if (tweaks.opt_rel) score += 15;
    if (tweaks.opt_resb_balance) score += 25;
    if (tweaks.opt_sub_541) score += 20;
    if (tweaks.opt_cogi_clean) score += 20;
    if (tweaks.opt_routing_pp03) score += 20;
    return score;
  }

  // Render presets buttons
  function renderWoPresetsButtons() {
    const grid = document.getElementById('presets-grid');
    if (!grid) return;

    grid.innerHTML = Object.keys(woPresets).map(key => {
      const p = woPresets[key];
      const isActive = key === activeWoPresetKey;
      return `
        <button class="preset-chip-btn ${isActive ? 'active' : ''}" onclick="loadWoPreset('${key}')" id="btn-preset-${p.id}">
          <div class="preset-chip-header">
            <span>${p.label}</span>
            <span class="badge-tag ${p.badgeClass}">${p.badge}</span>
          </div>
          <div class="preset-chip-sub">工單 ${p.woNumber} (${p.orderType}) • ${p.sub}</div>
        </button>
      `;
    }).join('');
  }

  // Load Preset
  window.loadWoPreset = function (presetKey) {
    if (!woPresets[presetKey]) return;
    activeWoPresetKey = presetKey;
    const p = woPresets[presetKey];
    activeWoTweakers = { ...p.tweakers };

    const input = document.getElementById('wo-inspector-input');
    if (input) input.value = p.woNumber;

    renderWoPresetsButtons();
    updateWoInspectorDisplay();
    showToast(`🔬 已載入案例：${p.label}`);
  };

  // Toggle What-If switches
  window.toggleWoTweaker = function (tweakKey) {
    if (activeWoTweakers.hasOwnProperty(tweakKey)) {
      activeWoTweakers[tweakKey] = !activeWoTweakers[tweakKey];
      updateWoInspectorDisplay();
      const statusDesc = activeWoTweakers[tweakKey] ? '✔ 正常/已排除' : '🛑 異常/阻擋';
      showToast(`🎛️ 條件已切換：${statusDesc}`);
    }
  };

  // Run Custom Inspection
  window.runWoInspection = function () {
    const input = document.getElementById('wo-inspector-input');
    const val = input ? input.value.trim() : '';

    if (!val) {
      showToast('⚠️ 請輸入 12 碼 SAP 生產工單號碼');
      return;
    }

    // Check if matches preset
    const matchedKey = Object.keys(woPresets).find(k => woPresets[k].woNumber === val);
    if (matchedKey) {
      loadWoPreset(matchedKey);
      return;
    }

    // Custom simulated check
    showToast(`⚡ 正在穿透解析 SAP 工單 [${val}] 底層資料表...`);
    setTimeout(() => {
      activeWoPresetKey = 'PRESET_HEALTHY';
      activeWoTweakers = { ...woPresets.PRESET_HEALTHY.tweakers };
      renderWoPresetsButtons();
      updateWoInspectorDisplay(val);
      showToast(`✅ 工單 [${val}] 七維穿透診斷完畢 (健康指數 100/100)`);
    }, 350);
  };

  // Master update display
  function updateWoInspectorDisplay(customWoNumber) {
    const p = woPresets[activeWoPresetKey];
    const displayWo = customWoNumber || p.woNumber;
    const score = computeHealthScore(activeWoTweakers);

    // 1. Health Gauge
    const scoreNumEl = document.getElementById('inspector-score-num');
    const scoreRingEl = document.getElementById('inspector-score-ring');
    const verdictBadgeEl = document.getElementById('inspector-verdict-badge');
    const metricsSummaryEl = document.getElementById('inspector-metrics-summary');

    if (scoreNumEl) scoreNumEl.textContent = score;

    let ringClass = 'score-high';
    let badgeClass = 'badge-score-high';
    let verdictText = '🟢 體質優良 (可順暢月結)';
    let summaryText = `工單 [${displayWo}] 各項指標健康，物料平衡、無 COGI 殘留、途程自動入庫完備，具備順暢結案條件。`;

    if (score < 60) {
      ringClass = 'score-low';
      badgeClass = 'badge-score-low';
      verdictText = '🔴 高危阻擋 (立即照 RACI 處置)';
      summaryText = `檢測到工單 [${displayWo}] 底層存在嚴重阻擋異常 (E005 斷鏈 / 委外缺料 / COGI 殘留)，月結與入庫受阻，請立即排除！`;
    } else if (score < 80) {
      ringClass = 'score-med';
      badgeClass = 'badge-score-med';
      verdictText = '🟡 注意警示 (需生管介入)';
      summaryText = `工單 [${displayWo}] 存在部分潛在瓶頸或途程警示，建議依照 RACI 處置工單進行預先修正，避免影響交期。`;
    }

    if (scoreRingEl) {
      scoreRingEl.className = `health-score-ring ${ringClass}`;
    }
    if (verdictBadgeEl) {
      verdictBadgeEl.className = `health-verdict-badge ${badgeClass}`;
      verdictBadgeEl.textContent = verdictText;
    }
    if (metricsSummaryEl) {
      metricsSummaryEl.innerHTML = summaryText;
    }

    // 2. Stepper Track
    const stepperTrack = document.getElementById('inspector-stepper-track');
    if (stepperTrack) {
      const step1Status = 'passed';
      const step2Status = activeWoTweakers.opt_rel ? 'passed' : 'blocked';
      const step3Status = !activeWoTweakers.opt_resb_balance ? 'blocked' : (!activeWoTweakers.opt_sub_541 ? 'warning' : 'passed');
      const step4Status = !activeWoTweakers.opt_sub_541 ? 'blocked' : 'passed';
      const step5Status = !activeWoTweakers.opt_cogi_clean ? 'blocked' : (!activeWoTweakers.opt_routing_pp03 ? 'warning' : 'passed');

      const stepsData = [
        { step: '01', name: '建立 (CRTD)', detail: 'BOM / 途程展開正常', status: step1Status },
        { step: '02', name: '釋放 (REL)', detail: activeWoTweakers.opt_rel ? 'ZMMT046 無鎖定 / 正常釋放' : 'CRTD 狀態未釋放 / 阻擋', status: step2Status },
        { step: '03', name: '發料 (GI)', detail: !activeWoTweakers.opt_resb_balance ? 'E005 斷鏈！RESB-ENMNG 擅改' : (!activeWoTweakers.opt_sub_541 ? '委外原料未做 541 移轉' : 'RESB 扣帳平衡無斷鏈'), status: step3Status },
        { step: '04', name: '報工/委外 (CONF)', detail: !activeWoTweakers.opt_sub_541 ? '委外庫存不足阻擋 101/543' : 'AFRU 正常記錄 / 工時吻合', status: step4Status },
        { step: '05', name: '入庫月結 (TECO)', detail: !activeWoTweakers.opt_cogi_clean ? 'AFFW 殘留！阻擋 CO88' : (!activeWoTweakers.opt_routing_pp03 ? '末站非 PP03 / 101 缺失' : 'PP03 自動 101 / 結算就緒'), status: step5Status }
      ];

      stepperTrack.innerHTML = stepsData.map(st => {
        const statusClass = st.status === 'passed' ? 'node-passed' : st.status === 'blocked' ? 'node-blocked' : st.status === 'warning' ? 'node-warning' : 'node-pending';
        const icon = st.status === 'passed' ? '✅' : st.status === 'blocked' ? '🛑' : st.status === 'warning' ? '⚠️' : '⏳';
        return `
          <div class="stepper-node ${statusClass}">
            <div class="stepper-node-top">
              <span class="stepper-node-step">STAGE ${st.step}</span>
              <span>${icon}</span>
            </div>
            <div class="stepper-node-name">${st.name}</div>
            <div class="stepper-node-detail">${st.detail}</div>
          </div>
        `;
      }).join('');
    }

    // 3. Action Dispatch Ticket
    const ticketBox = document.getElementById('inspector-action-ticket');
    if (ticketBox) {
      let ticketId = 'TICKET-WO-PASS';
      let ticketRaci = 'PP 生管人員 (例行監控)';
      let ticketProblem = `✅ 工單 [${displayWo}] 各項指標全數通過體檢，無異常阻擋。`;
      let ticketActions = [
        '維持現場正常 MES 輪次派工，定期查核報工工時。',
        '完工入庫後直接排入月底批次 TECO 作業 (FSH_PCW / COHV)。'
      ];

      if (!activeWoTweakers.opt_resb_balance) {
        ticketId = 'TICKET-ERR-E005';
        ticketRaci = 'PP 生管人員 ➔ MM 倉庫人員';
        ticketProblem = `🚨 工單 [${displayWo}] RESB-ENMNG>0 領料後改單！STPO 關聯碼遺失，引發 E005 系統阻擋！`;
        ticketActions = [
          '嚴禁在 CO02 直接手動增刪已領料元件，避免破壞預留清單關聯。',
          '生管立即至 ZPP024 開立退料申請單 (數量需等於已領數)。',
          '倉庫人員至 ZMM047 / MIGO 262 執行退料過帳將實領數歸零。',
          '生管使用標準交易碼 ZPP010 重新讀取 BOM 抽換料件。'
        ];
      } else if (!activeWoTweakers.opt_cogi_clean) {
        ticketId = 'TICKET-ERR-COGI';
        ticketRaci = 'PP 生管人員 ➔ MM 倉庫人員';
        ticketProblem = `🚨 工單 [${displayWo}] 殘留 AFFW / COGI 失敗異動！負庫存錯誤阻擋月結財務差異結算 (CO88)。`;
        ticketActions = [
          '生管進入 COGI 查看錯誤原因 (如 M7021 庫存不足)。',
          '倉庫使用 MB1B / MIGO (311) 撥補原料至現場線邊倉。',
          '生管於 COGI 全選錯誤記錄並儲存重新過帳。',
          '確認 COGI 歸零後方可執行 TECO 與通知財務結帳。'
        ];
      } else if (!activeWoTweakers.opt_sub_541) {
        ticketId = 'TICKET-ERR-SUB541';
        ticketRaci = 'MM 倉管人員 ➔ MM 採購人員';
        ticketProblem = `🚨 工單 [${displayWo}] 製程委外 (PP02) 供應商原料在庫不足！加工品回廠將阻擋 MIGO 101/543。`;
        ticketActions = [
          '嚴禁現場在 CO11N 手動報工 PP02 製程委外站。',
          '倉庫至 ME27 或 MIGO (541) 執行原料外發至供應商特殊庫存。',
          '至 ME2O 核對在庫充足後，廠商交貨時倉管執行 MIGO 101 收貨。'
        ];
      } else if (!activeWoTweakers.opt_routing_pp03) {
        ticketId = 'TICKET-WARN-RT01';
        ticketRaci = 'PP 生管人員 ➔ IE 生產工程';
        ticketProblem = `⚠️ 工單 [${displayWo}] 途程末站缺少 PP03/PP08 自動入庫碼！報工完成後產成品庫存不會自動增加。`;
        ticketActions = [
          '現場若已完成報工，生管需手動使用 MB31 (101) 補辦成品入庫。',
          '聯絡 IE 工程人員至 CA02 修正量產途程，將末站控制碼改為 PP03。',
          '檢查全單是否有其他站點誤設 PP03，確保全單唯一次數為 1。'
        ];
      } else if (!activeWoTweakers.opt_rel) {
        ticketId = 'TICKET-ACTION-REL';
        ticketRaci = 'PP 生管人員';
        ticketProblem = `⚠️ 工單 [${displayWo}] 尚未釋放 (CRTD) 或遭 ZMMT046 備料單鎖定！現場無法發料與報工。`;
        ticketActions = [
          '進入 CO02 或 ZPP015 執行工單釋放 (REL)。',
          '若被 ZMMT046 鎖定 (狀態 I/M)，聯絡倉庫人員取消備料單解鎖。'
        ];
      }

      ticketBox.innerHTML = `
        <div class="ticket-header">
          <span class="ticket-id-tag">🎫 ${ticketId}</span>
          <span class="ticket-raci-pill">責任：${ticketRaci}</span>
        </div>
        <div class="ticket-problem">${ticketProblem}</div>
        <div class="ticket-actions-list">
          ${ticketActions.map((act, idx) => `
            <div class="ticket-action-item">
              <span class="ticket-action-num">${idx + 1}</span>
              <span>${act}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 4. Tweaker Toggles List
    const tweakerList = document.getElementById('tweaker-toggles-list');
    if (tweakerList) {
      const tweakerConfigs = [
        { key: 'opt_rel', label: '1. 工單狀態已釋放 (REL) 無鎖定 (+15分)' },
        { key: 'opt_resb_balance', label: '2. 預留扣帳平衡無 E005 斷鏈 (+25分)' },
        { key: 'opt_sub_541', label: '3. 製程委外已完成 541 原料外發 (+20分)' },
        { key: 'opt_cogi_clean', label: '4. AFFW / COGI 失敗異動全數清零 (+20分)' },
        { key: 'opt_routing_pp03', label: '5. 途程末站合法配置 PP03 自動入庫 (+20分)' }
      ];

      tweakerList.innerHTML = tweakerConfigs.map(cfg => {
        const isChecked = activeWoTweakers[cfg.key];
        return `
          <div class="tweaker-item">
            <span>${cfg.label}</span>
            <input 
              type="checkbox" 
              class="tweaker-checkbox" 
              ${isChecked ? 'checked' : ''} 
              onchange="toggleWoTweaker('${cfg.key}')"
              id="tweaker-${cfg.key}"
            >
          </div>
        `;
      }).join('');
    }

    // 5. 7 Pillars Cards Container
    const pillarsContainer = document.getElementById('inspector-pillars-container');
    if (pillarsContainer) {
      pillarsContainer.innerHTML = p.pillars.map(pil => {
        let pilStatus = pil.status;
        let pilAnalysis = pil.analysis;
        let pilBadge = pil.badge;

        // Dynamic override based on active tweaks
        if (pil.id === 'p1_status') {
          pilStatus = activeWoTweakers.opt_rel ? 'pass' : 'fail';
          if (!activeWoTweakers.opt_rel) {
            pilBadge = 'CRTD_LOCKED';
            pilAnalysis = '工單處於 CRTD 未釋放狀態，或遭 ZMMT046 備料單鎖定，現場禁止發料與報工！';
          }
        } else if (pil.id === 'p2_resb') {
          pilStatus = activeWoTweakers.opt_resb_balance ? 'pass' : 'fail';
          if (!activeWoTweakers.opt_resb_balance) {
            pilBadge = 'E005_ERROR';
            pilAnalysis = '【阻擋】RESB-ENMNG > 0 領料後改單，破壞 STPO-ZZFIRST 關聯碼，嚴禁在 CO02 改元件，必須開 ZPP024 退料歸零後以 ZPP010 改單！';
          }
        } else if (pil.id === 'p3_routing') {
          pilStatus = activeWoTweakers.opt_routing_pp03 ? 'pass' : 'fail';
          if (!activeWoTweakers.opt_routing_pp03) {
            pilBadge = 'ROUTING_ERR';
            pilAnalysis = '【途程異常】末站工序未掛載 PP03/PP08 自動入庫控制碼，現場報工後成品庫存不會自動增加！需手動 MB31 補入庫並請 IE CA02 修正。';
          }
        } else if (pil.id === 'p4_subcontract') {
          pilStatus = activeWoTweakers.opt_sub_541 ? 'pass' : 'fail';
          if (!activeWoTweakers.opt_sub_541) {
            pilBadge = '541_LACKING';
            pilAnalysis = '【委外中斷】採購已開立委外 PO，但倉庫尚未以 Mvt 541 外發原料！供應商特殊庫存為 0，加工品送回時無法過帳 MIGO 101/543。';
          }
        } else if (pil.id === 'p5_cogi') {
          pilStatus = activeWoTweakers.opt_cogi_clean ? 'pass' : 'fail';
          if (!activeWoTweakers.opt_cogi_clean) {
            pilBadge = 'COGI_STUCK';
            pilAnalysis = '【月結高危】現場報工倒扣失敗產生 AFFW / COGI 殘留，負庫存錯誤阻擋 CO88 差異結算，必須先由倉庫補庫存並於 COGI 重新過帳清零！';
          }
        } else if (pil.id === 'p6_afru') {
          pilStatus = (activeWoTweakers.opt_rel && activeWoTweakers.opt_sub_541) ? 'pass' : 'warn';
        } else if (pil.id === 'p7_settlement') {
          pilStatus = (activeWoTweakers.opt_cogi_clean && activeWoTweakers.opt_resb_balance && activeWoTweakers.opt_routing_pp03) ? 'pass' : 'fail';
          if (pilStatus === 'fail') {
            pilBadge = 'TECO_BLOCKED';
            pilAnalysis = '存在未平衡預留、COGI 殘留或成品未入庫，嚴禁上 TECO！強行結案將引發財務損益重大斷層與跨月重工差異。';
          }
        }

        const statusClass = pilStatus === 'pass' ? 'status-pass' : pilStatus === 'warn' ? 'status-warn' : 'status-fail';
        const badgeTagClass = pilStatus === 'pass' ? 'badge-emerald' : pilStatus === 'warn' ? 'badge-amber' : 'badge-rose';

        return `
          <div class="pillar-card ${statusClass}">
            <div class="pillar-header">
              <div class="pillar-name-group">
                <span class="pillar-icon">${pil.icon}</span>
                <span class="pillar-name">${pil.name}</span>
              </div>
              <span class="badge-tag ${badgeTagClass}">${pilBadge}</span>
            </div>

            <div class="pillar-content-grid">
              ${pil.metrics.map(m => `
                <div>
                  <span class="pillar-label">${m.label}</span>
                  <span class="pillar-val">${m.val}</span>
                </div>
              `).join('')}
            </div>

            <div class="pillar-analysis">
              ${pilAnalysis}
            </div>

            <div class="pillar-footer">
              <span>底層對應資料表：<code>${pil.table}</code></span>
              <span>狀態：<strong>${pilStatus === 'pass' ? '🟢 通過體檢' : pilStatus === 'warn' ? '🟡 需注意' : '🔴 阻擋違規'}</strong></span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function renderWoInspector() {
    renderWoPresetsButtons();
    updateWoInspectorDisplay();
  }

  // Initial Renders
  renderIssues();
  renderDecisionTree();
  renderOrderMatrix();
  renderControlKeys();
  renderChecklist();
  renderRaci();
  renderTcodes();
  renderScenarioFlows();
  updateCalculations();
  renderRecommender();
  renderRoutingPipeline();
  simulateAction('ACTION_STATE_INSPECT');
  simulateSubAction('ACT_SUB_INSPECT');
  renderWoInspector();

  console.log("SAP PP Go-Live Interactive Triage Suite ready with Module 10 WO Lifecycle Inspector.");
});


