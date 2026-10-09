extends SceneTree
## ART-2D-03..06: exercise the actual courtyard scene and its commands.
## Run after import: Godot --headless --path godot --script ../qa/painted-courtyard-check.gd

var courtyard
var checks := 0
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(condition: bool, description: String) -> void:
	checks += 1
	if not condition:
		failures.append(description)
		push_error(description)


func _tick(count: int = 1) -> void:
	for index in range(count):
		courtyard._process(1.0 / 60.0)
		courtyard.master._process(1.0 / 60.0)
		courtyard.worker._process(1.0 / 60.0)


func _finish_route(max_frames: int = 7200) -> bool:
	for index in range(max_frames):
		if courtyard.route.is_empty():
			return true
		_tick()
	return courtyard.route.is_empty()


func _check_path(origin: Vector2, destination: Vector2, description: String) -> void:
	var points: Array = courtyard._path(origin, destination)
	_check(not points.is_empty(), description + " has a route")
	if points.is_empty():
		return
	_check(Vector2(points.back()).distance_to(destination) < 0.01, description + " reaches its requested endpoint")
	var cursor := origin
	var valid := true
	for point: Vector2 in points:
		valid = valid and courtyard._clear_segment(cursor, point)
		cursor = point
	_check(valid, description + " stays on the actual walkable ground")


func _pose(actor) -> Array:
	return [actor.position, actor._displayed_index, actor._phase, actor._work_phase, actor._facing_angle, actor._sprite.position, actor._sprite.scale]


func _layer(id: String) -> Dictionary:
	for layer: Dictionary in courtyard.painted_layers:
		if layer.id == id:
			return layer
	return {}


func _solid_pixel(actor, layer: Dictionary, covered: bool) -> Vector2:
	# Find a real painted character pixel at the current pose, then exercise
	# scene hit selection at that pixel. Transparent atlas space is excluded.
	for y in range(-85, 2):
		for x in range(-40, 41):
			var point: Vector2 = actor.position + Vector2(x, y)
			if actor.hit_test(point) and courtyard._layer_hit(layer, point) == covered:
				return point
	return Vector2.INF


func _click_world(point: Vector2) -> void:
	courtyard._click(courtyard.get_canvas_transform() * point)


func _run() -> void:
	root.size = Vector2i(1280, 800)
	var packed := load("res://painted_courtyard/courtyard.tscn") as PackedScene
	_check(packed != null, "Actual courtyard scene loads")
	if packed == null:
		quit(1)
		return
	courtyard = packed.instantiate()
	root.add_child(courtyard)
	courtyard.set_process(false)
	_check(courtyard.master != null and courtyard.worker != null, "Both actual painted identities instantiate")
	_check(courtyard.get_node("DepthSorted").y_sort_enabled, "Painting layers and people share depth sorting")
	var texture_alignment := true
	var drawable_outlines := true
	for layer: Dictionary in courtyard.painted_layers:
		texture_alignment = texture_alignment and is_equal_approx(layer.node.position.y, float(layer.depth))
		for index in range(layer.polygons.size()):
			var patch: Polygon2D = layer.node.get_child(index)
			var outline: PackedVector2Array = layer.polygons[index]
			drawable_outlines = drawable_outlines and not Geometry2D.triangulate_polygon(patch.polygon).is_empty()
			for vertex in range(outline.size()):
				texture_alignment = texture_alignment and patch.to_global(patch.polygon[vertex]).distance_to(outline[vertex]) < 0.01 and patch.uv[vertex].distance_to(outline[vertex]) < 0.01
	_check(texture_alignment, "All occlusion vertices and sampled texture pixels stay aligned with the source painting")
	_check(drawable_outlines, "Every actual painted occlusion polygon can be triangulated for drawing")
	var start: Vector2 = courtyard.master.position
	_check_path(start, courtyard.door, "Enter button")
	_check_path(courtyard.door, courtyard._vector(courtyard.layout.exit_point), "Exit button")
	_check_path(start, courtyard._vector(courtyard.layout.master_work_point), "Work button")
	var cursor := start
	for index in range(courtyard.layout.tour_points.size()):
		var destination: Vector2 = courtyard._vector(courtyard.layout.tour_points[index])
		_check_path(cursor, destination, "Tour leg %d" % (index + 1))
		cursor = destination
	_check_path(courtyard.work_points[0], courtyard.work_points[1], "Disciple first work leg")
	_check_path(courtyard.work_points[1], courtyard.work_points[0], "Disciple return work leg")
	for blocked in courtyard.layout.validation.blocked_points:
		var blocked_point: Vector2 = courtyard._vector(blocked.point)
		_check(not courtyard._is_walkable(blocked_point), str(blocked.name) + " blocks walking")
		_check(courtyard._path(start, blocked_point).is_empty(), str(blocked.name) + " rejects a route")
		courtyard._reset()
		_check(not courtyard._walk_to(blocked_point) and courtyard.route.is_empty() and courtyard.master.position == start, str(blocked.name) + " does not move the player")
	# Button sequences run scene logic through arrival, including indoor exit.
	courtyard._reset()
	courtyard._command("enter")
	_check(not courtyard.route.is_empty() and courtyard.mode == "enter", "Enter command starts travel")
	_check(_finish_route() and courtyard.indoor and not courtyard.master.visible, "Arrival at hall changes to hidden indoor state")
	courtyard._command("enter")
	_check(_finish_route() and not courtyard.indoor and courtyard.master.visible and courtyard.master.position.distance_to(courtyard._vector(courtyard.layout.exit_point)) < 0.01, "Exit command returns the same master to the forecourt")
	courtyard._command("work")
	_check(not courtyard.route.is_empty(), "Work command starts from the forecourt")
	var work_arrived := _finish_route()
	_tick() # Arrival can consume the final walking frame before the work pose.
	_check(work_arrived and courtyard.mode == "work" and courtyard.master.position.distance_to(courtyard._vector(courtyard.layout.master_work_point)) < 0.01 and courtyard.master._working, "Work command reaches the actual work point and starts its pose")
	courtyard._command("enter")
	_check(not courtyard.master._working and _finish_route() and courtyard.indoor, "Leaving work immediately ends the tool pose and can enter the hall")
	courtyard._command("work")
	_check(_finish_route() and not courtyard.indoor and courtyard.master.visible and courtyard.mode == "work", "Work command is reachable from indoors")
	courtyard._reset()
	courtyard._command("tour")
	_check(_finish_route() and courtyard.tour_queue.is_empty() and courtyard.mode == "idle" and courtyard.master.position.distance_to(courtyard._vector(courtyard.layout.tour_points.back())) < 0.01, "Tour command completes every leg and stops at its final point")
	courtyard._reset()
	var first_worker_position: Vector2 = courtyard.worker.position
	_tick(380)
	_check(courtyard.worker.position.distance_to(first_worker_position) > 10.0 and courtyard.worker_working and courtyard.worker_route.is_empty(), "Disciple autonomously reaches the second work point and resumes work")
	_tick(340)
	_check(courtyard.worker.position.distance_to(first_worker_position) < 0.01 and courtyard.worker_working, "Disciple returns autonomously to the first work point")
	# Compare visible character pixels with the same geometry used for drawing.
	courtyard._reset()
	var gate: Dictionary = _layer("gate")
	_check(not gate.is_empty(), "Mountain gate has a painted depth layer")
	if not gate.is_empty():
		_check(not courtyard._layer_hit(gate, courtyard._vector(courtyard.layout.validation.gate_opening)), "Gate opening keeps its visible ground clear")
		courtyard.master.position = courtyard._vector(courtyard.layout.validation.gate_rear)
		var covered := _solid_pixel(courtyard.master, gate, true)
		_check(covered.is_finite(), "Rear-gate fixture has a real character pixel behind the roof")
		if covered.is_finite():
			_check(courtyard._occluded(courtyard.master, covered), "Gate roof occludes the character behind it")
			_click_world(covered)
			_check(courtyard.selected == "gate", "Covered character pixel selects the visible gate")
		var exposed := _solid_pixel(courtyard.master, gate, false)
		_check(exposed.is_finite(), "Rear-gate fixture leaves a visible character pixel")
		if exposed.is_finite():
			_click_world(exposed)
			_check(courtyard.selected == "master", "Visible character pixel at the gate remains selectable")
		courtyard.master.position = courtyard._vector(courtyard.layout.validation.gate_front)
		_check(courtyard._is_walkable(courtyard.master.position), "Front-gate selection fixture stands on real path")
		var foreground := _solid_pixel(courtyard.master, gate, true)
		_check(foreground.is_finite(), "Front-gate fixture overlaps a painted pier with a real body pixel")
		if foreground.is_finite():
			_check(not courtyard._occluded(courtyard.master, foreground), "Character in front of gate is not hidden")
			_click_world(foreground)
			_check(courtyard.selected == "master", "Foreground character wins selection over gate")
		courtyard.master.position = courtyard._vector(courtyard.layout.validation.gate_equal_depth)
		_check(courtyard._is_walkable(courtyard.master.position), "Equal-depth fixture stands on the gate path")
		var equal_depth := _solid_pixel(courtyard.master, gate, true)
		_check(equal_depth.is_finite(), "Equal-depth fixture has a painted character pixel over the gate")
		if equal_depth.is_finite():
			_check(courtyard.master.get_index() > gate.node.get_index(), "Equal-depth character is drawn after the gate in scene order")
			_click_world(equal_depth)
			_check(courtyard.selected == "master", "Equal-depth selection follows the character drawn in front")
	_click_world(courtyard._vector(courtyard.layout.validation.hall_hit))
	_check(courtyard.selected == "hall", "Main hall painted facade is selectable")
	courtyard._reset()
	var worker_pixel := _solid_pixel(courtyard.worker, _layer("hall"), false)
	_check(worker_pixel.is_finite(), "Working disciple has a visible painted pixel")
	if worker_pixel.is_finite():
		_click_world(worker_pixel)
		_check(courtyard.selected == "worker", "Working disciple remains selectable")
	# Pause, reset and background use the actual command guard and actor clock.
	courtyard._reset()
	courtyard._command("tour")
	_tick(35)
	courtyard._command("pause")
	var frozen_master := _pose(courtyard.master)
	var frozen_worker := _pose(courtyard.worker)
	var frozen_time: float = courtyard.trial_time
	var frozen_route: Array = courtyard.route.duplicate()
	_tick(180)
	_check(_pose(courtyard.master) == frozen_master and _pose(courtyard.worker) == frozen_worker and courtyard.trial_time == frozen_time, "Pause freezes positions, facing, frames and sample time")
	for command in ["work", "enter", "tour"]:
		courtyard._command(command)
		_check(courtyard.route == frozen_route and _pose(courtyard.master) == frozen_master, "Paused " + command + " preserves the current route and pose")
	courtyard._command("reset")
	_check(not courtyard.paused and courtyard.mode == "idle" and courtyard.master.position == start and courtyard.route.is_empty() and courtyard.tour_queue.is_empty(), "Reset restores the initial controllable scene")
	courtyard._command("pause")
	frozen_master = _pose(courtyard.master)
	frozen_worker = _pose(courtyard.worker)
	_tick(180)
	_check(_pose(courtyard.master) == frozen_master and _pose(courtyard.worker) == frozen_worker, "Immediate pause after reset keeps both authored poses stable")
	courtyard._command("pause")
	courtyard._command("work")
	_tick(20)
	courtyard._command("background")
	frozen_master = _pose(courtyard.master)
	frozen_worker = _pose(courtyard.worker)
	frozen_time = courtyard.trial_time
	_tick(180)
	_check(_pose(courtyard.master) == frozen_master and _pose(courtyard.worker) == frozen_worker and courtyard.trial_time == frozen_time, "Background freezes both bodies and scene time")
	courtyard._command("foreground")
	courtyard._process(20.0)
	_check(courtyard.master.position == frozen_master[0] and courtyard.trial_time == frozen_time, "Returning to foreground discards elapsed hidden time")
	courtyard._command("zoom_in")
	_check(courtyard.zoom_factor > 1.0, "Zoom in button changes camera scale")
	courtyard._command("zoom_out")
	_check(is_equal_approx(courtyard.zoom_factor, 1.0), "Zoom out button restores initial camera scale")
	print("Painted courtyard: %d/%d checks passed" % [checks - failures.size(), checks])
	courtyard.free()
	quit(0 if failures.is_empty() else 1)
