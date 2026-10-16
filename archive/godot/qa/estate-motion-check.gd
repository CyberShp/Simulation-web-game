extends SceneTree
## Run: Godot --headless --path godot --script ../qa/estate-motion-check.gd

const Estate = preload("res://estate_2d/estate.gd")
var checks := 0
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)
		push_error(message)


func _run() -> void:
	var estate := Estate.new()
	var samples := [
		{"tick": 1, "position": Vector2.ZERO},
		{"tick": 2, "position": Vector2(10, 0)},
		{"tick": 3, "position": Vector2(10, 10)},
	]
	estate.render_tick = 1.5
	var first: Dictionary = estate._actor_pose(samples, true)
	_check(first.moving and first.position.is_equal_approx(Vector2(5, 0)), "First leg interpolates continuously")
	estate.render_tick = 2.0
	var corner: Dictionary = estate._actor_pose(samples, true)
	_check(corner.moving and corner.position.is_equal_approx(Vector2(10, 0)) and corner.direction.is_equal_approx(Vector2(0, 10)), "Corner begins the next leg at its boundary")
	estate.render_tick = 3.0
	var continuing: Dictionary = estate._actor_pose(samples, true)
	_check(continuing.moving and continuing.position.is_equal_approx(Vector2(10, 10)), "Awaiting a continuing route does not enter the stopping pose")
	var arrived: Dictionary = estate._actor_pose(samples, false)
	_check(not arrived.moving and arrived.position.is_equal_approx(Vector2(10, 10)), "Arrival enters the stopping pose")
	estate.free()
	print("Estate motion: %d/%d checks passed" % [checks - failures.size(), checks])
	quit(0 if failures.is_empty() else 1)
