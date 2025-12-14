import asyncio
import websockets
import sys

async def receive_messages(websocket):
    """
    Continuously listen for messages from the server.
    """
    try:
        async for message in websocket:
            print(f"\n< Received: {message}")
            print("> ", end="", flush=True) # Reprint prompt after receiving message
    except websockets.exceptions.ConnectionClosed:
        print("\nConnection closed by server.")

async def send_messages(websocket):
    """
    Continuously read user input and send it to the server.
    """
    print("> ", end="", flush=True)
    while True:
        # Use asyncio.to_thread to run input() without blocking the event loop
        # This allows receive_messages to keep running in the background.
        message = await asyncio.to_thread(input)
        
        if message.lower() == 'quit':
            break
            
        await websocket.send(message)
        print("> ", end="", flush=True)

async def main():
    # Connect to the deployed server
    # Note: We added '/ws' to the path in the new server
    uri = "wss://dang-ws.onrender.com/ws"
    # Or for local testing: uri = "ws://localhost:8765/ws"
    
    print(f"Connecting to {uri}...")
    
    try:
        # Increase the timeout to 60 seconds to allow the free server to "wake up"
        async with websockets.connect(uri, open_timeout=60) as websocket:
            print("Connected! Type a message and press Enter.")
            
            # Run both receive and send tasks concurrently
            receive_task = asyncio.create_task(receive_messages(websocket))
            send_task = asyncio.create_task(send_messages(websocket))
            
            # Wait until the send_task is done (user typed 'quit')
            # or the connection is closed
            done, pending = await asyncio.wait(
                [receive_task, send_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            # Cancel whichever task is still running
            for task in pending:
                task.cancel()
                
    except ConnectionRefusedError:
        print("Could not connect. Is the server running?")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nClient stopped.")
