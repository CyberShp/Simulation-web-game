extends Node3D

const ART = preload("res://estate_3d/estate_art.gd")
const ACTOR = preload("res://art/actor_3d.gd")
const SITES_FILE = "res://estate_3d/estate-sites.json"

var art
var layout: Dictionary = {}
var sites: Array[Dictionary] = []
var site_nodes: Dictionary = {}
var built_nodes: Dictionary = {}
var actor_nodes: Dictionary = {}
var actor_from: Dictionary = {}
var actor_to: Dictionary = {}
var actor_elapsed: Dictionary = {}
var scene_root: Node3D
var dynamic_root: Node3D
var camera: Camera3D
var selection_ring: MeshInstance3D
var selected_kind := ""
var selected_id := ""
var focus := Vector3(2.0, 0, -7.5)
var zoom := 19.5
var dragging := false
var drag_distance := 0.0
var press_position := Vector2.ZERO
var snapshot_interval := 0.0
var snapshot_tick := -1
var game_state: Dictionary = {}
var js_callback: JavaScriptObject

func _ready() -> void:
	var text := FileAccess.get_file_as_string(SITES_FILE)
	var parsed: Variant = JSON.parse_string(text)
	if not parsed is Dictionary:
		push_error("Old estate site layout could not be read.")
		return
	layout = parsed
	for item in layout.get("sites", []):
		if item is Dictionary:
			sites.append(item)
	art = ART.new()
	scene_root = Node3D.new()
	scene_root.name = "OldEstateTerrain"
	add_child(scene_root)
	art.make_ground(scene_root)
	art.make_landmarks(scene_root)
	dynamic_root = Node3D.new()
	dynamic_root.name = "PersistedEstate"
	add_child(dynamic_root)
	for site in sites:
		var centre := _to_scene(float(site.x) + float(site.reserveWidth) * 0.5, float(site.y) + float(site.reserveHeight) * 0.5)
		var marker: Node3D = art.make_site(site, centre)
		dynamic_root.add_child(marker)
		site_nodes[str(site.id)] = marker
	selection_ring = art.make_selection_ring(self)
	_make_lighting()
	_make_camera()
	if OS.has_feature("web"):
		js_callback = JavaScriptBridge.create_callback(_on_browser_command)
		JavaScriptBridge.get_interface("window").estateSceneCommand = js_callback
	_sync_game_state()
	print("ESTATE_3D_READY")

func _make_lighting() -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#9fb8b5")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#b1b9ad")
	environment.ambient_light_energy = 0.22
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.fog_enabled = true
	environment.fog_light_color = Color("#9fb9ae")
	environment.fog_density = 0.0008
	var world := WorldEnvironment.new()
	world.environment = environment
	add_child(world)
	var sunlight := DirectionalLight3D.new()
	sunlight.rotation_degrees = Vector3(-49, -35, 0)
	sunlight.light_color = Color("#fff0d5")
	sunlight.light_energy = 0.68
	sunlight.shadow_enabled = true
	sunlight.directional_shadow_max_distance = 80
	add_child(sunlight)

func _make_camera() -> void:
	camera = Camera3D.new()
	camera.name = "FixedObliqueCamera"
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.near = 0.1
	camera.far = 220.0
	camera.current = true
	add_child(camera)
	get_viewport().size_changed.connect(_update_camera)
	_update_camera()

func _update_camera() -> void:
	if camera == null:
		return
	camera.size = zoom
	camera.position = focus + Vector3(19, 23, 28)
	camera.look_at(focus)

func _to_scene(world_x: float, world_y: float) -> Vector3:
	var anchor: Dictionary = layout.get("worldAnchor", {})
	var offset: Dictionary = layout.get("sceneOffset", {})
	var scale: float = float(layout.get("metresToScene", 0.7))
	return Vector3(
		(world_x - float(anchor.get("x", 28))) * scale + float(offset.get("x", 0)),
		0,
		(world_y - float(anchor.get("y", 8))) * scale + float(offset.get("z", -13))
	)

func _to_world(point: Vector3) -> Vector2:
	var anchor: Dictionary = layout.get("worldAnchor", {})
	var offset: Dictionary = layout.get("sceneOffset", {})
	var scale: float = float(layout.get("metresToScene", 0.7))
	return Vector2(
		(point.x - float(offset.get("x", 0))) / scale + float(anchor.get("x", 28)),
		(point.z - float(offset.get("z", -13))) / scale + float(anchor.get("y", 8))
	)

func _site_for(building: Dictionary) -> String:
	for site in sites:
		if str(site.get("type", "")) == str(building.get("type", "")) and is_equal_approx(float(site.x), float(building.get("x", -100))) and is_equal_approx(float(site.y), float(building.get("y", -100))):
			return str(site.id)
	return ""

func _building_signature(building: Dictionary) -> String:
	return "%s:%s:%s:%s:%s:%s:%s" % [
		building.get("type", ""), building.get("x", 0), building.get("y", 0),
		building.get("width", 0), building.get("height", 0),
		building.get("level", 1), building.get("stage", "complete")
	]

func _sync_buildings(view: Dictionary) -> void:
	var live_ids: Dictionary = {}
	var occupied_sites: Dictionary = {}
	for item in view.get("buildings", []):
		if not item is Dictionary:
			continue
		var building: Dictionary = item
		var id := str(building.get("id", ""))
		live_ids[id] = true
		var site_id := _site_for(building)
		if not site_id.is_empty():
			occupied_sites[site_id] = true
		var signature := _building_signature(building)
		if built_nodes.has(id) and built_nodes[id].signature == signature:
			continue
		if built_nodes.has(id):
			built_nodes[id].node.queue_free()
		var centre := _to_scene(float(building.get("x", 0)) + float(building.get("width", 0)) * 0.5, float(building.get("y", 0)) + float(building.get("height", 0)) * 0.5)
		var model: Node3D = art.make_building(building, centre)
		dynamic_root.add_child(model)
		built_nodes[id] = {"signature": signature, "node": model}
	for id in built_nodes.keys():
		if not live_ids.has(id):
			built_nodes[id].node.queue_free()
			built_nodes.erase(id)
	for site in sites:
		var id := str(site.id)
		site_nodes[id].visible = not occupied_sites.has(id)

func _new_actor(id: String, is_master: bool) -> Node3D:
	var actor := ACTOR.new() as Node3D
	actor.name = "Person_" + id.replace(":", "_")
	dynamic_root.add_child(actor)
	actor.setup(is_master)
	actor.scale = Vector3.ONE * 0.70
	var body: StaticBody3D = art.hit_box(actor, "person", id, Vector3(0, 0.9, 0), Vector3(0.72, 1.9, 0.72))
	body.scale = Vector3.ONE / 0.70
	return actor

func _sync_people(view: Dictionary) -> void:
	var visible_ids: Dictionary = {}
	var new_tick: int = int(view.get("tick", 0))
	var stepped := new_tick != snapshot_tick
	for item in view.get("people", []):
		if not item is Dictionary:
			continue
		var person: Dictionary = item
		var id := str(person.get("id", ""))
		if bool(person.get("indoor", false)):
			continue
		visible_ids[id] = true
		var desired := _to_scene(float(person.get("x", 0)), float(person.get("y", 0)))
		desired.y = 0.035
		if not actor_nodes.has(id):
			var created := _new_actor(id, id == str(view.get("masterId", "person:master")))
			actor_nodes[id] = created
			created.position = desired
			actor_from[id] = desired
			actor_to[id] = desired
			actor_elapsed[id] = 0.10
		elif stepped and (actor_to[id] as Vector3).distance_to(desired) > 0.001:
			var actor: Node3D = actor_nodes[id]
			if actor.position.distance_to(desired) > 4.0:
				actor.position = desired
			actor_from[id] = actor.position
			actor_to[id] = desired
			actor_elapsed[id] = 0.0
		actor_nodes[id].set_meta("activity", str(person.get("activity", "")))
	for id in actor_nodes.keys():
		if not visible_ids.has(id):
			actor_nodes[id].queue_free()
			actor_nodes.erase(id)
			actor_from.erase(id)
			actor_to.erase(id)
			actor_elapsed.erase(id)
	snapshot_tick = new_tick

func _sync_game_state() -> void:
	if not OS.has_feature("web"):
		return
	var raw: Variant = JavaScriptBridge.eval("window.xianfuGodot ? window.xianfuGodot.snapshot_json() : ''", true)
	if not raw is String or raw.is_empty():
		return
	var parsed: Variant = JSON.parse_string(raw)
	if not parsed is Dictionary:
		return
	game_state = parsed
	_sync_buildings(game_state)
	_sync_people(game_state)
	if selected_kind == "building" and not built_nodes.has(selected_id):
		selected_kind = ""
		selected_id = ""
	_update_selection()

func _process(delta: float) -> void:
	snapshot_interval += delta
	if snapshot_interval >= 0.06:
		snapshot_interval = 0.0
		_sync_game_state()
	var paused: bool = bool(game_state.get("paused", false))
	for id in actor_nodes.keys():
		var actor: Node3D = actor_nodes[id]
		var from: Vector3 = actor_from.get(id, actor.position)
		var to: Vector3 = actor_to.get(id, actor.position)
		if not paused:
			actor_elapsed[id] = minf(0.10, float(actor_elapsed.get(id, 0.10)) + delta)
		var fraction: float = clampf(float(actor_elapsed[id]) / 0.10, 0.0, 1.0)
		var next := from.lerp(to, fraction)
		var motion := next - actor.position
		if motion.length() > 0.002:
			actor.set_facing(motion, delta)
		actor.position = next
		var working := str(actor.get_meta("activity", "")) == "work"
		actor.set_motion(not paused and motion.length() > 0.002, working and not paused, delta)
		for player in actor.find_children("*", "AnimationPlayer", true, false):
			player.speed_scale = 0.0 if paused else 1.0
	_update_selection()

func _update_selection() -> void:
	if selection_ring == null:
		return
	selection_ring.visible = false
	if selected_kind == "person" and actor_nodes.has(selected_id):
		selection_ring.position = actor_nodes[selected_id].position + Vector3(0, 0.05, 0)
		selection_ring.visible = true
	elif selected_kind == "building" and built_nodes.has(selected_id):
		selection_ring.position = built_nodes[selected_id].node.position + Vector3(0, 0.06, 0)
		selection_ring.visible = true
	elif selected_kind == "site" and site_nodes.has(selected_id):
		selection_ring.position = site_nodes[selected_id].position + Vector3(0, 0.08, 0)
		selection_ring.visible = true

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			zoom = clampf(zoom * 0.91, 16.5, 52.0)
			_update_camera()
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			zoom = clampf(zoom * 1.10, 16.5, 52.0)
			_update_camera()
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				press_position = event.position
				drag_distance = 0.0
				dragging = true
			else:
				dragging = false
				if drag_distance < 8.0:
					_click(event.position)
	elif event is InputEventMouseMotion and dragging:
		drag_distance += event.relative.length()
		if drag_distance >= 8.0:
			var scale := camera.size / maxf(get_viewport().get_visible_rect().size.y, 1.0)
			focus -= camera.global_basis.x * event.relative.x * scale
			var forward := Vector3(camera.global_basis.z.x, 0, camera.global_basis.z.z).normalized()
			focus -= forward * event.relative.y * scale * 1.35
			focus.x = clampf(focus.x, -14.0, 14.0)
			focus.z = clampf(focus.z, -14.0, 18.0)
			_update_camera()

func _click(screen: Vector2) -> void:
	if camera == null:
		return
	var origin := camera.project_ray_origin(screen)
	var ray := PhysicsRayQueryParameters3D.create(origin, origin + camera.project_ray_normal(screen) * 200.0)
	var hit := get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty():
		return
	var collider: Object = hit.collider
	var kind := str(collider.get_meta("estate_kind", "ground"))
	var id := str(collider.get_meta("estate_id", ""))
	if kind == "landmark":
		return
	if kind in ["person", "building", "site"]:
		selected_kind = kind
		selected_id = id
		if kind == "site":
			JavaScriptBridge.eval("window.estateGameSelect && window.estateGameSelect('site'," + JSON.stringify(id) + ")", true)
		else:
			JavaScriptBridge.eval("window.estateGameSelect && window.estateGameSelect(" + JSON.stringify(kind) + "," + JSON.stringify(id) + ")", true)
	else:
		var point := _to_world(hit.position)
		if point.x >= 0 and point.x <= float(game_state.get("width", 96)) and point.y >= 0 and point.y <= float(game_state.get("height", 96)):
			JavaScriptBridge.eval("window.estateGameMove && window.estateGameMove(" + str(point.x) + "," + str(point.y) + ")", true)
	_update_selection()

func _on_browser_command(arguments: Array) -> void:
	if arguments.is_empty():
		return
	match str(arguments[0]):
		"zoom_in":
			zoom = clampf(zoom * 0.85, 16.5, 52.0)
			_update_camera()
		"zoom_out":
			zoom = clampf(zoom / 0.85, 16.5, 52.0)
			_update_camera()
		"follow":
			var master_id := str(game_state.get("masterId", "person:master"))
			if actor_nodes.has(master_id):
				focus = actor_nodes[master_id].position + Vector3(0, 0, 1.5)
				focus.x = clampf(focus.x, -14.0, 14.0)
				focus.z = clampf(focus.z, -14.0, 18.0)
				_update_camera()
		"focus_site":
			if arguments.size() > 1:
				for site in sites:
					if str(site.id) == str(arguments[1]):
						focus = _to_scene(float(site.x) + float(site.reserveWidth) * 0.5, float(site.y) + float(site.reserveHeight) * 0.5)
						var size := get_viewport().get_visible_rect().size
						if size.x / maxf(size.y, 1.0) < 0.9:
							focus.z += 6.0
						focus.x = clampf(focus.x, -14.0, 14.0)
						focus.z = clampf(focus.z, -14.0, 18.0)
						_update_camera()
						break
		"gesture_zoom":
			if arguments.size() > 1:
				zoom = clampf(zoom / maxf(0.4, float(arguments[1])), 16.5, 52.0)
				_update_camera()
