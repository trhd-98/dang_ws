import json, TDJSON, TDFunctions

# WebSocket Callback Script
# Used by: websocket1 DAT

def onConnect(dat):
	print("Client Connected to TouchDesigner")
	return

def onDisconnect(dat):
	print("Client Disconnected from TouchDesigner")
	return

def onReceiveText(dat, rowIndex, message):
	try:
		data = json.loads(message)
	except:
		return

	# Case 1: New Client Connected -> Send Current Schema
	if data.get('type') == 'client_ready':
		operation = parent().par.Op.eval()
		if not operation:
			return

		# Get full schema and state
		full_schema = TDJSON.opToJSONOp(operation, extraAttrs=None, forceAttrLists=False, includeCustomPages=True, includeBuiltInPages=True)
		full_state = TDFunctions.getParInfo(operation, pattern='*', names=None, includeCustom=True, includeNonCustom=True)
		
		name = operation.name
		
		update_info = {
		  "type": "schema_update",
		  "id": str(operation.id), 
		  "title": name,
		  "schema": full_schema,
		  "state": full_state
		}
		
		dat.sendText(json.dumps(update_info))
		print(f"Sent schema to new client: {name}")

	# Case 2: Parameter Update from Web -> TouchDesigner
	else:
		operation = parent().par.Op.eval()
		if operation:
			for key, val in data.items():
				if key == 'type': continue
				
				# Update parameter if it exists
				if hasattr(operation.par, key):
					try:
						par = getattr(operation.par, key)
						par.val = val
					except Exception as e:
						print(f"Error setting parameter {key}: {e}")
	return

def onReceiveBinary(dat, contents):
	return

def onReceivePing(dat, contents):
	dat.sendPong(contents)
	return

def onReceivePong(dat, contents):
	return

def onMonitorMessage(dat, message):
	return
