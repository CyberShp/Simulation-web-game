extends CanvasLayer

const CHAPTER_CANVAS = preload("res://estate_2d/opening_inheritance_canvas.gd")

var painter: Control
var active := false
var options: Array = []
var selected_index := 0
var error_text := ""

func _ready() -> void:
 layer = 20
 painter = CHAPTER_CANVAS.new()
 painter.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 painter.mouse_filter = Control.MOUSE_FILTER_STOP
 painter.focus_mode = Control.FOCUS_ALL
 painter.scene = self
 add_child(painter)
 visible = false

func show_choice(data: Dictionary) -> void:
 var incoming: Array = data.get("options", [])
 if active and options == incoming:
  return
 active = true
 options = incoming.duplicate(true)
 selected_index = 0
 error_text = ""
 visible = true
 painter.queue_redraw()
 painter.grab_focus()

func hide_choice() -> void:
 active = false
 visible = false

func select_index(index: int) -> void:
 if index < 0 or index >= options.size():
  return
 selected_index = index
 error_text = ""
 painter.queue_redraw()

func choose_selected() -> void:
 if not OS.has_feature("web") or selected_index >= options.size():
  return
 var id := str(options[selected_index].get("id", ""))
 var call := "window.xianfuGodot.command(JSON.stringify({...JSON.parse(window.xianfuGodot.command_context()),name:'chooseOpeningInheritance',args:[" + JSON.stringify(id) + "]}))"
 var raw: Variant = JavaScriptBridge.eval(call, true)
 var response: Variant = JSON.parse_string(str(raw))
 if response is Dictionary and bool(response.get("ok", false)):
  hide_choice()
 else:
  error_text = str(response.get("error", "择卷未成，请再试。")) if response is Dictionary else "择卷未成，请再试。"
  painter.queue_redraw()
