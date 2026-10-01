let chemListEditorTab = 'compounds';
let chemListEditorSearch = '';
let listEditorLoaded = false;
async function renderListEditor() {
  const hasAccess = await checkPracticeAccess();
  if (!hasAccess) return;
  await Promise.all([chemInitApp(), reagentInitApp(), pkaInitApp()]);
  const root = document.getElementById('list-editor-root');
  if (!root) return;
  root.innerHTML = `
      <style>
        #list-editor-items::-webkit-scrollbar {
          width: 6px;
        }
        #list-editor-items::-webkit-scrollbar-track {
          background: transparent;
        }
        #list-editor-items::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 3px;
        }
        #list-editor-items::-webkit-scrollbar-thumb:hover {
          background: var(--text3);
        }
      </style>
      <div class="list-editor-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap: 10px; flex-wrap: wrap;">
        <div class="chem-board-tabs" style="margin:0;">
          <button class="chem-tab-btn ${chemListEditorTab === 'compounds' ? 'active' : ''}" id="list-editor-tab-compounds" onclick="setListEditorTab('compounds')">
            Compounds (${chemMyData.myList.length}/${chemAllCompounds.length})
          </button>
          <button class="chem-tab-btn ${chemListEditorTab === 'reagents' ? 'active' : ''}" id="list-editor-tab-reagents" onclick="setListEditorTab('reagents')">
            Reagents (${reagentMyData.myList.length}/${reagentAllReagents.length})
          </button>
          <button class="chem-tab-btn ${chemListEditorTab === 'pka' ? 'active' : ''}" id="list-editor-tab-pka" onclick="setListEditorTab('pka')">
            pKa (${pkaMyData.myList.length}/${pkaAllCompounds.length})
          </button>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="chem-btn chem-btn-ghost" style="min-height:30px; font-size:12px; padding:4px 10px;" onclick="listEditorSelectAll(true)">Select All</button>
          <button class="chem-btn chem-btn-ghost" style="min-height:30px; font-size:12px; padding:4px 10px;" onclick="listEditorSelectAll(false)">Deselect All</button>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <input type="text" id="list-editor-search" placeholder="Search ${chemListEditorTab === 'compounds' ? 'compounds...' : chemListEditorTab === 'reagents' ? 'reagents...' : 'pKa compounds...'}"
          style="width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg3); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; transition: border-color 0.2s;"
          value="${escapeHtml(chemListEditorSearch)}" oninput="handleListEditorSearch(this.value)" />
      </div>
      <div id="list-editor-items" style="max-height: 250px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg2);">
      </div>
    `;
  renderListEditorItems();
}
function renderListEditorItems() {
  const container = document.getElementById('list-editor-items');
  if (!container) return;
  const searchLower = chemListEditorSearch.toLowerCase().trim();
  if (chemListEditorTab === 'compounds') {
    const filtered = chemAllCompounds.filter(c => c.name.toLowerCase().includes(searchLower) || c.smiles && c.smiles.toLowerCase().includes(searchLower));
    if (!filtered.length) {
      container.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text3); font-size: 13px;">No compounds found.</div>`;
      return;
    }
    container.innerHTML = filtered.map(c => {
      const isChecked = chemMyData.myList.includes(c.name);
      return `
          <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: all 0.2s; user-select: none;">
            <input type="checkbox" style="cursor: pointer; accent-color: var(--accent);" ${isChecked ? 'checked' : ''} onchange="toggleListEditorCompound('${escapeHtml(c.name)}', this.checked)" />
            <div style="font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
          </label>
        `;
    }).join('');
  } else if (chemListEditorTab === 'reagents') {
    const filtered = reagentAllReagents.filter(r => r.toLowerCase().includes(searchLower));
    if (!filtered.length) {
      container.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text3); font-size: 13px;">No reagents found.</div>`;
      return;
    }
    container.innerHTML = filtered.map(r => {
      const isChecked = reagentMyData.myList.includes(r);
      return `
          <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: all 0.2s; user-select: none;">
            <input type="checkbox" style="cursor: pointer; accent-color: var(--accent);" ${isChecked ? 'checked' : ''} onchange="toggleListEditorReagent('${escapeHtml(r)}', this.checked)" />
            <div style="font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r)}">${escapeHtml(r)}</div>
          </label>
        `;
    }).join('');
  } else if (chemListEditorTab === 'pka') {
    const filtered = pkaAllCompounds.filter(c => c.name.toLowerCase().includes(searchLower));
    if (!filtered.length) {
      container.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text3); font-size: 13px;">No pKa compounds found.</div>`;
      return;
    }
    container.innerHTML = filtered.map(c => {
      const isChecked = pkaMyData.myList.includes(c.name);
      return `
          <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: all 0.2s; user-select: none;">
            <input type="checkbox" style="cursor: pointer; accent-color: var(--accent);" ${isChecked ? 'checked' : ''} onchange="toggleListEditorPka('${escapeHtml(c.name)}', this.checked)" />
            <div style="font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
          </label>
        `;
    }).join('');
  }
}
window.setListEditorTab = function (tab) {
  chemListEditorTab = tab;
  renderListEditor();
};
window.handleListEditorSearch = function (val) {
  chemListEditorSearch = val;
  renderListEditorItems();
};
window.toggleListEditorCompound = function (name, isChecked) {
  if (isChecked) {
    if (!chemMyData.myList.includes(name)) {
      chemMyData.myList.push(name);
      if (!chemMyData.stats[name]) {
        chemMyData.stats[name] = {
          wrong: 0,
          correct: 0,
          streak: 0,
          lastSeen: 0
        };
      }
    }
  } else {
    chemMyData.myList = chemMyData.myList.filter(n => n !== name);
  }
  chemSave();
  chemSyncAll(false);
  const tabBtn = document.getElementById('list-editor-tab-compounds');
  if (tabBtn) {
    tabBtn.textContent = `Compounds (${chemMyData.myList.length}/${chemAllCompounds.length})`;
  }
};
window.toggleListEditorReagent = function (name, isChecked) {
  if (isChecked) {
    if (!reagentMyData.myList.includes(name)) {
      reagentMyData.myList.push(name);
      const newReactions = reagentAllReactions.filter(r => r.Reagent === name);
      newReactions.forEach(r => {
        const key = `${r.Reactant} | ${r.Reagent} | ${r.Product}`;
        if (!reagentMyData.stats[key]) {
          reagentMyData.stats[key] = {
            wrong: 0,
            correct: 0,
            streak: 0,
            lastSeen: 0
          };
        }
      });
    }
  } else {
    reagentMyData.myList = reagentMyData.myList.filter(r => r !== name);
  }
  reagentSave();
  chemSave();
  chemSyncAll(false);
  const tabBtn = document.getElementById('list-editor-tab-reagents');
  if (tabBtn) {
    tabBtn.textContent = `Reagents (${reagentMyData.myList.length}/${reagentAllReagents.length})`;
  }
};
window.toggleListEditorPka = function (name, isChecked) {
  if (isChecked) {
    if (!pkaMyData.myList.includes(name)) {
      pkaMyData.myList.push(name);
      if (!pkaMyData.stats[name]) {
        pkaMyData.stats[name] = {
          wrong: 0,
          correct: 0,
          streak: 0,
          lastSeen: 0
        };
      }
    }
  } else {
    pkaMyData.myList = pkaMyData.myList.filter(n => n !== name);
  }
  pkaSave();
  chemSyncAll(false);
  const tabBtn = document.getElementById('list-editor-tab-pka');
  if (tabBtn) {
    tabBtn.textContent = `pKa (${pkaMyData.myList.length}/${pkaAllCompounds.length})`;
  }
};
window.listEditorSelectAll = function (selectAll) {
  const searchLower = chemListEditorSearch.toLowerCase().trim();
  if (chemListEditorTab === 'compounds') {
    const filtered = chemAllCompounds.filter(c => c.name.toLowerCase().includes(searchLower) || c.smiles && c.smiles.toLowerCase().includes(searchLower));
    filtered.forEach(c => {
      if (selectAll) {
        if (!chemMyData.myList.includes(c.name)) {
          chemMyData.myList.push(c.name);
          if (!chemMyData.stats[c.name]) {
            chemMyData.stats[c.name] = {
              wrong: 0,
              correct: 0,
              streak: 0,
              lastSeen: 0
            };
          }
        }
      } else {
        chemMyData.myList = chemMyData.myList.filter(n => n !== c.name);
      }
    });
    chemSave();
    chemSyncAll(false);
  } else if (chemListEditorTab === 'reagents') {
    const filtered = reagentAllReagents.filter(r => r.toLowerCase().includes(searchLower));
    filtered.forEach(r => {
      if (selectAll) {
        if (!reagentMyData.myList.includes(r)) {
          reagentMyData.myList.push(r);
          const newReactions = reagentAllReactions.filter(x => x.Reagent === r);
          newReactions.forEach(x => {
            const key = `${x.Reactant} | ${x.Reagent} | ${x.Product}`;
            if (!reagentMyData.stats[key]) {
              reagentMyData.stats[key] = {
                wrong: 0,
                correct: 0,
                streak: 0,
                lastSeen: 0
              };
            }
          });
        }
      } else {
        reagentMyData.myList = reagentMyData.myList.filter(x => x !== r);
      }
    });
    reagentSave();
    chemSave();
    chemSyncAll(false);
  } else if (chemListEditorTab === 'pka') {
    const filtered = pkaAllCompounds.filter(c => c.name.toLowerCase().includes(searchLower));
    filtered.forEach(c => {
      if (selectAll) {
        if (!pkaMyData.myList.includes(c.name)) {
          pkaMyData.myList.push(c.name);
          if (!pkaMyData.stats[c.name]) {
            pkaMyData.stats[c.name] = {
              wrong: 0,
              correct: 0,
              streak: 0,
              lastSeen: 0
            };
          }
        }
      } else {
        pkaMyData.myList = pkaMyData.myList.filter(n => n !== c.name);
      }
    });
    pkaSave();
    chemSyncAll(false);
  }
  renderListEditor();
};
window.chemToggleTextMode = function (el) {
  localStorage.setItem(getUserStorageKey('chem_setting_text_mode'), el.checked ? 'true' : 'false');
};
window.chemToggleWizardMode = function (el) {
  localStorage.setItem(getUserStorageKey('chem_setting_wizard_mode'), el.checked ? 'true' : 'false');
  chemUpdatePracticeButton();
};
window.chemChangeRenderer = function (val) {
  localStorage.setItem(getUserStorageKey('chem_setting_renderer'), val);
  if (val === 'rdkit') {
    loadRDKitDynamic().then(() => {
      chemShowToast("RDKit JS loaded successfully!");
      chemRefreshCurrentDrawing();
    }).catch(() => {
      chemShowToast("Failed to load RDKit JS. Using Smiles Drawer.");
      const rendererSelect = document.getElementById('chem-setting-renderer');
      if (rendererSelect) rendererSelect.value = 'smiles';
      localStorage.setItem(getUserStorageKey('chem_setting_renderer'), 'smiles');
    });
  } else {
    chemRefreshCurrentDrawing();
  }
};
function chemUpdatePracticeButton() {
  const btn = document.getElementById('chem-btn-practice');
  if (!btn) return;
  const wizardMode = localStorage.getItem(getUserStorageKey('chem_setting_wizard_mode')) === 'true';
  if (wizardMode) {
    btn.textContent = 'Run';
    btn.classList.add('chem-btn-primary');
    btn.classList.remove('chem-btn-secondary');
  } else {
    btn.textContent = 'Practice Mode';
    btn.classList.add('chem-btn-secondary');
    btn.classList.remove('chem-btn-primary');
  }
}
