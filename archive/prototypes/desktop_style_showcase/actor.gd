extends Node3D
## The director owns position and facing. Model height is 1.75 m, forward is +Z.

const MASTER_PATH := "res://assets/disciple_master.glb"
const WORKER_PATH := "res://assets/disciple_worker.glb"
var _model: Node3D
var _skeleton: Skeleton3D
var _player: AnimationPlayer
var _clips: Dictionary = {}
var _bones: Dictionary = {}
var _clip := ""
var _sword_mount: Node3D
var _cast_orb: MeshInstance3D
var _team := 0
var _pixel := false


func setup(master: bool, team: int, pixel_style: bool = false) -> void:
	if is_instance_valid(_model):
		return
	_team = team
	_pixel = pixel_style
	var packed := load(MASTER_PATH if master else WORKER_PATH) as PackedScene
	if packed == null:
		push_error("Showcase actor needs the disciple GLB assets.")
		return
	_model = packed.instantiate() as Node3D
	add_child(_model)
	_model.position.y = 0.001
	_skeleton = _find_node(_model, "Skeleton3D") as Skeleton3D
	_player = _find_node(_model, "AnimationPlayer") as AnimationPlayer
	if _skeleton == null or _player == null:
		push_error("Showcase disciple needs its skeleton and animation clips.")
		return
	_player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	for index in _skeleton.get_bone_count():
		_bones[_skeleton.get_bone_name(index)] = index
	for name: StringName in _player.get_animation_list():
		var short_name := String(name).get_slice("/", String(name).get_slice_count("/") - 1)
		_clips[short_name] = name
	_style_meshes(_model, master)
	_sword_mount = Node3D.new()
	_skeleton.add_child(_sword_mount)
	_make_sword(_sword_mount)
	_cast_orb = MeshInstance3D.new()
	var orb := SphereMesh.new()
	orb.radius = 0.07
	orb.height = 0.14
	orb.radial_segments = 12
	orb.rings = 6
	_cast_orb.mesh = orb
	var glow := StandardMaterial3D.new()
	glow.albedo_color = Color("e3fff5") if team == 0 else Color("ffcc87")
	glow.emission_enabled = true
	glow.emission = Color("54dac6") if team == 0 else Color("ff692c")
	glow.emission_energy_multiplier = 1.8
	_cast_orb.material_override = glow
	_skeleton.add_child(_cast_orb)
	pose(0.0, 0.0)


func pose(time: float, motion: float, action: int = 0) -> void:
	if _player == null or _skeleton == null:
		return
	var next_clip := "walk" if motion > 0.08 else "idle"
	if not _clips.has(next_clip):
		return
	if _clip != next_clip:
		_clip = next_clip
		_player.play(_clips[_clip])
	var animation := _player.get_animation(_clips[_clip])
	var rate := lerpf(0.8, 1.35, clampf(motion, 0.0, 1.0)) if _clip == "walk" else 1.0
	_player.seek(fposmod(time * rate, animation.length), true)
	# Add gestures after the imported animation has restored every bone pose.
	var swing := sin(time * TAU / 1.05)
	var lift := 0.5 + 0.5 * sin(time * TAU / 1.05 - 0.7)
	if action == 1:
		_add_rotation("chest", Vector3(0.10, 0.46 * swing, -0.10 * swing))
		_add_rotation("upper_arm.R", Vector3(-0.55 - lift * 1.10, 0.10, -0.40 + swing * 0.48))
		_add_rotation("forearm.R", Vector3(-0.35 - lift * 0.65, 0.0, 0.0))
		_add_rotation("upper_arm.L", Vector3(-0.24, 0.0, 0.32))
		_add_rotation("head", Vector3(0.0, -0.14 * swing, 0.0))
	elif action == 2:
		var pulse := sin(time * 3.5)
		_add_rotation("upper_arm.L", Vector3(-1.20 + pulse * 0.13, 0.0, 0.22))
		_add_rotation("forearm.L", Vector3(-0.65, 0.0, 0.0))
		_add_rotation("upper_arm.R", Vector3(-0.4, 0.0, -0.12))
		_add_rotation("chest", Vector3(-0.09, 0.08 * pulse, 0.0))
	elif action == 3:
		var recoil := pow(maxf(0.0, sin(time * 8.0)), 2.0)
		_add_rotation("chest", Vector3(-0.34 * recoil, 0.0, 0.13 * recoil))
		_add_rotation("head", Vector3(-0.16 * recoil, 0.0, 0.0))
		_add_rotation("upper_arm.L", Vector3(-0.44 * recoil, 0.0, 0.22 * recoil))
		_add_rotation("upper_arm.R", Vector3(-0.30 * recoil, 0.0, -0.20 * recoil))
	_skeleton.force_update_all_bone_transforms()
	var hand_id: int = _bones.get("hand.R", -1)
	if hand_id >= 0:
		_sword_mount.transform = _skeleton.get_bone_global_pose(hand_id)
		_sword_mount.rotate_object_local(Vector3.RIGHT, -0.22)
	var left_id: int = _bones.get("hand.L", -1)
	_cast_orb.visible = action == 2
	if left_id >= 0:
		_cast_orb.position = _skeleton.get_bone_global_pose(left_id).origin
		_cast_orb.scale = Vector3.ONE * (1.0 + 0.18 * sin(time * 8.0))


func face_camera(_camera: Camera3D) -> void:
	pass


func set_lighting(_daylight: float) -> void:
	pass


func _add_rotation(bone_name: String, angles: Vector3) -> void:
	var index: int = _bones.get(bone_name, -1)
	if index >= 0:
		_skeleton.set_bone_pose_rotation(index, _skeleton.get_bone_pose_rotation(index) * Quaternion.from_euler(angles))


func _style_meshes(node: Node, master: bool) -> void:
	if node is MeshInstance3D:
		var instance := node as MeshInstance3D
		for surface in instance.mesh.get_surface_count():
			var original := instance.mesh.surface_get_material(surface) as StandardMaterial3D
			if original == null:
				continue
			var material := original.duplicate() as StandardMaterial3D
			var label := String(original.resource_name).to_lower()
			if label.begins_with("wood") or label.begins_with("iron"):
				material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				material.albedo_color.a = 0.0
			elif label.begins_with("robe") or label.begins_with("lining"):
				var base := Color("bfd2d3") if master else Color("326f68")
				if _team != 0:
					base = Color("8d4548") if master else Color("755263")
				if label.contains("shade"):
					base = base.darkened(0.22)
				elif label.begins_with("lining"):
					base = Color("284e64") if _team == 0 else Color("422d46")
				material.albedo_color = base
			if _pixel:
				material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
				material.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
			instance.set_surface_override_material(surface, material)
	for child in node.get_children():
		_style_meshes(child, master)


func _make_sword(parent: Node3D) -> void:
	var steel := StandardMaterial3D.new()
	steel.albedo_color = Color("c7d7dd")
	steel.metallic = 0.78
	steel.roughness = 0.26
	var gold := StandardMaterial3D.new()
	gold.albedo_color = Color("b39452")
	gold.metallic = 0.65
	gold.roughness = 0.4
	# The local hand bone points along the fingers, so blade +Y follows the grip.
	for part in [Vector3(0.050, 0.76, 0.023), Vector3(0.22, 0.035, 0.06), Vector3(0.045, 0.18, 0.045)]:
		var mesh := BoxMesh.new()
		mesh.size = part
		var item := MeshInstance3D.new()
		item.mesh = mesh
		if part.y > 0.5:
			item.position.y = 0.47
			item.material_override = steel
		elif part.x > 0.1:
			item.position.y = 0.08
			item.material_override = gold
		else:
			item.position.y = -0.02
			item.material_override = gold
		parent.add_child(item)


func _find_node(node: Node, type_name: String) -> Node:
	if node.is_class(type_name):
		return node
	for child in node.get_children():
		var result := _find_node(child, type_name)
		if result != null:
			return result
	return null
