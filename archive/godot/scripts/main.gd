extends Node2D

const CourtyardScene = preload("res://scripts/courtyard.gd")
var courtyard: Node2D
var bridge: JavaScriptObject
var snapshot: Dictionary = {}
var refresh_elapsed: float = 0.0
var connected: bool = false
var title: Label
var details: Label
var notice: Label
var pause_button: Button
var save_button: Button
var reload_button: Button

func _ready() -> void:
	courtyard = CourtyardScene.new()
	add_child(courtyard)
	courtyard.ground_clicked.connect(_walk)
	courtyard.entity_selected.connect(_select)
	_make_hud()
	if not OS.has_feature("web"):
		var file := FileAccess.open("res://assets/initial_snapshot.json", FileAccess.READ)
		if file:
			var value = JSON.parse_string(file.get_as_text())
			if value is Dictionary:
				_apply(value)
		notice.text = "场景预览 · 运行网页版可行走、暂停与保存进度"
		pause_button.disabled = true
		save_button.disabled = true
		reload_button.disabled = true

func _make_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var top := PanelContainer.new()
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	top.offset_left = 16
	top.offset_right = -16
	top.offset_top = 12
	layer.add_child(top)
	var box := VBoxContainer.new()
	top.add_child(box)
	title = Label.new()
	title.text = "模拟仙府  云岫别院"
	title.add_theme_font_size_override("font_size", 24)
	box.add_child(title)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	box.add_child(row)
	pause_button = _button(row, "暂停", func(): _command({"type": "pause", "paused": not snapshot.get("paused", true)}))
	_button(row, "回到掌门", func(): courtyard.focus_master())
	_button(row, "疗伤 草药6", func(): _command({"name": "masterAction", "args": ["heal"]}))
	save_button = _button(row, "保存", func(): _host_action("save_slot"))
	reload_button = _button(row, "读取", func(): _host_action("reload_slot"))
	_button(row, "导出", func(): _host_action("download_save"))
	_button(row, "导入", func(): _host_action("import_save"))
	var bottom := PanelContainer.new()
	bottom.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_left = 16
	bottom.offset_right = -16
	bottom.offset_top = -100
	bottom.offset_bottom = -12
	layer.add_child(bottom)
	var body := VBoxContainer.new()
	bottom.add_child(body)
	details = Label.new()
	details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_child(details)
	notice = Label.new()
	notice.text = "正在打开云岫别院…"
	notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_child(notice)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.10, 0.15, 0.13, 0.94)
	style.border_color = Color(0.64, 0.62, 0.43, 0.6)
	style.set_border_width_all(1)
	style.set_corner_radius_all(8)
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	top.add_theme_stylebox_override("panel", style)
	bottom.add_theme_stylebox_override("panel", style)

func _button(parent: Node, text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(96, 44)
	button.pressed.connect(callback)
	parent.add_child(button)
	return button

func _process(delta: float) -> void:
	if not OS.has_feature("web"):
		return
	refresh_elapsed += delta
	if refresh_elapsed < 0.1:
		return
	refresh_elapsed = 0.0
	if not connected:
		bridge = JavaScriptBridge.get_interface("xianfuGodot")
		if bridge == null:
			return
		connected = true
		bridge.start()
		var _ready_result = JavaScriptBridge.eval("window.__godotSceneReady = true")
	var value = JSON.parse_string(str(bridge.snapshot_json()))
	if value is Dictionary:
		_apply(value)

func _apply(value: Dictionary) -> void:
	snapshot = value
	courtyard.apply_snapshot(snapshot)
	pause_button.text = "继续" if snapshot.get("paused", false) else "暂停"
	title.text = "模拟仙府  %s  开发预览" % snapshot.get("timeLabel", "云岫别院")
	var resources: Dictionary = snapshot.get("resources", {})
	details.text = "灵石 %d　粮食 %d　灵木 %d　玄石 %d　草药 %d" % [resources.get("jade", 0), resources.get("food", 0), resources.get("wood", 0), resources.get("stone", 0), resources.get("herb", 0)]
	if connected and bridge != null:
		notice.text = str(bridge.notice()).replace(" · ", "  ")

func _walk(position_in_world: Vector2) -> void:
	_command({"type": "move", "x": position_in_world.x, "y": position_in_world.y})

func _select(kind: String, id: String) -> void:
	courtyard.set_selected(kind, id)
	_command({"type": "select", "kind": kind, "id": id})

func _command(command: Dictionary) -> void:
	if not connected:
		return
	if command.get("type", "") != "select":
		var context = JSON.parse_string(str(bridge.command_context()))
		if not context is Dictionary:
			return
		command["id"] = context.id
		command["expectedRevision"] = context.expectedRevision
	bridge.command(JSON.stringify(command))
	var value = JSON.parse_string(str(bridge.snapshot_json()))
	if value is Dictionary:
		_apply(value)

func _host_action(action: String) -> void:
	if not connected:
		return
	if action == "save_slot":
		bridge.save_slot()
	elif action == "reload_slot":
		bridge.reload_slot()
	elif action == "download_save":
		bridge.download_save()
	elif action == "import_save":
		bridge.import_save()
