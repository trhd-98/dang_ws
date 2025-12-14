from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
import uvicorn
import os

app = FastAPI()

# Store connected clients
connected_clients = set()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    print(f"Client connected. Total clients: {len(connected_clients)}")
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            print(f"Received: {data}")
            
            # Broadcast to all connected clients
            for client in connected_clients:
                try:
                    await client.send_text(data)
                except Exception:
                    # If sending fails, we assume they might be disconnected
                    # The 'except WebSocketDisconnect' block handles the cleanup mostly
                    pass
                    
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        print(f"Client disconnected. Total clients: {len(connected_clients)}")
    except Exception as e:
        print(f"Error: {e}")
        if websocket in connected_clients:
            connected_clients.remove(websocket)

# Serve the 'website' folder at the root URL ("/")
# html=True allows serving 'index.html' automatically when visiting "/"
# Check if directory exists to avoid errors locally if folder is missing
if os.path.exists("website"):
    app.mount("/", StaticFiles(directory="website", html=True), name="static")
else:
    print("Warning: 'website' folder not found. Only WebSocket /ws will work.")

if __name__ == "__main__":
    # Get port from environment variable (Render) or default to 8765 (Local)
    port = int(os.environ.get("PORT", 8765))
    
    print(f"Server starting on http://0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
