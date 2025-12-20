import json, TDJSON, TDFunctions

# WebSocket Callback Script
# Used by: websocket1 DAT

def onConnect(dat):
	print("Connected to WebSocket Server")
	# Auto-refresh UI on connect
	try:
		logic = op('TD_code')
		if logic: logic.module.onValueChange(parent().par.Op, None)
	except: pass
	return

def onDisconnect(dat):
	print("Disconnected. Retrying in 5s...")
	run("op('websocket1').par.active = 1", delayFrames=300, delayId='reconnect')
	return

def onReceiveText(dat, rowIndex, message):
	try:
		data = json.loads(message)
	except: return

	if data.get('type') == 'ping': return

	# Case 1: New Client Connected -> Send Current Schema
	if data.get('type') == 'client_ready':
		operation = parent().par.Op.eval()
		if not operation: return

		full_schema = TDJSON.opToJSONOp(operation, includeCustomPages=True, includeBuiltInPages=True)
		full_state = TDFunctions.getParInfo(operation, pattern='*', includeCustom=True, includeNonCustom=True)
		
		msg = {
		  "type": "schema_update",
		  "id": str(operation.id), 
		  "title": operation.name,
		  "schema": full_schema,
		  "state": full_state
		}
		dat.sendText(json.dumps(msg))

	# Case 2: Parameter Update from Web -> TouchDesigner
	else:
		incoming_id = data.get('id')
		current_op = parent().par.Op.eval()
		if not current_op or str(current_op.id) != incoming_id: return

		for key, val in data.items():
			if key in ['type', 'id']: continue
			if hasattr(current_op.par, key):
				try:
					getattr(current_op.par, key).val = val
				except: pass
	return

def onReceiveBinary(dat, contents): return
def onReceivePing(dat, contents): dat.sendPong(contents); return
def onReceivePong(dat, contents): return
def onMonitorMessage(dat, message): return
