import asyncio
import websockets

# Store all connected clients
connected_clients = set()

async def handler(websocket):
    """
    Handles a connection from a client.
    Register the client, and broadcast any received messages to all other clients.
    """
    # Register the new client
    connected_clients.add(websocket)
    print(f"Client connected. Total clients: {len(connected_clients)}")
    
    try:
        async for message in websocket:
            print(f"Received: {message}")
            
            # Broadcast the message to all connected clients
            # We iterate over a copy of the set or just the set (since we only read it)
            # but sending is async, so we just await each send.
            for client in connected_clients:
                try:
                    await client.send(message)
                except websockets.exceptions.ConnectionClosed:
                    # If a client connection is dead, we'll ignore it here.
                    # It will be removed from the set in its own handler instance.
                    pass
            
            print(f"Broadcasted message to {len(connected_clients)} clients")
            
    except websockets.exceptions.ConnectionClosed as e:
        print(f"Client disconnected: {e}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Unregister the client when they disconnect
        connected_clients.remove(websocket)
        print(f"Client removed. Total clients: {len(connected_clients)}")

import os

async def main():
    # Get the port from the environment variable (Render sets this automatically).
    # If it's not set (like on your local computer), default to 8765.
    port = int(os.environ.get("PORT", 8765))
    
    # "0.0.0.0" means "listen on all available addresses". 
    # This is required for cloud hosting. Localhost only listens on your own machine.
    host = "0.0.0.0"
    
    print(f"Server starting on ws://{host}:{port}")
    print("Press Ctrl+C to stop the server")
    
    # Start the server
    # ping_interval=None disables the automatic ping/pong to check connection health.
    # This fixes the "keepalive ping timeout" error if the client (TouchDesigner)
    # doesn't respond to pings in time.
    async with websockets.serve(handler, host, port, ping_interval=None):
        await asyncio.get_running_loop().create_future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user.")
