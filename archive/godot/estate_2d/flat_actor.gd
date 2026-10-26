extends "res://painted_courtyard/actor_2d.gd"
## U-126 scene artwork; shared actor playback keeps the same movement contract.

const FLAT_METADATA_PATH := "res://estate_2d/assets/flat-characters-v1.json"
const FLAT_EDGE_SHADER := preload("res://estate_2d/flat_people.gdshader")

var _excluded_regions: Dictionary = {}
var _mask_frame_index := -2


func setup(is_master: bool) -> void:
	_ensure_sprite()
	var metadata: Variant = JSON.parse_string(FileAccess.get_file_as_string(FLAT_METADATA_PATH))
	var identity := "shen_yan" if is_master else "lu_zhiwei"
	if not metadata is Dictionary or not metadata.get("characters", {}).get(identity) is Dictionary:
		push_error("Flat character frame metadata is missing: " + identity)
		return
	_excluded_regions.clear()
	_mask_frame_index = -2
	var definitions: Array = metadata.characters[identity].get("frames", [])
	for index: int in range(definitions.size()):
		var region: Array = definitions[index].get("exclude_region", [])
		if region.size() == 4:
			_excluded_regions[index] = Rect2(region[0], region[1], region[2], region[3])
	var texture := load(str(metadata.get("texture", ""))) as Texture2D
	if texture == null or not _configure_frames(metadata.characters[identity], texture):
		push_error("Flat character atlas or frame definition is invalid: " + identity)
		return
	var material := ShaderMaterial.new()
	material.shader = FLAT_EDGE_SHADER
	_sprite.material = material
	_update_frame()


func _update_frame() -> void:
	super._update_frame()
	if not is_instance_valid(_sprite) or not _sprite.material is ShaderMaterial or _displayed_index == _mask_frame_index:
		return
	_mask_frame_index = _displayed_index
	var region: Rect2 = _excluded_regions.get(_displayed_index, Rect2())
	_sprite.material.set_shader_parameter("exclude_region", Vector4(region.position.x, region.position.y, region.size.x, region.size.y))


func hit_test(world_point: Vector2) -> bool:
	if not super.hit_test(world_point):
		return false
	var atlas_point := Vector2i(_frames[_displayed_index].region.position + _sprite.to_local(world_point).floor())
	if _excluded_regions.has(_displayed_index) and _excluded_regions[_displayed_index].has_point(Vector2(atlas_point)):
		return false
	return _atlas_image.get_pixelv(atlas_point).a >= 32.0 / 255.0
