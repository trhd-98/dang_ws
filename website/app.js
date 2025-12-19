/**
 * TouchDesigner Dynamic Controller
 * Generates UI based on schema.json and state.json
 */

// Multiple schemas support
let schemas = []; // Array of { id, schema, state, currentTab }
let socket = null;

const windowContainer = document.getElementById('window-container');

// WebSocket Logic (Borrowed and adapted from app.js)
let WS_URL;
if (window.location.protocol === 'file:') {
    WS_URL = 'ws://localhost:8765/ws';
} else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    WS_URL = `${protocol}//${window.location.host}/ws`;
}

function connect() {
    socket = new WebSocket(WS_URL);
    socket.onopen = () => {
        document.querySelector('.status-pill').style.opacity = '1';
        console.log('Connected to TD');
        // Let TD know we are ready to receive schemas
        socket.send(JSON.stringify({ type: 'client_ready' }));
    };
    socket.onclose = () => {
        document.querySelector('.status-pill').style.opacity = '0.5';
        setTimeout(connect, 3000);
    };
    socket.onmessage = (event) => {
        console.log("Raw Message Received:", event.data);
        try {
            const data = JSON.parse(event.data);
            console.log("Parsed Data:", data);

            // Handle different message types
            if (data.type === 'schema_update') {
                handleSchemaUpdate(data);
            } else if (data.type === 'parameter_update') {
                handleExternalUpdate(data.id, data.values);
            } else {
                handleExternalUpdate(null, data);
            }
        } catch (e) {
            console.error("Error parsing/handling message:", e, event.data);
        }
    };
}

function handleSchemaUpdate(data) {
    let { id, title, schema, state } = data;

    // Safety: Auto-parse strings if TD sent them as unparsed text
    if (typeof schema === 'string') {
        try { schema = JSON.parse(schema); } catch (e) { console.error("Failed to parse schema string"); }
    }
    if (typeof state === 'string') {
        try { state = JSON.parse(state); } catch (e) { console.error("Failed to parse state string"); }
    }

    if (!schema || typeof schema !== 'object') {
        console.error("Invalid schema received:", schema);
        return;
    }

    // Find existing schema or create new
    let s = schemas.find(x => x.id === id);
    if (!s) {
        s = { id, title, schema, state, currentTab: Object.keys(schema)[0] };
        schemas.push(s);
    } else {
        s.title = title;
        s.schema = schema;
        s.state = state;
        s.currentTab = Object.keys(schema)[0];
    }

    // Refresh the UI for this window
    renderWindows();
}

function handleExternalUpdate(windowId, values) {
    // If windowId is null, update all windows that have these parameters
    for (const [key, value] of Object.entries(values)) {
        const selector = windowId ? `[id="input-${windowId}-${key}"]` : `[id$="-${key}"]`;
        const inputs = document.querySelectorAll(selector);

        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                input.checked = !!value;
            } else {
                input.value = value;
            }

            const wId = input.dataset.windowId;
            const display = document.getElementById(`value-${wId}-${key}`);
            if (display) {
                display.textContent = (typeof value === 'number' && !Number.isInteger(value)) ?
                    value.toFixed(3) : value;
            }
        });
    }
}

function sendUpdate(param, value) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ [param]: value }));
    }
}

async function init() {
    console.log('Dynamic UI System Initialized. Waiting for schema updates from TouchDesigner...');

    // Start empty, windows will be created as schemas are received
    renderWindows();
    connect();
}

async function loadData(schemaUrl, stateUrl) {
    try {
        const [schemaRes, stateRes] = await Promise.all([
            fetch(schemaUrl),
            fetch(stateUrl)
        ]);
        return {
            schema: await schemaRes.json(),
            state: await stateRes.json()
        };
    } catch (e) {
        console.error(`Error loading ${schemaUrl}:`, e);
        return null;
    }
}

function renderWindows() {
    windowContainer.innerHTML = '';
    schemas.forEach(s => {
        const win = document.createElement('div');
        win.className = 'schema-window collapsed'; // Start collapsed
        win.id = `window-${s.id}`;
        win.innerHTML = `
            <div class="window-sidebar">
                <div class="window-title">${s.title}</div>
                <nav class="window-tabs" id="tabs-${s.id}"></nav>
            </div>
            <div class="window-main">
                <div class="window-header">
                    <h4 id="tabname-${s.id}">Select Category</h4>
                    <button class="toggle-btn" onclick="toggleWindow('${s.id}')">Expand</button>
                </div>
                <div class="window-content" id="content-${s.id}"></div>
            </div>
        `;
        windowContainer.appendChild(win);
        renderTabs(s);
        selectTab(s.id, s.currentTab);
    });
}

function toggleWindow(id) {
    const win = document.getElementById(`window-${id}`);
    win.classList.toggle('collapsed');
    const btn = win.querySelector('.toggle-btn');
    btn.textContent = win.classList.contains('collapsed') ? 'Expand' : 'Collapse';
}

function renderTabs(s) {
    const tabNav = document.getElementById(`tabs-${s.id}`);
    Object.keys(s.schema).forEach(pageName => {
        const tab = document.createElement('div');
        tab.className = 'window-tab';
        tab.textContent = pageName;
        tab.onclick = () => selectTab(s.id, pageName);
        tab.dataset.page = pageName;
        tabNav.appendChild(tab);
    });
}

function selectTab(windowId, pageName) {
    const s = schemas.find(x => x.id === windowId);
    s.currentTab = pageName;

    const tabNav = document.getElementById(`tabs-${windowId}`);
    tabNav.querySelectorAll('.window-tab').forEach(t => t.classList.remove('active'));
    tabNav.querySelector(`[data-page="${pageName}"]`).classList.add('active');

    document.getElementById(`tabname-${windowId}`).textContent = pageName;
    renderSettings(s, pageName);
}

function renderSettings(s, pageName) {
    const container = document.getElementById(`content-${s.id}`);
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

    container.innerHTML = `
        <div class="setting-label">
            <span class="setting-name">${spec.label}</span>
            <span class="setting-value" id="value-${windowId}-${key}">${val}</span>
        </div>
        <div class="control-row">
            ${getControlHtml(windowId, key, spec, val)}
        </div>
    `;

    attachEvents(container, windowId, key, spec);
}

function renderMultiValueControl(container, windowId, key, spec, state) {
    const is2D = spec.size === 2;
    container.innerHTML = `
        <div class="setting-label">
            <span class="setting-name">${spec.label}</span>
            ${is2D ? `<button class="pad-btn" onclick="toggle2DPad(event, '${windowId}', '${key}')" title="2D Pad">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="12" cy="12" r="1"></circle></svg>
            </button>` : ''}
        </div>
        <div class="multi-control-grid" style="display: grid; gap: 0.75rem;">
            ${getMultiControlHtml(windowId, key, spec, state)}
        </div>
        ${is2D ? `<div id="pad-${windowId}-${key}" class="pad-overlay" style="display:none">
            <div class="pad-area" onmousedown="startPadDrag(event, '${windowId}', '${key}')">
                <div class="pad-cursor" id="cursor-${windowId}-${key}"></div>
                <div class="pad-axis-x"></div>
                <div class="pad-axis-y"></div>
            </div>
            <div class="pad-footer">
                <span id="pad-vals-${windowId}-${key}">0.000, 0.000</span>
                <button onclick="toggle2DPad(null, '${windowId}', '${key}')">Close</button>
            </div>
        </div>` : ''}
    `;

    const suffixes = getSuffixes(spec);
    suffixes.forEach(s => {
        const subKey = s ? `${key}${s}` : key;
        attachEvents(container, windowId, subKey, spec, s);
    });
}

// 2D Pad Logic
let activePad = null;

function toggle2DPad(event, windowId, key) {
    const pad = document.getElementById(`pad-${windowId}-${key}`);
    const isOpening = pad.style.display === 'none';

    // Close other pads
    document.querySelectorAll('.pad-overlay').forEach(p => p.style.display = 'none');

    if (isOpening) {
        pad.style.display = 'flex';
        updatePadCursor(windowId, key);
    }
}

function updatePadCursor(windowId, key) {
    const s = schemas.find(x => x.id === windowId);
    const spec = findSpecByKey(s.schema, key);
    const suffixes = getSuffixes(spec);

    // Get current values
    const val0 = parseFloat(document.getElementById(`input-${windowId}-${key}${suffixes[0]}`).value);
    const val1 = parseFloat(document.getElementById(`input-${windowId}-${key}${suffixes[1]}`).value);

    const min = spec.normMin !== undefined ? spec.normMin : 0;
    const max = spec.normMax !== undefined ? spec.normMax : 1;

    // Map to 0-1 range
    const xPct = ((val0 - min) / (max - min)) * 100;
    const yPct = (1 - (val1 - min) / (max - min)) * 100; // Invert Y for screen coords

    const cursor = document.getElementById(`cursor-${windowId}-${key}`);
    cursor.style.left = `${xPct}%`;
    cursor.style.top = `${yPct}%`;

    document.getElementById(`pad-vals-${windowId}-${key}`).textContent = `${val0.toFixed(3)}, ${val1.toFixed(3)}`;
}

function findSpecByKey(schema, key) {
    for (const page of Object.values(schema)) {
        if (page[key]) return page[key];
    }
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

    let x = (e.clientX - rect.left) / rect.width;
    let y = 1 - (e.clientY - rect.top) / rect.height; // Invert Y

    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    const s = schemas.find(x => x.id === windowId);
    const spec = findSpecByKey(s.schema, key);
    const suffixes = getSuffixes(spec);

    const min = spec.normMin !== undefined ? spec.normMin : 0;
    const max = spec.normMax !== undefined ? spec.normMax : 1;

    const valX = min + x * (max - min);
    const valY = min + y * (max - min);

    // Update inputs and send
    updateParam(windowId, `${key}${suffixes[0]}`, valX);
    updateParam(windowId, `${key}${suffixes[1]}`, valY);

    updatePadCursor(windowId, key);
}

function updateParam(windowId, subKey, value) {
    const input = document.getElementById(`input-${windowId}-${subKey}`);
    const display = document.getElementById(`value-${windowId}-${subKey}`);
    if (input) input.value = value;
    if (display) display.textContent = value.toFixed(3);
    sendUpdate(subKey, value);
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

function getControlHtml(windowId, key, spec, val) {
    switch (spec.style) {
        case 'Float':
        case 'Int':
            const min = spec.normMin !== undefined ? spec.normMin : 0;
            const max = spec.normMax !== undefined ? spec.normMax : 1;
            const step = spec.style === 'Int' ? 1 : 0.001;
            return `
                <input type="range" id="input-${windowId}-${key}" data-window-id="${windowId}" min="${min}" max="${max}" step="${step}" value="${val}">
            `;
        case 'Toggle':
            return `
                <label class="switch">
                    <input type="checkbox" id="input-${windowId}-${key}" data-window-id="${windowId}" ${val ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
        case 'Menu':
            const options = spec.menuLabels.map((label, i) =>
                `<option value="${spec.menuNames[i]}" ${spec.menuNames[i] === val ? 'selected' : ''}>${label}</option>`
            ).join('');
            return `<select id="input-${windowId}-${key}" data-window-id="${windowId}" style="width: 100%">${options}</select>`;
        default:
            return `<input type="text" id="input-${windowId}-${key}" data-window-id="${windowId}" value="${val}" style="width: 100%">`;
    }
}

function getMultiControlHtml(windowId, key, spec, state) {
    const suffixes = getSuffixes(spec);
    return suffixes.map(s => {
        const subKey = `${key}${s}`;
        const val = state[subKey] ? state[subKey][0] : (Array.isArray(spec.default) ? spec.default[suffixes.indexOf(s)] : spec.default);
        return `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.75rem; width: 15px; color: var(--text-dim); text-transform: uppercase;">${s}</span>
                ${getControlHtml(windowId, subKey, spec, val)}
                <span class="setting-value" id="value-${windowId}-${subKey}" style="min-width: 50px; text-align: right;">${val}</span>
            </div>
        `;
    }).join('');
}

function attachEvents(container, windowId, key, spec, suffix = '') {
    const input = container.querySelector(`#input-${windowId}-${key}`);
    const display = container.querySelector(`#value-${windowId}-${key}`);

    if (!input) return;

    const updateEvent = spec.style === 'Menu' || spec.style === 'Toggle' ? 'change' : 'input';

    input.addEventListener(updateEvent, (e) => {
        let value = input.type === 'checkbox' ? input.checked : e.target.value;
        if (spec.style === 'Int') value = parseInt(value);
        if (spec.style === 'Float') value = parseFloat(value);

        if (display) {
            display.textContent = typeof value === 'number' ?
                (spec.style === 'Int' ? value : value.toFixed(3)) : value;
        }

        sendUpdate(key, value);
    });
}

// Start
init();
