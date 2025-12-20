import json

# This script handles real-time parameter updates from TouchDesigner to the Web UI
# It should be used in a Parameter Execute DAT (e.g., 'parexec_monitor')

def onValuesChanged(changes):
	if not changes:
		return
		
	# Check if Active is ON
	if not parent().par.Active.eval():
		return

	# Group changes for efficiency
	updates = {}
	op_id = None
	
	for c in changes:
		par = c.par
		val = par.eval()
		
		# Skip MOMENTARY parameters if checking specifically (optional)
		# But usually we send everything.
		
		updates[par.name] = val
		
		if op_id is None:
			op_id = str(par.owner.id)

	if updates and op_id:
		msg = {
			"type": "parameter_update",
			"id": op_id,
			"values": updates
		}
		
		# Send to websocket
		# Try to find websocket1 in the same network
		ws = op("websocket1")
		if ws:
			ws.sendText(json.dumps(msg))
	return

def onValueChange(par, prev):
	# We use onValuesChanged for efficiency, but you can use this if preferred for single updates
	return

def onPulse(par):
	# Optional: feedback for pulse buttons
	return

def onExpressionChange(par, val, prev):
	return

def onExportChange(par, val, prev):
	return

def onEnableChange(par, val, prev):
	return

def onModeChange(par, val, prev):
	return
