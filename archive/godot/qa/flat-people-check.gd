extends SceneTree
## Godot --headless --path godot --script ../qa/flat-people-check.gd

const Visitor = preload("res://estate_2d/standing_person.gd")
const Actor = preload("res://estate_2d/flat_actor.gd")
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
	var actor := Actor.new()
	root.add_child(actor)
	actor.setup(true)
	for index: int in actor._excluded_regions:
		actor._moving = index < 16
		actor._working = index >= 16
		actor._facing_angle = -PI / 4.0
		actor._phase = 1.1 / 8.0
		actor._work_phase = 1.1 / 8.0
		actor._update_frame()
		_check(actor._displayed_index == index, "Overlap check displays the intended authored frame")
		var excluded: Rect2 = actor._excluded_regions[index]
		var shader_region: Vector4 = actor._sprite.material.get_shader_parameter("exclude_region")
		_check(shader_region == Vector4(excluded.position.x, excluded.position.y, excluded.size.x, excluded.size.y), "Drawing clips the adjacent frame overlap")
		var neighboring_pixel := excluded.get_center() - actor._frames[index].region.position
		_check(not actor.hit_test(actor._sprite.to_global(neighboring_pixel)), "Adjacent frame overlap does not select the actor")
	actor.free()
	var metadata: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://estate_2d/assets/flat-visitors-v1.json"))
	for filename: String in metadata.characters:
		var visitor := Visitor.new()
		root.add_child(visitor)
		visitor.position = Vector2(120.0, 180.0)
		visitor.visual_height = 100.0 if filename.contains("shanxiao") else 76.0
		visitor.setup("res://estate_2d/assets/" + filename)
		_check(visitor.body != null and visitor.body_image != null, filename + " loads")
		_check(is_equal_approx(visitor.visible_bounds.size.y * visitor.body.scale.y, visitor.visual_height), filename + " visible silhouette has the requested height")
		var anchor: Array = metadata.characters[filename].foot_anchor
		_check(visitor.body.to_global(Vector2(anchor[0], anchor[1])).is_equal_approx(visitor.global_position), filename + " ground contact maps to the simulation foot point")
		var bounds: Rect2i = visitor.visible_bounds
		var center := Vector2(bounds.get_center())
		_check(visitor.hit_test(visitor.body.to_global(center)), filename + " body is selectable")
		_check(not visitor.hit_test(visitor.body.to_global(Vector2.ZERO)), filename + " transparent margin does not select")
		visitor.set_travel_distance(6.0)
		visitor.set_motion(true, false, 0.1)
		_check(visitor.body.position.y < visitor.base_position.y, filename + " travel retains gait response")
		visitor.set_motion(false, false, 0.1)
		_check(visitor.body.position.is_equal_approx(visitor.base_position), filename + " stopping restores its authored foot point")
		visitor.set_process(false)
		var phase: float = visitor.gait_distance
		visitor.set_travel_distance(5.0)
		_check(is_equal_approx(visitor.gait_distance, phase), filename + " disabled processing freezes gait")
		visitor.hide()
		_check(not visitor.hit_test(visitor.body.to_global(center)), filename + " hidden visitor does not select")
		visitor.free()
	# Low alpha marks around an opaque subject must not shrink its visible body.
	var image := Image.create(32, 32, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.6, 0.6, 0.4, 0.03))
	image.fill_rect(Rect2i(8, 4, 12, 24), Color.WHITE)
	var texture := ImageTexture.create_from_image(image)
	var fixture := Visitor.new()
	root.add_child(fixture)
	fixture.visual_height = 76.0
	fixture._configure_texture(texture)
	_check(fixture.visible_bounds == Rect2i(8, 4, 12, 24), "Low alpha outer margin does not define body size")
	_check(is_equal_approx(fixture.body.scale.y * 24.0, 76.0), "Opaque body remains 76px tall with outer alpha margin")
	_check(not fixture.hit_test(fixture.body.to_global(Vector2(1, 1))), "Low alpha outer margin does not intercept a click")
	_check(fixture.hit_test(fixture.body.to_global(Vector2(12, 12))), "Opaque fixture body is clickable")
	fixture.free()
	print("Flat people: %s/%s checks passed" % [checks - failures.size(), checks])
	quit(0 if failures.is_empty() else 1)
