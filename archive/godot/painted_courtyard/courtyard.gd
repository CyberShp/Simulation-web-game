extends Node2D

# ART-2D-01..07: the independent courtyard uses image pixels as its local space.
const ACTOR = preload("res://painted_courtyard/actor_2d.gd")
const DOMAIN = preload("res://painted_courtyard/mountain_domain.gd")
const CELL := 6.0
const CLEARANCE := 6.0
const WALK_SPEED := 112.0
const WORKER_SPEED := 72.0
var layout: Dictionary = {}
var canvas_size := Vector2(1536, 1024)
var walkable := PackedVector2Array()
var walkable_regions: Array[PackedVector2Array] = []
var blockers: Array[PackedVector2Array] = []
var painted_layers: Array[Dictionary] = []
var navigation := AStarGrid2D.new()
var camera: Camera2D
var hall: Node2D
var hall_sprite: Sprite2D
var hall_image: Image
var master: Node2D
var worker: Node2D
var route: Array[Vector2] = []
var worker_route: Array[Vector2] = []
var tour_queue: Array[Vector2] = []
var work_points: Array[Vector2] = []
var worker_index := 0
var worker_working := true
var worker_timer := 0.0
var door := Vector2.ZERO
var target := Vector2.ZERO
var target_visible := false
var focus := Vector2(805, 480)
var zoom_factor := 1.0
var portrait_view := false
var mode := "idle"
var selected := "master"
var indoor := false
var paused := false
var backgrounded := false
var suppress_next_delta := false
var dragging := false
var touch_zooming := false
var drag_distance := 0.0
var pointer_scale := 1.0
var last_pointer_position := Vector2.ZERO
var metrics_timer := 0.0
var trial_time := 0.0
var frame_samples: Array[float] = []
var message := "点选院地，让掌门沿石路行走"
var js_callback: JavaScriptObject
var native_label: Label
var domain: Node2D
var ground_painting: Sprite2D
var follow_master := false
var overview_mode := false
var game_mode := false
var game_poll := 0.0
var game_tick := 0
var game_hall_id := ""

func _ready() -> void:
	var file := FileAccess.open("res://painted_courtyard/assets/layout.json", FileAccess.READ)
	if file == null:
		push_error("Painted courtyard layout is missing")
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		push_error("Painted courtyard layout must be a JSON object")
		return
	layout = parsed
	canvas_size = _vector(layout.get("canvas_size", [1536, 1024]))
	walkable = _polygon(layout.get("walkable", [[90, 220], [1440, 220], [1440, 950], [90, 950]]))
	for shape in layout.get("walkable_regions", []):
		walkable_regions.append(_polygon(shape))
	if walkable_regions.is_empty():
		walkable_regions.append(walkable)
	for shape in layout.get("obstacles", []):
		blockers.append(_polygon(shape))
	var hall_data: Dictionary = layout.get("hall", {})
	blockers.append(_polygon(hall_data.get("footprint", [[530, 300], [1000, 300], [1000, 490], [530, 490]])))
	door = _vector(hall_data.get("door", [768, 530]))
	for point in layout.get("work_points", [[1110, 720], [1160, 760]]):
		work_points.append(_vector(point))
	domain = DOMAIN.new()
	domain.name = "MountainDomain"
	add_child(domain)
	_build_images(hall_data)
	_build_navigation()
	var sorted := Node2D.new()
	sorted.name = "DepthSorted"
	sorted.y_sort_enabled = true
	add_child(sorted)
	hall.reparent(sorted, false)
	for layer in painted_layers:
		if layer.node != hall:
			layer.node.reparent(sorted, false)
	master = ACTOR.new()
	master.name = "Master"
	master.visual_height = float(layout.get("actor_height", 88.0))
	sorted.add_child(master)
	master.setup(true)
	worker = ACTOR.new()
	worker.name = "Disciple"
	worker.visual_height = float(layout.get("actor_height", 88.0))
	sorted.add_child(worker)
	worker.setup(false)
	camera = Camera2D.new()
	camera.position_smoothing_enabled = false
	add_child(camera)
	camera.make_current()
	get_viewport().size_changed.connect(_update_camera)
	_reset()
	if OS.has_feature("web"):
		game_mode = bool(JavaScriptBridge.eval("window.__paintedGameMode === true", true))
		if game_mode:
			_update_camera()
			_sync_game_state(0.0)
		js_callback = JavaScriptBridge.create_callback(_on_browser_command)
		var window := JavaScriptBridge.get_interface("window")
		window.paintedCourtyardCommand = js_callback
		window.artTrialCommand = js_callback
		backgrounded = bool(JavaScriptBridge.eval("document.hidden", true))
		_sync_animation_pause()
	else:
		var layer := CanvasLayer.new()
		native_label = Label.new()
		native_label.position = Vector2(18, 18)
		native_label.add_theme_color_override("font_color", Color("f4eddc"))
		native_label.add_theme_color_override("font_shadow_color", Color("23392f"))
		native_label.add_theme_constant_override("shadow_offset_x", 1)
		native_label.add_theme_constant_override("shadow_offset_y", 1)
		layer.add_child(native_label)
		add_child(layer)
	_publish_state()
	print("PAINTED_COURTYARD_READY")

func _vector(value: Variant) -> Vector2:
	return Vector2(float(value[0]), float(value[1]))

func _polygon(values: Array) -> PackedVector2Array:
	var result := PackedVector2Array()
	for value in values:
		result.append(_vector(value))
	return result

func _build_images(hall_data: Dictionary) -> void:
	var ground := Sprite2D.new()
	ground_painting = ground
	ground.name = "GroundPainting"
	ground.texture = load("res://painted_courtyard/assets/" + str(layout.get("ground_texture", "ground.png")))
	ground.centered = false
	ground.scale = canvas_size / ground.texture.get_size()
	ground.z_index = -20
	ground.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(ground)
	hall = Node2D.new()
	hall.name = "MainHall"
	hall.position = _vector(hall_data.get("position", [768, 525]))
	add_child(hall)
	if layout.get("composition", "") == "fixed_painted_layers":
		# Each silhouette samples the same painting, preserving the authored scene.
		# Separate solid parts leave the mountain gate's opening genuinely clear.
		for definition in layout.get("painted_layers", []):
			var layer_node := hall if definition.id == "hall" else Node2D.new()
			if layer_node != hall:
				layer_node.name = str(definition.id)
				layer_node.position = Vector2(0, float(definition.depth))
				add_child(layer_node)
			var outlines: Array[PackedVector2Array] = []
			for points in definition.polygons:
				var outline := _polygon(points)
				outlines.append(outline)
				var patch := Polygon2D.new()
				var local_points := PackedVector2Array()
				for point in outline:
					local_points.append(point - layer_node.position)
				patch.polygon = local_points
				patch.uv = outline
				patch.texture = ground.texture
				patch.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
				layer_node.add_child(patch)
			painted_layers.append({"id": str(definition.id), "label": str(definition.label), "depth": float(definition.depth), "node": layer_node, "polygons": outlines})
		return
	hall_sprite = Sprite2D.new()
	hall_sprite.texture = load("res://painted_courtyard/assets/hall.png")
	hall_sprite.centered = false
	var anchor := _vector(hall_data.get("anchor", [0.5, 1.0]))
	hall_sprite.position = -_vector(hall_data.get("display_size", [640, 480])) * anchor
	hall_sprite.scale = _vector(hall_data.get("display_size", [640, 480])) / hall_sprite.texture.get_size()
	hall_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	hall_sprite.flip_h = bool(hall_data.get("flip_h", false))
	hall.add_child(hall_sprite)
	hall_image = hall_sprite.texture.get_image()
	if hall_image.is_compressed():
		hall_image.decompress()

func _is_walkable(point: Vector2) -> bool:
	return _local_walkable(point) or (domain != null and bool(domain.definition.get("external_trail_navigation", false)) and domain.contains(point, CLEARANCE))

func _local_walkable(point: Vector2) -> bool:
	for offset in [Vector2.ZERO, Vector2(CLEARANCE, 0), Vector2(-CLEARANCE, 0), Vector2(0, CLEARANCE), Vector2(0, -CLEARANCE)]:
		var sample: Vector2 = point + offset
		var on_ground := false
		for region in walkable_regions:
			if Geometry2D.is_point_in_polygon(sample, region):
				on_ground = true
				break
		if not on_ground:
			return false
		for shape in blockers:
			if shape.size() >= 3 and Geometry2D.is_point_in_polygon(sample, shape):
				return false
	return true

func _build_navigation() -> void:
	navigation.region = Rect2i(0, 0, ceili(canvas_size.x / CELL) + 1, ceili(canvas_size.y / CELL) + 1)
	navigation.cell_size = Vector2(CELL, CELL)
	navigation.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	navigation.update()
	for x in navigation.region.size.x:
		for y in navigation.region.size.y:
			navigation.set_point_solid(Vector2i(x, y), not _local_walkable(Vector2(x * CELL, y * CELL)))

func _grid(point: Vector2) -> Vector2i:
	return Vector2i(roundi(point.x / CELL), roundi(point.y / CELL))

func _free_grid(point: Vector2) -> Vector2i:
	var center := _grid(point)
	var best := Vector2i(-1, -1)
	var distance := INF
	for x in range(center.x - 2, center.x + 3):
		for y in range(center.y - 2, center.y + 3):
			var cell := Vector2i(x, y)
			var candidate := Vector2(cell) * CELL
			if navigation.is_in_boundsv(cell) and not navigation.is_point_solid(cell) and _clear_segment(point, candidate):
				var score := point.distance_squared_to(candidate)
				if score < distance:
					distance = score
					best = cell
	return best

func _clear_segment(a: Vector2, b: Vector2) -> bool:
	var samples := maxi(1, ceili(a.distance_to(b) / 5.0))
	for i in range(samples + 1):
		if not _is_walkable(a.lerp(b, float(i) / samples)):
			return false
	return true

func _path(from: Vector2, destination: Vector2) -> Array[Vector2]:
	var start_local := _local_walkable(from)
	var end_local := _local_walkable(destination)
	if start_local and end_local:
		return _local_path(from, destination)
	var planned: Array[Vector2] = []
	if not _is_walkable(from) or not _is_walkable(destination):
		return planned
	if start_local:
		planned = _local_path(from, domain.gateway)
		if planned.is_empty():
			return []
		planned.append_array(domain.path(domain.gateway, destination))
	elif end_local:
		planned = domain.path(from, domain.gateway)
		var remainder := _local_path(domain.gateway, destination)
		if planned.is_empty() or remainder.is_empty():
			return []
		planned.append_array(remainder)
	else:
		planned = domain.path(from, destination)
	return planned

func _local_path(from: Vector2, destination: Vector2) -> Array[Vector2]:
	var result: Array[Vector2] = []
	if not _is_walkable(from) or not _is_walkable(destination):
		return result
	if _clear_segment(from, destination):
		result.append(destination)
		return result
	var start := _free_grid(from)
	var goal := _free_grid(destination)
	if start.x < 0 or goal.x < 0:
		return result
	var raw := navigation.get_point_path(start, goal)
	if raw.is_empty():
		return result
	raw.append(destination)
	var cursor := from
	var index := 0
	while index < raw.size():
		var furthest := index
		for next in range(index + 1, raw.size()):
			if _clear_segment(cursor, raw[next]):
				furthest = next
			else:
				break
		if not _clear_segment(cursor, raw[furthest]):
			return []
		result.append(raw[furthest])
		cursor = raw[furthest]
		index = furthest + 1
	return result

func _walk_to(destination: Vector2, next_mode: String = "walk") -> bool:
	if not _movement_allowed():
		return false
	var start := door if indoor else master.position
	var planned := _path(start, destination)
	if planned.is_empty():
		message = "此处无法通行 · 请沿庭院、台阶和石桥行走"
		_publish_state()
		return false
	if indoor:
		indoor = false
		master.position = door
		master.visible = true
	route = planned
	mode = next_mode
	selected = "master"
	target = destination
	target_visible = true
	message = "掌门正在前往药田" if next_mode == "work" else "掌门正在沿山路行走"
	master.set_motion(true, false, 0.0)
	_publish_state()
	return true

func _move_actor(actor: Node2D, points: Array[Vector2], speed: float, delta: float) -> bool:
	var remaining: float = speed * delta * actor.visual_height / 68.0
	var travelled := 0.0
	var moved := false
	while not points.is_empty() and remaining > 0.0:
		var difference: Vector2 = points[0] - actor.position
		var distance := difference.length()
		if distance < 0.01:
			actor.position = points.pop_front()
			continue
		actor.set_facing(difference.normalized(), delta)
		var step := minf(remaining, distance)
		actor.position += difference / distance * step
		remaining -= step
		travelled += step
		moved = true
		if step >= distance:
			actor.position = points.pop_front()
	actor.set_travel_distance(travelled)
	return moved

func _arrived() -> void:
	target_visible = false
	match mode:
		"enter":
			indoor = true
			master.visible = false
			mode = "indoor"
			selected = "hall"
			message = "掌门已进入主殿 · 可出殿或选择院中目的地"
		"work":
			master.set_facing(Vector2(-1, 0.5), 1.0)
			message = "掌门正在照料药田"
		"tour":
			if not tour_queue.is_empty():
				_walk_to(tour_queue.pop_front(), "tour")
			else:
				mode = "idle"
				message = "已走过小院 · 可继续点选院地"
		_:
			mode = "idle"
			message = "掌门已到达"
	_publish_state()

func _process(raw_delta: float) -> void:
	if master == null or camera == null:
		return
	if raw_delta > 0.0 and raw_delta < 0.5 and not backgrounded:
		frame_samples.append(raw_delta * 1000.0)
		if frame_samples.size() > 300:
			frame_samples.pop_front()
	var delta := minf(raw_delta, 0.05)
	if suppress_next_delta:
		delta = 0.0
		suppress_next_delta = false
	if game_mode:
		game_poll += raw_delta
		if game_poll >= 0.08:
			game_poll = 0.0
			_sync_game_state(delta)
	elif not paused and not backgrounded:
		trial_time += delta
		var was_walking := not route.is_empty()
		var moving := _move_actor(master, route, WALK_SPEED, delta) if not indoor else false
		if was_walking and route.is_empty():
			_arrived()
		master.set_motion(moving or not route.is_empty(), mode == "work" and route.is_empty(), delta)
		if worker_route.is_empty():
			worker_timer += delta
			worker_working = true
			if worker_timer >= 4.8 and work_points.size() > 1:
				worker_timer = 0.0
				worker_index = (worker_index + 1) % work_points.size()
				worker_route = _path(worker.position, work_points[worker_index])
				worker_working = worker_route.is_empty()
		else:
			_move_actor(worker, worker_route, WORKER_SPEED, delta)
			worker_working = worker_route.is_empty()
			if worker_working:
				worker.set_facing(Vector2(-0.7, -0.3), 1.0)
		worker.set_motion(not worker_route.is_empty(), worker_working, delta)
	if follow_master and not overview_mode:
		focus = focus.lerp(master.position + Vector2(0, -100), 1.0 - exp(-raw_delta * 5.0))
		_update_camera()
	metrics_timer += minf(raw_delta, 0.1)
	if metrics_timer >= 0.2:
		metrics_timer = 0.0
		_publish_state()
	queue_redraw()

func _game_position(person: Dictionary) -> Vector2:
	# This preview aligns the formal hall and entrance with the wide painted courtyard.
	# The full 96 m scene needs further authored terrain before it can be shown here.
	return Vector2(float(person.get("x", 0.0)) * 25.6, float(person.get("y", 0.0)) * 9.25 + 134.0)

func _sync_game_state(delta: float) -> void:
	if not OS.has_feature("web"):
		return
	var raw: Variant = JavaScriptBridge.eval("window.xianfuGodot ? window.xianfuGodot.snapshot_json() : ''", true)
	if not raw is String or raw.is_empty():
		return
	var parsed: Variant = JSON.parse_string(raw)
	if not parsed is Dictionary:
		return
	var view: Dictionary = parsed
	game_tick = int(view.get("tick", 0))
	for building in view.get("buildings", []):
		if building.get("type", "") == "hall":
			game_hall_id = str(building.get("id", ""))
			break
	var found_master := false
	var found_worker := false
	var show_master := false
	var show_worker := false
	for person in view.get("people", []):
		var actor: Node2D = null
		if str(person.get("id", "")) == str(view.get("masterId", "")):
			actor = master
			found_master = true
		elif str(person.get("id", "")) == "person:lu-zhiwei":
			actor = worker
			found_worker = true
		if actor == null:
			continue
		var next_position := _game_position(person)
		var travelled := actor.position.distance_to(next_position)
		if travelled > 0.01 and travelled < 150.0:
			actor.set_facing(next_position - actor.position, delta)
			actor.set_travel_distance(travelled)
		actor.position = next_position
		var visible_here := not bool(person.get("indoor", false)) and Rect2(Vector2.ZERO, canvas_size).has_point(next_position)
		if actor == master:
			show_master = visible_here
		else:
			show_worker = visible_here
		actor.set_motion(bool(person.get("moving", false)), str(person.get("activity", "")) == "work", delta)
	master.visible = found_master and show_master
	worker.visible = found_worker and show_worker
	var next_paused: bool = bool(view.get("paused", false))
	if paused != next_paused:
		paused = next_paused
		_sync_animation_pause()
	message = str(view.get("message", ""))

func _draw() -> void:
	if master == null:
		return
	var ring_position: Vector2 = master.position if selected == "master" else worker.position
	if selected == "hall":
		ring_position = door
	elif selected != "master" and selected != "worker":
		return
	if not (selected == "master" and indoor):
		_draw_ring(ring_position, Vector2(24, 10) if selected != "hall" else Vector2(38, 15), Color("cfb976"))
	if target_visible:
		_draw_ring(target, Vector2(12, 5), Color(0.77, 0.90, 0.70, 0.85))

func _draw_ring(center: Vector2, radii: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for i in range(49):
		var angle := float(i) / 48.0 * TAU
		points.append(center + Vector2(cos(angle), sin(angle)) * radii)
	draw_polyline(points, color, 1.7, true)

func _update_camera() -> void:
	if camera == null:
		return
	if OS.has_feature("web"):
		pointer_scale = maxf(1.0, float(JavaScriptBridge.eval("window.devicePixelRatio || 1", true)))
	var viewport := get_viewport_rect().size
	portrait_view = viewport.x < viewport.y
	var cover := maxf(viewport.x / canvas_size.x, viewport.y / canvas_size.y) if game_mode and portrait_view and not overview_mode else minf(viewport.x / canvas_size.x, viewport.y / canvas_size.y)
	zoom_factor = clampf(zoom_factor, maxf(1.0, _minimum_zoom()) if game_mode and portrait_view and not overview_mode else _minimum_zoom(), _minimum_zoom() * 2.2 if overview_mode else 2.6)
	camera.zoom = Vector2.ONE * cover * zoom_factor
	var half := viewport / camera.zoom / 2.0
	var bounds: Rect2 = domain.world_rect if overview_mode else domain.detail_rect
	for axis in range(2):
		if half[axis] * 2.0 >= bounds.size[axis]:
			focus[axis] = bounds.get_center()[axis]
		else:
			focus[axis] = clampf(focus[axis], bounds.position[axis] + half[axis], bounds.end[axis] - half[axis])
	camera.position = focus
	camera.force_update_scroll()
	domain.set_view(overview_mode)
	ground_painting.visible = not overview_mode
	ground_painting.modulate.a = 1.0
	for layer in painted_layers:
		layer.node.visible = ground_painting.visible
		layer.node.modulate.a = ground_painting.modulate.a

func _minimum_zoom() -> float:
	var viewport := get_viewport_rect().size
	var cover := maxf(viewport.x / canvas_size.x, viewport.y / canvas_size.y) if game_mode and portrait_view and not overview_mode else minf(viewport.x / canvas_size.x, viewport.y / canvas_size.y)
	if overview_mode:
		return minf(viewport.x / domain.world_rect.size.x, viewport.y / domain.world_rect.size.y) / cover
	var size: Vector2 = domain.detail_rect.size
	return minf(viewport.x / size.x, viewport.y / size.y) / cover

func _home_focus() -> Vector2:
	if get_viewport_rect().size.x < get_viewport_rect().size.y:
		return _vector(layout.get("portrait_camera_focus", [900, 512]))
	return _vector(layout.get("camera_focus", [805, 480]))

func _zoom(multiplier: float, screen_anchor: Vector2 = Vector2(-1, -1)) -> void:
	var proposed := zoom_factor * multiplier
	if not overview_mode and multiplier < 1.0 and proposed < _minimum_zoom() * 0.98:
		_command("overview")
		return
	if overview_mode and multiplier > 1.0 and proposed > _minimum_zoom() * 2.2:
		overview_mode = false
		focus = _home_focus()
		zoom_factor = _minimum_zoom()
		_update_camera()
		message = "开山院与观瀑步道 · 继续放大可近观人物"
		_publish_state()
		return
	var anchored := screen_anchor.x >= 0
	var before := get_canvas_transform().affine_inverse() * screen_anchor
	follow_master = false
	zoom_factor = clampf(proposed, _minimum_zoom(), _minimum_zoom() * 2.2 if overview_mode else 2.6)
	_update_camera()
	if anchored:
		var after := get_canvas_transform().affine_inverse() * screen_anchor
		focus += before - after
		_update_camera()
	_publish_state()

func _unhandled_input(event: InputEvent) -> void:
	if camera == null:
		return
	if event is InputEventMouseButton:
		if touch_zooming:
			return
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			_zoom(1.1, event.position)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			_zoom(1.0 / 1.1, event.position)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				dragging = true
				drag_distance = 0.0
				last_pointer_position = event.position
			else:
				var was_dragging := dragging
				if was_dragging:
					drag_distance += event.position.distance_to(last_pointer_position)
				dragging = false
				if was_dragging and drag_distance < _drag_threshold():
					_click(event.position)
	elif event is InputEventMouseMotion and dragging:
		var pointer_delta: Vector2 = event.position - last_pointer_position
		last_pointer_position = event.position
		drag_distance += pointer_delta.length()
		if drag_distance >= _drag_threshold():
			follow_master = false
			focus -= pointer_delta / camera.zoom
			_update_camera()
	elif event is InputEventMagnifyGesture:
		_zoom(event.factor, event.position)
	elif event is InputEventPanGesture:
		follow_master = false
		focus += event.delta * 12.0 / camera.zoom
		_update_camera()
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_SPACE:
			_command("pause")
		elif event.keycode == KEY_R:
			_command("reset")

func _hall_hit(point: Vector2) -> bool:
	if hall_sprite == null:
		for layer in painted_layers:
			if layer.id == "hall" and _layer_hit(layer, point):
				return true
		return false
	var local := hall_sprite.to_local(point)
	var pixel := Vector2i(floori(local.x), floori(local.y))
	if pixel.x < 0 or pixel.y < 0 or pixel.x >= hall_image.get_width() or pixel.y >= hall_image.get_height():
		return false
	if hall_sprite.flip_h:
		pixel.x = hall_image.get_width() - 1 - pixel.x
	return hall_image.get_pixelv(pixel).a >= 0.12

func _drag_threshold() -> float:
	return 7.0 * pointer_scale

func _layer_hit(layer: Dictionary, point: Vector2) -> bool:
	for outline in layer.polygons:
		if Geometry2D.is_point_in_polygon(point, outline):
			return true
	return false

func _occluded(actor: Node2D, point: Vector2) -> bool:
	for layer in painted_layers:
		if float(layer.depth) > actor.position.y and _layer_hit(layer, point):
			return true
	return false

func _click(screen: Vector2) -> void:
	var point := get_canvas_transform().affine_inverse() * screen
	if overview_mode:
		message = "山域地形总览 · 点“近观小院”或“跟随掌门”回到可游历庭院"
		_publish_state()
		return
	var candidates: Array[Dictionary] = []
	if painted_layers.is_empty() and _hall_hit(point):
		candidates.append({"kind": "hall", "depth": hall.position.y, "order": hall.get_index()})
	for layer in painted_layers:
		if _layer_hit(layer, point):
			candidates.append({"kind": layer.id, "depth": layer.depth, "order": layer.node.get_index()})
	if master.visible and not indoor and master.hit_test(point) and not _occluded(master, point):
		candidates.append({"kind": "master", "depth": master.position.y, "order": master.get_index()})
	if worker.visible and worker.hit_test(point) and not _occluded(worker, point):
		candidates.append({"kind": "worker", "depth": worker.position.y, "order": worker.get_index()})
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if a.depth == b.depth:
			return a.order > b.order
		return a.depth > b.depth)
	if not candidates.is_empty():
		selected = candidates[0].kind
		if game_mode:
			if selected == "master":
				JavaScriptBridge.eval("window.paintedGameSelect('person','person:master')", true)
			elif selected == "worker":
				JavaScriptBridge.eval("window.paintedGameSelect('person','person:lu-zhiwei')", true)
			elif selected == "hall" and not game_hall_id.is_empty():
				JavaScriptBridge.eval("window.paintedGameSelect('building'," + JSON.stringify(game_hall_id) + ")", true)
			_publish_state()
			return
		var labels := {"master": "沈砚 · 掌门 · 点选院地行走", "worker": "陆知微 · 照料药田" if worker_working else "陆知微 · 沿药田行走", "hall": "主殿 · 青瓦木构，石阶入殿"}
		for layer in painted_layers:
			if not labels.has(layer.id):
				labels[layer.id] = layer.label
		message = str(labels.get(selected, "云岫山院"))
	else:
		if game_mode:
			if not Rect2(Vector2.ZERO, canvas_size).has_point(point):
				message = "当前庭院预览只覆盖画中的院地"
				JavaScriptBridge.eval("window.paintedGameNotice(" + JSON.stringify(message) + ")", true)
				_publish_state()
				return
			JavaScriptBridge.eval("window.paintedGameMove(" + str(point.x / 25.6) + "," + str((point.y - 134.0) / 9.25) + ")", true)
			_publish_state()
			return
		if _movement_allowed():
			tour_queue.clear()
			_walk_to(point)
	_publish_state()

func _movement_allowed() -> bool:
	if paused or backgrounded:
		message = "小院已暂停，请先点“继续”再行走"
		_publish_state()
		return false
	return true

func _sync_animation_pause() -> void:
	var active := not paused and not backgrounded
	master.set_process(active)
	worker.set_process(active)
	if active:
		suppress_next_delta = true

func _reset() -> void:
	route.clear()
	worker_route.clear()
	tour_queue.clear()
	master.position = _vector(layout.get("master_start", [760, 740]))
	worker.position = _vector(layout.get("worker_start", [1110, 720]))
	master.visible = true
	master.set_process(true)
	worker.set_process(true)
	master.setup(true)
	worker.setup(false)
	master.set_motion(false, false, 0.0)
	worker.set_motion(false, true, 0.0)
	master.set_facing(Vector2(0.4, 1), 1.0)
	worker.set_facing(Vector2(-0.7, -0.3), 1.0)
	worker_index = 0
	worker_timer = 0.0
	worker_working = true
	indoor = false
	paused = false
	mode = "idle"
	selected = "master"
	target_visible = false
	follow_master = false
	overview_mode = false
	trial_time = 0.0
	portrait_view = get_viewport_rect().size.x < get_viewport_rect().size.y
	focus = _home_focus()
	zoom_factor = 1.0
	message = "点选院地，让掌门沿石路行走"
	_update_camera()
	_sync_animation_pause()

func _command(command: String) -> void:
	if game_mode and command == "pause":
		JavaScriptBridge.eval("window.paintedGamePause()", true)
		return
	if game_mode and command in ["tour", "enter", "work", "explore", "return", "reset"]:
		return
	if command in ["tour", "enter", "work", "explore", "return"] and not _movement_allowed():
		return
	if command.begins_with("place:"):
		for place in domain.places:
			if command == "place:" + str(place.id):
				message = str(place.label) + " · " + str(place.description)
				_publish_state()
		return
	match command:
		"overview":
			follow_master = false
			overview_mode = true
			focus = domain.world_rect.get_center()
			zoom_factor = _minimum_zoom()
			_update_camera()
			message = "云岫山域 · 约六公里见方的地形规划，开山院与观瀑步道可近观游历"
		"home":
			follow_master = false
			overview_mode = false
			focus = _home_focus()
			zoom_factor = 1.0
			_update_camera()
			message = "开山旧院 · 主殿、古松、山门与灵泉"
		"follow":
			follow_master = true
			overview_mode = false
			focus = master.position + Vector2(0, -100)
			zoom_factor = 1.55
			_update_camera()
			message = "镜头跟随掌门 · 拖动可自由查看"
		"explore":
			tour_queue.clear()
			if _walk_to(domain.destination, "walk"):
				follow_master = true
				overview_mode = false
				zoom_factor = 1.55
				_update_camera()
				message = "掌门正在穿过前庭与石桥，前往观瀑台"
		"return":
			tour_queue.clear()
			if _walk_to(_vector(layout.master_start), "walk"):
				follow_master = true
				overview_mode = false
				zoom_factor = 1.55
				_update_camera()
				message = "掌门正在沿山路返回开山院"
		"tour":
			tour_queue.clear()
			for point in layout.get("tour_points", [[1060, 580], [1110, 780], [700, 850], [460, 600], [460, 270], [1060, 270], [1060, 580], [768, 670]]):
				tour_queue.append(_vector(point))
			if not tour_queue.is_empty():
				_walk_to(tour_queue.pop_front(), "tour")
		"enter":
			tour_queue.clear()
			if indoor:
				_walk_to(_vector(layout.get("exit_point", [door.x, door.y + 75])), "walk")
			else:
				_walk_to(door, "enter")
		"work":
			tour_queue.clear()
			_walk_to(_vector(layout.get("master_work_point", [work_points[0].x - 60, work_points[0].y + 28])), "work")
		"pause":
			paused = not paused
			message = "小院已暂停" if paused else "小院继续运行"
			_sync_animation_pause()
		"background":
			backgrounded = true
			dragging = false
			_sync_animation_pause()
		"gesture_start":
			touch_zooming = true
			dragging = false
		"gesture_end":
			touch_zooming = false
			dragging = false
		"foreground":
			backgrounded = false
			_sync_animation_pause()
		"zoom_in": _zoom(1.15)
		"zoom_out": _zoom(1.0 / 1.15)
		"reset": _reset()
	_publish_state()

func _on_browser_command(arguments: Array) -> void:
	if not arguments.is_empty():
		if str(arguments[0]) == "gesture_zoom" and arguments.size() >= 4:
			var normalized := Vector2(float(arguments[2]), float(arguments[3]))
			_zoom(clampf(float(arguments[1]), 0.5, 2.0), normalized * get_viewport_rect().size)
		else:
			_command(str(arguments[0]))

func _xy(point: Vector2) -> Array[float]:
	return [point.x, point.y]

func _screen(point: Vector2) -> Array[float]:
	return _xy(get_canvas_transform() * point)

func _publish_state() -> void:
	if master == null or camera == null:
		return
	var ordered := frame_samples.duplicate()
	ordered.sort()
	var p95: float = ordered[mini(ordered.size() - 1, floori(ordered.size() * 0.95))] if not ordered.is_empty() else 0.0
	var viewport := get_viewport_rect().size
	var height: float = float(layout.get("actor_height", 88.0))
	var positions := {"master": _xy(master.position), "worker": _xy(worker.position), "hall": _xy(hall.position), "door": _xy(door)}
	var projected := {"master": _screen(master.position - Vector2(0, height * 0.5)), "worker": _screen(worker.position - Vector2(0, height * 0.5)), "masterFeet": _screen(master.position), "workerFeet": _screen(worker.position), "hall": _screen(hall.position - Vector2(0, 150)), "door": _screen(door), "work": _screen(_vector(layout.get("master_work_point", [work_points[0].x - 60, work_points[0].y + 28])))}
	var state := {
		"ready": true, "scope": "painted-courtyard", "build": "mountain-domain-v2", "message": message,
		"mode": mode, "selected": selected, "paused": paused, "backgrounded": backgrounded,
		"indoor": indoor, "masterVisible": master.visible, "workerWorking": worker_working,
		"positions": positions, "projectedScreen": projected, "viewport": _xy(viewport),
		"master": positions.master, "worker": positions.worker,
		"masterScreen": projected.master, "workerScreen": projected.worker, "viewportSize": _xy(viewport),
		"target": _xy(target), "routePoints": route.size(), "workerRoutePoints": worker_route.size(),
		"zoom": zoom_factor, "cameraScale": camera.zoom.x, "cameraFocus": _xy(focus),
		"fps": Engine.get_frames_per_second(), "p95": snappedf(p95, 0.1), "frameP95Ms": snappedf(p95, 0.1),
		"sampleCount": frame_samples.size(), "seconds": trial_time,
		"drawCalls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	}
	state["landmarks"] = layout.get("landmarks", {})
	var places: Array[Dictionary] = []
	for place in domain.places:
		places.append({"id": place.id, "label": place.label, "screen": _screen(domain.place_position(place))})
	state["domain"] = {"overview": overview_mode, "planningExtentKm": [6, 6], "follow": follow_master, "gateway": _xy(domain.gateway), "destination": _xy(domain.destination), "trailLengthPixels": domain.trail_length, "places": places, "location": "开山院" if _local_walkable(master.position) else "松溪山路", "minimumZoom": _minimum_zoom()}
	state["actorHeight"] = height
	state["animations"] = {"master": master._displayed_animation, "masterFrame": master._displayed_index, "worker": worker._displayed_animation, "workerFrame": worker._displayed_index}
	state["bodyOccluded"] = {"master": _occluded(master, master.position - Vector2(0, height * 0.5)), "worker": _occluded(worker, worker.position - Vector2(0, height * 0.5))}
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.paintedCourtyardState=" + JSON.stringify(state) + ";window.artTrialState=window.paintedCourtyardState;window.dispatchEvent(new Event('painted-courtyard-state'));", true)
	elif native_label:
		native_label.text = "云岫山院 · 绘画小院\n" + message + "\n点选院地行走，拖动镜头，滚轮缩放，Space 暂停，R 复位"
