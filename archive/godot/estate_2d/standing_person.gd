extends Node2D
## Public visitor at their actual scene position.

const GEOMETRY_PATH := "res://estate_2d/assets/flat-visitors-v1.json"
const EDGE_SHADER := preload("res://estate_2d/flat_people.gdshader")
const ALPHA_THRESHOLD := 32.0 / 255.0

var body: Sprite2D
var visual_height := 76.0
var body_image: Image
var base_position := Vector2.ZERO
var gait_distance := 0.0
var visible_bounds := Rect2i()

static var _geometry_cache: Dictionary = {}
static var _texture_cache: Dictionary = {}

func _ready() -> void:
	# The scene toggles processing with pause; travel still drives the animation.
	set_process(true)

func setup(texture_path: String) -> void:
	var texture := load(texture_path) as Texture2D
	if texture == null:
		push_error("Visitor artwork could not be loaded: " + texture_path)
		return
	var geometry: Dictionary = {}
	if FileAccess.file_exists(GEOMETRY_PATH):
		var metadata: Variant = JSON.parse_string(FileAccess.get_file_as_string(GEOMETRY_PATH))
		if metadata is Dictionary:
			geometry = metadata.get("characters", {}).get(texture_path.get_file(), {})
	_configure_texture(texture, geometry)


func _configure_texture(texture: Texture2D, geometry: Dictionary = {}) -> void:
	if is_instance_valid(body):
		remove_child(body)
		body.queue_free()
	body = Sprite2D.new()
	body.texture = texture
	body.centered = false
	body.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	body_image = body.texture.get_image()
	if body_image.is_compressed():
		body_image.decompress()
	# Visitor portraits are much larger than their scene bodies; filtered levels
	# keep cloth and outlines stable when the camera shows a 76px character.
	var texture_key := texture.resource_path
	if not texture_key.is_empty() and _texture_cache.has(texture_key):
		body.texture = _texture_cache[texture_key]
	else:
		var filtered_image := body_image.duplicate() as Image
		filtered_image.generate_mipmaps()
		body.texture = ImageTexture.create_from_image(filtered_image)
		if not texture_key.is_empty():
			_texture_cache[texture_key] = body.texture
	var region: Array = geometry.get("visible_bounds", [])
	visible_bounds = Rect2i(int(region[0]), int(region[1]), int(region[2]), int(region[3])) if region.size() == 4 else _visible_bounds(body_image, texture.resource_path)
	var foot: Array = geometry.get("foot_anchor", [])
	var anchor := Vector2(float(foot[0]), float(foot[1])) if foot.size() == 2 else Vector2(float(visible_bounds.position.x) + float(visible_bounds.size.x) * 0.5, float(visible_bounds.end.y))
	var ratio := visual_height / maxf(float(visible_bounds.size.y), 1.0)
	body.scale = Vector2.ONE * ratio
	base_position = -anchor * ratio
	body.position = base_position
	var material := ShaderMaterial.new()
	material.shader = EDGE_SHADER
	body.material = material
	add_child(body)
	queue_redraw()


func _visible_bounds(image: Image, cache_key: String) -> Rect2i:
	if not cache_key.is_empty() and _geometry_cache.has(cache_key):
		return _geometry_cache[cache_key]
	var start := image.get_size()
	var finish := Vector2i.ZERO
	for y: int in range(image.get_height()):
		for x: int in range(image.get_width()):
			if image.get_pixel(x, y).a >= ALPHA_THRESHOLD:
				start = start.min(Vector2i(x, y))
				finish = finish.max(Vector2i(x + 1, y + 1))
	var bounds := Rect2i(start, finish - start) if finish.x > start.x else Rect2i()
	if not cache_key.is_empty():
		_geometry_cache[cache_key] = bounds
	return bounds

func set_travel_distance(distance: float) -> void:
	if is_finite(distance) and _animation_enabled():
		gait_distance += maxf(0.0, distance)

func set_facing(_direction: Vector2, _delta: float) -> void:
	pass

func set_motion(moving: bool, _working: bool, _delta: float) -> void:
	if not is_instance_valid(body) or not _animation_enabled():
		return
	body.position = base_position + Vector2(0, -absf(sin(gait_distance * 0.18)) * 2.2 if moving else 0.0)

func hit_test(point: Vector2) -> bool:
	if not is_instance_valid(body) or not is_visible_in_tree() or modulate.a <= 0.05:
		return false
	var pixel := Vector2i(body.to_local(point).floor())
	return visible_bounds.has_point(pixel) and body_image.get_pixelv(pixel).a >= ALPHA_THRESHOLD


func _animation_enabled() -> bool:
	return not is_inside_tree() or (is_processing() and can_process())


func _draw() -> void:
	draw_set_transform(Vector2(0.0, 1.0), 0.0, Vector2(1.0, 0.30))
	draw_circle(Vector2.ZERO, visual_height * 0.18, Color(0.17, 0.21, 0.14, 0.22))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
