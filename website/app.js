const slider = document.getElementById('slider-intensity');
const valueDisplay = document.getElementById('value-display');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

// Configuration
// Automatically determine the WebSocket URL based on the current page address
let WS_URL;
if (window.location.protocol === 'file:') {
    // If opening file directly (double click), connect to the cloud server
    // (Or change this to 'ws://localhost:8765/ws' if you want local testing)
    WS_URL = 'wss://dang-ws.onrender.com/ws';
} else {
    // If hosted (on Render or Localhost server), use relative path
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    WS_URL = `${protocol}//${window.location.host}/ws`;
}

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
        console.log("Received:", event.data);
        try {
            const data = JSON.parse(event.data);

            // Checks if the incoming JSON has "slider1"
            if (data.slider1 !== undefined) {
                // Update the slider value and the UI
                slider.value = data.slider1;
                updateSliderUI(data.slider1);
            }
        } catch (e) {
            // Ignore non-JSON messages or errors
            console.log("Received non-JSON content or error parsing:", e);
        }
    };
}

// Slider Logic
function updateSliderUI(value) {
    // Update text
    valueDisplay.textContent = Math.round(value);

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
