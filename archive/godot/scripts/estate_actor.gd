class_name EstateActor
extends Node2D

## SR-XF-007: a read-only view of one persistent person's courtyard snapshot.
const ATLAS_PATH := "res://assets/yunxiu-courtyard/assets/characters.webp"
const PIXELS_PER_METRE := 32.0
const DISPLAY_HEIGHT := 1.75 * PIXELS_PER_METRE
const FRAMES := [[{"x":64,"y":21,"w":171,"h":227,"footX":72.02941176470588,"footY":225},{"x":352,"y":34,"w":106,"h":212,"footX":61.613636363636374,"footY":210},{"x":600,"y":24,"w":102,"h":225,"footX":35.915887850467286,"footY":223},{"x":844,"y":30,"w":132,"h":217,"footX":68.18050541516246,"footY":214},{"x":1106,"y":41,"w":91,"h":206,"footX":53.70977917981074,"footY":202},{"x":1362,"y":38,"w":107,"h":210,"footX":54.27385892116183,"footY":207}],[{"x":55,"y":265,"w":150,"h":230,"footX":121.59893048128342,"footY":226},{"x":353,"y":279,"w":111,"h":208,"footX":75.62068965517241,"footY":206},{"x":607,"y":268,"w":99,"h":223,"footX":68.62146892655366,"footY":219},{"x":848,"y":270,"w":131,"h":219,"footX":101.09944751381215,"footY":216},{"x":1100,"y":274,"w":112,"h":214,"footX":92.16753926701571,"footY":211},{"x":1370,"y":275,"w":120,"h":212,"footX":72.34415584415584,"footY":209}],[{"x":56,"y":513,"w":178,"h":221,"footX":134.61,"footY":216},{"x":362,"y":531,"w":104,"h":202,"footX":79.702,"footY":198},{"x":604,"y":519,"w":110,"h":216,"footX":91.49,"footY":212},{"x":852,"y":521,"w":136,"h":216,"footX":108.177,"footY":211},{"x":1111,"y":531,"w":113,"h":204,"footX":97.056,"footY":200},{"x":1371,"y":531,"w":122,"h":202,"footX":84.511,"footY":198}]]

var entity_id := ""
var person_name := ""
var activity := ""
var indoor := false
var is_selected := false
var is_master := false
var world_position := Vector2.ZERO
var sprite: Sprite2D
var caption: Label
var _target := Vector2.ZERO
var _from := Vector2.ZERO
var _interpolation := 1.0
var _has_sample := false
var _appearance := -1
var _frame_row := -1
var _image: Image
var _source_rect := Rect2()
static var _atlas: Texture2D
static var _atlas_image: Image


func _ready() -> void:
	sprite = Sprite2D.new()
	sprite.centered = false
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(sprite)
	caption = Label.new()
	caption.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caption.position = Vector2(-70, -80)
	caption.size = Vector2(140, 24)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.add_theme_font_size_override("font_size", 17)
	caption.add_theme_color_override("font_color", Color("f5eed4"))
	caption.add_theme_color_override("font_shadow_color", Color("26372b"))
	caption.add_theme_constant_override("shadow_offset_x", 1)
	caption.add_theme_constant_override("shadow_offset_y", 2)
	add_child(caption)
	set_process(false)


func apply_snapshot(data: Dictionary, projected: Vector2, tick: int, paused: bool, master: bool) -> void:
	entity_id = str(data.get("id", ""))
	person_name = str(data.get("name", ""))
	activity = str(data.get("activity", ""))
	var next_world := Vector2(float(data.get("x", 0.0)), float(data.get("y", 0.0)))
	var was_indoor := indoor
	indoor = bool(data.get("indoor", false))
	is_master = master
	visible = not indoor
	# Blend only an adjacent, supplied locomotion segment. Long steps and room
	# transitions snap to authority; presentation never extrapolates movement.
	if _has_sample and not paused and not indoor and not was_indoor and world_position.distance_to(next_world) <= 0.75 and projected != _target:
		_from = position
		_target = projected
		_interpolation = 0.0
		set_process(true)
	else:
		position = projected
		_target = projected
		_interpolation = 1.0
		set_process(false)
	world_position = next_world
	_has_sample = true
	var row := 0
	if bool(data.get("moving", false)) and not paused:
		row = 1 + (int(tick / 5) % 2)
	_set_frame(clampi(int(data.get("appearance", 0)), 0, 5), row)
	caption.text = person_name
	caption.visible = is_selected or is_master
	queue_redraw()


func _set_frame(appearance: int, row: int) -> void:
	if appearance == _appearance and row == _frame_row:
		return
	_appearance = appearance
	_frame_row = row
	if _atlas == null and ResourceLoader.exists(ATLAS_PATH):
		_atlas = load(ATLAS_PATH) as Texture2D
		if _atlas:
			_atlas_image = _atlas.get_image()
	var crop: Dictionary = FRAMES[row][appearance]
	_source_rect = Rect2(float(crop.x), float(crop.y), float(crop.w), float(crop.h))
	if _atlas:
		sprite.texture = _atlas
		sprite.region_enabled = true
		sprite.region_rect = _source_rect
		sprite.region_filter_clip_enabled = true
		var factor := DISPLAY_HEIGHT / float(crop.footY)
		sprite.scale = Vector2.ONE * factor
		sprite.position = -Vector2(float(crop.footX), float(crop.footY)) * factor
	_image = _atlas_image


func _process(delta: float) -> void:
	_interpolation = minf(1.0, _interpolation + delta / 0.1)
	position = _from.lerp(_target, _interpolation)
	if _interpolation >= 1.0:
		set_process(false)


func set_selected(selected: bool) -> void:
	if is_selected == selected:
		return
	is_selected = selected
	caption.visible = selected or is_master
	queue_redraw()


func contains_canvas_point(point: Vector2) -> bool:
	if indoor or not visible:
		return false
	var local := to_local(point)
	if sprite.texture == null:
		return Rect2(-13, -DISPLAY_HEIGHT, 26, DISPLAY_HEIGHT + 7).has_point(local)
	var source := (local - sprite.position) / sprite.scale
	if not Rect2(Vector2.ZERO, _source_rect.size).has_point(source):
		return local.length() < 12.0
	var pixel := Vector2i(source + _source_rect.position)
	return _image != null and _image.get_pixelv(pixel).a > 0.25


func _draw() -> void:
	if indoor:
		return
	draw_set_transform(Vector2(0, 1), 0.0, Vector2(1.0, 0.38))
	draw_circle(Vector2.ZERO, 11.0, Color(0.12, 0.18, 0.13, 0.3))
	if is_selected or is_master:
		draw_arc(Vector2.ZERO, 16.0 if is_selected else 13.0, 0, TAU, 40, Color("ecd096") if is_selected else Color(0.87, 0.9, 0.75, 0.5), 2.0, true)
	draw_set_transform(Vector2.ZERO)
	if sprite and sprite.texture == null:
		draw_circle(Vector2(0, -43), 7, Color("c5a984"))
		draw_colored_polygon(PackedVector2Array([Vector2(-8, -35), Vector2(8, -35), Vector2(12, -3), Vector2(-12, -3)]), Color("607a73"))
