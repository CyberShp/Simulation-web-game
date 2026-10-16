extends Node3D
## Animated courtyard disciple. The scene owner supplies world movement.

const MASTER_MODEL := "res://art/assets/disciple_master.glb"
const WORKER_MODEL := "res://art/assets/disciple_worker.glb"

var _model: Node3D
var _player: AnimationPlayer
var _motion := ""
var _is_master := false
var _clips: Dictionary = {}


func setup(is_master: bool) -> void:
	if is_instance_valid(_model) and _is_master == is_master:
		return
	_is_master = is_master
	if is_instance_valid(_model):
		remove_child(_model)
		_model.queue_free()
	var packed := load(MASTER_MODEL if is_master else WORKER_MODEL) as PackedScene
	if packed == null:
		push_error("The courtyard disciple model could not be loaded.")
		return
	_model = packed.instantiate() as Node3D
	add_child(_model)
	_player = _find_player(_model)
	_clips.clear()
	_motion = ""
	if _player == null:
		push_error("The courtyard disciple requires its animation clips.")
		return
	for animation_name: StringName in _player.get_animation_list():
		var short_name := String(animation_name).get_slice("/", String(animation_name).get_slice_count("/") - 1)
		if short_name in ["idle", "walk", "work"]:
			_clips[short_name] = animation_name
			_player.get_animation(animation_name).loop_mode = Animation.LOOP_LINEAR
	set_motion(false, false, 0.0)


@warning_ignore("unused_parameter")
func set_motion(moving: bool, working: bool, delta: float) -> void:
	if not is_instance_valid(_player):
		return
	var next_motion := "walk" if moving else ("work" if working else "idle")
	if _motion == next_motion or not _clips.has(next_motion):
		return
	_motion = next_motion
	_player.play(_clips[next_motion], 0.18)


func set_facing(direction: Vector3, delta: float) -> void:
	var planar := Vector2(direction.x, direction.z)
	if planar.length_squared() < 0.00001:
		return
	var angle := atan2(direction.x, direction.z)
	rotation.y = lerp_angle(rotation.y, angle, 1.0 - exp(-12.0 * maxf(delta, 0.0)))


func _find_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child in node.get_children():
		var found := _find_player(child)
		if found != null:
			return found
	return null
