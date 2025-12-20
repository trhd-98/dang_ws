/**
 * TouchDesigner Dynamic Controller
 * Generates UI based on schema.json and state.json
 */

const schemas = []; // Array of { id, title, schema, state, currentTab }
let socket = null;

const windowContainer = document.getElementById('window-container');
const WS_URL = 'wss://dang-ws.onrender.com/ws';

function connect() {
    socket = new WebSocket(WS_URL);
    socket.onopen = () => {
        document.querySelector('.status-pill').style.opacity = '1';
        console.log('Connected to TD');
        socket.send(JSON.stringify({ type: 'client_ready' }));
    };
    socket.onclose = () => {
        document.querySelector('.status-pill').style.opacity = '0.5';
        setTimeout(connect, 3000);
    };
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'schema_update') {
                handleSchemaUpdate(data);
            } else if (data.type === 'parameter_update') {
                handleExternalUpdate(data.id, data.values);
            } else if (data.type === 'remove_window') {
                handleWindowRemoval(data.id);
            } else if (data.type === 'ping') {
                return; // Ignore heartbeats
            } else {
                handleExternalUpdate(null, data);
            }
        } catch (e) {
            console.error(e);
        }
    };
}

// Toast Notification System
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        info: 'ℹ',
        warning: '⚠'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function handleSchemaUpdate(data) {
    let { id, title, schema, state } = data;
    if (typeof schema === 'string') schema = JSON.parse(schema);
    if (typeof state === 'string') state = JSON.parse(state);

    // Dynamic Multi-COMP Support: Upsert based on ID
    let s = schemas.find(x => x.id === id);
    const isNew = !s;

    if (!s) {
        s = { id, title, schema, state, currentTab: Object.keys(schema)[0] };
        schemas.push(s);
        showToast('Operation Linked', `${title} is now connected`, 'success');
    } else {
        s.title = title;
        s.schema = schema;
        s.state = state;
        showToast('Operation Updated', `${title} parameters refreshed`, 'info');
    }
    renderWindows();
}

function handleExternalUpdate(targetId, updates) {
    const targets = targetId ? schemas.filter(s => s.id === targetId) : schemas;

    targets.forEach(s => {
        Object.keys(updates).forEach(key => {
            if (s.state[key]) {
                s.state[key][0] = updates[key];
            } else {
                s.state[key] = [updates[key]];
            }

            const windowId = s.id;
            const input = document.getElementById(`input-${windowId}-${key}`);
            const display = document.getElementById(`value-${windowId}-${key}`);

            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = updates[key];
                } else if (document.activeElement !== input && !input.isInteracting) {
                    input.value = updates[key];
                }
            }

            if (display) {
                const val = updates[key];
                display.textContent = (typeof val === 'number' && !Number.isInteger(val)) ? val.toFixed(3) : val;
            }
        });
    });
}

function handleWindowRemoval(id) {
    const win = document.getElementById(`window-${id}`);
    if (win) {
        const schema = schemas.find(s => s.id === id);
        const title = schema ? schema.title : 'Operation';

        win.remove();
        const index = schemas.findIndex(s => s.id === id);
        if (index > -1) schemas.splice(index, 1);

        showToast('Operation Unlinked', `${title} has been disconnected`, 'warning');
    }
}

function sendUpdate(windowId, param, value) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'parameter_update',
            id: windowId,
            [param]: value
        }));
    }
}



function renderWindows() {
    windowContainer.innerHTML = '';
    schemas.forEach(s => {
        const pageNames = Object.keys(s.schema);
        const firstPage = pageNames[0];
        const otherPages = pageNames.slice(1);

        const win = document.createElement('div');
        win.className = 'schema-window';
        win.id = `window-${s.id}`;
        win.innerHTML = `
            <div class="window-header">
                <div class="window-title-bar">
                    <span class="window-title">${s.title}</span>
                    <div class="window-controls">
                        <button class="toggle-btn" onclick="exportSchema('${s.id}')" title="Export Schema">
                            <span class="icon">⤓</span>
                        </button>
                        <button class="toggle-btn" onclick="toggleWindow('${s.id}')" title="Collapse/Expand">
                            <span class="icon">▼</span>
                        </button>
                    </div>
                </div>
            </div>
            <div class="window-body">
                <div class="primary-section">
                    <div class="section-header">
                        <span class="section-tag">PRIMARY</span>
                        <h4>${firstPage}</h4>
                    </div>
                    <div class="window-content" id="content-${s.id}-${firstPage}"></div>
                </div>

                ${otherPages.length > 0 ? `
                <div class="advanced-section" id="advanced-${s.id}">
                    <button class="advanced-toggle" onclick="toggleAdvanced('${s.id}')">
                        <span class="icon">⚙</span> 
                        <span class="text">More Settings (${otherPages.length})</span>
                        <span class="arrow">▼</span>
                    </button>
                    <div class="advanced-drawer" id="drawer-${s.id}" style="display: none;">
                        <nav class="window-tabs" id="tabs-${s.id}"></nav>
                        <div class="window-content" id="content-advanced-${s.id}"></div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        windowContainer.appendChild(win);

        renderSettings(s, firstPage, `content-${s.id}-${firstPage}`);
        if (otherPages.length > 0) {
            renderTabs(s, otherPages);
            selectTab(s.id, otherPages[0], true);
        }
    });
}

function toggleAdvanced(id) {
    const drawer = document.getElementById(`drawer-${id}`);
    const btn = document.querySelector(`#advanced-${id} .advanced-toggle`);
    const isHidden = drawer.style.display === 'none';
    drawer.style.display = isHidden ? 'flex' : 'none';
    btn.classList.toggle('active', isHidden);
}

function toggleWindow(id) {
    document.getElementById(`window-${id}`).classList.toggle('collapsed');
}

function renderTabs(s, pageNames) {
    const tabNav = document.getElementById(`tabs-${s.id}`);
    if (!tabNav) return;
    pageNames.forEach(pageName => {
        const tab = document.createElement('div');
        tab.className = 'window-tab';
        tab.textContent = pageName;
        tab.onclick = () => selectTab(s.id, pageName, true);
        tab.dataset.page = pageName;
        tabNav.appendChild(tab);
    });
}

function selectTab(windowId, pageName, isAdvanced = false) {
    const s = schemas.find(x => x.id === windowId);
    if (!s) return;
    if (isAdvanced) {
        const tabNav = document.getElementById(`tabs-${windowId}`);
        if (tabNav) {
            tabNav.querySelectorAll('.window-tab').forEach(t => t.classList.remove('active'));
            const activeTab = tabNav.querySelector(`[data-page="${pageName}"]`);
            if (activeTab) activeTab.classList.add('active');
        }
        renderSettings(s, pageName, `content-advanced-${windowId}`);
    } else {
        renderSettings(s, pageName, `content-${windowId}-${pageName}`);
    }
}

function renderSettings(s, pageName, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const params = s.schema[pageName];

    Object.entries(params).forEach(([paramKey, paramSpec]) => {
        if (paramSpec.enable === false) return;
        const card = document.createElement('div');
        card.className = 'setting-card';
        if (paramSpec.size > 1) {
            renderMultiValueControl(card, s.id, paramKey, paramSpec, s.state);
        } else {
            renderSingleValueControl(card, s.id, paramKey, paramSpec, s.state);
        }
        container.appendChild(card);
    });
}

function renderSingleValueControl(container, windowId, key, spec, state) {
    const val = state[key] ? state[key][0] : spec.default;
    const isStr = spec.style === 'Str';

    container.innerHTML = `
        <div class="setting-label">
            <span class="setting-name">${spec.label}</span>
            ${!isStr ? `<span class="setting-value editable-value" id="value-${windowId}-${key}" onclick="makeValueEditable(event, '${windowId}', '${key}', ${val})">${val}</span>` : ''}
        </div>
        <div class="control-row">
            ${getControlHtml(windowId, key, spec, val)}
        </div>
    `;
    attachEvents(container, windowId, key, spec);
}

function renderMultiValueControl(container, windowId, key, spec, state) {
    const is2D = spec.style === 'XY' || spec.style === 'XYZ' || spec.style === 'UV' || spec.style === 'UVW';
    const isColor = spec.style === 'RGB' || spec.style === 'RGBA';

    if (isColor) {
        renderColorControl(container, windowId, key, spec, state);
        return;
    }

    container.innerHTML = `
        <div class="setting-label">
            <span class="setting-name">${spec.label}</span>
            ${is2D && spec.size === 2 ? `<button class="pad-btn" onclick="toggle2DPad(event, '${windowId}', '${key}')" title="2D Pad"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="12" cy="12" r="1"></circle></svg></button>` : ''}
        </div>
        <div class="multi-control-grid">
            ${getMultiControlHtml(windowId, key, spec, state)}
        </div>
        ${is2D && spec.size === 2 ? `<div id="pad-${windowId}-${key}" class="pad-overlay" style="display:none">
            <div class="pad-area" onmousedown="startPadDrag(event, '${windowId}', '${key}')">
                <div class="pad-cursor" id="cursor-${windowId}-${key}"></div>
            </div>
            <div class="pad-footer"><span id="pad-vals-${windowId}-${key}">0.000, 0.000</span><button onclick="toggle2DPad(null, '${windowId}', '${key}')">Close</button></div>
        </div>` : ''}
    `;

    const suffixes = getSuffixes(spec);
    suffixes.forEach(s => attachEvents(container, windowId, `${key}${s}`, spec));
}

function renderColorControl(container, windowId, key, spec, state) {
    const suffixes = getSuffixes(spec);

    // Improved lookup: TD sometimes uses 'colorr' vs 'Colorr'
    const getParamVal = (s) => {
        const fullKey = `${key}${s}`.toLowerCase();
        const actualKey = Object.keys(state).find(k => k.toLowerCase() === fullKey);
        return (actualKey && state[actualKey]) ? state[actualKey][0] : 0.5;
    };

    const r = getParamVal(suffixes[0]);
    const g = getParamVal(suffixes[1]);
    const b = getParamVal(suffixes[2]);

    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
    const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    container.innerHTML = `
        <div class="setting-label">
            <span class="setting-name">${spec.label}</span>
            <span class="setting-value" id="color-val-${windowId}-${key}">${hexColor.toUpperCase()}</span>
        </div>
        <div class="color-control-row">
            <div class="color-picker-wrapper">
                <input type="color" class="color-picker-input" value="${hexColor}">
                <div class="picker-preview" style="background-color: ${hexColor}"></div>
            </div>
            <div class="color-sliders">
                ${suffixes.map(s => {
        const val = getParamVal(s);
        return `
                        <div class="color-mini-row">
                            <span class="color-tag">${s.toUpperCase()}</span>
                            <input type="range" class="color-slider" data-suffix="${s}" min="0" max="1" step="0.001" value="${val}">
                            <span class="mini-val">${val.toFixed(2)}</span>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;

    const picker = container.querySelector('.color-picker-input');
    const preview = container.querySelector('.picker-preview');
    const colorValDisplay = container.querySelector(`#color-val-${windowId}-${key}`);
    const sliders = container.querySelectorAll('.color-slider');

    picker.addEventListener('input', (e) => {
        const hex = e.target.value;
        const rv = parseInt(hex.slice(1, 3), 16) / 255;
        const gv = parseInt(hex.slice(3, 5), 16) / 255;
        const bv = parseInt(hex.slice(5, 7), 16) / 255;

        preview.style.backgroundColor = hex;
        colorValDisplay.textContent = hex.toUpperCase();

        updateParam(windowId, `${key}${suffixes[0]}`, rv);
        updateParam(windowId, `${key}${suffixes[1]}`, gv);
        updateParam(windowId, `${key}${suffixes[2]}`, bv);

        // Update slider values visually
        container.querySelectorAll('.color-slider').forEach((slider, i) => {
            const vals = [rv, gv, bv];
            slider.value = vals[i];
            slider.parentElement.querySelector('.mini-val').textContent = vals[i].toFixed(2);
        });
    });

    sliders.forEach(slider => {
        slider.addEventListener('input', () => {
            const rVal = parseFloat(container.querySelector('[data-suffix="r"]').value);
            const gVal = parseFloat(container.querySelector('[data-suffix="g"]').value);
            const bVal = parseFloat(container.querySelector('[data-suffix="b"]').value);

            const newHex = `#${toHex(rVal)}${toHex(gVal)}${toHex(bVal)}`;
            picker.value = newHex;
            preview.style.backgroundColor = newHex;
            colorValDisplay.textContent = newHex.toUpperCase();

            slider.parentElement.querySelector('.mini-val').textContent = parseFloat(slider.value).toFixed(2);
            sendUpdate(windowId, `${key}${slider.dataset.suffix}`, parseFloat(slider.value));
        });
    });
}

function makeValueEditable(event, windowId, key, currentVal) {
    const display = event.target;
    if (display.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'inline-edit-input';
    input.value = currentVal;
    display.textContent = '';
    display.appendChild(input);
    input.focus();
    input.select();

    const finishEdit = () => {
        let newVal = parseFloat(input.value);
        if (isNaN(newVal)) newVal = currentVal;
        display.textContent = (typeof newVal === 'number' && !Number.isInteger(newVal)) ? newVal.toFixed(3) : newVal;
        const control = document.getElementById(`input-${windowId}-${key}`);
        if (control) {
            control.value = newVal;
            control.dispatchEvent(new Event('input'));
        }
    };
    input.onblur = finishEdit;
    input.onkeydown = (e) => { if (e.key === 'Enter') finishEdit(); if (e.key === 'Escape') { display.textContent = currentVal; input.remove(); } };
}

function getControlHtml(windowId, key, spec, val) {
    switch (spec.style) {
        case 'Float':
        case 'Int':
            const min = spec.normMin !== undefined ? spec.normMin : 0;
            const max = spec.normMax !== undefined ? spec.normMax : 1;
            const step = spec.style === 'Int' ? 1 : 0.001;
            return `<input type="range" id="input-${windowId}-${key}" data-window-id="${windowId}" min="${min}" max="${max}" step="${step}" value="${val}">`;
        case 'Toggle':
            return `<label class="switch"><input type="checkbox" id="input-${windowId}-${key}" data-window-id="${windowId}" ${val ? 'checked' : ''}><span class="slider"></span></label>`;
        case 'Pulse':
            return `<button class="pulse-btn" id="input-${windowId}-${key}" data-window-id="${windowId}">${spec.label}</button>`;
        case 'Menu':
            const options = spec.menuLabels.map((l, i) => `<option value="${spec.menuNames[i]}" ${spec.menuNames[i] === val ? 'selected' : ''}>${l}</option>`).join('');
            return `<select id="input-${windowId}-${key}" data-window-id="${windowId}">${options}</select>`;
        default:
            return `<input type="text" id="input-${windowId}-${key}" data-window-id="${windowId}" value="${val}" class="styled-text-input">`;
    }
}

function getMultiControlHtml(windowId, key, spec, state) {
    const suffixes = getSuffixes(spec);
    return suffixes.map(s => {
        const subKey = `${key}${s}`;
        const val = state[subKey] ? state[subKey][0] : (Array.isArray(spec.default) ? spec.default[suffixes.indexOf(s)] : spec.default);
        return `<div class="multi-entry"><span class="multi-tag">${s.toUpperCase()}</span>${getControlHtml(windowId, subKey, spec, val)}<span class="setting-value editable-value" id="value-${windowId}-${subKey}" onclick="makeValueEditable(event, '${windowId}', '${subKey}', ${val})">${val}</span></div>`;
    }).join('');
}

function attachEvents(container, windowId, key, spec) {
    const input = container.querySelector(`#input-${windowId}-${key}`);
    const display = container.querySelector(`#value-${windowId}-${key}`);
    if (!input) return;

    if (spec.style === 'Pulse') {
        const sendPulse = (val) => sendUpdate(windowId, key, val);

        const press = (e) => {
            if (e.type === 'touchstart') e.preventDefault();
            sendPulse(true);
            input.classList.add('pulsing');

            // Special reset logic (kept from previous version just in case)
            if (key === 'resetpulse') {
                const win = input.closest('.schema-window');
                const resetToggle = win.querySelector(`[id$="-reset"]`);
                if (resetToggle) {
                    resetToggle.checked = !resetToggle.checked;
                    resetToggle.dispatchEvent(new Event('change'));
                }
            }
        };

        const release = (e) => {
            if (e.type === 'touchend') e.preventDefault();
            sendPulse(false);
            input.classList.remove('pulsing');
        };

        input.addEventListener('mousedown', press);
        input.addEventListener('mouseup', release);
        input.addEventListener('mouseleave', release);

        input.addEventListener('touchstart', press);
        input.addEventListener('touchend', release);

        return;
    }

    const updateEvent = spec.style === 'Menu' || spec.style === 'Toggle' || spec.style === 'Str' ? 'change' : 'input';

    // Track interaction to prevent jitter from external updates
    if (input.type === 'range') {
        const startInt = () => input.isInteracting = true;
        const endInt = () => input.isInteracting = false;
        input.addEventListener('mousedown', startInt);
        input.addEventListener('touchstart', startInt, { passive: true });
        input.addEventListener('mouseup', endInt);
        input.addEventListener('mouseleave', endInt);
        input.addEventListener('touchend', endInt);
        input.addEventListener('touchcancel', endInt);
    }

    input.addEventListener(updateEvent, (e) => {
        let value = input.type === 'checkbox' ? input.checked : e.target.value;
        if (spec.style === 'Int') value = parseInt(value);
        if (spec.style === 'Float') value = parseFloat(value);
        if (display) display.textContent = typeof value === 'number' ? (spec.style === 'Int' ? value : value.toFixed(3)) : value;
        sendUpdate(windowId, key, value);
    });
}

function updateParam(windowId, subKey, value) {
    const input = document.getElementById(`input-${windowId}-${subKey}`);
    const display = document.getElementById(`value-${windowId}-${subKey}`);
    if (input) input.value = value;
    if (display) display.textContent = typeof value === 'number' ? value.toFixed(3) : value;
    sendUpdate(windowId, subKey, value);
}

function findSpecByKey(schema, key) {
    for (const page of Object.values(schema)) { if (page[key]) return page[key]; }
    return null;
}

function startPadDrag(e, windowId, key) {
    activePad = { windowId, key };
    handlePadMove(e);
    window.addEventListener('mousemove', handlePadMove);
    window.addEventListener('mouseup', stopPadDrag);
}

function handlePadMove(e) {
    if (!activePad) return;
    const { windowId, key } = activePad;
    const padArea = document.querySelector(`#pad-${windowId}-${key} .pad-area`);
    const rect = padArea.getBoundingClientRect();
    let x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    let y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const s = schemas.find(x => x.id === windowId);
    if (!s) return;
    const spec = findSpecByKey(s.schema, key);
    const suffixes = getSuffixes(spec);
    const min = spec.normMin !== undefined ? spec.normMin : 0;
    const max = spec.normMax !== undefined ? spec.normMax : 1;
    const valX = min + x * (max - min);
    const valY = min + y * (max - min);
    updateParam(windowId, `${key}${suffixes[0]}`, valX);
    updateParam(windowId, `${key}${suffixes[1]}`, valY);
    updatePadCursor(windowId, key);
}

function stopPadDrag() {
    activePad = null;
    window.removeEventListener('mousemove', handlePadMove);
    window.removeEventListener('mouseup', stopPadDrag);
}

function getSuffixes(spec) {
    if (spec.style === 'RGB' || spec.style === 'RGBA') return ['r', 'g', 'b', 'a'].slice(0, spec.size);
    if (spec.style === 'XY' || spec.style === 'XYZ') return ['x', 'y', 'z'].slice(0, spec.size);
    if (spec.style === 'UV' || spec.style === 'UVW') return ['u', 'v', 'w'].slice(0, spec.size);
    return Array.from({ length: spec.size }, (_, i) => i);
}

async function init() {
    renderWindows();
    connect();
}

async function exportSchema(id) {
    const s = schemas.find(x => x.id === id);
    if (!s) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(s.schema, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `schema_${s.title}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

init();
