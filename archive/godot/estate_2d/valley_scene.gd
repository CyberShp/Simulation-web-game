extends Node2D

const VALLEY_ID := "scene:valley"
const ART_ROOT := "res://estate_2d/assets/"
const SCENE_SIZE := Vector2(1536.0, 1024.0)
const ART_FILES := {
	"ground": "valley-ground-v1.png",
	"resource": "valley-herb-patch-v1.png",
	"bridge": "valley-bridge-v1.png",
	"cave": "valley-cave-v1.png",
}

var _world: Dictionary = {}
var _art: Dictionary = {}
var _font: Font
var _highlighted_id := ""


func _ready() -> void:
	for kind in ART_FILES:
		var path := ART_ROOT + str(ART_FILES[kind])
		if ResourceLoader.exists(path):
			_art[kind] = load(path) as Texture2D
	var font_path := ART_ROOT + "scene-labels.ttf"
	if ResourceLoader.exists(font_path):
		_font = load(font_path) as Font
	if _font == null:
		_font = ThemeDB.fallback_font
	visible = false


func update_world(world: Dictionary) -> void:
	_world = world
	var scene: Variant = world.get("scene", null)
	visible = scene is Dictionary and str(scene.get("id", "")) == VALLEY_ID
	queue_redraw()


func set_highlight(id: String) -> void:
	if id == _highlighted_id:
		return
	_highlighted_id = id
	queue_redraw()


func to_screen(world_x: float, world_y: float) -> Vector2:
	return Vector2(80.0 + world_x * 21.0, 100.0 + world_y * 16.0)


func to_world(global_point: Vector2) -> Vector2:
	var point := to_local(global_point)
	return Vector2((point.x - 80.0) / 21.0, (point.y - 100.0) / 16.0)


func _object_rect(item: Dictionary) -> Rect2:
	var foot := to_screen(float(item.get("x", 0.0)), float(item.get("y", 0.0)))
	var size := Vector2(72.0, 76.0)
	var below_foot := 0.0
	match str(item.get("kind", "")):
		"bridge":
			size = Vector2(190.0, 112.0)
		"cave":
			size = Vector2(174.0, 130.0)
		"person":
			size = Vector2(76.0, 56.0)
			below_foot = 10.0
	return Rect2(foot - Vector2(size.x * 0.5, size.y), size + Vector2(0.0, below_foot))


func _exit_rect(item: Dictionary) -> Rect2:
	var foot := to_screen(float(item.get("x", 0.0)), float(item.get("y", 0.0)))
	return Rect2(foot - Vector2(56.0, 88.0), Vector2(112.0, 96.0))


func hit_test(global_point: Vector2) -> Dictionary:
	if not visible:
		return {}
	var point := to_local(global_point)
	var objects: Array = _world.get("objects", [])
	for index in range(objects.size() - 1, -1, -1):
		var item: Variant = objects[index]
		if item is Dictionary and _object_rect(item).has_point(point):
			return {"kind": "world-object", "id": str(item.get("id", ""))}
	for item in _world.get("exits", []):
		if item is Dictionary and str(item.get("sceneId", "")) == VALLEY_ID and _exit_rect(item).has_point(point):
			return {"kind": "exit", "id": str(item.get("id", ""))}
	return {}


func _draw() -> void:
	if not visible:
		return
	_draw_ground()
	for item in _world.get("objects", []):
		if item is Dictionary:
			_draw_object(item)
	for item in _world.get("exits", []):
		if item is Dictionary and str(item.get("sceneId", "")) == VALLEY_ID:
			_draw_exit(item)


func _draw_ground() -> void:
	var texture: Texture2D = _art.get("ground")
	if texture != null:
		draw_texture_rect(texture, Rect2(Vector2.ZERO, SCENE_SIZE), false)
		return
	# The fallback keeps the scene legible while its painted ground is unavailable.
	draw_rect(Rect2(Vector2.ZERO, SCENE_SIZE), Color("314c43"))
	draw_polygon(PackedVector2Array([Vector2(0, 306), Vector2(246, 286), Vector2(548, 412), Vector2(830, 475), Vector2(1150, 672), Vector2(1536, 640), Vector2(1536, 810), Vector2(1040, 782), Vector2(730, 580), Vector2(418, 510), Vector2(0, 425)]), PackedColorArray([Color("52736e")]))
	draw_polygon(PackedVector2Array([Vector2(0, 786), Vector2(332, 704), Vector2(670, 808), Vector2(1130, 746), Vector2(1536, 914), Vector2(1536, 1024), Vector2(0, 1024)]), PackedColorArray([Color("203a35")]))


func _draw_object(item: Dictionary) -> void:
	var kind := str(item.get("kind", ""))
	var id := str(item.get("id", ""))
	var foot := to_screen(float(item.get("x", 0.0)), float(item.get("y", 0.0)))
	var rect := _object_rect(item)
	var depleted := kind == "resource" and float(item.get("resourceRemaining", 1.0)) <= 0.0
	var unavailable := kind == "person" and not bool(item.get("available", true))
	var tint := Color(1.0, 1.0, 1.0, 0.48 if depleted or unavailable else 1.0)
	if kind == "person":
		# A ground mark identifies the interaction; the estate actor renders the body.
		draw_arc(foot, 24.0, 0.0, TAU, 28, Color(0.74, 0.82, 0.66, 0.44 if unavailable else 0.82), 2.0, true)
	elif _art.has(kind):
		draw_texture_rect(_art[kind], rect, false, tint)
	else:
		_draw_fallback_object(kind, foot, tint)
	if id == _highlighted_id:
		draw_arc(foot, 35.0, 0.0, TAU, 32, Color("9de6c0"), 3.0, true)
	_draw_label(foot + Vector2(0.0, 23.0), str(item.get("name", "")), unavailable)


func _draw_fallback_object(kind: String, foot: Vector2, tint: Color) -> void:
	var ink := Color("a5c6a4") * tint
	if kind == "bridge":
		draw_line(foot + Vector2(-79, -18), foot + Vector2(79, -18), ink, 15.0, true)
		draw_arc(foot + Vector2(0, -13), 73.0, PI, TAU, 20, ink, 4.0, true)
	elif kind == "cave":
		draw_arc(foot + Vector2(0, -4), 56.0, PI, TAU, 24, ink, 13.0, true)
		draw_rect(Rect2(foot + Vector2(-47, -16), Vector2(94, 17)), ink)
	else:
		for dx in [-22.0, -4.0, 17.0]:
			draw_line(foot + Vector2(dx, 0), foot + Vector2(dx * 0.8, -48.0), ink, 3.0, true)
			draw_circle(foot + Vector2(dx * 0.8, -52.0), 10.0, ink)


func _draw_exit(item: Dictionary) -> void:
	var foot := to_screen(float(item.get("x", 0.0)), float(item.get("y", 0.0)))
	var near := bool(item.get("near", false))
	var ink := Color("d5c79e") if near else Color("a9b49b")
	draw_line(foot, foot + Vector2(0.0, -65.0), Color("503c2a"), 6.0, true)
	draw_polygon(PackedVector2Array([foot + Vector2(-48, -70), foot + Vector2(44, -70), foot + Vector2(54, -45), foot + Vector2(-43, -45)]), PackedColorArray([Color("594638")]))
	draw_line(foot + Vector2(-42, -68), foot + Vector2(44, -68), ink, 2.0, true)
	_draw_label(foot + Vector2(0.0, -48.0), str(item.get("name", "山道")), false)
	if str(item.get("id", "")) == _highlighted_id:
		draw_arc(foot, 34.0, 0.0, TAU, 32, Color("9de6c0"), 3.0, true)


func _draw_label(point: Vector2, text: String, muted: bool) -> void:
	if text.is_empty() or _font == null:
		return
	var color := Color("aeb6a7") if muted else Color("e5ddc6")
	draw_string(_font, point + Vector2(-116.0, 2.0), text, HORIZONTAL_ALIGNMENT_CENTER, 232.0, 20, Color(0.07, 0.16, 0.14, 0.85))
	draw_string(_font, point + Vector2(-116.0, 0.0), text, HORIZONTAL_ALIGNMENT_CENTER, 232.0, 20, color)
