const slider = document.getElementById('slider-intensity');
const valueDisplay = document.getElementById('value-display');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

// Configuration
// Automatically determine the WebSocket URL based on the current page address
// If we are on https://mysite.com, use wss://mysite.com/ws
// If we are on http://localhost:8765, use ws://localhost:8765/ws
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}/ws`;

let socket;

function connect() {
    console.log('Connecting to WebSocket...');
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        console.log('Connected!');
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected';
    };

    socket.onclose = () => {
        console.log('Disconnected. Retrying in 3s...');
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'Reconnecting...';

        // Auto-reconnect logic
        setTimeout(connect, 3000);
    };

    socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };

    socket.onmessage = (event) => {
        // Optional: If we want the slider to update if OTHER people move it
        // We can parse 'event.data' here. 
        // For now, let's keep it simple (one-way control mostly)
        console.log("Received:", event.data);
    };
}

// Slider Logic
function updateSliderUI(value) {
    // Update text
    valueDisplay.textContent = parseFloat(value).toFixed(2);

    // Update gradient fill (CSS variable)
    const percentage = (value - slider.min) / (slider.max - slider.min) * 100;
    slider.style.setProperty('--fill-percent', `${percentage}%`);
}

function sendValue(value) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        // Send a JSON object
        const payload = JSON.stringify({
            parameter: 'intensity',
            value: parseFloat(value)
        });
        socket.send(payload);
    }
}

// Initialize
slider.addEventListener('input', (e) => {
    const val = e.target.value;
    updateSliderUI(val);
    sendValue(val);
});

// Initial visual update
updateSliderUI(slider.value);
// Start connection
connect();
