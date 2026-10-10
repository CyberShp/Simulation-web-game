class_name EstateBuilding
extends Node2D

## SR-XF-004 / U-101: versioned exterior art on the original metre footprint.
const ART := {
	"house": {"path": "res://assets/assets/estate-v1/house-stages-v2.png", "stages": {
		"preview": {"rect":[20,25,437,420]},
		"foundation": {"rect":[472,183,405,262]},
		"structure": {"rect":[900,54,413,391]},
		"finishing": {"rect":[1336,41,427,404]},
		"complete": {"rect":[25,445,421,411]},
		"upgrade": {"rect":[466,445,449,409]},
		"damaged": {"rect":[926,445,419,413]},
	}},
	"hall": {"path": "res://assets/assets/estate-v1/hall-stages-v2.png", "stages": {
		"preview": {"rect":[13,35,420,400]},
		"foundation": {"rect":[467,14,420,400]},
		"structure": {"rect":[903,27,420,400]},
		"finishing": {"rect":[1346,30,420,400]},
		"complete": {"rect":[20,444,420,400]},
		"upgrade": {"rect":[462,444,420,400]},
		"damaged": {"rect":[900,443,420,400]},
	}},
	"clinic": {"path": "res://assets/assets/estate-v1/clinic-stages-v2.png", "stages": {
		"preview": {"rect":[43,45,400,400]},
		"foundation": {"rect":[458,55,400,400]},
		"structure": {"rect":[898,54,400,400]},
		"finishing": {"rect":[1356,53,400,400]},
		"complete": {"rect":[43,450,400,400]},
		"upgrade": {"rect":[479,449,400,400]},
		"damaged": {"rect":[922,450,400,400]},
	}},
	"library": {"path": "res://assets/assets/estate-v1/library-stages-v3.png", "stages": {
		"preview": {"rect":[43,63,380,380]},
		"foundation": {"rect":[472,53,380,380]},
		"structure": {"rect":[919,52,380,380]},
		"finishing": {"rect":[1357,61,380,380]},
		"complete": {"rect":[46,475,380,380]},
		"upgrade": {"rect":[482,474,380,380]},
		"damaged": {"rect":[921,475,380,380]},
	}},
	"farm": {"path": "res://assets/assets/estate-v1/farm-stages-v1.png", "stages": {
		"preview": {"rect":[0,45,443,345],"heightScale":0.8346376811594203},
		"foundation": {"rect":[443,75,443,368],"heightScale":0.7824728260869565},
		"structure": {"rect":[886,40,443,360],"heightScale":0.7998611111111111},
		"finishing": {"rect":[1329,25,443,372],"heightScale":0.7740591397849462},
		"complete": {"rect":[0,453,443,386],"heightScale":0.7459844559585492},
		"upgrade": {"rect":[443,443,443,396],"heightScale":0.7271464646464646},
		"damaged": {"rect":[886,478,443,365],"heightScale":0.7889041095890411},
	}},
	"lumber": {"path": "res://assets/assets/estate-v1/lumber-stages-v1.png", "stages": {
		"preview": {"rect":[0,40,443,400],"heightScale":0.7358949801849406},
		"foundation": {"rect":[443,40,443,400],"heightScale":0.7358949801849406},
		"structure": {"rect":[886,40,443,400],"heightScale":0.7358949801849406},
		"finishing": {"rect":[1329,40,443,400],"heightScale":0.7358949801849406},
		"complete": {"rect":[0,468,443,400],"heightScale":0.7358949801849406},
		"upgrade": {"rect":[443,468,443,400],"heightScale":0.7358949801849406},
		"damaged": {"rect":[886,468,443,400],"heightScale":0.7358949801849406},
	}},
	"quarry": {"path": "res://assets/assets/estate-v1/quarry-stages-v1.png", "stages": {
		"preview": {"rect":[0,15,443,425],"heightScale":0.7023639952625346},
		"foundation": {"rect":[443,15,443,425],"heightScale":0.7023639952625346},
		"structure": {"rect":[886,15,443,425],"heightScale":0.7023639952625346},
		"finishing": {"rect":[1329,15,443,425],"heightScale":0.7023639952625346},
		"complete": {"rect":[0,448,443,425],"heightScale":0.7023639952625346},
		"upgrade": {"rect":[443,448,443,425],"heightScale":0.7023639952625346},
		"damaged": {"rect":[886,448,443,425],"heightScale":0.7023639952625346},
	}},
	"meditation": {"path": "res://assets/assets/estate-v1/meditation-stages-v1.png", "stages": {
		"preview": {"rect":[0,45,443,385],"heightScale":0.7162676680748971},
		"foundation": {"rect":[443,45,443,385],"heightScale":0.7162676680748971},
		"structure": {"rect":[886,45,443,385],"heightScale":0.7162676680748971},
		"finishing": {"rect":[1329,45,443,385],"heightScale":0.7162676680748971},
		"complete": {"rect":[0,455,443,385],"heightScale":0.7162676680748971},
		"upgrade": {"rect":[443,455,443,385],"heightScale":0.7162676680748971},
		"damaged": {"rect":[886,455,443,385],"heightScale":0.7162676680748971},
	}},
	"alchemy": {"path": "res://assets/assets/estate-v1/alchemy-stages-v3.png", "stages": {
		"preview": {"rect":[0,0,443,443],"heightScale":0.8438538205980066},
		"foundation": {"rect":[443,0,443,443],"heightScale":0.8438538205980066},
		"structure": {"rect":[886,0,443,443],"heightScale":0.8438538205980066},
		"finishing": {"rect":[1329,0,443,443],"heightScale":0.8438538205980066},
		"complete": {"rect":[0,443,443,430],"heightScale":0.8693656802905044},
		"upgrade": {"rect":[443,443,443,430],"heightScale":0.8693656802905044},
		"damaged": {"rect":[886,443,443,430],"heightScale":0.8693656802905044},
	}},
	"well": {"path": "res://assets/assets/estate-v1/well-stages-v1.png", "stages": {
		"preview": {"rect":[0,65,443,360],"heightScale":0.7596244705115672},
		"foundation": {"rect":[443,65,443,360],"heightScale":0.7596244705115672},
		"structure": {"rect":[886,65,443,360],"heightScale":0.7596244705115672},
		"finishing": {"rect":[1329,65,443,360],"heightScale":0.7596244705115672},
		"complete": {"rect":[0,473,443,370],"heightScale":0.7390940794166599},
		"upgrade": {"rect":[443,473,443,370],"heightScale":0.7390940794166599},
		"damaged": {"rect":[886,473,443,370],"heightScale":0.7390940794166599},
	}},
	"granary": {"path": "res://assets/assets/estate-v1/granary-stages-v1.png", "stages": {
		"preview": {"rect":[0,0,443,410],"heightScale":0.7023170731707317},
		"foundation": {"rect":[443,0,443,410],"heightScale":0.7023170731707317},
		"structure": {"rect":[886,0,443,410],"heightScale":0.7023170731707317},
		"finishing": {"rect":[1329,0,443,410],"heightScale":0.7023170731707317},
		"complete": {"rect":[0,443,443,412],"heightScale":0.6989077669902912},
		"upgrade": {"rect":[443,443,443,412],"heightScale":0.6989077669902912},
		"damaged": {"rect":[886,443,443,412],"heightScale":0.6989077669902912},
	}},
	"kitchen": {"path": "res://assets/assets/estate-v1/kitchen-stages-v3.png", "stages": {
		"preview": {"rect":[0,0,443,443],"heightScale":0.9532062391681108},
		"foundation": {"rect":[443,0,443,443],"heightScale":0.9532062391681108},
		"structure": {"rect":[886,0,443,443],"heightScale":0.9532062391681108},
		"finishing": {"rect":[1329,0,443,443],"heightScale":0.9532062391681108},
		"complete": {"rect":[0,443,443,443],"heightScale":0.9532062391681108},
		"upgrade": {"rect":[443,443,443,443],"heightScale":0.9532062391681108},
		"damaged": {"rect":[886,443,443,443],"heightScale":0.9532062391681108},
	}},
	"workshop": {"path": "res://assets/assets/estate-v1/workshop-stages-v3.png", "stages": {
		"preview": {"rect":[0,0,443,443],"heightScale":0.8708053691275168},
		"foundation": {"rect":[443,0,443,443],"heightScale":0.8708053691275168},
		"structure": {"rect":[886,0,443,443],"heightScale":0.8708053691275168},
		"finishing": {"rect":[1329,0,443,443],"heightScale":0.8708053691275168},
		"complete": {"rect":[0,443,443,420],"heightScale":0.9184923298178332},
		"upgrade": {"rect":[443,443,443,420],"heightScale":0.9184923298178332},
		"damaged": {"rect":[886,443,443,420],"heightScale":0.9184923298178332},
	}},
	"watchtower": {"path": "res://assets/assets/estate-v1/watchtower-stages-v1.png", "stages": {
		"preview": {"rect":[0,0,443,443],"heightScale":1.0830324909747293},
		"foundation": {"rect":[443,0,443,443],"heightScale":1.0830324909747293},
		"structure": {"rect":[886,0,443,443],"heightScale":1.0830324909747293},
		"finishing": {"rect":[1329,0,443,443],"heightScale":1.0830324909747293},
		"complete": {"rect":[0,443,443,443],"heightScale":1.0830324909747293},
		"upgrade": {"rect":[443,443,443,443],"heightScale":1.0830324909747293},
		"damaged": {"rect":[886,443,443,443],"heightScale":1.0830324909747293},
	}},
}
const PIXELS_PER_METRE := 32.0
const DEPTH := 0.62
const ROTATION_COMPONENT := 0.7071067811865476

var entity_id := ""
var building_name := ""
var is_selected := false
var sprite: Sprite2D
var caption: Label
var footprint := PackedVector2Array()
var _signature := ""
var _image: Image
var _rect := Rect2()
var _source_rect := Rect2()
static var _textures: Dictionary = {}
static var _images: Dictionary = {}


func _ready() -> void:
	sprite = Sprite2D.new()
	sprite.centered = false
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(sprite)
	caption = Label.new()
	caption.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.add_theme_font_size_override("font_size", 20)
	caption.add_theme_color_override("font_color", Color("fff3ce"))
	caption.add_theme_color_override("font_shadow_color", Color("293b31"))
	caption.add_theme_constant_override("shadow_offset_x", 1)
	caption.add_theme_constant_override("shadow_offset_y", 2)
	caption.visible = false
	add_child(caption)


func apply_snapshot(data: Dictionary) -> void:
	var signature := JSON.stringify(data)
	if signature == _signature:
		return
	_signature = signature
	entity_id = str(data.get("id", ""))
	building_name = str(data.get("name", ""))
	var origin := Vector2(float(data.get("x", 0.0)), float(data.get("y", 0.0)))
	var extent := Vector2(maxf(0.1, float(data.get("width", 2.0))), maxf(0.1, float(data.get("height", 2.0))))
	# The current Canvas renderer sorts exteriors by footprint centre. Keep the
	# artwork's bottom at the front corner while sharing that same depth anchor.
	position = _project(origin + extent / 2.0)
	footprint = PackedVector2Array()
	for corner in [origin, origin + Vector2(extent.x, 0), origin + extent, origin + Vector2(0, extent.y)]:
		footprint.append(_project(corner) - position)
	var type := str(data.get("type", ""))
	var stage := str(data.get("stage", "complete"))
	sprite.texture = null
	_image = null
	if ART.has(type):
		var spec: Dictionary = ART[type]
		var stages: Dictionary = spec.stages
		var art: Dictionary = stages.get(stage, stages.complete)
		var crop: Array = art.rect
		_source_rect = Rect2(float(crop[0]), float(crop[1]), float(crop[2]), float(crop[3]))
		var path := str(spec.path)
		if not _textures.has(path) and ResourceLoader.exists(path):
			var texture := load(path) as Texture2D
			_textures[path] = texture
			if texture:
				_images[path] = texture.get_image()
		if _textures.has(path):
			sprite.texture = _textures[path]
			_image = _images.get(path)
		var width := (extent.x + extent.y) * PIXELS_PER_METRE * ROTATION_COMPONENT * 1.06
		var height := width * _source_rect.size.y / _source_rect.size.x * float(art.get("heightScale", 1.0))
		var center := _project(origin + extent / 2.0) - position
		var bottom := _project(origin + extent).y - position.y + 0.12 * PIXELS_PER_METRE
		_rect = Rect2(Vector2(center.x - width / 2.0, bottom - height), Vector2(width, height))
		sprite.region_enabled = true
		sprite.region_rect = _source_rect
		sprite.region_filter_clip_enabled = true
		sprite.position = _rect.position
		sprite.scale = _rect.size / _source_rect.size
	else:
		_rect = Rect2(Vector2(-40, -70), Vector2(80, 70))
	caption.text = building_name
	caption.position = Vector2(_rect.position.x, _rect.position.y - 28)
	caption.size = Vector2(_rect.size.x, 25)
	queue_redraw()


static func _project(point: Vector2) -> Vector2:
	return Vector2(point.x - point.y, (point.x + point.y) * DEPTH) * (PIXELS_PER_METRE * ROTATION_COMPONENT)


func set_selected(selected: bool) -> void:
	if is_selected == selected:
		return
	is_selected = selected
	caption.visible = selected
	queue_redraw()


func contains_canvas_point(point: Vector2) -> bool:
	var local := to_local(point)
	if sprite.texture and _image and _rect.has_point(local):
		var pixel := Vector2i((local - _rect.position) / _rect.size * _source_rect.size + _source_rect.position)
		if _image.get_pixelv(pixel).a > 0.38:
			return true
	# A missing texture retains the real footprint and its entity identity.
	return sprite.texture == null and Geometry2D.is_point_in_polygon(local, footprint)


func _draw() -> void:
	if footprint.size() < 4:
		return
	if sprite and sprite.texture == null:
		var roof := PackedVector2Array()
		for corner in footprint:
			roof.append(corner + Vector2(0, -35))
		draw_colored_polygon(footprint, Color("695d43"))
		draw_colored_polygon(roof, Color("53695c"))
		draw_polyline(PackedVector2Array([roof[0], roof[1], roof[2], roof[3], roof[0]]), Color("bdad80"), 2.0, true)
	if is_selected:
		var ring := footprint.duplicate()
		ring.append(footprint[0])
		draw_polyline(ring, Color("f4d08b"), 3.0, true)
