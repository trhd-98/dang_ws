import json, TDJSON, TDFunctions

# Main logic script
# Triggered when 'Op' parameter changes on the main Base COMP

def onValueChange(par, prev):
	operation = parent().par.Op.eval()
	if not operation:
		return
	
	name = operation.name
	
	# 1. Update the Monitoring Script (parexec_monitor)
	# This ensures that when we change the Op, the value listener immediately switches to watch the new Op
	monitor = op('parexec_monitor')
	if monitor:
		monitor.par.ops = operation
		print(f"Updated monitor to watch: {name}")
	else:
		print("Warning: 'parexec_monitor' operator not found. Real-time updates from TD -> Web won't work.")

	# 2. Get Schema and State to push to Web immediately
	full_schema = TDJSON.opToJSONOp(operation, extraAttrs=None, forceAttrLists=False, includeCustomPages=True, includeBuiltInPages=True)
	full_state = TDFunctions.getParInfo(operation, pattern='*', names=None, includeCustom=True, includeNonCustom=True)
	
	update_info = {
	  "type": "schema_update",
	  "id": str(operation.id), 
	  "title": name,
	  "schema": full_schema,
	  "state": full_state
	}
	
	# 3. Send to WebSocket
	ws = op("websocket1")
	if ws:
		ws.sendText(json.dumps(update_info))
		print(f"{name}: Sent full schema to websocket")
	
	return

# Unused callbacks
def onValuesChanged(changes): return
def onPulse(par): return
def onExpressionChange(par, val, prev): return
def onExportChange(par, val, prev): return
def onEnableChange(par, val, prev): return
def onModeChange(par, val, prev): return
