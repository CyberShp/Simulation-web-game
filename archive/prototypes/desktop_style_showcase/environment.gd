extends Node3D
## Native showcase environment. All positions are metres, Y up, entrance +Z.
## Root scene owns lighting, sky, camera, simulation, and characters.

const SURFACE_SHADER = preload("res://shaders/environment_surface.gdshader")
const WATER_SHADER = preload("res://shaders/environment_water.gdshader")
const WALK_HEIGHT := 0.12
const PLAYABLE_RECT := Rect2(-22.0, -12.0, 44.0, 54.0)
const BATTLE_RECT := Rect2(-17.0, -3.0, 34.0, 39.0)

var landmarks: Dictionary = {
	"hall": Vector3(0, 0.12, -24),
	"hall_stairs": Vector3(0, 0.12, -13),
	"west_hall": Vector3(-23, 0.12, -6),
	"east_hall": Vector3(23, 0.12, -6),
	"battle_center": Vector3(0, 0.12, 14),
	"walk_start": Vector3(-12, 0.12, 24),
	"walk_end": Vector3(0, 0.12, 12),
	"gate": Vector3(0, 0.12, 44),
	"bridge": Vector3(34, 1.15, 10),
	"river": Vector3(35, -1.25, 0),
}
var _pixel_style := false
var _rng := RandomNumberGenerator.new()
var _materials: Dictionary = {}
var _meshes: Dictionary = {}
var _batches: Dictionary = {}
var _built_root: Node3D
var _water_material: ShaderMaterial
var _lantern_material: StandardMaterial3D


func build(pixel_style: bool = false) -> void:
	if is_instance_valid(_built_root):
		remove_child(_built_root)
		_built_root.queue_free()
	_pixel_style = pixel_style
	_rng.seed = 1260314
	_materials.clear()
	_meshes.clear()
	_batches.clear()
	_built_root = Node3D.new()
	_built_root.name = "YunxiuMountainCourtyard"
	add_child(_built_root)
	_make_materials()
	_make_meshes()
	_make_terrain()
	_make_courtyard()
	_make_halls()
	_make_colonnades()
	_make_gate()
	_make_river_and_bridge()
	_make_gardens()
	_make_mountains()
	_flush_batches()
	set_daylight(1.0)


func get_landmarks() -> Dictionary:
	return landmarks.duplicate(true)


func set_daylight(progress: float) -> void:
	var day := clampf(progress, 0.0, 1.0)
	if _water_material != null:
		_water_material.set_shader_parameter("daylight", day)
	if _lantern_material != null:
		_lantern_material.emission_energy_multiplier = lerpf(2.2, 0.65, day)


func _surface(key: String, color: Color, kind: float = 0.0, grain: float = 0.08) -> void:
	var material := ShaderMaterial.new()
	material.shader = SURFACE_SHADER
	material.set_shader_parameter("tint", color)
	material.set_shader_parameter("surface_kind", kind)
	material.set_shader_parameter("grain_strength", grain)
	material.set_shader_parameter("pixel_style", _pixel_style)
	_materials[key] = material


func _make_materials() -> void:
	_surface("stone", Color("93948a"), 1.0, 0.065)
	_surface("stone_light", Color("b3b5a7"), 1.0, 0.055)
	_surface("stone_dark", Color("565f59"), 1.0, 0.06)
	_surface("paving", Color("929c94"), 1.0, 0.065)
	_surface("earth", Color("58624b"), 3.0, 0.12)
	_surface("soil", Color("776b50"), 3.0, 0.1)
	_surface("wood", Color("4a2b1b"), 2.0, 0.045)
	_surface("wood_edge", Color("795036"), 2.0, 0.035)
	_surface("roof", Color("253e43"), 1.0, 0.025)
	_surface("ridge", Color("637978"), 1.0, 0.02)
	_surface("bark", Color("514336"), 2.0, 0.05)
	_surface("pine", Color("294f42"), 3.0, 0.045)
	_surface("pine_light", Color("456955"), 3.0, 0.04)
	_surface("shrub", Color("4b6750"), 3.0, 0.055)
	_surface("grass", Color("687951"), 3.0, 0.05)
	_surface("red", Color("733b2a"), 2.0, 0.03)
	_surface("brass", Color("b2914a"), 1.0, 0.02)
	_surface("mountain_near", Color("62726d"), 1.0, 0.055)
	_surface("mountain_mid", Color("738b86"), 1.0, 0.035)
	_surface("mountain_far", Color("8da5a4"), 1.0, 0.025)
	_lantern_material = StandardMaterial3D.new()
	_lantern_material.albedo_color = Color("edcb86")
	_lantern_material.emission_enabled = true
	_lantern_material.emission = Color("e4aa50")
	_lantern_material.emission_energy_multiplier = 0.65
	_lantern_material.roughness = 0.72
	_materials["lantern"] = _lantern_material


func _make_meshes() -> void:
	var box := BoxMesh.new()
	box.size = Vector3.ONE
	_meshes["box"] = box
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = 0.5
	cylinder.bottom_radius = 0.5
	cylinder.height = 1.0
	cylinder.radial_segments = 12
	_meshes["cylinder"] = cylinder
	var sphere := SphereMesh.new()
	sphere.radius = 0.5
	sphere.height = 1.0
	sphere.radial_segments = 12
	sphere.rings = 6
	_meshes["foliage"] = sphere
	_meshes["rock"] = _rock_mesh()
	_meshes["roof"] = _roof_mesh()
	for variant in range(5):
		_meshes["mountain" + str(variant)] = _mountain_mesh(variant)


func _add(kind: String, material: String, position: Vector3, size: Vector3, yaw: float = 0.0, tint: Color = Color.WHITE) -> void:
	var transform := Transform3D(Basis(Vector3.UP, yaw).scaled(size), position)
	_queue(kind, material, transform, tint)


func _queue(kind: String, material: String, transform: Transform3D, tint: Color = Color.WHITE) -> void:
	var key := kind + ":" + material
	if not _batches.has(key):
		_batches[key] = {"kind": kind, "material": material, "transforms": [], "colors": []}
	_batches[key].transforms.append(transform)
	_batches[key].colors.append(tint)


func _segment(a: Vector3, b: Vector3, radius: float, material: String) -> void:
	var offset := b - a
	if offset.length_squared() < 0.001:
		return
	var basis := Basis(Quaternion(Vector3.UP, offset.normalized())).scaled(Vector3(radius * 2, offset.length(), radius * 2))
	_queue("cylinder", material, Transform3D(basis, (a + b) * 0.5))


func _flush_batches() -> void:
	for key in _batches:
		var batch: Dictionary = _batches[key]
		var mesh: Mesh = _meshes[batch.kind]
		var multi := MultiMesh.new()
		multi.transform_format = MultiMesh.TRANSFORM_3D
		multi.use_colors = true
		multi.mesh = mesh
		multi.instance_count = batch.transforms.size()
		for i in range(multi.instance_count):
			multi.set_instance_transform(i, batch.transforms[i])
			multi.set_instance_color(i, batch.colors[i])
		var node := MultiMeshInstance3D.new()
		node.name = String(key).replace(":", "_")
		node.multimesh = multi
		node.material_override = _materials[batch.material]
		_built_root.add_child(node)


func _make_terrain() -> void:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var step := 2.5
	for iz in range(64):
		for ix in range(48):
			var x := -60.0 + ix * step
			var z := -80.0 + iz * step
			var points := [Vector3(x, _terrain_height(x, z), z), Vector3(x + step, _terrain_height(x + step, z), z), Vector3(x, _terrain_height(x, z + step), z + step), Vector3(x + step, _terrain_height(x + step, z + step), z + step)]
			for index in [0, 1, 2, 1, 3, 2]:
				var v: Vector3 = points[index]
				surface.set_uv(Vector2(v.x, v.z) * 0.1)
				surface.add_vertex(v)
	surface.generate_normals()
	var terrain := MeshInstance3D.new()
	terrain.name = "ContinuousMountainTerrace"
	terrain.mesh = surface.commit()
	terrain.material_override = _materials.earth
	_built_root.add_child(terrain)
	# Ground beneath the stone paving is level with the character foot contract.
	_add("box", "stone_dark", Vector3(0, -0.20, 15), Vector3(45, 0.38, 55))


func _terrain_height(x: float, z: float) -> float:
	if absf(x) < 28.0 and z > -39.0 and z < 50.0:
		return -0.12
	var river_center := 35.0 + sin(z * 0.042) * 2.0
	if absf(x - river_center) < 6.6:
		return -3.0
	var height := -0.3 + sin(x * 0.11 + z * 0.08) * 0.45 + cos(z * 0.17) * 0.28
	if z < -43.0:
		height += minf(13.0, (-43.0 - z) * 0.34)
	if x < -34.0:
		height += minf(9.0, (-34.0 - x) * 0.32)
	return height


func _make_courtyard() -> void:
	# Large individual slabs establish human scale; narrow joints stay visible.
	for row in range(27):
		for column in range(22):
			var value := _rng.randf_range(0.88, 1.09)
			var center := Vector3(-21.0 + column * 2.0, 0.025, -11.0 + row * 2.0)
			_add("box", "paving", center, Vector3(1.962, 0.15, 1.962), 0.0, Color(value, value, value * 0.985))
	for side in [-1.0, 1.0]:
		for z in range(-12, 43, 2):
			_add("box", "stone_light", Vector3(side * 22.15, 0.065, z), Vector3(0.48, 0.22, 1.96))
		for x in range(-22, 23, 2):
			_add("box", "stone_light", Vector3(x, 0.065, -12 if side < 0 else 42), Vector3(1.96, 0.22, 0.48))
	# A broad axial strip and a restrained stone seal mark the central court.
	for row in range(26):
		_add("box", "stone_light", Vector3(-3.1, 0.106, -10.0 + row * 2), Vector3(0.10, 0.012, 1.94))
		_add("box", "stone_light", Vector3(3.1, 0.106, -10.0 + row * 2), Vector3(0.10, 0.012, 1.94))
	for radius in [3.0, 3.25]:
		for i in range(48):
			var angle := i * TAU / 48.0
			_add("box", "stone_dark", Vector3(sin(angle) * radius, 0.108, 14 + cos(angle) * radius), Vector3(0.44, 0.012, 0.10), angle)
	# Broad frame bands give the forecourt its own paved composition.
	for x in [-18.0, 18.0]:
		_add("box", "stone_dark", Vector3(x, 0.106, 15), Vector3(0.20, 0.012, 48.0))
	for z in [-9.0, 39.0]:
		_add("box", "stone_dark", Vector3(0, 0.106, z), Vector3(36.0, 0.012, 0.20))
	for side in [-1.0, 1.0]:
		for i in range(25):
			var z := _rng.randf_range(-10, 40)
			var x: float = side * _rng.randf_range(20.3, 21.6)
			_add("foliage", "grass", Vector3(x, 0.096, z), Vector3(_rng.randf_range(0.25, 0.65), 0.035, _rng.randf_range(0.1, 0.4)), _rng.randf_range(0, TAU))
	# Broad approach stones continue through the gate and toward the bridge.
	for z in range(44, 66, 2):
		for x in [-2.0, 0.0, 2.0]:
			_add("box", "paving", Vector3(x, 0.02, z), Vector3(1.94, 0.13, 1.94))
	for x in range(23, 30, 2):
		for z in [8.0, 10.0, 12.0]:
			_add("box", "paving", Vector3(x, 0.02, z), Vector3(1.94, 0.13, 1.94))


func _make_halls() -> void:
	var packed := load("res://assets/hall.glb") as PackedScene
	if packed == null:
		push_error("Showcase environment requires res://assets/hall.glb")
		return
	for definition in [
		{"name": "MainHall", "position": Vector3(0, 0.1, -24), "scale": 2.0, "yaw": 0.0},
		{"name": "WestResidence", "position": Vector3(-23, 0.1, -6), "scale": 0.96, "yaw": PI * 0.5},
		{"name": "EastAlchemyHall", "position": Vector3(23, 0.1, -6), "scale": 0.96, "yaw": -PI * 0.5},
	]:
		var model := packed.instantiate() as Node3D
		model.name = definition.name
		model.position = definition.position
		model.scale = Vector3.ONE * float(definition.scale)
		model.rotation.y = float(definition.yaw)
		_refine_hall_materials(model)
		_built_root.add_child(model)
	for x in [-12.7, 12.7]:
		_stone_lantern(Vector3(x, 0, -12.5), 1.55)
		_planter(Vector3(x, 0, -18), Vector3(2.2, 0.6, 3.8))
	for x in [-17.5, 17.5]:
		_stone_lantern(Vector3(x, 0, -1), 1.05)


func _refine_hall_materials(node: Node) -> void:
	if node is MeshInstance3D:
		var instance := node as MeshInstance3D
		for index in range(instance.mesh.get_surface_count()):
			var original := instance.mesh.surface_get_material(index)
			var label := original.resource_name.to_lower() if original != null else ""
			var kind := 0.0
			if "cedar" in label or "timber" in label:
				kind = 2.0
			elif "tile" in label or "ridge" in label:
				kind = 4.0
			elif "stone" in label:
				kind = 1.0
			var key := "hall_" + str(kind)
			if not _materials.has(key):
				var tint := Color("d6d7d2")
				if kind == 4.0:
					tint = Color("a8b7c4")
				elif kind == 2.0:
					tint = Color("c6b39a")
				elif kind == 1.0:
					tint = Color("c5cccf")
				_surface(key, tint, kind, 0.027)
			instance.set_surface_override_material(index, _materials[key])
	for child in node.get_children():
		_refine_hall_materials(child)


func _make_colonnades() -> void:
	for side in [-1.0, 1.0]:
		var x: float = side * 24.0
		# A generous opening on the river side preserves the bridge approach.
		var runs := [[17.0, 36.0]] if side > 0 else [[5.0, 36.0]]
		for run in runs:
			var start: float = run[0]
			var end: float = run[1]
			_add("box", "stone", Vector3(x, 0.08, (start + end) * 0.5), Vector3(5.4, 0.25, end - start + 1.5))
			_add("roof", "roof", Vector3(x, 4.45, (start + end) * 0.5), Vector3(end - start + 3.0, 1.6, 6.4), PI * 0.5)
			# Ridge and roof-edge bands follow the long corridor axis.
			_add("box", "ridge", Vector3(x, 6.05, (start + end) * 0.5), Vector3(0.22, 0.24, end - start + 3.3))
			for edge in [-1.0, 1.0]:
				_add("box", "wood_edge", Vector3(x + edge * 2.3, 4.33, (start + end) * 0.5), Vector3(0.26, 0.34, end - start + 0.5))
			for z in range(int(start), int(end) + 1, 4):
				for edge in [-1.0, 1.0]:
					var p := Vector3(x + edge * 2.1, 0, z)
					_add("box", "stone_light", p + Vector3(0, 0.3, 0), Vector3(0.66, 0.5, 0.66))
					_add("cylinder", "wood", p + Vector3(0, 2.35, 0), Vector3(0.38, 3.9, 0.38))
					_add("box", "wood_edge", p + Vector3(0, 4.0, 0), Vector3(0.7, 0.2, 0.5))
				_hanging_lantern(Vector3(x, 3.65, z), 0.65)
			for z in range(int(start), int(end), 4):
				_railing(Vector3(x + side * 2.25, 0.2, z), Vector3(x + side * 2.25, 0.2, minf(z + 4, end)))


func _make_gate() -> void:
	for x in [-5.6, 5.6]:
		_add("box", "stone_light", Vector3(x, 0.48, 44), Vector3(1.1, 0.8, 1.1))
		_add("cylinder", "red", Vector3(x, 3.6, 44), Vector3(0.62, 6.1, 0.62))
		_add("box", "wood_edge", Vector3(x, 6.3, 44), Vector3(1.3, 0.42, 0.8))
		_hanging_lantern(Vector3(x * 0.86, 5.55, 44.8), 1.0)
	_add("box", "wood", Vector3(0, 6.05, 44), Vector3(12.6, 0.65, 0.65))
	_add("roof", "roof", Vector3(0, 6.4, 44), Vector3(14.0, 1.9, 4.0))
	_add("box", "ridge", Vector3(0, 8.35, 44), Vector3(14.2, 0.22, 0.22))
	_add("box", "wood", Vector3(0, 5.55, 44.4), Vector3(3.2, 1.2, 0.22))
	for x in [-1.5, 1.5]:
		_add("box", "brass", Vector3(x, 5.55, 44.53), Vector3(0.055, 1.07, 0.03))
	for y in [5.05, 6.05]:
		_add("box", "brass", Vector3(0, y, 44.53), Vector3(3.05, 0.055, 0.03))
	# Relief strokes remain geometric ornaments at the showcase camera distance.
	for x in [-0.8, 0.0, 0.8]:
		for dx in [-0.15, 0.0, 0.15]:
			_add("box", "brass", Vector3(x + dx, 5.55, 44.55), Vector3(0.06, 0.48 if dx == 0 else 0.32, 0.04))
		_add("box", "brass", Vector3(x, 5.35, 44.55), Vector3(0.42, 0.06, 0.04))
	for side in [-1.0, 1.0]:
		_railing(Vector3(side * 7, 0, 43), Vector3(side * 22, 0, 43))
		_stone_lantern(Vector3(side * 8.5, 0, 46), 1.4)


func _make_river_and_bridge() -> void:
	var water_mesh := PlaneMesh.new()
	water_mesh.size = Vector2(12.0, 144.0)
	water_mesh.subdivide_width = 8
	water_mesh.subdivide_depth = 72
	_water_material = ShaderMaterial.new()
	_water_material.shader = WATER_SHADER
	_water_material.set_shader_parameter("pixel_style", _pixel_style)
	var water := MeshInstance3D.new()
	water.name = "JadeRiver"
	water.mesh = water_mesh
	water.material_override = _water_material
	water.position = Vector3(35, -1.25, -4)
	_built_root.add_child(water)
	# Staggered banks conceal the straight water boundary beneath organic rock forms.
	for side in [-1.0, 1.0]:
		for i in range(31):
			var z := -66.0 + i * 4.2
			if z > 5 and z < 15:
				continue
			var x: float = 35.0 + side * 6.2 + sin(z * 0.042) * 1.4
			_add("rock", "stone_dark", Vector3(x, -2.0, z), Vector3(_rng.randf_range(2.0, 3.3), _rng.randf_range(2.3, 3.8), _rng.randf_range(2.4, 4.5)), _rng.randf_range(-0.3, 0.3))
	for i in range(17):
		var x := 26.0 + float(i)
		var rise := sin(float(i) / 16.0 * PI) * 1.0
		_add("box", "stone", Vector3(x, -0.2 + rise, 10), Vector3(0.97, 0.55, 6.0))
		_add("box", "stone_light", Vector3(x, 0.10 + rise, 10), Vector3(0.97, 0.12, 5.7))
		if i % 2 == 0:
			for side in [-1.0, 1.0]:
				_add("box", "stone_light", Vector3(x, 0.8 + rise, 10 + side * 2.75), Vector3(0.32, 1.4, 0.32))
				_add("foliage", "stone", Vector3(x, 1.55 + rise, 10 + side * 2.75), Vector3(0.48, 0.45, 0.48))
		if i < 16:
			var next_rise := sin(float(i + 1) / 16.0 * PI)
			for side in [-1.0, 1.0]:
				for height in [0.55, 1.25]:
					_segment(Vector3(x, height + rise, 10 + side * 2.75), Vector3(x + 1, height + next_rise, 10 + side * 2.75), 0.075, "stone_light")
	for x in [27.0, 41.0]:
		for z in [6.5, 13.5]:
			_stone_lantern(Vector3(x, 0, z), 0.85)
	# Understructure leaves a visible dark passage above the water.
	for x in [27.0, 41.0]:
		_add("box", "stone_dark", Vector3(x, -1.0, 10), Vector3(2.0, 2.0, 5.4))


func _railing(a: Vector3, b: Vector3) -> void:
	var distance := a.distance_to(b)
	var count := maxi(1, int(ceil(distance / 2.4)))
	for i in range(count + 1):
		var p := a.lerp(b, float(i) / count)
		_add("box", "stone", p + Vector3(0, 0.75, 0), Vector3(0.3, 1.5, 0.3))
		_add("box", "stone_light", p + Vector3(0, 1.55, 0), Vector3(0.43, 0.16, 0.43))
	for y in [0.5, 1.15]:
		_segment(a + Vector3(0, y, 0), b + Vector3(0, y, 0), 0.075, "stone_light")


func _stone_lantern(p: Vector3, scale_factor: float) -> void:
	_add("box", "stone", p + Vector3(0, 0.16, 0) * scale_factor, Vector3(0.95, 0.30, 0.95) * scale_factor)
	_add("box", "stone_light", p + Vector3(0, 1.05, 0) * scale_factor, Vector3(0.42, 1.6, 0.42) * scale_factor)
	_add("box", "stone", p + Vector3(0, 1.78, 0) * scale_factor, Vector3(0.86, 0.20, 0.86) * scale_factor)
	_hanging_lantern(p + Vector3(0, 2.22, 0) * scale_factor, scale_factor)


func _hanging_lantern(p: Vector3, scale_factor: float) -> void:
	_add("box", "lantern", p, Vector3(0.48, 0.65, 0.48) * scale_factor)
	for x in [-0.28, 0.28]:
		for z in [-0.28, 0.28]:
			_add("box", "wood", p + Vector3(x, 0, z) * scale_factor, Vector3(0.065, 0.78, 0.065) * scale_factor)
	for y in [-0.4, 0.4]:
		_add("box", "wood_edge", p + Vector3(0, y, 0) * scale_factor, Vector3(0.69, 0.12, 0.69) * scale_factor)
	_add("roof", "roof", p + Vector3(0, 0.44, 0) * scale_factor, Vector3(0.9, 0.35, 0.9) * scale_factor)
	_add("foliage", "brass", p + Vector3(0, 0.83, 0) * scale_factor, Vector3(0.11, 0.2, 0.11) * scale_factor)


func _planter(p: Vector3, size: Vector3) -> void:
	_add("box", "stone_dark", p + Vector3(0, size.y * 0.5, 0), size)
	_add("box", "soil", p + Vector3(0, size.y + 0.015, 0), Vector3(size.x - 0.25, 0.08, size.z - 0.25))
	for i in range(5):
		var at := p + Vector3(_rng.randf_range(-0.5, 0.5) * size.x, size.y + 0.4, _rng.randf_range(-0.38, 0.38) * size.z)
		_add("foliage", "shrub", at, Vector3(1.2, 0.85, 1.3), _rng.randf_range(0, TAU))


func _make_gardens() -> void:
	for p in [Vector3(-34, 0, 29), Vector3(-34, 0, -17), Vector3(-18, 0, -34), Vector3(18, 0, -37), Vector3(45, 0, -14), Vector3(49, 0, 26), Vector3(-15, 0, 52), Vector3(19, 0, 53)]:
		_pine(p, _rng.randf_range(1.05, 1.5))
		for i in range(5):
			var at: Vector3 = p + Vector3(_rng.randf_range(-4, 4), -0.12, _rng.randf_range(-3, 3))
			_add("rock", "stone", at, Vector3(_rng.randf_range(1.0, 2.8), _rng.randf_range(0.8, 3.2), _rng.randf_range(1.1, 2.6)), _rng.randf_range(0, TAU))
			_add("foliage", "shrub", at + Vector3(1, 0.15, 0.5), Vector3(2.1, 1.0, 2.0), _rng.randf_range(0, TAU))
	for i in range(40):
		var side := -1.0 if i % 2 == 0 else 1.0
		var x := side * _rng.randf_range(42.0, 59.0)
		var z := _rng.randf_range(-64.0, 52.0)
		_pine(Vector3(x, _terrain_height(x, z), z), _rng.randf_range(0.6, 1.15))
	# Low plants along the paving boundary leave combat and walking routes clear.
	for side in [-1.0, 1.0]:
		for i in range(17):
			var z := -10.0 + i * 3.0
			if side > 0 and z > 5 and z < 16:
				continue
			_add("foliage", "grass", Vector3(side * 27.5, 0.05, z), Vector3(_rng.randf_range(1.2, 2.6), 0.6, 2.0), _rng.randf_range(0, TAU))
	# A stepped cliff beneath the western terrace gives the courtyard a mountain edge.
	for i in range(21):
		var z := -42.0 + i * 5.0
		_add("rock", "mountain_near", Vector3(-40.0 + sin(i * 1.3) * 2, -7, z), Vector3(5.5, 9.0 + sin(i) * 2, 5.0), i * 0.37)


func _pine(p: Vector3, size: float) -> void:
	var yaw := _rng.randf_range(0, TAU)
	var lean := Vector3(cos(yaw), 0, sin(yaw)) * size
	var root := p
	var middle := p + Vector3(0, 3.8, 0) * size + lean * 0.55
	var crown := p + Vector3(0, 8.0, 0) * size + lean * 1.6
	_segment(root, middle, 0.30 * size, "bark")
	_segment(middle, crown, 0.18 * size, "bark")
	for tier in range(4):
		var height := (3.8 + tier * 1.3) * size
		var origin := p + Vector3(0, height, 0) + lean * (0.5 + tier * 0.3)
		var radius := (3.2 - tier * 0.48) * size
		for branch in range(3):
			var angle := yaw + branch * TAU / 3.0 + tier * 1.15
			var end := origin + Vector3(cos(angle) * radius, size * 0.35, sin(angle) * radius)
			_segment(origin, end, 0.095 * size, "bark")
			var green := "pine" if (branch + tier) % 3 else "pine_light"
			_add("foliage", green, end, Vector3(4.0 - tier * 0.4, 1.0, 2.5) * size, angle, Color(_rng.randf_range(0.87, 1.1), 1, 1))
			_add("foliage", green, end + Vector3(cos(angle + 0.9), 0.2, sin(angle + 0.9)) * size, Vector3(2.1, 0.8, 2.0) * size, -angle)


func _make_mountains() -> void:
	for band in range(3):
		var mat: String = ["mountain_near", "mountain_mid", "mountain_far"][band]
		for i in range(10):
			var x := -83.0 + i * 18.0 + _rng.randf_range(-4, 4)
			var z := -62.0 - band * 32.0 + _rng.randf_range(-9, 3)
			var height := _rng.randf_range(25, 44) + band * 10
			_add("mountain" + str((i + band) % 5), mat, Vector3(x, -3, z), Vector3(_rng.randf_range(10, 17), height, _rng.randf_range(10, 17)), _rng.randf_range(0, TAU))
	for i in range(7):
		var x := -55.0 - i * 2
		var z := -31.0 + i * 10
		_add("mountain" + str(i % 5), "mountain_near", Vector3(x, -4, z), Vector3(8, _rng.randf_range(13, 23), 9), i * 0.73)


func _rock_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings: Array[PackedVector3Array] = []
	var profiles := [Vector2(1.0, 0.0), Vector2(0.96, 0.16), Vector2(0.80, 0.46), Vector2(0.54, 0.77), Vector2(0.19, 1.0)]
	for ring in range(profiles.size()):
		var points := PackedVector3Array()
		for i in range(9):
			var angle := i * TAU / 9.0
			var radius: float = profiles[ring].x * (0.89 + sin(i * 14.3 + ring * 1.2) * 0.12)
			points.append(Vector3(cos(angle) * radius + ring * 0.035, profiles[ring].y + sin(i * 4.3) * 0.032 * ring, sin(angle) * radius))
		rings.append(points)
	for ring in range(rings.size() - 1):
		for i in range(9):
			var next := (i + 1) % 9
			for v in [rings[ring][i], rings[ring][next], rings[ring + 1][i], rings[ring][next], rings[ring + 1][next], rings[ring + 1][i]]:
				st.set_uv(Vector2(v.x, v.y))
				st.add_vertex(v)
	for i in range(9):
		for v in [rings[4][i], rings[4][(i + 1) % 9], Vector3(0.14, 1.015, 0.0)]:
			st.set_uv(Vector2(v.x, v.z))
			st.add_vertex(v)
	st.generate_normals()
	return st.commit()


func _mountain_mesh(variant: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings: Array[PackedVector3Array] = []
	var profiles := [Vector2(1.0, 0.0), Vector2(1.04, 0.08), Vector2(0.94, 0.14), Vector2(0.98, 0.22), Vector2(0.88, 0.28), Vector2(0.92, 0.37), Vector2(0.80, 0.43), Vector2(0.84, 0.52), Vector2(0.73, 0.58), Vector2(0.76, 0.68), Vector2(0.65, 0.74), Vector2(0.65, 0.83), Vector2(0.54, 0.90), Vector2(0.48, 0.96), Vector2(0.31, 1.005), Vector2(0.06, 1.025)]
	var offset := float(variant) * 2.713
	for level in range(profiles.size()):
		var ring := PackedVector3Array()
		for i in range(40):
			var angle := i * TAU / 40.0
			var folds := sin(angle * 5.0 + offset) * 0.07 + sin(angle * 9.0 - offset) * 0.045 + cos(angle * 17.0 + level * 0.43) * 0.015
			var shelf := profiles[level].x
			var radius := shelf * (1.0 + folds) + sin(angle * 3 + level * 0.53 + offset) * 0.025
			var height := profiles[level].y + sin(angle * 4.0 + offset) * 0.012 + cos(angle * 7.0 + offset) * 0.008
			var lean := Vector3(sin(offset), 0, cos(offset)) * height * 0.12
			ring.append(Vector3(cos(angle) * radius, height, sin(angle) * radius) + lean)
		rings.append(ring)
	for level in range(rings.size() - 1):
		for i in range(40):
			var next := (i + 1) % 40
			for v in [rings[level][i], rings[level][next], rings[level + 1][i], rings[level][next], rings[level + 1][next], rings[level + 1][i]]:
				st.set_uv(Vector2(v.x * 2.0, v.y * 3.0))
				st.add_vertex(v)
	for i in range(40):
		for v in [rings[15][i], rings[15][(i + 1) % 40], Vector3(sin(offset) * 0.123, 1.027, cos(offset) * 0.123)]:
			st.set_uv(Vector2(v.x, v.z))
			st.add_vertex(v)
	st.generate_normals()
	return st.commit()


func _roof_mesh() -> ArrayMesh:
	# Unit curved roof: ridge along X, eaves along Z. Width/depth are supplied per instance.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for side in [-1.0, 1.0]:
		for ix in range(16):
			for iz in range(7):
				var points: Array[Vector3] = []
				for offset in [Vector2(0, 0), Vector2(1, 0), Vector2(0, 1), Vector2(1, 1)]:
					var x: float = (ix + offset.x) / 16.0 - 0.5
					var t: float = (iz + offset.y) / 7.0
					var y: float = 1.0 - 0.94 * pow(t, 0.7) + 0.18 * pow(t, 7.0) + 0.15 * pow(absf(x) * 2, 6) * t
					points.append(Vector3(x, y, side * t * 0.5))
				var indices := [0, 1, 2, 1, 3, 2] if side > 0 else [0, 2, 1, 1, 2, 3]
				for index in indices:
					var v: Vector3 = points[index]
					st.set_uv(Vector2(v.x * 16.0, v.z * 14.0))
					st.add_vertex(v)
	st.generate_normals()
	var mesh := st.commit()
	return mesh
