extends Node2D

const ACTOR = preload("res://painted_courtyard/actor_2d.gd")
const SHADOW = preload("res://estate_2d/shadow_layer.gd")
const PACKAGE_SCENE = preload("res://estate_2d/opening_inheritance_scene.gd")
const SITES_FILE = "res://estate_2d/estate-sites.json"
const SCENE_SIZE := Vector2(1536, 1024)
const TICKS_PER_SECOND := 10.0
const VISUAL_DELAY_TICKS := 1.0
const ART_ROOT := "res://estate_2d/assets/"
const BUILDING_ART := {
	"hall": {"shelter": "opening-shelter-v1.png", "foundation": "mountain-main-hall-foundation-v1.png", "structure": "mountain-main-hall-structure-v1.png", "finishing": "mountain-main-hall-finishing-v1.png", "complete": "mountain-main-hall-v1.png", "level2": "mountain-main-hall-v1.png", "width": 380.0},
	"house": {"complete": "residence-v1.png", "width": 265.0},
	"kitchen": {"complete": "kitchen-v1.png", "width": 265.0},
	"farm": {"foundation": "mountain-herb-terrace-foundation-v1.png", "structure": "mountain-herb-terrace-structure-v1.png", "finishing": "mountain-herb-terrace-finishing-v1.png", "complete": "mountain-herb-terrace-empty-v1.png", "growing": "mountain-herb-terrace-growing-v1.png", "ripe": "mountain-herb-terrace-ripe-v1.png", "width": 126.0},
	"lumber": {"complete": "lumber-v1.png", "width": 265.0},
}

var sites: Array[Dictionary] = []
var site_by_id: Dictionary = {}
var buildings: Dictionary = {}
var actors: Dictionary = {}
var actor_samples: Dictionary = {}
var state: Dictionary = {}
var snapshot_tick := -1
var render_tick := -1.0
var last_snapshot_json := ""
var qa_motion_enabled := false
var qa_motion_elapsed := 0.0
var qa_motion_distance := 0.0
var qa_frame_changes := 0
var qa_last_frame := -1
var qa_turn_rest_frames := 0
var qa_total_turns := 0
var qa_last_direction := Vector2.ZERO
var qa_current_hold := 0.0
var qa_max_hold := 0.0
var camera: Camera2D
var sorted: Node2D
var shadows: Node2D
var selection_overlay: Node2D
var selected_kind := ""
var selected_id := ""
var focus := Vector2(768, 385)
var zoom_factor := 1.06
var dragging := false
var drag_distance := 0.0
var pinching := false
var backgrounded := false
var scene_click_block_until := 0
var suppress_pointer_release := false
var js_callback: JavaScriptObject
var package_scene: CanvasLayer

func _ready() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(SITES_FILE))
	if not parsed is Dictionary:
		push_error("Painted estate sites could not be read.")
		return
	for item in parsed.get("sites", []):
		if item is Dictionary:
			sites.append(item)
			site_by_id[str(item.id)] = item
	var ground := Sprite2D.new()
	ground.name = "MountainCourtyardTerrain"
	ground.centered = false
	ground.texture = load(ART_ROOT + "mountain-courtyard-ground-v1.png")
	ground.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	ground.z_index = -100
	add_child(ground)
	shadows = SHADOW.new()
	shadows.name = "SeparateBuildingShadows"
	shadows.z_index = -30
	add_child(shadows)
	sorted = Node2D.new()
	sorted.name = "DepthSortedBuildingsAndPeople"
	sorted.y_sort_enabled = true
	add_child(sorted)
	_make_foreground(ground.texture)
	selection_overlay = Node2D.new()
	selection_overlay.name = "SelectionOverlay"
	selection_overlay.z_index = 10
	selection_overlay.draw.connect(_draw_selection)
	add_child(selection_overlay)
	camera = Camera2D.new()
	camera.name = "FixedObliquePaintedCamera"
	add_child(camera)
	camera.make_current()
	get_viewport().size_changed.connect(_update_camera)
	_update_camera()
	package_scene = PACKAGE_SCENE.new()
	package_scene.name = "OpeningInheritanceScene"
	add_child(package_scene)
	if OS.has_feature("web"):
		js_callback = JavaScriptBridge.create_callback(_on_browser_command)
		JavaScriptBridge.get_interface("window").estateSceneCommand = js_callback
		backgrounded = bool(JavaScriptBridge.eval("document.hidden", true))
		qa_motion_enabled = bool(JavaScriptBridge.eval("new URLSearchParams(location.search).has('acceptance')", true))
	_sync_state()
	print("MOUNTAIN_COURTYARD_READY")

func _to_screen(world_x: float, world_y: float) -> Vector2:
	return Vector2(768.0 + (world_x - 30.0) * 28.0, 180.0 + world_y * 10.5)

func _to_world(point: Vector2) -> Vector2:
	return Vector2(30.0 + (point.x - 768.0) / 28.0, (point.y - 180.0) / 10.5)

func _site_for(building: Dictionary) -> Dictionary:
	for site in sites:
		if str(site.type) == str(building.get("type", "")) and is_equal_approx(float(site.x), float(building.get("x", -100))) and is_equal_approx(float(site.y), float(building.get("y", -100))):
			return site
	return {}

func _site_anchor(site: Dictionary) -> Vector2:
	return _to_screen(float(site.x) + float(site.get("footprintWidth", site.reserveWidth)) * 0.5, float(site.y) + float(site.get("footprintHeight", site.reserveHeight)) * 0.5)

func _site_has_building(site: Dictionary) -> bool:
	for item in state.get("buildings", []):
		if not item is Dictionary:
			continue
		var building: Dictionary = item
		if str(building.get("type", "")) == str(site.type) and is_equal_approx(float(building.get("x", -100)), float(site.x)) and is_equal_approx(float(building.get("y", -100)), float(site.y)):
			return true
	return false

func _make_foreground(texture: Texture2D) -> void:
	# These painted silhouettes sample the same terrain pixels but sort in front of
	# a person standing behind them; editable buildings remain separate sprites.
	var outlines := [
		{"depth": 302.0, "points": [[0, 0], [359, 0], [352, 204], [187, 351], [0, 370]]},
		{"depth": 390.0, "points": [[1295, 0], [1535, 0], [1535, 530], [1409, 488], [1280, 295]]},
	]
	for definition in outlines:
		var layer := Node2D.new()
		layer.name = "ForegroundPaintedSilhouette"
		layer.position.y = float(definition.depth)
		sorted.add_child(layer)
		var patch := Polygon2D.new()
		var points := PackedVector2Array()
		var local := PackedVector2Array()
		for pair in definition.points:
			var point := Vector2(float(pair[0]), float(pair[1]))
			points.append(point)
			local.append(point - layer.position)
		patch.polygon = local
		patch.uv = points
		patch.texture = texture
		patch.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		layer.add_child(patch)

func _building_signature(building: Dictionary) -> String:
	return "%s:%s:%s:%s:%s" % [building.get("type", ""), building.get("stage", ""), building.get("level", 1), building.get("condition", 100), building.get("cropVisual", "")]

func _make_construction(node: Node2D, stage: String, width: float) -> void:
	var base := Polygon2D.new()
	base.polygon = PackedVector2Array([Vector2(-width * 0.46, -10), Vector2(width * 0.46, -10), Vector2(width * 0.48, 13), Vector2(-width * 0.48, 13)])
	base.color = Color("a8a28a")
	node.add_child(base)
	if stage == "foundation":
		return
	for x in [-0.34, -0.12, 0.12, 0.34]:
		var post := Line2D.new()
		post.width = 8.0
		post.default_color = Color("66503a")
		post.points = PackedVector2Array([Vector2(width * x, -10), Vector2(width * x, -115 if stage == "structure" else -145)])
		node.add_child(post)
	var beam := Line2D.new()
	beam.width = 9.0
	beam.default_color = Color("795f43")
	beam.points = PackedVector2Array([Vector2(-width * 0.37, -112 if stage == "structure" else -142), Vector2(width * 0.37, -112 if stage == "structure" else -142)])
	node.add_child(beam)

func _make_building(building: Dictionary, site: Dictionary) -> Dictionary:
	var kind := str(building.get("type", ""))
	var art: Dictionary = BUILDING_ART.get(kind, BUILDING_ART.house)
	var stage := str(building.get("stage", "complete"))
	var node := Node2D.new()
	node.name = "Building_" + str(building.get("id", "")).replace(":", "_")
	node.position = _to_screen(float(building.get("x", 0)) + float(building.get("width", 0)) * 0.5, float(building.get("y", 0)) + float(building.get("height", 0)))
	sorted.add_child(node)
	var sprite: Sprite2D = null
	var image: Image = null
	var level := int(building.get("level", 1))
	var width := (310.0 if kind == "hall" and stage == "shelter" else float(art.width)) * (1.0 + 0.06 * float(maxi(level - 1, 0)))
	var construction_stage := stage in ["foundation", "structure", "finishing"]
	var stage_art := str(art.get(stage, ""))
	var farm_stage_texture: Texture2D = null
	if kind == "farm" and construction_stage and not stage_art.is_empty() and ResourceLoader.exists(ART_ROOT + stage_art):
		farm_stage_texture = load(ART_ROOT + stage_art) as Texture2D
	var painted_construction := construction_stage and (kind == "hall" or farm_stage_texture != null)
	if stage in ["foundation", "structure"] and not painted_construction:
		_make_construction(node, stage, width)
	else:
		var file := str(art.get(stage, art.complete)) if painted_construction or stage in ["shelter", "damaged"] else str(art.get("level2", art.complete)) if kind == "hall" and level >= 2 and stage == "complete" else str(art.get(str(building.get("cropVisual", "empty")), art.complete)) if kind == "farm" and stage == "complete" else str(art.complete)
		if not ResourceLoader.exists(ART_ROOT + file):
			file = str(art.complete)
		var texture := farm_stage_texture if farm_stage_texture != null else load(ART_ROOT + file) as Texture2D
		if texture != null:
			sprite = Sprite2D.new()
			sprite.name = "ClosedBuildingPainting"
			sprite.texture = texture
			sprite.centered = false
			sprite.scale = Vector2.ONE * (width / texture.get_width())
			var stage_offset := {"shelter": 16.0, "foundation": 32.0, "structure": 13.0, "finishing": 7.0}
			sprite.position = Vector2(-width * 0.5, -float(texture.get_height()) * sprite.scale.y + float(stage_offset.get(stage, 0.0)))
			sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
			if stage in ["finishing", "upgrade"] and not painted_construction:
				sprite.modulate.a = 0.70
			node.add_child(sprite)
			image = texture.get_image()
			if image.is_compressed():
				image.decompress()
		if stage in ["finishing", "upgrade"] and not painted_construction:
			_make_construction(node, stage, width)
	return {"node": node, "sprite": sprite, "image": image, "width": width, "stage": stage, "signature": _building_signature(building), "id": str(building.get("id", "")), "site_id": str(site.get("id", ""))}

func _sync_buildings(view: Dictionary) -> void:
	var live: Dictionary = {}
	var footprints: Array[Dictionary] = []
	var changed := false
	for item in view.get("buildings", []):
		if not item is Dictionary:
			continue
		var building: Dictionary = item
		var id := str(building.get("id", ""))
		live[id] = true
		var signature := _building_signature(building)
		if not buildings.has(id) or str(buildings[id].signature) != signature:
			changed = true
			if buildings.has(id):
				buildings[id].node.queue_free()
			buildings[id] = _make_building(building, _site_for(building))
		var visual: Dictionary = buildings[id]
		footprints.append({"center": _to_screen(float(building.get("x", 0)) + float(building.get("width", 0)) * 0.5, float(building.get("y", 0)) + float(building.get("height", 0)) * 0.5), "width": visual.width, "length": 17.0 if visual.stage in ["foundation", "structure"] else 30.0})
	for id in buildings.keys():
		if not live.has(id):
			changed = true
			buildings[id].node.queue_free()
			buildings.erase(id)
	if changed:
		shadows.set_footprints(footprints)
		selection_overlay.queue_redraw()

func _new_actor(id: String, master: bool, position: Vector2) -> Node2D:
	var actor := ACTOR.new() as Node2D
	actor.name = "Person_" + id.replace(":", "_")
	actor.visual_height = 65.0
	actor.turn_speed = 36.0
	sorted.add_child(actor)
	actor.setup(master)
	actor.position = position
	return actor

func _sync_people(view: Dictionary) -> void:
	var tick := int(view.get("tick", 0))
	var stepped := tick != snapshot_tick
	var reset := snapshot_tick >= 0 and (tick < snapshot_tick or tick - snapshot_tick > 8)
	if render_tick < 0.0 or reset:
		render_tick = float(tick) - VISUAL_DELAY_TICKS
	var live: Dictionary = {}
	for item in view.get("people", []):
		if not item is Dictionary or bool(item.get("indoor", false)):
			continue
		var person: Dictionary = item
		var id := str(person.get("id", ""))
		# Current authored atlas covers these two persistent opening identities.
		if id != str(view.get("masterId", "person:master")) and id != "person:lu-zhiwei":
			continue
		live[id] = true
		var desired := _to_screen(float(person.get("x", 0)), float(person.get("y", 0)))
		if not actors.has(id):
			actors[id] = _new_actor(id, id == str(view.get("masterId", "person:master")), desired)
			actor_samples[id] = [{"tick": tick, "position": desired}]
		elif reset or actors[id].position.distance_to(desired) > 140.0:
			actors[id].position = desired
			actor_samples[id] = [{"tick": tick, "position": desired}]
		elif stepped:
			var samples: Array = actor_samples[id]
			samples.append({"tick": tick, "position": desired})
			while samples.size() > 2 and float(samples[1].tick) < render_tick - 1.0:
				samples.remove_at(0)
		actors[id].set_meta("activity", str(person.get("activity", "")))
		actors[id].set_meta("still_walking", bool(person.get("moving", false)))
	for id in actors.keys():
		if not live.has(id):
			actors[id].queue_free()
			actors.erase(id)
			actor_samples.erase(id)
	snapshot_tick = tick

func _actor_pose(samples: Array, still_walking: bool) -> Dictionary:
	var first: Dictionary = samples[0]
	if render_tick < float(first.tick):
		return {"position": first.position, "moving": false, "direction": Vector2.ZERO}
	for index in range(1, samples.size()):
		var before: Dictionary = samples[index - 1]
		var after: Dictionary = samples[index]
		if render_tick < float(after.tick):
			var direction: Vector2 = after.position - before.position
			var fraction := clampf((render_tick - float(before.tick)) / maxf(float(after.tick) - float(before.tick), 1.0), 0.0, 1.0)
			return {"position": before.position.lerp(after.position, fraction), "moving": direction.length() > 0.01, "direction": direction}
	var last: Dictionary = samples.back()
	var last_direction := Vector2.ZERO
	if samples.size() > 1:
		last_direction = last.position - samples[samples.size() - 2].position
	return {"position": last.position, "moving": still_walking and last_direction.length() > 0.01, "direction": last_direction}

func _sync_state() -> void:
	if not OS.has_feature("web"):
		return
	var raw: Variant = JavaScriptBridge.eval("window.xianfuGodot ? window.xianfuGodot.snapshot_json() : ''", true)
	if not raw is String or raw.is_empty():
		return
	if raw == last_snapshot_json:
		return
	var parsed: Variant = JSON.parse_string(raw)
	if not parsed is Dictionary:
		return
	last_snapshot_json = raw
	state = parsed
	_sync_buildings(state)
	_sync_people(state)
	var inheritance: Variant = state.get("openingInheritance", null)
	if inheritance is Dictionary and inheritance.get("status", "") == "pending":
		package_scene.show_choice(inheritance)
	else:
		package_scene.hide_choice()

func _process(delta: float) -> void:
	_sync_state()
	var paused := bool(state.get("paused", false)) or backgrounded
	if not paused and snapshot_tick >= 0:
		render_tick = minf(render_tick + minf(delta, 0.25) * TICKS_PER_SECOND, float(snapshot_tick))
	for id in actors.keys():
		var actor: Node2D = actors[id]
		var pose := _actor_pose(actor_samples[id], bool(actor.get_meta("still_walking", false)))
		if not paused:
			var world_distance: float = _to_world(actor.position).distance_to(_to_world(pose.position))
			actor.position = pose.position
			actor.set_travel_distance(world_distance * 28.0)
			if pose.moving:
				actor.set_facing(pose.direction, delta)
			actor.set_motion(pose.moving, str(actor.get_meta("activity", "")) == "work", delta)
			if qa_motion_enabled and id == str(state.get("masterId", "person:master")):
				qa_motion_distance += world_distance
				if pose.moving and world_distance < 0.0001:
					qa_current_hold += delta
					qa_max_hold = maxf(qa_max_hold, qa_current_hold)
				else:
					qa_current_hold = 0.0
				var frame_index := int(actor.get("_displayed_index"))
				if qa_last_frame >= 0 and frame_index != qa_last_frame:
					qa_frame_changes += 1
				qa_last_frame = frame_index
				if pose.moving and str(actor.get("_displayed_animation")) == "turn_rest":
					qa_turn_rest_frames += 1
				if pose.moving and pose.direction.length_squared() > 0.01:
					var direction: Vector2 = pose.direction.normalized()
					if qa_last_direction.length_squared() > 0.01 and qa_last_direction.dot(direction) < 0.92:
						qa_total_turns += 1
					qa_last_direction = direction
		actor.set_process(not paused)
	if qa_motion_enabled:
		qa_motion_elapsed += delta
		if qa_motion_elapsed >= 1.0:
			var stats := {"fps": Engine.get_frames_per_second(), "masterMetres": qa_motion_distance, "walkFrameChanges": qa_frame_changes, "turnRestDuringMove": qa_turn_rest_frames, "totalTurns": qa_total_turns, "maxMovingHoldMs": roundi(qa_max_hold * 1000.0)}
			JavaScriptBridge.eval("window.xianfuSceneStats = " + JSON.stringify(stats), true)
			qa_motion_elapsed = 0.0
			qa_motion_distance = 0.0
			qa_frame_changes = 0
			qa_turn_rest_frames = 0
			qa_max_hold = 0.0
	if selected_kind == "person" and actors.has(selected_id):
		selection_overlay.queue_redraw()

func _update_camera() -> void:
	if camera == null:
		return
	var viewport_size := get_viewport().get_visible_rect().size
	var min_zoom := maxf(viewport_size.x / SCENE_SIZE.x, viewport_size.y / SCENE_SIZE.y)
	zoom_factor = clampf(zoom_factor, min_zoom, 1.65)
	var half := viewport_size / (2.0 * zoom_factor)
	focus.x = clampf(focus.x, half.x, SCENE_SIZE.x - half.x)
	focus.y = clampf(focus.y, half.y, SCENE_SIZE.y - half.y)
	camera.position = focus
	camera.zoom = Vector2.ONE * zoom_factor

func _sprite_hit(visual: Dictionary, point: Vector2) -> bool:
	var sprite: Sprite2D = visual.sprite
	var image: Image = visual.image
	if sprite == null or image == null:
		return Rect2(visual.node.position - Vector2(visual.width * 0.5, 130), Vector2(visual.width, 150)).has_point(point)
	var pixel := Vector2i(sprite.to_local(point).floor())
	if not Rect2i(Vector2i.ZERO, image.get_size()).has_point(pixel):
		return false
	return image.get_pixelv(pixel).a > 0.12

func _click(point: Vector2) -> void:
	var candidates: Array[Dictionary] = []
	for id in actors.keys():
		var actor: Node2D = actors[id]
		if actor.hit_test(point):
			candidates.append({"kind": "person", "id": id, "depth": actor.position.y})
	for id in buildings.keys():
		var visual: Dictionary = buildings[id]
		if _sprite_hit(visual, point):
			candidates.append({"kind": "building", "id": id, "depth": visual.node.position.y})
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.depth > b.depth)
	if not candidates.is_empty():
		selected_kind = str(candidates[0].kind)
		selected_id = str(candidates[0].id)
		JavaScriptBridge.eval("window.estateGameSelect && window.estateGameSelect(" + JSON.stringify(selected_kind) + "," + JSON.stringify(selected_id) + ")", true)
		selection_overlay.queue_redraw()
		return
	for site in sites:
		var anchor := _site_anchor(site)
		if Rect2(anchor - Vector2(140, 76), Vector2(280, 152)).has_point(point):
			selected_kind = "site"
			selected_id = str(site.id)
			JavaScriptBridge.eval("window.estateGameSelect && window.estateGameSelect('site'," + JSON.stringify(selected_id) + ")", true)
			selection_overlay.queue_redraw()
			return
	var target := _to_world(point)
	if target.x >= 0.0 and target.x <= float(state.get("width", 96)) and target.y >= 0.0 and target.y <= float(state.get("height", 96)):
		JavaScriptBridge.eval("window.estateGameMove && window.estateGameMove(" + str(target.x) + "," + str(target.y) + ")", true)

func _draw_selection() -> void:
	var centre := Vector2.ZERO
	if selected_kind == "person" and actors.has(selected_id):
		centre = actors[selected_id].position
	elif selected_kind == "building" and buildings.has(selected_id):
		centre = buildings[selected_id].node.position
	elif selected_kind == "site" and site_by_id.has(selected_id):
		var site: Dictionary = site_by_id[selected_id]
		if selected_id == "site:herb-terrace" and not _site_has_building(site):
			var north_west := _to_screen(float(site.x), float(site.y))
			var south_east := _to_screen(float(site.x) + float(site.footprintWidth), float(site.y) + float(site.footprintHeight))
			var outline := Rect2(north_west, south_east - north_west)
			selection_overlay.draw_rect(outline, Color(0.37, 0.93, 0.75, 0.85), false, 3.0, true)
			var entrance := Vector2((north_west.x + south_east.x) * 0.5, south_east.y)
			selection_overlay.draw_line(entrance, entrance + Vector2(0, 18), Color(0.37, 0.93, 0.75, 0.85), 3.0, true)
			selection_overlay.draw_line(entrance + Vector2(0, 18), entrance + Vector2(-7, 10), Color(0.37, 0.93, 0.75, 0.85), 3.0, true)
			selection_overlay.draw_line(entrance + Vector2(0, 18), entrance + Vector2(7, 10), Color(0.37, 0.93, 0.75, 0.85), 3.0, true)
			return
		centre = _site_anchor(site)
	else:
		return
	for index in range(32):
		var a := TAU * float(index) / 32.0
		var b := TAU * float(index + 1) / 32.0
		selection_overlay.draw_line(centre + Vector2(cos(a) * 31, sin(a) * 13), centre + Vector2(cos(b) * 31, sin(b) * 13), Color(0.37, 0.93, 0.75, 0.85), 3.0, true)

func suppress_next_scene_click() -> void:
	scene_click_block_until = Time.get_ticks_msec() + 500
	suppress_pointer_release = true
	dragging = false

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed and suppress_pointer_release:
		suppress_pointer_release = false
		dragging = false
		return
	if package_scene.active or Time.get_ticks_msec() < scene_click_block_until:
		dragging = false
		return
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			zoom_factor = clampf(zoom_factor * 1.10, 0.66, 1.65)
			_update_camera()
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			zoom_factor = clampf(zoom_factor / 1.10, 0.66, 1.65)
			_update_camera()
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				dragging = true
				drag_distance = 0.0
			else:
				dragging = false
				if not pinching and drag_distance < 8.0:
					_click(get_global_mouse_position())
	elif event is InputEventMouseMotion and dragging:
		drag_distance += event.relative.length()
		if drag_distance >= 8.0:
			focus -= event.relative / zoom_factor
			focus.x = clampf(focus.x, 430, 1120)
			focus.y = clampf(focus.y, 290, 750)
			_update_camera()

func _on_browser_command(arguments: Array) -> void:
	if arguments.is_empty():
		return
	match str(arguments[0]):
		"zoom_in":
			zoom_factor = clampf(zoom_factor * 1.18, 0.66, 1.65)
			_update_camera()
		"zoom_out":
			zoom_factor = clampf(zoom_factor / 1.18, 0.66, 1.65)
			_update_camera()
		"gesture_zoom":
			if arguments.size() > 1:
				zoom_factor = clampf(zoom_factor * float(arguments[1]), 0.66, 1.65)
				_update_camera()
		"gesture_start":
			pinching = true
		"gesture_end":
			pinching = false
		"follow":
			var id := str(state.get("masterId", "person:master"))
			if actors.has(id):
				focus = actors[id].position
				_update_camera()
		"focus_site":
			if arguments.size() > 1 and site_by_id.has(str(arguments[1])):
				selected_kind = "site"
				selected_id = str(arguments[1])
				focus = _site_anchor(site_by_id[selected_id])
				_update_camera()
				selection_overlay.queue_redraw()
		"focus_person":
			if arguments.size() > 1 and actors.has(str(arguments[1])):
				selected_kind = "person"
				selected_id = str(arguments[1])
				focus = actors[selected_id].position
				_update_camera()
				selection_overlay.queue_redraw()
		"background":
			backgrounded = true
		"foreground":
			backgrounded = false
