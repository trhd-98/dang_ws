import json, TDJSON, TDFunctions

# Main logic script
# Triggered when 'Op' or 'Active' parameter changes on the main Base COMP

def onValueChange(par, prev):
	"""
	This callback is triggered when either 'Op' or 'Active' parameter changes.
	- Op: Which TouchDesigner operation to control
	- Active: Whether to show/hide the UI for this operation
	"""
	
	# CASE 1: Active parameter changed (show/hide UI)
	if par == parent().par.Active:
		active = par.eval()
		operation = parent().par.Op.eval()
		
		print(f"WEB_GUI: Active toggled to {active}")
		
		if not active:
			# Hide UI - send remove command
			if operation:
				try:
					msg = {"type": "remove_window", "id": str(operation.id)}
					ws = op("websocket1")
					if ws: 
						ws.sendText(json.dumps(msg))
						print(f"WEB_GUI: Hid UI for {operation.name}")
				except Exception as e:
					print(f"WEB_GUI Error hiding UI: {e}")
			return
		else:
			# Show UI - fall through to send schema
			print(f"WEB_GUI: Showing UI...")
	
	# CASE 2: Op parameter changed (link to new operation)
	elif par == parent().par.Op:
		operation = par.eval()
		
		# If Op was cleared (unlinked)
		if not operation:
			# Remove the old operation's UI
			monitor = op('parexec_monitor')
			old_op = monitor.par.ops.eval() if monitor else None
			if old_op:
				try:
					msg = {"type": "remove_window", "id": str(old_op.id)}
					ws = op("websocket1")
					if ws: 
						ws.sendText(json.dumps(msg))
						print(f"WEB_GUI: Removed UI for {old_op.name}")
				except: pass
				if monitor: monitor.par.ops = ""
			return
		else:
			print(f"WEB_GUI: Linked to {operation.name}")
	
	# SHARED LOGIC: Send schema to UI (if Active is ON)
	if not parent().par.Active.eval():
		print("WEB_GUI: Skipping update - Active is OFF")
		return
	
	operation = parent().par.Op.eval()
	if not operation:
		return
	
	# Update the parameter monitor
	monitor = op('parexec_monitor')
	if monitor: 
		monitor.par.ops = operation
	
	# Send schema to web UI
	try:
		full_schema = TDJSON.opToJSONOp(
			operation, 
			extraAttrs=None, 
			forceAttrLists=False, 
			includeCustomPages=True, 
			includeBuiltInPages=True
		)
		full_state = TDFunctions.getParInfo(
			operation, 
			pattern='*', 
			names=None, 
			includeCustom=True, 
			includeNonCustom=True
		)
		
		update_info = {
			"type": "schema_update",
			"id": str(operation.id), 
			"title": operation.name,
			"schema": full_schema,
			"state": full_state
		}
		
		ws = op("websocket1")
		if ws:
			ws.sendText(json.dumps(update_info))
			print(f"WEB_GUI: Pushed UI schema for {operation.name}")
	except Exception as e:
		print(f"WEB_GUI Error: {e}")
	
	return

# Unused callbacks
def onValuesChanged(changes): return
def onPulse(par): return
def onExpressionChange(par, val, prev): return
def onExportChange(par, val, prev): return
def onEnableChange(par, val, prev): return
def onModeChange(par, val, prev): return
