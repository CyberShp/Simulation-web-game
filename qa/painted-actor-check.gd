extends SceneTree
## Run: Godot --headless --path godot --script ../qa/painted-actor-check.gd

const Actor = preload("res://painted_courtyard/actor_2d.gd")
var checks := 0
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)
		push_error(message)


func _fixture(count: int, with_turn: bool, bounds_key: String = "bounds") -> Dictionary:
	var entries: Array = []
	var names: Array[String] = ["walk_front", "walk_back", "work"]
	if with_turn:
		names.append("turn_rest")
	for animation: String in names:
		# Reverse file ordering to require sorting by authored frame number.
		for number: int in range(count - 1, -1, -1):
			var frame: Dictionary = {"animation": animation, "frame": number, "region": [0, 0, 64, 64], "foot_anchor": [28, 56]}
			frame[bounds_key] = [16, 8, 24, 48]
			entries.append(frame)
	return {"reference_height": 48, "frames": entries}


func _run() -> void:
	for is_master: bool in [true, false]:
		var current_actor := Actor.new()
		root.add_child(current_actor)
		current_actor.visual_height = 68.0
		current_actor.setup(is_master)
		_check(not current_actor._frames.is_empty() and current_actor._displayed_index >= 0, "Current authored atlas loads for " + ("Shen Yan" if is_master else "Lu Zhiwei"))
		_check(current_actor._frames.size() == 32, "Current authored identity has 32 frames")
		var all_regions_loaded := true
		for frame: AtlasTexture in current_actor._frames:
			var frame_image: Image = frame.get_image()
			all_regions_loaded = all_regions_loaded and frame_image != null and not frame_image.is_empty() and frame_image.get_size() == Vector2i(frame.region.size)
		_check(all_regions_loaded, "Every actual atlas region loads, including cross-cell tools")
		for direction: Vector2 in [Vector2(1, 1), Vector2(1, -1)]:
			current_actor.set_facing(direction, 0.0)
			for tick: int in range(8):
				current_actor._process(0.05)
			current_actor.set_motion(true, false, 0.0)
			var visited: Dictionary = {}
			for tick: int in range(8):
				current_actor.set_travel_distance(current_actor.visual_height * current_actor.stride_height_ratio / 8.0)
				current_actor._process(0.05)
				visited[current_actor._displayed_index] = true
			_check(visited.size() == 8, "Actual front/back walk visits all eight authored frames")
		current_actor.set_motion(false, true, 0.0)
		var work_frames: Dictionary = {}
		for tick: int in range(40):
			current_actor._process(0.05)
			work_frames[current_actor._displayed_index] = true
		_check(work_frames.size() == 8, "Actual work visits all eight authored frames")
		_check(is_equal_approx(absf(current_actor._sprite.scale.x), 68.0 / current_actor._reference_height), "Actual work uses the same standing-derived body scale")
		current_actor.set_motion(true, false, 0.0)
		_check(current_actor._displayed_animation != "work", "Actual work exits immediately on walking")
		current_actor.free()
	var image := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	image.fill(Color.TRANSPARENT)
	image.fill_rect(Rect2i(16, 8, 24, 48), Color.WHITE)
	# A transparent hole inside broad painted bounds must not intercept selection.
	image.set_pixel(20, 20, Color.TRANSPARENT)
	var texture := ImageTexture.create_from_image(image)
	var actor := Actor.new()
	root.add_child(actor)
	_check(actor._configure_frames(_fixture(8, true), texture), "32-frame metadata loads")
	_check(actor._frames.size() == 32 and actor._animations["turn_rest"].size() == 8, "Named animation groups retain all authored frames")
	_check(actor._animations["walk_front"][0] == 7, "Authored frame numbers determine clip order")
	_check(actor._displayed_index == actor._animations["turn_rest"][0], "Initial front pose is a stable standing frame")
	actor.set_motion(true, true, 0.0)
	_check(actor._moving and not actor._working and actor._displayed_animation == "walk_front", "Approaching work uses walking")
	actor.set_travel_distance(actor.visual_height * actor.stride_height_ratio * 0.25)
	actor._process(0.05)
	_check(is_equal_approx(actor._phase, 0.25), "Actual distance advances one quarter stride")
	actor.set_travel_distance(0.0)
	actor._process(0.05)
	_check(is_equal_approx(actor._phase, 0.25), "Blocked movement does not walk in place")
	actor.set_travel_distance(actor.visual_height * actor.stride_height_ratio * 0.125)
	actor.set_travel_distance(actor.visual_height * actor.stride_height_ratio * 0.125)
	actor._process(0.01)
	_check(is_equal_approx(actor._phase, 0.5), "Path legs accumulate independently of frame duration")
	actor.set_travel_distance(actor.visual_height * actor.stride_height_ratio * 0.1)
	actor._process(0.05)
	actor.set_motion(false, false, 0.0)
	_check(actor._settling and actor._displayed_animation == "walk_front", "Stopping begins a short finishing step")
	for step: int in range(4):
		actor._process(0.05)
	_check(not actor._settling and actor._displayed_index == actor._animations["turn_rest"][0], "Finishing step lands in an authored standing pose")
	actor.set_facing(Vector2(1, -1), 0.0)
	actor._process(0.05)
	_check(actor._turning and actor._displayed_index == actor._animations["turn_rest"][1], "Turning passes through an intermediate authored pose")
	for step: int in range(4):
		actor._process(0.05)
	_check(not actor._turning and actor._displayed_index == actor._animations["turn_rest"][4], "Back turn ends at stable frame four")
	actor.set_facing(Vector2(-1, -1), 0.0)
	for step: int in range(8):
		actor._process(0.05)
	_check(actor._left_facing and actor._sprite.scale.x < 0, "Left-facing poses mirror the same anchored body")
	var solid_world: Vector2 = actor._sprite.to_global(Vector2(25, 25))
	var hole_world: Vector2 = actor._sprite.to_global(Vector2(20, 20))
	_check(actor.hit_test(solid_world), "Mirrored painted body remains selectable")
	_check(not actor.hit_test(hole_world), "Transparent pixels do not claim selection")
	_check(not actor.hit_test(actor._sprite.to_global(Vector2(4, 4))), "Transparent atlas margins remain unselectable")
	_check(actor._sprite.to_global(actor._anchors[actor._displayed_index]).is_equal_approx(actor.global_position), "Mirrored foot anchor remains at parent-owned position")
	actor.set_motion(false, true, 0.0)
	actor._process(0.05)
	_check(actor._displayed_animation == "work", "Stationary work uses its own clip")
	actor.set_motion(true, true, 0.0)
	_check(actor._displayed_animation != "work" and not actor._working, "Leaving work removes the tool pose immediately")
	var frozen_phase: float = actor._phase
	var frozen_angle: float = actor._facing_angle
	var frozen_frame: int = actor._displayed_index
	var frozen_position: Vector2 = actor.position
	actor.set_process(false)
	actor.set_facing(Vector2.DOWN, 1.0)
	actor.set_motion(false, true, 1.0)
	actor.set_travel_distance(100.0)
	actor._process(10.0)
	_check(actor._phase == frozen_phase and actor._facing_angle == frozen_angle and actor._displayed_index == frozen_frame, "Disabled processing freezes phases, facing and visible frame")
	_check(actor.position == frozen_position, "Animation never moves parent-owned position")
	actor.set_process(true)
	actor.set_travel_distance(0.0)
	actor._process(0.05)
	_check(actor._phase == frozen_phase, "Resume does not replay hidden travel")
	var broken: Dictionary = _fixture(8, true)
	broken["frames"][0]["region"] = [60, 0, 64, 64]
	_check(not actor._configure_frames(broken, texture) and actor._frames.size() == 32, "Invalid atlas bounds preserve the valid actor")
	_check(actor._configure_frames(_fixture(6, false, "visible_bounds"), texture), "Legacy 18-frame metadata remains supported")
	_check(actor._frames.size() == 18 and actor._displayed_index == actor._animations["walk_front"][1], "Legacy standing fallback is retained")
	actor.set_motion(true, false, 0.0)
	actor._process(0.05)
	_check(actor._phase > 0.0, "Existing callers retain time-based walking until travel input is supplied")
	_check(actor._configure_frames(_fixture(5, false), texture) and actor._frames.size() == 15, "Frame count is dynamic rather than fixed to either atlas version")
	actor.queue_free()
	print("Painted actor: %d/%d checks passed" % [checks - failures.size(), checks])
	quit(0 if failures.is_empty() else 1)
