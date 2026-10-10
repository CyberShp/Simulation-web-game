class_name Courtyard
extends Node2D

## SR-XF-003/004/007: retained Godot scene nodes projected from the single world.
signal ground_clicked(world_position: Vector2)
signal entity_selected(kind: String, id: String)

const ActorScript = preload("res://scripts/estate_actor.gd")
const BuildingScript = preload("res://scripts/estate_building.gd")
const PIXELS_PER_METRE := 32.0
const DEPTH := 0.62
const ROTATION_COMPONENT := 0.7071067811865476
const GRID_METRES := 2.0
const MIN_ZOOM := 0.24
const MAX_ZOOM := 2.4
const MEADOW_PATH := "res://assets/assets/estate-v1/meadow-20261007.webp"
const NATURE_PATH := "res://assets/assets/estate-v1/nature-20261007.webp"

var camera: Camera2D
var people: Dictionary = {}
var buildings: Dictionary = {}
var world_size := Vector2(96, 96)
var master_id := ""
var selected_kind := ""
var selected_id := ""
var _ground: Polygon2D
var _terrain_layer: Node2D
var _entities: Node2D
var _border: Node2D
var _terrain_signature := ""
var _terrain: Array = []
var _focused := false
var _mouse_pressed := false
var _mouse_button := 0
var _dragged := false
var _press_position := Vector2.ZERO
var _last_pointer := Vector2.ZERO
var _touches: Dictionary = {}
var _touch_gesture_active := false


func _ready() -> void:
	_ground = Polygon2D.new()
	_ground.name = "Meadow"
	_ground.z_index = -4
	_ground.texture_repeat = CanvasItem.TEXTURE_REPEAT_MIRROR
	_ground.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	_ground.color = Color("aab290")
	if ResourceLoader.exists(MEADOW_PATH):
		_ground.texture = load(MEADOW_PATH) as Texture2D
	add_child(_ground)
	_terrain_layer = Node2D.new()
	_terrain_layer.name = "Terrain"
	_terrain_layer.z_index = -3
	add_child(_terrain_layer)
	_border = Node2D.new()
	_border.name = "Boundary"
	_border.z_index = -2
	add_child(_border)
	_entities = Node2D.new()
	_entities.name = "EstateEntities"
	_entities.y_sort_enabled = true
	add_child(_entities)
	camera = Camera2D.new()
	camera.name = "CourtyardCamera"
	camera.zoom = Vector2.ONE * 1.0
	camera.position = world_to_canvas(Vector2(15, 15))
	add_child(camera)
	camera.make_current()
	_rebuild_ground()
	set_process(false)


func apply_snapshot(snapshot: Dictionary) -> void:
	if int(snapshot.get("version", 0)) != 1:
		return
	var next_size := Vector2(float(snapshot.get("width", 96.0)), float(snapshot.get("height", 96.0)))
	if next_size.x > 0.0 and next_size.y > 0.0 and next_size != world_size:
		world_size = next_size
		_rebuild_ground()
	var terrain: Array = snapshot.get("terrain", [])
	var terrain_signature := JSON.stringify(terrain)
	if _terrain_signature != terrain_signature:
		_terrain_signature = terrain_signature
		_terrain = terrain.duplicate(true)
		_rebuild_terrain()
	master_id = str(snapshot.get("masterId", ""))
	var tick := int(snapshot.get("tick", 0))
	var paused := bool(snapshot.get("paused", true))
	var live_buildings: Dictionary = {}
	for item in snapshot.get("buildings", []):
		if not item is Dictionary or str(item.get("id", "")).is_empty():
			continue
		var id := str(item.id)
		live_buildings[id] = true
		if not buildings.has(id):
			var building = BuildingScript.new()
			_entities.add_child(building)
			buildings[id] = building
		buildings[id].apply_snapshot(item)
		buildings[id].set_selected(selected_kind == "building" and selected_id == id)
	_remove_missing(buildings, live_buildings)
	var live_people: Dictionary = {}
	for item in snapshot.get("people", []):
		if not item is Dictionary or str(item.get("id", "")).is_empty():
			continue
		var id := str(item.id)
		live_people[id] = true
		if not people.has(id):
			var actor = ActorScript.new()
			_entities.add_child(actor)
			people[id] = actor
		var world := Vector2(float(item.get("x", 0)), float(item.get("y", 0)))
		people[id].apply_snapshot(item, world_to_canvas(world), tick, paused, id == master_id)
		people[id].set_selected(selected_kind == "person" and selected_id == id)
	_remove_missing(people, live_people)
	if not _focused and people.has(master_id):
		focus_master()
		_focused = true
	if (selected_kind == "person" and not people.has(selected_id)) or (selected_kind == "building" and not buildings.has(selected_id)):
		set_selected("", "")


func _remove_missing(nodes: Dictionary, live: Dictionary) -> void:
	for id in nodes.keys():
		if not live.has(id):
			var node: Node = nodes[id]
			_entities.remove_child(node)
			node.queue_free()
			nodes.erase(id)


func set_selected(kind: String, id: String) -> void:
	selected_kind = kind
	selected_id = id
	for person_id in people:
		people[person_id].set_selected(kind == "person" and id == person_id)
	for building_id in buildings:
		buildings[building_id].set_selected(kind == "building" and id == building_id)


func focus_master() -> void:
	if people.has(master_id):
		camera.position = world_to_canvas(people[master_id].world_position)
		_constrain_camera()


static func world_to_canvas(point: Vector2) -> Vector2:
	return Vector2(point.x - point.y, (point.x + point.y) * DEPTH) * (PIXELS_PER_METRE * ROTATION_COMPONENT)


static func world_from_canvas(point: Vector2) -> Vector2:
	var projected := point / (PIXELS_PER_METRE * ROTATION_COMPONENT)
	return Vector2((projected.x + projected.y / DEPTH) / 2.0, (projected.y / DEPTH - projected.x) / 2.0)


func _screen_to_canvas(point: Vector2) -> Vector2:
	return get_viewport().get_canvas_transform().affine_inverse() * point


func _rebuild_ground() -> void:
	if _ground == null:
		return
	_ground.polygon = PackedVector2Array([
		world_to_canvas(Vector2.ZERO), world_to_canvas(Vector2(world_size.x, 0)),
		world_to_canvas(world_size), world_to_canvas(Vector2(0, world_size.y))])
	var tile_pixels := Vector2(1024, 1024)
	if _ground.texture:
		tile_pixels = _ground.texture.get_size()
	var repeat_size := world_size * tile_pixels / 16.0
	_ground.uv = PackedVector2Array([Vector2.ZERO, Vector2(repeat_size.x, 0), repeat_size, Vector2(0, repeat_size.y)])
	_rebuild_boundary()
	queue_redraw()


func _rebuild_terrain() -> void:
	for child in _terrain_layer.get_children():
		_terrain_layer.remove_child(child)
		child.queue_free()
	for item in _terrain:
		if not item is Dictionary:
			continue
		var polygon := Polygon2D.new()
		var points := PackedVector2Array()
		for vertex in item.get("polygon", []):
			if vertex is Array and vertex.size() >= 2:
				points.append(world_to_canvas(Vector2(float(vertex[0]), float(vertex[1]))))
			elif vertex is Dictionary:
				points.append(world_to_canvas(Vector2(float(vertex.get("x", 0)), float(vertex.get("y", 0)))))
		if points.size() < 3:
			polygon.free()
			continue
		polygon.polygon = points
		polygon.color = Color("729798") if str(item.get("kind", "")) in ["water", "pond", "river"] else Color("788773")
		_terrain_layer.add_child(polygon)
		var edge := Line2D.new()
		edge.points = points
		edge.closed = true
		edge.width = 3.0
		edge.default_color = Color(0.8, 0.8, 0.65, 0.55)
		_terrain_layer.add_child(edge)
	queue_redraw()


func _rebuild_boundary() -> void:
	for child in _border.get_children():
		_border.remove_child(child)
		child.queue_free()
	if not ResourceLoader.exists(NATURE_PATH):
		return
	var texture := load(NATURE_PATH) as Texture2D
	if texture == null:
		return
	# Decorative trees remain beyond the shared playable boundary.
	for index in range(12):
		var tree := Sprite2D.new()
		tree.texture = texture
		tree.region_enabled = true
		tree.region_filter_clip_enabled = true
		tree.region_rect = Rect2(32, 20, 752, 584) if index % 2 == 0 else Rect2(830, 20, 685, 590)
		tree.centered = false
		var width := 180.0 + float(index % 3) * 23.0
		tree.scale = Vector2.ONE * width / tree.region_rect.size.x
		var world := Vector2(5 + (index / 2) * 15, -3) if index % 2 == 0 else Vector2(-3, 5 + (index / 2) * 15)
		tree.position = world_to_canvas(world) - Vector2(width / 2, tree.region_rect.size.y * tree.scale.y)
		_border.add_child(tree)


func _draw() -> void:
	# Godot retains this command list. Camera movement does not rebuild the grid.
	var color := Color(0.22, 0.32, 0.25, 0.13)
	for x in range(0, int(world_size.x) + 1, int(GRID_METRES)):
		draw_line(world_to_canvas(Vector2(x, 0)), world_to_canvas(Vector2(x, world_size.y)), color, 0.65, true)
	for y in range(0, int(world_size.y) + 1, int(GRID_METRES)):
		draw_line(world_to_canvas(Vector2(0, y)), world_to_canvas(Vector2(world_size.x, y)), color, 0.65, true)
	var outline := PackedVector2Array([world_to_canvas(Vector2.ZERO), world_to_canvas(Vector2(world_size.x, 0)), world_to_canvas(world_size), world_to_canvas(Vector2(0, world_size.y)), world_to_canvas(Vector2.ZERO)])
	draw_polyline(outline, Color(0.8, 0.83, 0.65, 0.45), 2.0, true)


func _input(event: InputEvent) -> void:
	# A release may be consumed by a HUD control after a drag started on land.
	# Clear its state after normal dispatch so that re-entering land cannot pan.
	if event is InputEventMouseButton and not event.pressed and event.button_index == _mouse_button:
		_finish_mouse_release.call_deferred()
	elif event is InputEventScreenTouch and not event.pressed:
		_finish_touch_release.call_deferred(event.index)


func _finish_mouse_release() -> void:
	_mouse_pressed = false


func _finish_touch_release(index: int) -> void:
	_touches.erase(index)
	if _touches.is_empty():
		_touch_gesture_active = false


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_mouse_pressed = false
		_touches.clear()
		_touch_gesture_active = false


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP or event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			if event.pressed:
				_zoom_at(event.position, 1.12 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.12)
			get_viewport().set_input_as_handled()
		elif event.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_MIDDLE, MOUSE_BUTTON_RIGHT]:
			if event.pressed:
				_mouse_pressed = true
				_mouse_button = event.button_index
				_dragged = false
				_press_position = event.position
				_last_pointer = event.position
			else:
				if _mouse_pressed and not _dragged and _mouse_button == MOUSE_BUTTON_LEFT:
					_pick(event.position)
				_mouse_pressed = false
			get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and _mouse_pressed:
		if event.position.distance_to(_press_position) > 6.0:
			_dragged = true
		if _dragged:
			_pan(event.position - _last_pointer)
		_last_pointer = event.position
		get_viewport().set_input_as_handled()
	elif event is InputEventMagnifyGesture:
		_zoom_at(event.position, event.factor)
		get_viewport().set_input_as_handled()
	elif event is InputEventPanGesture:
		_pan(-event.delta * 22.0)
		get_viewport().set_input_as_handled()
	elif event is InputEventScreenTouch:
		if event.pressed:
			_touches[event.index] = event.position
			if _touches.size() == 1:
				_press_position = event.position
				_dragged = false
			else:
				_touch_gesture_active = true
		else:
			if _touches.size() == 1 and not _touch_gesture_active and not _dragged:
				_pick(event.position)
			_touches.erase(event.index)
			if _touches.is_empty():
				_touch_gesture_active = false
		get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag and _touches.has(event.index):
		if _touches.size() >= 2:
			var old_values: Array = _touches.values()
			var old_center: Vector2 = (old_values[0] + old_values[1]) / 2.0
			var old_distance: float = old_values[0].distance_to(old_values[1])
			_touches[event.index] = event.position
			var new_values: Array = _touches.values()
			var new_center: Vector2 = (new_values[0] + new_values[1]) / 2.0
			var new_distance: float = new_values[0].distance_to(new_values[1])
			_pan(new_center - old_center)
			if old_distance > 5.0:
				_zoom_at(new_center, new_distance / old_distance)
		else:
			if event.position.distance_to(_press_position) > 6.0:
				_dragged = true
			if _dragged:
				_pan(event.position - _touches[event.index])
			_touches[event.index] = event.position
		get_viewport().set_input_as_handled()


func _zoom_at(screen_position: Vector2, factor: float) -> void:
	var before := _screen_to_canvas(screen_position)
	var zoom_value := clampf(camera.zoom.x * factor, MIN_ZOOM, MAX_ZOOM)
	camera.zoom = Vector2.ONE * zoom_value
	camera.force_update_scroll()
	camera.position += before - _screen_to_canvas(screen_position)
	_constrain_camera()


func _pan(delta: Vector2) -> void:
	camera.position -= delta / camera.zoom
	_constrain_camera()


func _constrain_camera() -> void:
	var world := world_from_canvas(camera.position)
	world.x = clampf(world.x, -2.0, world_size.x + 2.0)
	world.y = clampf(world.y, -2.0, world_size.y + 2.0)
	camera.position = world_to_canvas(world)
	camera.force_update_scroll()


func _pick(screen_position: Vector2) -> void:
	var point := _screen_to_canvas(screen_position)
	var candidates: Array = []
	for actor in people.values():
		if actor.contains_canvas_point(point):
			candidates.append({"kind": "person", "id": actor.entity_id, "depth": actor.position.y + 0.01})
	for building in buildings.values():
		if building.contains_canvas_point(point):
			candidates.append({"kind": "building", "id": building.entity_id, "depth": building.position.y})
	if not candidates.is_empty():
		candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a.depth) > float(b.depth))
		var entity: Dictionary = candidates[0]
		set_selected(str(entity.kind), str(entity.id))
		entity_selected.emit(str(entity.kind), str(entity.id))
		return
	var world := world_from_canvas(point)
	if world.x >= 0 and world.y >= 0 and world.x <= world_size.x and world.y <= world_size.y:
		set_selected("", "")
		ground_clicked.emit(world)
