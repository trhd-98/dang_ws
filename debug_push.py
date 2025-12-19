import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8765/ws"
    async with websockets.connect(uri) as websocket:
        schema = {
            "Test Page": {
                "slider1": {
                    "label": "Test Slider",
                    "style": "Float",
                    "normMin": 0,
                    "normMax": 10,
                    "size": 1,
                    "enable": True
                },
                "xy_pad": {
                    "label": "2D Pad",
                    "style": "XY",
                    "normMin": 0,
                    "normMax": 1,
                    "size": 2,
                    "enable": True
                }
            }
        }
        state = {
            "slider1": [5.0],
            "xy_padx": [0.5],
            "xy_pady": [0.5]
        }
        
        update_UI_info = {
            "type": "schema_update",
            "id": "test_op", 
            "title": "Debug Controller",
            "schema": schema,
            "state": state
        }
        
        await websocket.send(json.dumps(update_UI_info))
        print("Schema update sent!")

if __name__ == "__main__":
    asyncio.run(test())
