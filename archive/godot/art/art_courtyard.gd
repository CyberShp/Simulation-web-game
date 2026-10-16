extends Node3D

const ACTOR = preload("res://art/actor_3d.gd")
const HALL_POSITION := Vector3(0, 0, -5)
const MASTER_START := Vector3(-0.8, 0.07, 5.5)
const WORKER_START := Vector3(4.85, 0.0, 8.1)
var camera: Camera3D
var master: Node3D
var worker: Node3D
var master_hit: StaticBody3D
var sun: DirectionalLight3D
var target_ring: MeshInstance3D
var selected_ring: MeshInstance3D
var navigation := AStarGrid2D.new()
var route: Array[Vector3] = []
var focus := Vector3(0, 1.7, 1.8)
var zoom := 20.0
var mode := "idle"
var selected := "master"
var indoor := false
var paused := false
var backgrounded := false
var dragging := false
var drag_distance := 0.0
var press_position := Vector2.ZERO
var trial_time := 0.0
var worker_timer := 0.0
var worker_goal := WORKER_START
var worker_working := true
var metrics_timer := 0.0
var frame_samples: Array[float] = []
var message := "点击石路，让掌门走进小院"
var js_callback: JavaScriptObject
var native_label: Label
var water: MeshInstance3D
var animation_players: Array[AnimationPlayer] = []

func _ready() -> void:
	_build_light()
	var landscape: Node3D = load("res://art/assets/landscape.glb").instantiate()
	add_child(landscape)
	_add_landscape_hits(landscape)
	var hall: Node3D = load("res://art/assets/hall.glb").instantiate()
	hall.position = HALL_POSITION
	add_child(hall)
	_add_mesh_hits(hall, "hall")
	_make_water()
	var ground := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(31, 0.1, 34)
	shape.shape = box
	ground.position = Vector3(0, -0.13, 2)
	ground.set_meta("art_kind", "ground")
	ground.add_child(shape)
	add_child(ground)
	master = ACTOR.new()
	master.name = "Master"
	add_child(master)
	master.setup(true)
	master.position = MASTER_START
	master_hit = _add_person_hit(master, "master")
	worker = ACTOR.new()
	worker.name = "Disciple"
	add_child(worker)
	worker.setup(false)
	worker.position = WORKER_START
	_add_person_hit(worker, "worker")
	worker.set_facing(Vector3.RIGHT, 1.0)
	for actor in [master, worker]:
		for player in actor.find_children("*", "AnimationPlayer", true, false):
			animation_players.append(player)
	selected_ring = _ring(Color(0.87, 0.72, 0.37, 0.85), 0.48)
	target_ring = _ring(Color(0.66, 0.80, 0.66, 0.65), 0.27)
	target_ring.visible = false
	_build_navigation()
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.near = 0.1
	camera.far = 180.0
	add_child(camera)
	camera.current = true
	get_viewport().size_changed.connect(_update_camera)
	_update_camera()
	if OS.has_feature("web"):
		js_callback = JavaScriptBridge.create_callback(_on_browser_command)
		JavaScriptBridge.get_interface("window").artTrialCommand = js_callback
	else:
		var layer := CanvasLayer.new()
		native_label = Label.new()
		native_label.position = Vector2(20, 16)
		native_label.add_theme_color_override("font_color", Color("f2ead6"))
		native_label.add_theme_color_override("font_shadow_color", Color("213c33"))
		native_label.add_theme_constant_override("shadow_offset_x", 1)
		native_label.add_theme_constant_override("shadow_offset_y", 1)
		layer.add_child(native_label)
		add_child(layer)
	_publish_state()
	print("ART_TRIAL_READY")

func _build_light() -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("b8c9c6")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("cad8dc")
	environment.ambient_light_energy = 0.28
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	environment.fog_enabled = true
	environment.fog_light_color = Color("bbcfc9")
	environment.fog_density = 0.004
	var world := WorldEnvironment.new()
	world.environment = environment
	add_child(world)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-53, -32, 0)
	sun.light_color = Color("fff0cc")
	sun.light_energy = 0.72
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 70.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.shadow_bias = 0.14
	sun.shadow_normal_bias = 1.0
	add_child(sun)

func _make_water() -> void:
	water = MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(5.0, 37.0)
	water.mesh = plane
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	water.position = Vector3(-11.7, -0.46, 2)
	var shader := Shader.new()
	shader.code = """shader_type spatial;
render_mode cull_disabled;
uniform float water_time = 0.0;
void fragment(){
 float wave=sin(UV.y*160.0+water_time*0.65+sin(UV.x*36.0))*sin(UV.x*70.0-water_time*0.4);
 float lines=pow(max(0.0,wave),14.0);
 ALBEDO=mix(vec3(0.12,0.34,0.30),vec3(0.34,0.56,0.48),UV.x)+lines*0.12;
 ROUGHNESS=0.36;
 METALLIC=0.08;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	water.material_override = material
	add_child(water)

func _add_mesh_hits(node: Node, kind: String) -> void:
	if node is MeshInstance3D and node.mesh:
		var body := StaticBody3D.new()
		body.set_meta("art_kind", kind)
		var collision := CollisionShape3D.new()
		collision.shape = node.mesh.create_trimesh_shape()
		body.add_child(collision)
		node.add_child(body)
	for child in node.get_children():
		if child is not StaticBody3D:
			_add_mesh_hits(child, kind)

func _add_landscape_hits(node: Node) -> void:
	if node is MeshInstance3D:
		var ground_surface: bool = str(node.name).begins_with("TerrainSurface") or str(node.name).begins_with("CourtyardPaving")
		if ground_surface:
			node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_add_mesh_hits(node, "ground" if ground_surface else "scenery")
		return
	for child in node.get_children():
		_add_landscape_hits(child)

func _add_person_hit(actor: Node3D, kind: String) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.set_meta("art_kind", kind)
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.33
	capsule.height = 1.82
	collision.shape = capsule
	collision.position.y = 0.90
	body.add_child(collision)
	actor.add_child(body)
	return body

func _ring(color: Color, radius: float) -> MeshInstance3D:
	var ring := MeshInstance3D.new()
	var mesh := TorusMesh.new()
	mesh.inner_radius = radius - 0.018
	mesh.outer_radius = radius + 0.018
	mesh.rings = 32
	mesh.ring_segments = 6
	ring.mesh = mesh
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = material
	add_child(ring)
	return ring

func _build_navigation() -> void:
	navigation.region = Rect2i(-22, -22, 45, 60)
	navigation.cell_size = Vector2(0.4, 0.4)
	navigation.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	navigation.update()
	for x in range(-22, 23):
		for z in range(-22, 38):
			var p := Vector2(x * 0.4, z * 0.4)
			var solid := absf(p.x) < 5.3 and p.y < -1.5
			if p.x > 5.25 and p.y > 4.45 and p.y < 9.55:
				solid = true
			for rock in [Vector2(-7.8, 2.3), Vector2(-8.1, 7.8), Vector2(7.8, -6.5), Vector2(-8, -5.3)]:
				if p.distance_to(rock) < 1.1:
					solid = true
			if absf(p.x) < 1.6 and p.y > -2.4:
				solid = false
			navigation.set_point_solid(Vector2i(x, z), solid)

func _grid_point(p: Vector3) -> Vector2i:
	return Vector2i(roundi(p.x / 0.4), roundi(p.z / 0.4))

func _floor_height(p: Vector3) -> float:
	if absf(p.x) < 1.9 and p.z < 0.5:
		return 0.78 * clampf((0.5 - p.z) / 2.1, 0.0, 1.0) + 0.025
	if absf(p.x) < 6.4 and p.z > -1.5 and p.z < 5.0:
		return 0.07
	if absf(p.x) < 3.6 and p.z >= 5.0:
		return 0.07
	return 0.0

func _walk_to(destination: Vector3, next_mode: String = "walk") -> void:
	if indoor:
		_exit_hall(destination, next_mode)
		return
	var dest := _grid_point(destination)
	var start := _grid_point(master.position)
	if not navigation.is_in_boundsv(dest) or navigation.is_point_solid(dest):
		message = "那里是建筑或种植区，请选择可通行的石路"
		_publish_state()
		return
	var points := navigation.get_point_path(start, dest)
	if points.is_empty():
		message = "这条路暂时无法到达"
		return
	route.clear()
	for p in points:
		var waypoint := Vector3(p.x, 0, p.y)
		waypoint.y = _floor_height(waypoint)
		route.append(waypoint)
	if not route.is_empty() and master.position.distance_to(route[0]) < 0.30:
		route.pop_front()
	mode = next_mode
	selected = "master"
	target_ring.position = Vector3(destination.x, _floor_height(destination) + 0.05, destination.z)
	target_ring.visible = true
	message = "掌门正在沿石路行走"
	_publish_state()

func _enter_hall() -> void:
	if indoor:
		_exit_hall(Vector3(0, 0, 3.0))
		return
	_walk_to(Vector3(0, 0, 0.8), "enter")
	if mode == "enter":
		route.append(Vector3(0, 0.43, -0.55))
		route.append(Vector3(0, 0.805, -1.65))
		route.append(Vector3(0, 0.805, -2.58))
		message = "掌门前往主殿"

func _exit_hall(destination: Vector3, next_mode: String = "walk") -> void:
	indoor = false
	master.visible = true
	route = [Vector3(0, 0.805, -1.65), Vector3(0, 0.43, -0.55), Vector3(0, 0.07, 0.8), Vector3(0, 0.07, 3.0)]
	mode = next_mode
	var endpoint := _grid_point(destination)
	if navigation.is_in_boundsv(endpoint) and not navigation.is_point_solid(endpoint):
		for p in navigation.get_point_path(_grid_point(Vector3(0, 0, 3)), endpoint):
			var waypoint := Vector3(p.x, 0, p.y)
			waypoint.y = _floor_height(waypoint)
			route.append(waypoint)
	message = "掌门走出主殿"
	target_ring.position = Vector3(destination.x, _floor_height(destination) + 0.05, destination.z)
	target_ring.visible = true

func _tour() -> void:
	if indoor:
		_exit_hall(Vector3(-3.2, 0, 3.2), "tour")
	else:
		_walk_to(Vector3(-3.2, 0, 3.2), "tour")
	for p in [Vector3(-3.2, 0, 8.8), Vector3(2.4, 0, 8.8), Vector3(2.4, 0, 2.0), MASTER_START]:
		p.y = _floor_height(p)
		route.append(p)
	message = "观察行走、转身和衣袍动作"

func _process(delta: float) -> void:
	if camera == null:
		return
	frame_samples.append(delta * 1000.0)
	if frame_samples.size() > 600:
		frame_samples.pop_front()
	var active := not paused and not backgrounded
	var moving := false
	if active:
		trial_time += delta
		water.material_override.set_shader_parameter("water_time", trial_time)
		if not route.is_empty():
			var difference: Vector3 = route[0] - master.position
			var horizontal := Vector3(difference.x, 0, difference.z)
			moving = horizontal.length() > 0.015
			if moving:
				master.set_facing(horizontal.normalized(), delta)
				master.position = master.position.move_toward(route[0], 1.5 * delta)
			if master.position.distance_to(route[0]) < 0.025:
				master.position = route.pop_front()
				if route.is_empty():
					target_ring.visible = false
					if mode == "enter":
						indoor = true
						master.visible = false
						message = "掌门在主殿内 · 点击出殿返回庭院"
					elif mode == "work":
						master.set_facing(Vector3.BACK, 1.0)
						message = "掌门正在照料药田"
					else:
						mode = "idle"
						message = "点击人物或主殿查看，点击地面行走"
		worker_timer += delta
		if worker_timer > 9.0 and worker_working:
			worker_working = false
			worker_goal = Vector3(4.85, 0, 5.4 if worker.position.z > 7 else 8.1)
			if selected == "worker":
				message = "陆知微 · 沿药田行走"
		if not worker_working:
			var direction := worker_goal - worker.position
			worker.set_facing(direction.normalized(), delta)
			worker.position = worker.position.move_toward(worker_goal, 0.85 * delta)
			if worker.position.distance_to(worker_goal) < 0.025:
				worker_working = true
				worker_timer = 0
				worker.set_facing(Vector3.RIGHT, 1.0)
				if selected == "worker":
					message = "陆知微 · 正在照料药田"
	if active:
		master.set_motion(moving, mode == "work" and route.is_empty(), delta)
		worker.set_motion(not worker_working, worker_working, delta)
	for player in animation_players:
		var rate := 1.0 if master.is_ancestor_of(player) or worker_working else 0.57
		player.speed_scale = rate if active else 0.0
		player.process_mode = Node.PROCESS_MODE_INHERIT if active else Node.PROCESS_MODE_DISABLED
	selected_ring.visible = selected in ["master", "worker"] and not (selected == "master" and indoor)
	selected_ring.position = (master.position if selected == "master" else worker.position) + Vector3(0, 0.03, 0)
	metrics_timer += delta
	if metrics_timer > 0.35:
		metrics_timer = 0
		_publish_state()

func _update_camera() -> void:
	var viewport_size := get_viewport().get_visible_rect().size
	var aspect := viewport_size.x / maxf(viewport_size.y, 1.0)
	camera.size = zoom * maxf(1.0, 1.6 / aspect)
	camera.position = focus + Vector3(16, 17, 27)
	camera.look_at(focus)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			zoom = clampf(zoom * 0.91, 11.0, 34.0)
			_update_camera()
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			zoom = clampf(zoom * 1.1, 11.0, 34.0)
			_update_camera()
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				press_position = event.position
				drag_distance = 0
				dragging = true
			else:
				dragging = false
				if drag_distance < 7:
					_click(event.position)
	elif event is InputEventMouseMotion and dragging:
		drag_distance += event.relative.length()
		if drag_distance > 7:
			var scale := camera.size / get_viewport().get_visible_rect().size.y
			var right := camera.global_basis.x
			var forward := Vector3(camera.global_basis.z.x, 0, camera.global_basis.z.z).normalized()
			focus -= right * event.relative.x * scale
			focus -= forward * event.relative.y * scale * 1.45
			focus.x = clampf(focus.x, -6.0, 6.0)
			focus.z = clampf(focus.z, -4.0, 9.0)
			_update_camera()
	elif event is InputEventKey and event.pressed:
		if event.keycode == KEY_SPACE:
			_command("pause")
		elif event.keycode == KEY_R:
			_command("reset")

func _click(screen: Vector2) -> void:
	var origin := camera.project_ray_origin(screen)
	var query := PhysicsRayQueryParameters3D.create(origin, origin + camera.project_ray_normal(screen) * 150)
	if indoor:
		query.exclude = [master_hit.get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return
	var kind: String = hit.collider.get_meta("art_kind", "ground")
	if kind in ["master", "worker", "hall"]:
		selected = kind
		message = {"master":"沈砚 · 可点击石路行走", "worker":"陆知微 · 正在照料药田", "hall":"主殿 · 木石台基与青瓦屋顶"}[kind]
		if kind == "worker" and not worker_working:
			message = "陆知微 · 沿药田行走"
	elif kind == "ground":
		_walk_to(hit.position)
	else:
		message = "山石和林木 · 请点选可通行的院地"
	_publish_state()

func _command(command: String) -> void:
	match command:
		"tour": _tour()
		"enter": _enter_hall()
		"work":
			_walk_to(Vector3(6.4, 0, 4.0), "work")
		"pause":
			paused = not paused
			message = "小院已暂停" if paused else "小院继续运行"
		"zoom_in":
			zoom = clampf(zoom * 0.85, 11.0, 34.0)
			_update_camera()
		"zoom_out":
			zoom = clampf(zoom / 0.85, 11.0, 34.0)
			_update_camera()
		"background": backgrounded = true
		"foreground": backgrounded = false
		"reset":
			route.clear()
			master.position = MASTER_START
			master.visible = true
			master.rotation = Vector3.ZERO
			worker.position = WORKER_START
			worker_timer = 0
			worker_working = true
			worker.set_facing(Vector3.RIGHT, 1)
			indoor = false
			paused = false
			mode = "idle"
			selected = "master"
			focus = Vector3(0, 1.7, 1.8)
			zoom = 20
			target_ring.visible = false
			_update_camera()
			message = "点击石路，让掌门走进小院"
	_publish_state()

func _on_browser_command(arguments: Array) -> void:
	if not arguments.is_empty():
		_command(str(arguments[0]))

func _publish_state() -> void:
	var ordered := frame_samples.duplicate()
	ordered.sort()
	var p95: float = ordered[int(ordered.size() * 0.95)] if not ordered.is_empty() else 0.0
	var master_screen := camera.unproject_position(master.position + Vector3(0, 0.9, 0)) if camera else Vector2.ZERO
	var worker_screen := camera.unproject_position(worker.position + Vector3(0, 0.9, 0)) if camera else Vector2.ZERO
	var state := {
		"ready":true, "scope":"art-trial", "message":message,
		"selected":selected, "paused":paused, "indoor":indoor, "mode":mode,
		"master":[master.position.x, master.position.y, master.position.z],
		"worker":[worker.position.x, worker.position.y, worker.position.z],
		"masterScreen":[master_screen.x,master_screen.y],"workerScreen":[worker_screen.x,worker_screen.y],
		"viewportSize":[get_viewport().get_visible_rect().size.x,get_viewport().get_visible_rect().size.y],
		"workerWorking":worker_working, "routePoints":route.size(), "zoom":zoom,
		"fps":Engine.get_frames_per_second(), "frameP95Ms":snappedf(p95,0.1),
		"drawCalls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
		"sampleCount":frame_samples.size(), "seconds":trial_time
	}
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.artTrialState = " + JSON.stringify(state) + "; window.dispatchEvent(new Event('art-trial-state'));", true)
	elif native_label:
		native_label.text = "云岫山院 · 美术实机小院\n" + message + "\n左键行走/拖动镜头，滚轮缩放，Space 暂停，R 复位"
