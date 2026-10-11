extends Control

const WIDE_SCROLL = preload("res://estate_2d/assets/opening-scroll-wide.png")
const PORTRAIT_SCROLL = preload("res://estate_2d/assets/opening-scroll-portrait.png")
const WIDE_RAIN = preload("res://estate_2d/assets/opening-rain-wide.png")
const PORTRAIT_RAIN = preload("res://estate_2d/assets/opening-rain-portrait.png")
const LETTER_FONT = preload("res://estate_2d/assets/opening-serif.ttf")
const INK = Color(0.22, 0.17, 0.12)
const MUTED_INK = Color(0.27, 0.19, 0.12)
const PALE = Color(0.95, 0.86, 0.65)
const SEAL_COLORS = {
 "qinglan": Color(0.32, 0.65, 0.54), "chiyang": Color(0.77, 0.40, 0.29),
 "hanquan": Color(0.40, 0.67, 0.82), "houttu": Color(0.76, 0.62, 0.37),
 "jinfeng": Color(0.83, 0.78, 0.62),
}

var scene: CanvasLayer

func _ready() -> void:
 resized.connect(queue_redraw)

func _line(copy: String, at: Vector2, font_size: int, color: Color) -> void:
 draw_string(LETTER_FONT, at, copy, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)

func _seal(at: Vector2, id: String, name: String, chosen: bool, radius: float) -> void:
 var tint: Color = SEAL_COLORS.get(id, Color(0.8, 0.7, 0.5))
 draw_circle(at + Vector2(3, 5), radius + 5, Color(0.03, 0.02, 0.02, 0.38))
 draw_circle(at, radius - 4, tint.darkened(0.28))
 draw_arc(at, radius - 9, 0.0, TAU, 44, tint.lightened(0.3), 2.0)
 if chosen:
  draw_arc(at, radius + 15, 0.0, TAU, 44, Color(1.0, 0.84, 0.51), 4.0)
 _line(name, at + Vector2(-radius * 0.55, radius * 0.24), int(radius * 0.60), PALE)

func _manuscript_row(at: Vector2, mark: String, name: String) -> void:
 draw_circle(at + Vector2(22, -18), 24, Color(0.45, 0.22, 0.16, 0.9))
 _line(mark, at + Vector2(8, -7), 23, Color(0.97, 0.86, 0.67))
 _line(name, at + Vector2(66, 0), 27, INK)

func _choice_ribbon(rect: Rect2) -> void:
 draw_colored_polygon(PackedVector2Array([rect.position, rect.position + Vector2(rect.size.x, 0), rect.position + Vector2(rect.size.x - 17, rect.size.y / 2), rect.position + rect.size, rect.position + Vector2(0, rect.size.y), rect.position + Vector2(17, rect.size.y / 2)]), Color(0.35, 0.18, 0.13))
 draw_rect(rect.grow(-5), Color(0.76, 0.58, 0.32, 0.75), false, 2.0)
 _line("启封此卷", rect.position + Vector2(rect.size.x * 0.29, rect.size.y * 0.68), 28, PALE)

func _draw() -> void:
 if scene == null or not scene.active:
  return
 var size := get_viewport_rect().size
 if size.x < size.y * 0.9:
  draw_texture_rect(PORTRAIT_RAIN, Rect2(Vector2.ZERO, size), false)
  draw_rect(Rect2(Vector2.ZERO, size), Color(0.01, 0.02, 0.04, 0.22))
  _paint_portrait(size)
 else:
  draw_texture_rect(WIDE_RAIN, Rect2(Vector2.ZERO, size), false)
  draw_rect(Rect2(Vector2.ZERO, size), Color(0.01, 0.02, 0.04, 0.22))
  draw_set_transform(Vector2.ZERO, 0.0, Vector2(size.x / 1536.0, size.y / 1024.0))
  draw_texture_rect(WIDE_SCROLL, Rect2(0, 0, 1536, 1024), false)
  _paint_landscape()
  draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _paint_landscape() -> void:
 for index in range(scene.options.size()):
  var item: Dictionary = scene.options[index]
  var y := 211.0 + index * 143.0
  var chosen: bool = index == scene.selected_index
  _seal(Vector2(247, y), str(item.get("id", "")), str(item.get("name", "")), chosen, 48.0)
 var selected: Dictionary = scene.options[scene.selected_index] if scene.selected_index < scene.options.size() else {}
 _line("母亲留下的包裹", Vector2(480, 221), 44, INK)
 draw_line(Vector2(475, 247), Vector2(1284, 247), Color(0.40, 0.27, 0.15, 0.47), 2.0)
 _line("旧布结里，五道封印尚未拆开。", Vector2(480, 284), 25, MUTED_INK)
 _line(str(selected.get("name", "")) + " · " + str(selected.get("element", "")) + "行", Vector2(492, 378), 37, INK)
 _line(str(selected.get("flavor", "")), Vector2(492, 428), 25, MUTED_INK)
 _manuscript_row(Vector2(504, 515), "心", str(selected.get("heartName", "")))
 _manuscript_row(Vector2(504, 601), "攻", str(selected.get("attackName", "")))
 _manuscript_row(Vector2(504, 687), "守", str(selected.get("guardName", "")))
 draw_line(Vector2(480, 735), Vector2(1240, 735), Color(0.39, 0.26, 0.15, 0.38), 1.5)
 _line("余下封印的去处，仍可循墨记追寻。", Vector2(492, 770), 23, MUTED_INK)
 _choice_ribbon(Rect2(845, 804, 360, 74))
 if scene.error_text != "":
  _line(scene.error_text, Vector2(492, 878), 18, Color(0.52, 0.12, 0.09))

func _paint_portrait(size: Vector2) -> void:
 draw_set_transform(Vector2.ZERO, 0.0, Vector2(size.x / 1024.0, size.y / 1536.0))
 draw_texture_rect(PORTRAIT_SCROLL, Rect2(0, 0, 1024, 1536), false)
 _line("母亲留下的包裹", Vector2(205, 212), 47, INK)
 _line("旧布结里，五道封印尚未拆开。", Vector2(205, 261), 24, MUTED_INK)
 for index in range(scene.options.size()):
  var item: Dictionary = scene.options[index]
  var x := 211.0 + index * 152.0
  _seal(Vector2(x, 367), str(item.get("id", "")), str(item.get("name", "")), index == scene.selected_index, 56.0)
 var selected: Dictionary = scene.options[scene.selected_index] if scene.selected_index < scene.options.size() else {}
 _line(str(selected.get("name", "")) + " · " + str(selected.get("element", "")) + "行", Vector2(191, 570), 44, INK)
 _line(str(selected.get("flavor", "")), Vector2(191, 630), 25, MUTED_INK)
 _manuscript_row(Vector2(204, 742), "心", str(selected.get("heartName", "")))
 _manuscript_row(Vector2(204, 860), "攻", str(selected.get("attackName", "")))
 _manuscript_row(Vector2(204, 978), "守", str(selected.get("guardName", "")))
 draw_line(Vector2(184, 1030), Vector2(824, 1030), Color(0.39, 0.26, 0.15, 0.38), 1.5)
 _line("余下封印的去处，仍可循墨记追寻。", Vector2(192, 1080), 23, MUTED_INK)
 _choice_ribbon(Rect2(332, 1193, 360, 82))
 if scene.error_text != "":
  _line(scene.error_text, Vector2(192, 1340), 21, Color(0.52, 0.12, 0.09))
 draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

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
  for index in range(scene.options.size()):
   if Rect2(144 + index * 152, 296, 135, 145).has_point(at):
    scene.select_index(index)
    accept_event()
    return
  if Rect2(332, 1193, 360, 82).has_point(at):
   scene.choose_selected()
 else:
  var at := Vector2(position.x * 1536.0 / size.x, position.y * 1024.0 / size.y)
  for index in range(scene.options.size()):
   if Rect2(176, 140 + index * 143, 142, 140).has_point(at):
    scene.select_index(index)
    accept_event()
    return
  if Rect2(845, 804, 360, 74).has_point(at):
   scene.choose_selected()
 accept_event()
