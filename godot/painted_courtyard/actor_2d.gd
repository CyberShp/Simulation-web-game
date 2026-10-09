extends Node2D
## Painted projection only: the parent owns position, activity and pause.

const METADATA_PATH := "res://painted_courtyard/assets/characters.json"
const DEFAULT_TEXTURE_PATH := "res://painted_courtyard/assets/characters.png"

@export_range(24.0, 180.0, 1.0) var visual_height: float = 88.0
@export_range(1.0, 18.0, 0.5) var walk_fps: float = 9.0
@export_range(1.0, 12.0, 0.5) var work_fps: float = 5.0
@export_range(0.5, 2.0, 0.05) var stride_height_ratio: float = 1.15
@export_range(2.0, 16.0, 0.5) var turn_speed: float = 9.0

var _sprite: Sprite2D
var _atlas_image: Image
var _frames: Array[AtlasTexture] = []
var _anchors: Array[Vector2] = []
var _frame_bounds: Array[Rect2] = []
var _animations: Dictionary = {}
var _reference_height: float = 165.0
var _moving := false
var _working := false
var _back_facing := false
var _left_facing := false
var _facing_angle: float = PI / 4.0
var _target_angle: float = PI / 4.0
var _turning := false
# Walk phase is a fraction of a complete stride, independent of atlas length.
var _phase: float = 0.0
var _work_phase: float = 0.0
var _distance_driven := false
var _pending_distance: float = 0.0
var _settling := false
var _settle_elapsed: float = 0.0
var _settle_start: float = 0.0
var _settle_end: float = 0.0
var _displayed_index := -1
var _displayed_height := -1.0
var _displayed_left := false
var _displayed_animation := ""


func setup(is_master: bool) -> void:
	_ensure_sprite()
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(METADATA_PATH))
	if not parsed is Dictionary:
		push_error("Painted character frame metadata could not be loaded.")
		return
	var metadata: Dictionary = parsed
	var identity: String = "shen_yan" if is_master else "lu_zhiwei"
	var characters: Variant = metadata.get("characters", {})
	if not characters is Dictionary or not characters.get(identity) is Dictionary:
		push_error("Painted character identity is missing: " + identity)
		return
	var definition: Dictionary = characters[identity]
	var texture_path: String = str(definition.get("texture", metadata.get("texture", DEFAULT_TEXTURE_PATH)))
	if not texture_path.begins_with("res://"):
		texture_path = METADATA_PATH.get_base_dir().path_join(texture_path)
	var texture: Texture2D = load(texture_path) as Texture2D
	if texture == null or not _configure_frames(definition, texture):
		push_error("Painted character atlas or frame definition is invalid: " + identity)


func _ensure_sprite() -> void:
	if is_instance_valid(_sprite):
		return
	_sprite = Sprite2D.new()
	_sprite.name = "PaintedBody"
	_sprite.centered = false
	_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(_sprite)


func _configure_frames(definition: Dictionary, texture: Texture2D) -> bool:
	# Build off to the side so a malformed replacement cannot erase a valid actor.
	var entries: Variant = definition.get("frames", [])
	if not entries is Array or entries.is_empty():
		return false
	var frames: Array[AtlasTexture] = []
	var anchors: Array[Vector2] = []
	var bounds_list: Array[Rect2] = []
	var grouped: Dictionary = {}
	var image: Image = texture.get_image()
	if image == null:
		return false
	if image.is_compressed() and image.decompress() != OK:
		return false
	for raw: Variant in entries:
		if not raw is Dictionary:
			return false
		var entry: Dictionary = raw
		var region_data: Variant = entry.get("region", [])
		var anchor_data: Variant = entry.get("foot_anchor", [])
		var bounds_data: Variant = entry.get("visible_bounds", entry.get("bounds", []))
		if not region_data is Array or region_data.size() != 4 or not anchor_data is Array or anchor_data.size() != 2 or not bounds_data is Array or bounds_data.size() != 4:
			return false
		var region := Rect2(float(region_data[0]), float(region_data[1]), float(region_data[2]), float(region_data[3]))
		if region.size.x <= 0.0 or region.size.y <= 0.0 or not Rect2(Vector2.ZERO, image.get_size()).encloses(region):
			return false
		var frame := AtlasTexture.new()
		frame.atlas = texture
		frame.region = region
		frame.filter_clip = true
		var index: int = frames.size()
		frames.append(frame)
		anchors.append(Vector2(float(anchor_data[0]), float(anchor_data[1])))
		bounds_list.append(Rect2(float(bounds_data[0]), float(bounds_data[1]), float(bounds_data[2]), float(bounds_data[3])))
		var animation: String = str(entry.get("animation", ""))
		if animation.is_empty():
			return false
		if not grouped.has(animation):
			grouped[animation] = []
		grouped[animation].append({"index": index, "frame": int(entry.get("frame", index))})
	for required: String in ["walk_front", "walk_back", "work"]:
		if not grouped.has(required):
			return false
	var animations: Dictionary = {}
	for animation: String in grouped:
		var group: Array = grouped[animation]
		group.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["frame"] < b["frame"])
		var indices: Array[int] = []
		for record: Dictionary in group:
			indices.append(int(record["index"]))
		animations[animation] = indices
	_ensure_sprite()
	_frames = frames
	_anchors = anchors
	_frame_bounds = bounds_list
	_animations = animations
	_atlas_image = image
	_reference_height = maxf(1.0, float(definition.get("reference_height", 165.0)))
	_moving = false
	_working = false
	_phase = 0.0
	_work_phase = 0.0
	_facing_angle = PI / 4.0
	_target_angle = _facing_angle
	_turning = false
	_settling = false
	_distance_driven = false
	_pending_distance = 0.0
	_displayed_index = -1
	_update_frame()
	queue_redraw()
	return true


func set_travel_distance(distance: float) -> void:
	## Call with actual distance travelled in this actor's parent coordinates.
	## Call even with zero on a blocked movement frame. Multiple path legs add up.
	if not _animation_enabled() or not is_finite(distance):
		return
	_distance_driven = true
	_pending_distance += maxf(0.0, distance)


func set_motion(moving: bool, working: bool, _delta: float) -> void:
	if not _animation_enabled():
		return
	var next_working: bool = working and not moving
	if _moving and not moving and not next_working:
		_settling = true
		_settle_elapsed = 0.0
		_settle_start = _phase
		_settle_end = ceilf(_phase * 2.0) / 2.0
	elif moving or next_working:
		_settling = false
	if next_working and not _working:
		_work_phase = 0.0
	# Leaving work immediately switches to the walking body, even on the same tick.
	if moving and _working:
		_phase = 0.0
	_moving = moving
	_working = next_working
	_update_frame()


func set_facing(direction: Vector2, _delta: float) -> void:
	if not _animation_enabled() or not direction.is_finite() or direction.length_squared() < 0.0001:
		return
	_target_angle = direction.angle()
	if absf(angle_difference(_facing_angle, _target_angle)) > 0.4:
		_turning = true


func _animation_enabled() -> bool:
	return not is_inside_tree() or (is_processing() and can_process())


func _process(delta: float) -> void:
	if _frames.is_empty() or not _animation_enabled():
		return
	# Slow/resumed frames never catch up elapsed hidden animation time.
	var elapsed: float = clampf(delta, 0.0, 0.05)
	_facing_angle = rotate_toward(_facing_angle, _target_angle, turn_speed * elapsed)
	if absf(angle_difference(_facing_angle, _target_angle)) < 0.025:
		_facing_angle = _target_angle
		_turning = false
	if _moving:
		if _distance_driven:
			_phase = fposmod(_phase + _pending_distance / maxf(1.0, visual_height * stride_height_ratio), 1.0)
		else:
			_phase = fposmod(_phase + elapsed * walk_fps / _clip_size(_walk_animation()), 1.0)
	elif _working:
		_work_phase = fposmod(_work_phase + elapsed * work_fps / _clip_size("work"), 1.0)
	elif _settling:
		_settle_elapsed += elapsed
		var weight: float = minf(_settle_elapsed / 0.16, 1.0)
		_phase = fposmod(lerpf(_settle_start, _settle_end, 1.0 - pow(1.0 - weight, 2.0)), 1.0)
		if weight >= 1.0:
			_settling = false
	_pending_distance = 0.0
	_update_frame()


func _walk_animation() -> String:
	return "walk_back" if _back_facing else "walk_front"


func _clip_size(animation: String) -> int:
	return maxi(1, _animations.get(animation, []).size())


func _update_frame() -> void:
	if _frames.is_empty():
		return
	_left_facing = cos(_facing_angle) < -0.001
	_back_facing = sin(_facing_angle) < -absf(cos(_facing_angle)) * 0.12
	var animation: String = _walk_animation()
	var column: int = 0
	if _working:
		animation = "work"
		column = int(_work_phase * _clip_size(animation))
	elif _turning and _animations.has("turn_rest"):
		animation = "turn_rest"
		column = _turn_column()
	elif _moving or _settling:
		column = int(_phase * _clip_size(animation))
	elif _animations.has("turn_rest"):
		animation = "turn_rest"
		# Authored stable poses: front-right 0, side 2, back-right 4.
		column = int(roundf(float(_turn_column()) / 2.0)) * 2
	else:
		# Original six-frame strips have no dedicated standing/turning strip.
		column = 1
	var indices: Array = _animations[animation]
	var index: int = int(indices[clampi(column, 0, indices.size() - 1)])
	_displayed_animation = animation
	if index == _displayed_index and visual_height == _displayed_height and _left_facing == _displayed_left:
		return
	_displayed_index = index
	_displayed_height = visual_height
	_displayed_left = _left_facing
	var ratio: float = visual_height / _reference_height
	var anchor: Vector2 = _anchors[index]
	var horizontal: float = -1.0 if _left_facing else 1.0
	_sprite.texture = _frames[index]
	_sprite.scale = Vector2(ratio * horizontal, ratio)
	_sprite.position = Vector2(-anchor.x * ratio * horizontal, -anchor.y * ratio)


func _turn_column() -> int:
	var half_angle: float = atan2(sin(_facing_angle), absf(cos(_facing_angle)))
	return clampi(int(roundf(2.0 - half_angle / (PI / 4.0) * 2.0)), 0, 4)


func hit_test(world_point: Vector2) -> bool:
	if not is_visible_in_tree() or _displayed_index < 0 or modulate.a <= 0.05:
		return false
	var texture_point: Vector2 = _sprite.to_local(world_point)
	var index: int = _displayed_index
	var region: Rect2 = _frames[index].region
	# Bounds and alpha use the same mirrored, foot-anchored transform as drawing.
	if not _frame_bounds[index].has_point(texture_point) or not Rect2(Vector2.ZERO, region.size).has_point(texture_point):
		return false
	var atlas_point := Vector2i(region.position + texture_point.floor())
	if not Rect2i(Vector2i.ZERO, _atlas_image.get_size()).has_point(atlas_point):
		return false
	return _atlas_image.get_pixelv(atlas_point).a > 0.12


func _draw() -> void:
	var radius: float = visual_height * 0.18
	draw_set_transform(Vector2(0.0, 1.0), 0.0, Vector2(1.0, 0.30))
	draw_circle(Vector2.ZERO, radius, Color(0.17, 0.21, 0.14, 0.22))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
