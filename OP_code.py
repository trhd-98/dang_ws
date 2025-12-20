import json

# OP Execute DAT Script - Cleanup on deletion
def onDestroy(changeOp):
	try:
		tracked_op = changeOp.par.Op.eval()
		if tracked_op:
			ws = changeOp.op('websocket1')
			if ws:
				msg = {
					"type": "remove_window",
					"id": str(tracked_op.id)
				}
				ws.sendText(json.dumps(msg))
	except:
		pass
	return
