extends RefCounted

## Small, solid 3D pieces for the old estate. All building variants occupy the
## same persistent site; the game state chooses the visible variant.

const HALL_SCENE = preload("res://art/assets/hall.glb")
const EARTH := Color("#756d4f")
const GRASS := Color("#6e8054")
const MOSS := Color("#536344")
const STONE := Color("#666b5e")
const WOOD := Color("#604638")
const ROOF := Color("#425c5a")
const PAPER := Color("#c5b89a")

var _materials: Dictionary = {}
var _random := RandomNumberGenerator.new()

func _init() -> void:
	_random.seed = 104109

func material(color: Color, roughness: float = 0.88, metallic: float = 0.0) -> StandardMaterial3D:
	var key := "%s:%.2f:%.2f" % [color.to_html(), roughness, metallic]
	if _materials.has(key):
		return _materials[key]
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.roughness = roughness
	result.metallic = metallic
	_materials[key] = result
	return result

func box(parent: Node3D, name: String, position: Vector3, size: Vector3, color: Color, bevel: float = 0.0) -> MeshInstance3D:
	var piece := MeshInstance3D.new()
	piece.name = name
	var mesh := BoxMesh.new()
	mesh.size = size
	piece.mesh = mesh
	piece.position = position
	piece.material_override = material(color)
	parent.add_child(piece)
	if bevel > 0.0:
		# A second thin cap breaks the silhouette of plain rectangular walls.
		var cap := MeshInstance3D.new()
		cap.name = name + "Cap"
		var cap_mesh := BoxMesh.new()
		cap_mesh.size = Vector3(size.x + bevel, bevel, size.z + bevel)
		cap.mesh = cap_mesh
		cap.position = position + Vector3(0, size.y * 0.5 + bevel * 0.5, 0)
		cap.material_override = material(color.lightened(0.09))
		parent.add_child(cap)
	return piece

func cylinder(parent: Node3D, name: String, position: Vector3, radius: float, height: float, color: Color, sides: int = 10) -> MeshInstance3D:
	var piece := MeshInstance3D.new()
	piece.name = name
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius * 0.92
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = sides
	piece.mesh = mesh
	piece.position = position
	piece.material_override = material(color)
	parent.add_child(piece)
	return piece

func sphere(parent: Node3D, name: String, position: Vector3, scale: Vector3, color: Color) -> MeshInstance3D:
	var piece := MeshInstance3D.new()
	piece.name = name
	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 2.0
	mesh.radial_segments = 12
	mesh.rings = 7
	piece.mesh = mesh
	piece.position = position
	piece.scale = scale
	piece.material_override = material(color)
	parent.add_child(piece)
	return piece

func hit_box(parent: Node3D, kind: String, id: String, position: Vector3, size: Vector3) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = "Hit_" + id.replace(":", "_")
	body.set_meta("estate_kind", kind)
	body.set_meta("estate_id", id)
	body.position = position
	var shape := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = size
	shape.shape = box_shape
	body.add_child(shape)
	parent.add_child(body)
	return body

func _ground_color(x: float, z: float) -> Color:
	var grain := sin(x * 1.7 + z * 0.6) * 0.035 + cos(z * 2.2 - x * 0.8) * 0.027
	var path := absf(x - sin(z * 0.12) * 1.4) < (1.6 if z > -7 else 2.4)
	if path and z > -11 and z < 22:
		return EARTH.lightened(grain + 0.06)
	var edge := clampf((maxf(absf(x) - 17.0, absf(z) - 17.0)) / 12.0, 0.0, 1.0)
	return GRASS.lerp(MOSS, edge * 0.32).lightened(grain)

func make_ground(parent: Node3D) -> void:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for ix in range(-32, 32):
		for iz in range(-31, 31):
			var corners := [
				Vector3(ix, 0, iz), Vector3(ix + 1, 0, iz),
				Vector3(ix, 0, iz + 1), Vector3(ix + 1, 0, iz + 1)
			]
			for k in [0, 2, 1, 1, 2, 3]:
				var p: Vector3 = corners[k]
				tool.set_color(_ground_color(p.x, p.z))
				tool.add_vertex(p)
	tool.generate_normals()
	var terrain := MeshInstance3D.new()
	terrain.name = "OldEstateGround"
	terrain.mesh = tool.commit()
	var ground_mat := StandardMaterial3D.new()
	ground_mat.vertex_color_use_as_albedo = true
	ground_mat.albedo_color = Color("#71906d")
	ground_mat.roughness = 0.97
	ground_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	terrain.material_override = ground_mat
	parent.add_child(terrain)
	hit_box(parent, "ground", "", Vector3(0, -0.08, 0), Vector3(64, 0.15, 62))
	# The path is narrow, interrupted and visibly older than later ceremonial paving.
	for n in range(52):
		var z := -8.0 + n * 0.56
		var x := sin(z * 0.12) * 1.2 + _random.randf_range(-0.5, 0.5)
		if n % 5 == 0:
			continue
		var slab := box(parent, "OldPathStone", Vector3(x, 0.025, z), Vector3(_random.randf_range(0.55, 1.10), 0.05, 0.38), STONE.darkened(_random.randf_range(0.02, 0.18)))
		slab.rotation.y = _random.randf_range(-0.22, 0.22)
	for n in range(115):
		var x := _random.randf_range(-28.0, 28.0)
		var z := _random.randf_range(-26.0, 27.0)
		if absf(x) < 3.4 and z > -10 and z < 22:
			continue
		if (absf(x + 10.0) < 4.5 or absf(x - 11.5) < 4.5) and z > -8 and z < 16:
			continue
		var tuft := sphere(parent, "WildGrass", Vector3(x, 0.12, z), Vector3(0.19, _random.randf_range(0.12, 0.30), 0.16), GRASS.darkened(_random.randf_range(0.0, 0.22)))
		tuft.rotation.y = _random.randf_range(0.0, TAU)

func pine(parent: Node3D, at: Vector3, size: float, ancient: bool = false) -> void:
	var trunk := cylinder(parent, "OldPineTrunk", at + Vector3(0, size * 1.35, 0), size * (0.19 if ancient else 0.12), size * 2.7, WOOD.darkened(0.19), 12)
	trunk.rotation.z = 0.13 if ancient else _random.randf_range(-0.08, 0.08)
	for i in range(4 if ancient else 3):
		var shift := Vector3((i - 1.5) * size * 0.34, size * (2.5 + i * 0.20), (i % 2) * size * 0.19)
		sphere(parent, "PineNeedles", at + shift, Vector3(size * (1.12 if ancient else 0.77), size * 0.32, size * 0.70), Color("#304b3f").lightened(i * 0.047))
	if ancient:
		for i in range(8):
			var angle := i * TAU / 8
			sphere(parent, "PineRootStone", at + Vector3(cos(angle) * 1.2, 0.25, sin(angle) * 1.1), Vector3(0.55, 0.38, 0.50), STONE.darkened(0.17))

func shrub(parent: Node3D, at: Vector3, size: float, bloom: bool = false) -> void:
	var leaf := Color("#365b43") if bloom else Color("#38533f")
	for i in range(4):
		var angle := i * TAU / 4.0
		var crown := sphere(parent, "WildShrub", at + Vector3(cos(angle) * size * 0.34, size * 0.32, sin(angle) * size * 0.31), Vector3(size * 0.50, size * 0.39, size * 0.43), leaf.lightened(_random.randf_range(-0.09, 0.10)))
		crown.rotation.y = angle
	if bloom:
		for i in range(5):
			var angle := i * TAU / 5.0
			sphere(parent, "MountainBlossom", at + Vector3(cos(angle) * size * 0.36, size * 0.58, sin(angle) * size * 0.30), Vector3(size * 0.10, size * 0.12, size * 0.10), Color("#c9a795"))

func make_landmarks(parent: Node3D) -> void:
	# The old pine, mountain gate and spring remain identifiable as the estate grows.
	pine(parent, Vector3(-12.8, 0, -19.3), 2.55, true)
	# Tall trunks stand beyond the playable west/north boundary or in the
	# simulation's blocked eastern water. Paths never need a second collision map.
	for at in [Vector3(-25, 0, -22), Vector3(24, 0, -19), Vector3(-25, 0, 16), Vector3(24, 0, -20), Vector3(-21, 0, -14), Vector3(20, 0, -19), Vector3(-22, 0, 22), Vector3(23, 0, -9)]:
		pine(parent, at, _random.randf_range(1.9, 2.8))
	for i in range(24):
		var x := _random.randf_range(-29.0, -22.0) if i % 2 == 0 else _random.randf_range(-18.0, 25.0)
		var z := _random.randf_range(-24.0, 24.0) if i % 2 == 0 else _random.randf_range(-29.0, -20.0)
		var rock := sphere(parent, "MountainRock", Vector3(x, _random.randf_range(0.3, 0.8), z), Vector3(_random.randf_range(0.9, 2.2), _random.randf_range(0.8, 1.8), _random.randf_range(0.9, 1.9)), STONE.darkened(_random.randf_range(0.10, 0.31)))
		rock.rotation.y = _random.randf_range(0, TAU)
	for n in range(140):
		var x := _random.randf_range(-23.0, 23.0)
		var z := _random.randf_range(-22.0, 23.0)
		if absf(x) < 3.9 and z > -14.0 and z < 23.0:
			continue
		if x > -19.5 and x < -5.0 and z > -12.0 and z < 16.0:
			continue
		if x > 6.0 and x < 19.5 and z > -12.0 and z < 16.0:
			continue
		shrub(parent, Vector3(x, 0.03, z), _random.randf_range(0.25, 0.61), n % 11 == 0)
	for at in [Vector3(-8.2,0,-9.7),Vector3(-6.8,0,-10.1),Vector3(7.5,0,-9.4),Vector3(10.2,0,-8.7),Vector3(-3.9,0,-16),Vector3(4.1,0,-15.4),Vector3(-5.4,0,2.6),Vector3(5.7,0,2.2),Vector3(18.0,0,4.8),Vector3(20.5,0,-3.0)]:
		shrub(parent, at, 0.83, true)
	# An old estate keeps remnants of its former court, without looking repaired.
	for x in [-6.1, 6.1]:
		for z in [-12.4, -9.3]:
			box(parent, "BrokenCourtyardStone", Vector3(x, 0.10, z), Vector3(0.9, 0.18, 0.8), STONE.darkened(0.12)).rotation.y = _random.randf_range(-0.5, 0.5)
	# An old, modest gate. Its open arch remains passable.
	var gate := Node3D.new()
	gate.name = "OldMountainGate"
	gate.position = Vector3(2.8, 0, 22)
	parent.add_child(gate)
	for x in [-2.0, 2.0]:
		box(gate, "GatePost", Vector3(x, 1.45, 0), Vector3(0.42, 2.9, 0.42), WOOD)
		box(gate, "GateStoneFoot", Vector3(x, 0.25, 0), Vector3(0.80, 0.50, 0.72), STONE, 0.10)
		hit_box(gate, "landmark", "gate-post", Vector3(x, 1.5, 0), Vector3(0.80, 3.0, 0.80))
	box(gate, "GateBeam", Vector3(0, 2.9, 0), Vector3(4.8, 0.28, 0.54), WOOD.darkened(0.15))
	box(gate, "GateRoof", Vector3(0, 3.20, 0), Vector3(5.4, 0.35, 1.2), ROOF.darkened(0.19))
	# Spring water has a genuine surface and moving normals, rather than pixels on the ground.
	var spring := Node3D.new()
	spring.name = "LingSpring"
	spring.position = Vector3(23.2, 0, 0.8)
	parent.add_child(spring)
	var water := MeshInstance3D.new()
	water.name = "LivingWater"
	var disk := CylinderMesh.new()
	disk.top_radius = 2.0
	disk.bottom_radius = 2.0
	disk.height = 0.08
	disk.radial_segments = 32
	water.mesh = disk
	water.position.y = 0.035
	var water_shader := Shader.new()
	water_shader.code = "shader_type spatial;\nrender_mode cull_disabled;\nvoid fragment(){ float r=sin(UV.x*49.0+TIME*1.4)*cos(UV.y*44.0-TIME*1.1); ALBEDO=vec3(0.13,0.38,0.36)+r*0.045; ROUGHNESS=0.24; METALLIC=0.12; }\n"
	var water_mat := ShaderMaterial.new()
	water_mat.shader = water_shader
	water.material_override = water_mat
	spring.add_child(water)
	for i in range(17):
		var angle := i * TAU / 17
		var rock := sphere(spring, "SpringRim", Vector3(cos(angle) * 2.0, 0.24, sin(angle) * 1.8), Vector3(0.38, 0.30, 0.36), STONE.darkened(0.13))
		rock.rotation.y = angle
	# Broken boundary posts suggest a former estate without a fully restored wall.
	for x in [-22.0, -20.5]:
		for z in [-11.0, 5.0]:
			box(parent, "OldBoundaryPost", Vector3(x, 0.45, z), Vector3(0.55, 0.9, 0.55), STONE.darkened(0.12), 0.09)

func make_site(site: Dictionary, centre: Vector3) -> Node3D:
	var root := Node3D.new()
	root.name = str(site.id).replace(":", "_")
	root.position = centre
	var w: float = float(site.reserveWidth) * 0.7
	var d: float = float(site.reserveHeight) * 0.7
	for x in [-w * 0.5 + 0.3, w * 0.5 - 0.3]:
		for z in [-d * 0.5 + 0.3, d * 0.5 - 0.3]:
			sphere(root, "OldCornerStone", Vector3(x, 0.17, z), Vector3(0.34, 0.25, 0.29), STONE.darkened(0.21))
	# Scrub and old boundary stones identify future work without a finished pad.
	sphere(root, "FallowGround", Vector3(0, -0.045, 0), Vector3(w * 0.45, 0.10, d * 0.42), MOSS.darkened(0.12))
	for i in range(17):
		var x := _random.randf_range(-w * 0.35, w * 0.35)
		var z := _random.randf_range(-d * 0.32, d * 0.32)
		if i % 5 == 0:
			sphere(root, "BuriedStone", Vector3(x, 0.08, z), Vector3(0.24, 0.13, 0.20), STONE.darkened(0.20))
		else:
			shrub(root, Vector3(x, 0.025, z), _random.randf_range(0.15, 0.32))
	hit_box(root, "site", str(site.id), Vector3(0, 0.085, 0), Vector3(w, 0.16, d))
	return root

func _roof(parent: Node3D, width: float, depth: float, height: float, level: int) -> void:
	for side in [-1.0, 1.0]:
		var half := box(parent, "SlopedTileRoof", Vector3(side * width * 0.25, height, 0), Vector3(width * 0.53, 0.17, depth * 1.17), ROOF.lightened(0.035 * level))
		half.rotation.z = side * 0.31
		for j in range(1, 9):
			var ridge := box(parent, "RoofTileRow", Vector3(side * width * (0.04 + j * 0.047), height + (8 - j) * 0.035, 0), Vector3(0.045, 0.055, depth * 1.19), ROOF.darkened(0.07 if j % 2 else 0.01))
			ridge.rotation.z = side * 0.31
	box(parent, "RoofRidge", Vector3(0, height + width * 0.085, 0), Vector3(0.24, 0.21, depth * 1.26), Color("#8d9c89"))
	if level > 1:
		for z in [-depth * 0.55, depth * 0.55]:
			sphere(parent, "CarvedRidgeEnd", Vector3(0, height + width * 0.09, z), Vector3(0.19, 0.22, 0.18), Color("#b79a61"))

func _secondary_building(root: Node3D, building: Dictionary, width: float, depth: float) -> void:
	var level: int = int(building.get("level", 1))
	var height := 2.55 + (level - 1) * 0.22
	box(root, "StoneFoundation", Vector3(0, 0.17, 0), Vector3(width + 0.48, 0.34, depth + 0.50), STONE, 0.14)
	box(root, "ClosedPlasterWalls", Vector3(0, 1.39, 0), Vector3(width * 0.84, 2.13, depth * 0.78), PAPER)
	for x in [-width * 0.40, width * 0.40]:
		for z in [-depth * 0.38, depth * 0.38]:
			cylinder(root, "CedarPillar", Vector3(x, 1.45, z), 0.12, 2.5, WOOD)
	for x in [-width * 0.28, width * 0.28]:
		box(root, "LatticeWindow", Vector3(x, 1.56, depth * 0.397), Vector3(0.92, 1.15, 0.05), WOOD.darkened(0.18))
		for j in range(4):
			box(root, "WindowLattice", Vector3(x - 0.34 + j * 0.22, 1.56, depth * 0.44), Vector3(0.035, 1.16, 0.04), PAPER.darkened(0.18))
	box(root, "ClosedDoor", Vector3(0, 1.18, depth * 0.405), Vector3(0.82, 1.95, 0.08), WOOD.darkened(0.14))
	_roof(root, width, depth, height, level)
	if level > 1:
		for x in [-width * 0.49, width * 0.49]:
			box(root, "UpgradeStoneRail", Vector3(x, 0.55, depth * 0.48), Vector3(0.22, 0.7, 1.1), STONE.lightened(0.1))
	if level > 2:
		for x in [-width * 0.33, width * 0.33]:
			cylinder(root, "UpgradeLantern", Vector3(x, 1.83, depth * 0.56), 0.16, 0.43, Color("#d9b575"))

func _farm(root: Node3D, width: float, depth: float, level: int) -> void:
	box(root, "FieldSoil", Vector3(0, 0.08, 0), Vector3(width, 0.15, depth), Color("#4d4330"))
	for i in range(3 + level):
		var x := -width * 0.37 + i * width * 0.74 / (2 + level)
		box(root, "RaisedHerbBed", Vector3(x, 0.20, 0), Vector3(width / (4.5 + level), 0.19, depth * 0.78), EARTH.darkened(0.25))
		for j in range(4 + level):
			var z := -depth * 0.33 + j * depth * 0.66 / (3 + level)
			sphere(root, "LivingHerb", Vector3(x, 0.43, z), Vector3(0.18, 0.29, 0.17), Color("#467553").lightened((i + j) % 3 * 0.06))
	for x in [-width * 0.5, width * 0.5]:
		for z in [-depth * 0.5, depth * 0.5]:
			box(root, "FieldCornerPost", Vector3(x, 0.4, z), Vector3(0.13, 0.8, 0.13), WOOD)
	if level > 1:
		box(root, "IrrigationChannel", Vector3(0, 0.11, depth * 0.43), Vector3(width, 0.11, 0.29), Color("#477e79"))

func _lumber(root: Node3D, width: float, depth: float, level: int) -> void:
	box(root, "LumberWorkGround", Vector3(0, 0.07, 0), Vector3(width, 0.14, depth), EARTH.darkened(0.21))
	for i in range(3 + level * 2):
		var x := -width * 0.34 + (i % 3) * width * 0.30
		var z := -depth * 0.25 + floorf(i / 3.0) * 0.42
		var log := cylinder(root, "StackedCedar", Vector3(x, 0.36 + floorf(i / 6.0) * 0.2, z), 0.15, 2.1, WOOD.lightened(i % 2 * 0.07), 12)
		log.rotation.z = PI * 0.5
	for x in [-width * 0.27, width * 0.27]:
		box(root, "SawHorse", Vector3(x, 0.52, depth * 0.22), Vector3(0.13, 1.04, 1.05), WOOD)
	box(root, "WorkBench", Vector3(0, 1.01, depth * 0.22), Vector3(width * 0.7, 0.13, 0.8), WOOD.lightened(0.09))
	if level > 1:
		for x in [-width * 0.47, width * 0.47]:
			box(root, "ShelterPost", Vector3(x, 1.25, -depth * 0.37), Vector3(0.15, 2.5, 0.15), WOOD)
		box(root, "TimberShelter", Vector3(0, 2.55, -depth * 0.37), Vector3(width * 1.04, 0.21, depth * 0.45), ROOF)

func make_building(building: Dictionary, position: Vector3) -> Node3D:
	var root := Node3D.new()
	root.name = "Building_" + str(building.id)
	root.position = position
	var width: float = float(building.get("width", 6)) * 0.7
	var depth: float = float(building.get("height", 5)) * 0.7
	var stage: String = str(building.get("stage", "complete"))
	var kind: String = str(building.get("type", "house"))
	var level: int = int(building.get("level", 1))
	if stage in ["foundation", "structure", "finishing"]:
		box(root, "RealFoundation", Vector3(0, 0.13, 0), Vector3(width + 0.3, 0.26, depth + 0.3), STONE.darkened(0.14))
		if stage != "foundation":
			for x in [-width * 0.44, width * 0.44]:
				for z in [-depth * 0.43, depth * 0.43]:
					box(root, "ConstructionPost", Vector3(x, 1.30, z), Vector3(0.13, 2.60, 0.13), WOOD)
			for z in [-depth * 0.43, depth * 0.43]:
				box(root, "ConstructionBeam", Vector3(0, 2.60, z), Vector3(width * 0.94, 0.13, 0.14), WOOD.lightened(0.08))
		if stage == "finishing":
			_roof(root, width, depth, 2.64, 1)
	elif kind == "hall":
		var model := HALL_SCENE.instantiate() as Node3D
		model.name = "ClosedOldHouse"
		model.scale = Vector3.ONE * 0.65
		root.add_child(model)
		if stage == "damaged":
			for i in range(12):
				var x := -width * 0.45 + i * width * 0.08
				var z := depth * 0.35 + (i % 3) * 0.22
				var weather := box(root, "BrokenEave", Vector3(x, 2.79 + (i % 2) * 0.08, z), Vector3(0.32, 0.07, 0.49), Color("#303d3c"))
				weather.rotation.z = -0.15 if i % 2 else 0.13
			for i in range(9):
				sphere(root, "ClimbingMoss", Vector3(_random.randf_range(-width * 0.46, width * 0.46), 0.36, depth * 0.48), Vector3(0.22, 0.31, 0.16), MOSS.darkened(0.13))
			box(root, "BoardedDoor", Vector3(0, 1.37, depth * 0.48), Vector3(1.20, 0.22, 0.11), WOOD.darkened(0.28)).rotation.z = 0.10
			box(root, "LooseDoorBrace", Vector3(0.19, 1.39, depth * 0.51), Vector3(0.20, 1.86, 0.10), WOOD.darkened(0.31)).rotation.z = -0.26
			for x in [-width * 0.32, width * 0.32]:
				box(root, "BoardedWindow", Vector3(x, 1.52, depth * 0.50), Vector3(0.16, 1.36, 0.10), WOOD.darkened(0.27)).rotation.z = 0.64 if x < 0 else -0.56
				box(root, "LooseWindowBoard", Vector3(x, 1.42, depth * 0.52), Vector3(0.15, 1.24, 0.10), WOOD.darkened(0.34)).rotation.z = -0.72 if x < 0 else 0.71
			for i in range(24):
				var tile_x := _random.randf_range(-width * 0.62, width * 0.62)
				var tile_z := _random.randf_range(depth * 0.52, depth * 0.86)
				var fallen := box(root, "FallenRoofTile", Vector3(tile_x, 0.11, tile_z), Vector3(_random.randf_range(0.18, 0.38), 0.08, _random.randf_range(0.20, 0.44)), ROOF.darkened(_random.randf_range(0.10, 0.32)))
				fallen.rotation.y = _random.randf_range(-1.0, 1.0)
			for x in [-width * 0.48, width * 0.48]:
				for i in range(4):
					sphere(root, "WallClimbingIvy", Vector3(x, 0.37 + i * 0.35, depth * 0.32), Vector3(0.17, 0.25, 0.21), MOSS.darkened(0.13))
		elif level > 1:
			for x in [-width * 0.58, width * 0.58]:
				box(root, "RebuiltStoneLantern", Vector3(x, 0.89, depth * 0.65), Vector3(0.46, 1.78, 0.46), STONE.lightened(0.12), 0.12)
			if level > 2:
				box(root, "CeremonialPaving", Vector3(0, 0.045, depth * 0.91), Vector3(width * 1.3, 0.07, depth * 0.34), STONE.lightened(0.15))
	elif kind == "farm":
		_farm(root, width, depth, level)
	elif kind == "lumber":
		_lumber(root, width, depth, level)
	else:
		_secondary_building(root, building, width, depth)
	if stage == "upgrade":
		for x in [-width * 0.53, width * 0.53]:
			for z in [-depth * 0.53, depth * 0.53]:
				box(root, "UpgradeScaffold", Vector3(x, 1.35, z), Vector3(0.12, 2.7, 0.12), WOOD.lightened(0.13))
	var hit_width := maxf(width + 0.9, 8.0) if kind == "hall" else width + 0.4
	var hit_depth := maxf(depth + 0.9, 6.8) if kind == "hall" else depth + 0.4
	hit_box(root, "building", str(building.id), Vector3(0, 2.15, 0), Vector3(hit_width, 4.3, hit_depth))
	return root

func make_selection_ring(parent: Node3D) -> MeshInstance3D:
	var ring := MeshInstance3D.new()
	ring.name = "SelectionRing"
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.74
	mesh.outer_radius = 0.81
	mesh.rings = 32
	mesh.ring_segments = 7
	ring.mesh = mesh
	ring.material_override = material(Color("#67dbc0"), 0.27, 0.14)
	parent.add_child(ring)
	ring.visible = false
	return ring
