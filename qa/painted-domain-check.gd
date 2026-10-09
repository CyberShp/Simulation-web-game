extends SceneTree
## DOMAIN-01..05: real scene route continuity, return, boundaries, camera and pause.

var scene
var checks := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _check(ok: bool, description: String) -> void:
	checks += 1
	if not ok:
		failures.append(description)
		push_error(description)

func _travel() -> Dictionary:
	var frames := 0
	var valid := true
	var continuous := true
	while not scene.route.is_empty() and frames < 18000:
		var before: Vector2 = scene.master.position
		scene._process(1.0 / 60.0)
		valid = valid and scene._is_walkable(scene.master.position)
		continuous = continuous and before.distance_to(scene.master.position) <= scene.WALK_SPEED / 60.0 + 0.01
		frames += 1
	return {"frames": frames, "valid": valid, "continuous": continuous}

func _run() -> void:
	scene = load("res://painted_courtyard/courtyard.tscn").instantiate()
	root.add_child(scene)
	scene.set_process(false)
	await process_frame
	_check(scene.domain.places.size() == 7, "Seven stable mountain-domain zones")
	_check(scene._local_walkable(scene.domain.gateway), "Trail gateway overlaps the original courtyard navigation")
	_check(scene.domain.contains(scene.domain.destination), "Waterfall landing is on the authored trail")
	_check(scene.domain.trail_length > 300, "Stone bridge and waterfall approach form a substantial connected route")
	var landmarks: Dictionary = scene.layout.landmarks
	var hall_position: Vector2 = scene._vector(landmarks.hall)
	var gate_position: Vector2 = scene._vector(landmarks.mountain_gate)
	_check(hall_position.distance_to(gate_position) / scene.master.visual_height > 10.0, "Hall-to-gate depth exceeds ten adult heights at the shared art scale")
	var start: Vector2 = scene.master.position
	scene._command("explore")
	_check(not scene.route.is_empty(), "Public explore command creates a continuous route")
	_check(scene.master.position == start, "Issuing explore never relocates the character")
	var outward := _travel()
	_check(outward.valid and outward.continuous, "Outward route stays on ground at bounded movement speed")
	_check(scene.master.position.distance_to(scene.domain.destination) < 0.1, "Reaches the waterfall landing")
	_check(scene.route.is_empty() and scene.mode == "idle", "Stops at destination")
	var outside: Vector2 = scene.master.position
	scene._command("pause")
	var clock: float = scene.trial_time
	scene._command("overview")
	_check(scene.zoom_factor < 0.02, "Overview fits the broad mountain terrain")
	scene._process(0.5)
	scene._command("home")
	_check(scene.master.position == outside and scene.trial_time == clock, "Paused map and home views preserve position and time")
	scene._command("return")
	_check(scene.route.is_empty(), "Paused return is rejected")
	scene._command("pause")
	_check(not scene._walk_to(Vector2(-6000, 3000)), "Landscape outside authored ground is rejected")
	_check(scene.master.position == outside, "Rejected movement keeps the existing position")
	scene._command("return")
	_check(not scene.route.is_empty(), "Public return command finds the full return route")
	var inward := _travel()
	_check(inward.valid and inward.continuous, "Return retraces reachable ground without teleporting")
	_check(scene.master.position.distance_to(start) < 0.1, "Return reaches the original courtyard start")
	_check(scene._local_walkable(scene.worker.position), "Autonomous worker keeps the original local activity")
	scene._reset()
	_check(scene.master.position == start and scene.zoom_factor == 1.0 and not scene.follow_master, "Reset restores courtyard pose and camera")
	print(JSON.stringify({"suite": "painted-domain", "checks": checks, "failures": failures, "outwardFrames": outward.frames, "inwardFrames": inward.frames, "trailPixels": scene.domain.trail_length}))
	quit(0 if failures.is_empty() else 1)
