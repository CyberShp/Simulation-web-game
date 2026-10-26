extends Node3D
## Thirty-six 96x128 character cells share one isolated 3D render pass.

const ACTOR := preload("res://actor.gd")
const PIXEL_SHADER := preload("res://pixel_actor.gdshader")
const CELL := Vector2i(96, 128)
const GRID := Vector2i(6, 6)
const CELL_WORLD := Vector2(2.4, 3.2)
const FOOT_FROM_BOTTOM := 16.0
static var _atlas: SubViewport
static var _stage: Node3D
static var _sun: DirectionalLight3D
static var _slots: Array[bool] = []
static var _material: ShaderMaterial
var _slot := -1
var _proxy: Node3D
var _tilt: Node3D
var _sprite: Sprite3D
var _camera: Camera3D
var _last_sample := -1
var _last_motion := -1.0
var _last_action := -1


func setup(master: bool, team: int, _pixel_style: bool = true) -> void:
	if _slot >= 0:
		return
	if not is_inside_tree():
		setup.call_deferred(master, team, _pixel_style)
		return
	_ensure_atlas()
	for index in _slots.size():
		if not _slots[index]:
			_slot = index
			_slots[index] = true
			break
	if _slot < 0:
		push_error("The showcase pixel atlas supports 36 simultaneous characters.")
		return
	var col := _slot % GRID.x
	var row := _slot / GRID.x
	_tilt = Node3D.new()
	_stage.add_child(_tilt)
	_tilt.position = Vector3((col + 0.5 - GRID.x * 0.5) * CELL_WORLD.x, (GRID.y * 0.5 - row - 1.0) * CELL_WORLD.y + FOOT_FROM_BOTTOM * CELL_WORLD.y / CELL.y, 0.0)
	_tilt.rotation.x = deg_to_rad(35.0)
	_proxy = ACTOR.new()
	_tilt.add_child(_proxy)
	_proxy.setup(master, team, true)
	_sprite = Sprite3D.new()
	_sprite.texture = _atlas.get_texture()
	_sprite.region_enabled = true
	_sprite.region_rect = Rect2(Vector2(col * CELL.x, row * CELL.y), Vector2(CELL))
	_sprite.pixel_size = CELL_WORLD.y / CELL.y
	_sprite.offset = Vector2(0.0, CELL.y * 0.5 - FOOT_FROM_BOTTOM)
	_sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	_sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_sprite.material_override = _material
	add_child(_sprite)


func pose(time: float, motion: float, action: int = 0) -> void:
	if _proxy == null:
		return
	if not is_instance_valid(_camera):
		_camera = get_viewport().get_camera_3d()
	if is_instance_valid(_camera):
		face_camera(_camera)
	# Quantized sampling preserves an intentional pixel animation cadence.
	var sample := int(floor(time * 18.0))
	if sample != _last_sample or motion != _last_motion or action != _last_action:
		_proxy.pose(float(sample) / 18.0, motion, action)
		_last_sample = sample
		_last_motion = motion
		_last_action = action


func face_camera(camera: Camera3D) -> void:
	_camera = camera
	if _proxy == null:
		return
	var toward_camera := camera.global_basis.z.normalized()
	var azimuth := atan2(toward_camera.x, toward_camera.z)
	var elevation := atan2(toward_camera.y, Vector2(toward_camera.x, toward_camera.z).length())
	_tilt.rotation.x = elevation
	_proxy.rotation.y = global_rotation.y - azimuth


func set_lighting(daylight: float) -> void:
	if is_instance_valid(_sun):
		_sun.light_energy = lerpf(0.35, 1.25, clampf(daylight, 0.0, 1.0))
	if _material != null:
		_material.set_shader_parameter("daylight", clampf(daylight, 0.0, 1.0))


func _exit_tree() -> void:
	if _slot >= 0 and _slot < _slots.size():
		_slots[_slot] = false
	if is_instance_valid(_tilt):
		_tilt.queue_free()


func _ensure_atlas() -> void:
	if is_instance_valid(_atlas):
		return
	_slots.clear()
	_slots.resize(GRID.x * GRID.y)
	_slots.fill(false)
	_atlas = SubViewport.new()
	_atlas.name = "SharedPixelCharacterAtlas"
	_atlas.size = CELL * GRID
	_atlas.transparent_bg = true
	_atlas.own_world_3d = true
	_atlas.msaa_3d = Viewport.MSAA_DISABLED
	_atlas.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
	_atlas.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	get_tree().root.add_child(_atlas)
	_stage = Node3D.new()
	_atlas.add_child(_stage)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.keep_aspect = Camera3D.KEEP_HEIGHT
	camera.size = CELL_WORLD.y * GRID.y
	camera.position = Vector3(0.0, 0.0, 20.0)
	camera.far = 40.0
	camera.current = true
	_stage.add_child(camera)
	_sun = DirectionalLight3D.new()
	_sun.rotation_degrees = Vector3(-25.0, -30.0, 0.0)
	_sun.light_energy = 1.25
	_sun.light_color = Color("fff0d5")
	_sun.shadow_enabled = false
	_stage.add_child(_sun)
	var environment := WorldEnvironment.new()
	var settings := Environment.new()
	settings.background_mode = Environment.BG_CLEAR_COLOR
	settings.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	settings.ambient_light_color = Color("a4c1d4")
	settings.ambient_light_energy = 0.7
	settings.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	environment.environment = settings
	_stage.add_child(environment)
	_material = ShaderMaterial.new()
	_material.shader = PIXEL_SHADER
	_material.set_shader_parameter("sprite_texture", _atlas.get_texture())
