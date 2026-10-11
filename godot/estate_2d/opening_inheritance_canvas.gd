extends Control

const WIDE_SCENE = preload("res://estate_2d/assets/opening-bundle-wide.png")
const PORTRAIT_SCENE = preload("res://estate_2d/assets/opening-bundle-portrait.png")
const LETTER_FONT = preload("res://estate_2d/assets/opening-serif.ttf")
const WARM = Color(0.95, 0.86, 0.69)
const SOFT = Color(0.81, 0.83, 0.80)
const GOLD = Color(0.92, 0.72, 0.39)
const SEAL_COLORS = {
 "qinglan": Color(0.45, 0.79, 0.69), "chiyang": Color(0.95, 0.52, 0.38),
 "hanquan": Color(0.62, 0.79, 0.96), "houttu": Color(0.91, 0.72, 0.43),
 "jinfeng": Color(0.93, 0.87, 0.74),
}

var scene: CanvasLayer

func _ready() -> void:
 resized.connect(queue_redraw)

func _line(copy: String, at: Vector2, font_size: int, color: Color) -> void:
 draw_string(LETTER_FONT, at, copy, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)

func _center(copy: String, x: float, y: float, font_size: int, color: Color) -> void:
 var text_width := LETTER_FONT.get_string_size(copy, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
 draw_string(LETTER_FONT, Vector2(x - text_width / 2.0, y), copy, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)

func _right_shadow() -> void:
 draw_polygon(
  PackedVector2Array([Vector2(775, 0), Vector2(1536, 0), Vector2(1536, 1024), Vector2(775, 1024)]),
  PackedColorArray([Color(0.02, 0.025, 0.03, 0.0), Color(0.02, 0.025, 0.03, 0.72), Color(0.02, 0.025, 0.03, 0.72), Color(0.02, 0.025, 0.03, 0.0)])
 )

func _lower_shadow() -> void:
 draw_polygon(
  PackedVector2Array([Vector2(0, 1050), Vector2(1024, 1050), Vector2(1024, 1536), Vector2(0, 1536)]),
  PackedColorArray([Color(0.02, 0.025, 0.03, 0.0), Color(0.02, 0.025, 0.03, 0.0), Color(0.02, 0.025, 0.03, 0.91), Color(0.02, 0.025, 0.03, 0.91)])
 )

func _switch_arrow(at: Vector2, direction: float) -> void:
 draw_circle(at, 34.0, Color(0.10, 0.13, 0.14, 0.82))
 draw_arc(at, 31.0, 0.0, TAU, 32, Color(0.88, 0.70, 0.43, 0.8), 2.0)
 draw_line(at + Vector2(-7.0 * direction, -12), at + Vector2(7.0 * direction, 0), GOLD, 3.0)
 draw_line(at + Vector2(7.0 * direction, 0), at + Vector2(-7.0 * direction, 12), GOLD, 3.0)

func _art_line(label: String, value: String, y: float, x: float, end_x: float) -> void:
 _line(label, Vector2(x, y), 22, GOLD)
 _line(value, Vector2(x + 88, y), 27, WARM)
 draw_line(Vector2(x, y + 18), Vector2(end_x, y + 18), Color(0.86, 0.76, 0.56, 0.25), 1.0)

func _choice_plaque(rect: Rect2) -> void:
 draw_rect(rect, Color(0.27, 0.16, 0.10, 0.94))
 draw_rect(rect.grow(-3), GOLD, false, 2.0)
 draw_line(rect.position + Vector2(16, 11), rect.position + Vector2(rect.size.x - 16, 11), Color(1.0, 0.87, 0.58, 0.48), 1.0)
 _center("承此传承", rect.position.x + rect.size.x / 2.0, rect.position.y + rect.size.y * 0.68, 31, WARM)

func _draw() -> void:
 if scene == null or not scene.active:
  return
 var size := get_viewport_rect().size
 if size.x < size.y * 0.9:
  draw_set_transform(Vector2.ZERO, 0.0, Vector2(size.x / 1024.0, size.y / 1536.0))
  draw_texture_rect(PORTRAIT_SCENE, Rect2(0, 0, 1024, 1536), false)
  _lower_shadow()
  _paint_portrait()
 else:
  draw_set_transform(Vector2.ZERO, 0.0, Vector2(size.x / 1536.0, size.y / 1024.0))
  draw_texture_rect(WIDE_SCENE, Rect2(0, 0, 1536, 1024), false)
  _right_shadow()
  _paint_landscape()
 draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _paint_landscape() -> void:
 var selected: Dictionary = scene.options[scene.selected_index] if scene.selected_index < scene.options.size() else {}
 _line("母亲留下的包裹", Vector2(936, 235), 35, WARM)
 _line("旧布结松开，一卷传承仍在。", Vector2(936, 279), 22, SOFT)
 draw_line(Vector2(936, 305), Vector2(1388, 305), Color(0.95, 0.76, 0.48, 0.4), 1.5)
 var tint: Color = SEAL_COLORS.get(str(selected.get("id", "")), WARM)
 _switch_arrow(Vector2(953, 371), -1.0)
 _switch_arrow(Vector2(1390, 371), 1.0)
 _line(str(selected.get("name", "")), Vector2(1009, 385), 52, tint)
 _line(str(selected.get("element", "")) + "行", Vector2(1170, 379), 27, SOFT)
 _line(str(selected.get("flavor", "")), Vector2(1009, 430), 25, WARM)
 _line(str(scene.selected_index + 1) + " / " + str(scene.options.size()), Vector2(1300, 466), 22, SOFT)
 _art_line("心法", str(selected.get("heartName", "")), 540.0, 936.0, 1388.0)
 _art_line("攻伐", str(selected.get("attackName", "")), 615.0, 936.0, 1388.0)
 _art_line("护持", str(selected.get("guardName", "")), 690.0, 936.0, 1388.0)
 _choice_plaque(Rect2(974, 783, 370, 79))
 if scene.error_text != "":
  _line(scene.error_text, Vector2(936, 904), 21, Color(1.0, 0.63, 0.52))

func _paint_portrait() -> void:
 var selected: Dictionary = scene.options[scene.selected_index] if scene.selected_index < scene.options.size() else {}
 _line("母亲留下的包裹", Vector2(88, 190), 50, WARM)
 _line("旧布结松开，一卷传承仍在。", Vector2(88, 238), 25, SOFT)
 var tint: Color = SEAL_COLORS.get(str(selected.get("id", "")), WARM)
 _switch_arrow(Vector2(104, 1183), -1.0)
 _switch_arrow(Vector2(920, 1183), 1.0)
 _center(str(selected.get("name", "")), 512.0, 1200.0, 46, tint)
 _center(str(selected.get("element", "")) + "行  ·  " + str(selected.get("flavor", "")), 512.0, 1241.0, 25, WARM)
 _center(str(scene.selected_index + 1) + " / " + str(scene.options.size()), 512.0, 1150.0, 22, SOFT)
 _art_line("心法", str(selected.get("heartName", "")), 1270.0, 93.0, 930.0)
 _art_line("攻伐", str(selected.get("attackName", "")), 1320.0, 93.0, 930.0)
 _art_line("护持", str(selected.get("guardName", "")), 1370.0, 93.0, 930.0)
 _choice_plaque(Rect2(332, 1431, 360, 72))
 if scene.error_text != "":
  _line(scene.error_text, Vector2(93, 1420), 20, Color(1.0, 0.63, 0.52))

func _gui_input(event: InputEvent) -> void:
 if scene == null or not scene.active:
  return
 if event is InputEventKey and event.pressed and not event.echo:
  if event.keycode == KEY_UP or event.keycode == KEY_LEFT:
   scene.select_index((scene.selected_index + scene.options.size() - 1) % scene.options.size())
  elif event.keycode == KEY_DOWN or event.keycode == KEY_RIGHT:
   scene.select_index((scene.selected_index + 1) % scene.options.size())
  elif event.keycode == KEY_ENTER or event.keycode == KEY_KP_ENTER:
   scene.choose_selected()
  accept_event()
  return
 var position := Vector2(-1, -1)
 if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
  position = event.position
 elif event is InputEventScreenTouch and event.pressed:
  position = event.position
 if position.x < 0:
  return
 var size := get_viewport_rect().size
 if size.x < size.y * 0.9:
  var at := Vector2(position.x * 1024.0 / size.x, position.y * 1536.0 / size.y)
  if Rect2(58, 1137, 92, 92).has_point(at):
   scene.select_index((scene.selected_index + scene.options.size() - 1) % scene.options.size())
   accept_event()
   return
  if Rect2(874, 1137, 92, 92).has_point(at):
   scene.select_index((scene.selected_index + 1) % scene.options.size())
   accept_event()
   return
  if Rect2(332, 1431, 360, 72).has_point(at):
   scene.choose_selected()
 else:
  var at := Vector2(position.x * 1536.0 / size.x, position.y * 1024.0 / size.y)
  if Rect2(909, 327, 88, 88).has_point(at):
   scene.select_index((scene.selected_index + scene.options.size() - 1) % scene.options.size())
   accept_event()
   return
  if Rect2(1346, 327, 88, 88).has_point(at):
   scene.select_index((scene.selected_index + 1) % scene.options.size())
   accept_event()
   return
  if Rect2(974, 783, 370, 79).has_point(at):
   scene.choose_selected()
 accept_event()
