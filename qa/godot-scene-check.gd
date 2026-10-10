extends SceneTree
var checks := 0
var failures := 0
var scene
var clicked_world := Vector2(-1, -1)
var selected := ""

func _initialize() -> void:
	call_deferred("_run")

func verify(condition: bool, detail: String) -> void:
	if not condition:
		push_error("FAILED: " + detail)
		failures += 1
	checks += 1

func _run() -> void:
	scene = load("res://scripts/courtyard.gd").new()
	root.add_child(scene)
	root.size = Vector2i(1280, 800)
	await process_frame
	var snapshot := {"version": 1, "tick": 25, "paused": true, "width": 96, "height": 96, "masterId": "p:master", "people": [{"id": "p:master", "name": "沈砚", "x": 15, "y": 15, "appearance": 0, "activity": "stand", "indoor": false, "moving": false}, {"id": "p:indoor", "name": "陆知微", "x": 22, "y": 22, "appearance": 2, "activity": "rest", "indoor": true, "moving": false}], "buildings": [{"id": "b:hall", "name": "主屋", "type": "hall", "x": 20, "y": 20, "width": 8, "height": 8, "indoor": true, "level": 1, "stage": "complete"}], "terrain": [{"kind": "water", "polygon": [[60, 60], [66, 60], [66, 66], [60, 66]]}]}
	var frozen := JSON.stringify(snapshot)
	scene.apply_snapshot(snapshot)
	await process_frame
	verify(JSON.stringify(snapshot) == frozen, "view preserves authoritative snapshot")
	verify(scene.people.size() == 2 and scene.buildings.size() == 1, "persistent entities are constructed")
	verify(not scene.people["p:indoor"].visible and not scene.people["p:indoor"].contains_canvas_point(scene.world_to_canvas(Vector2(22, 22))), "indoor person hidden and not pickable")
	verify(scene.people["p:master"].visible, "outdoor master visible")
	for point in [Vector2.ZERO, Vector2(96, 96), Vector2(12.75, 70.25)]:
		verify(scene.world_from_canvas(scene.world_to_canvas(point)).distance_to(point) < 0.0001, "projection shares exact inverse")
	var actor_id: int = scene.people["p:master"].get_instance_id()
	var building_id: int = scene.buildings["b:hall"].get_instance_id()
	scene.apply_snapshot(snapshot)
	verify(scene.people["p:master"].get_instance_id() == actor_id and scene.buildings["b:hall"].get_instance_id() == building_id, "unchanged entities reuse retained nodes")
	verify(scene.camera.position.distance_to(scene.world_to_canvas(Vector2(15, 15))) < 0.001, "first camera focus uses master location")
	scene.set_selected("person", "p:master")
	verify(scene.people["p:master"].is_selected, "person selection retained")
	scene.ground_clicked.connect(func(point: Vector2): clicked_world = point)
	scene.entity_selected.connect(func(kind: String, id: String): selected = kind + ":" + id)
	var canvas: Transform2D = root.get_canvas_transform()
	scene._pick(canvas * scene.world_to_canvas(Vector2(30, 15)))
	verify(clicked_world.distance_to(Vector2(30, 15)) < 0.001, "ground click emits authoritative metre coordinates")
	scene._pick(canvas * (scene.people["p:master"].position + Vector2(0, -25)))
	verify(selected == "person:p:master", "visible body selects same persistent person")
	var anchor := Vector2(500, 350)
	var before: Vector2 = scene._screen_to_canvas(anchor)
	scene._zoom_at(anchor, 1.2)
	verify(before.distance_to(scene._screen_to_canvas(anchor)) < 0.001, "wheel keeps pointer anchored")
	verify(scene.people["p:master"].sprite.texture != null and scene.buildings["b:hall"].sprite.texture != null, "registered actor and building textures load")
	var occluded: Dictionary = snapshot.duplicate(true)
	occluded.people[0].x = 23
	occluded.people[0].y = 19
	scene.apply_snapshot(occluded)
	var roof_point := Vector2.ZERO
	var found_roof := false
	var actor = scene.people["p:master"]
	var building = scene.buildings["b:hall"]
	for dx in range(-8, 9, 2):
		for dy in range(-50, -4, 2):
			var point: Vector2 = actor.position + Vector2(dx, dy)
			if actor.contains_canvas_point(point) and building.contains_canvas_point(point):
				roof_point = point
				found_roof = true
	verify(found_roof, "authored roof actually overlaps rear actor pixels")
	if found_roof:
		selected = ""
		scene._pick(root.get_canvas_transform() * roof_point)
		verify(selected == "building:b:hall", "roof occlusion and click order agree")
	var transparent_found := false
	for dx in range(0, int(building._rect.size.x), 10):
		var corner: Vector2 = building.position + building._rect.position + Vector2(dx, 1)
		if not building.contains_canvas_point(corner):
			transparent_found = true
	verify(transparent_found, "transparent atlas margins do not swallow clicks")
	occluded.buildings[0].stage = "damaged"
	var old_crop: Rect2 = building.sprite.region_rect
	scene.apply_snapshot(occluded)
	verify(building.get_instance_id() == building_id and building.sprite.region_rect != old_crop, "building stage updates the same retained entity")
	scene.apply_snapshot(snapshot)
	var moving: Dictionary = snapshot.duplicate(true)
	moving.paused = false
	moving.tick = 30
	moving.people[0].x = 15.5
	moving.people[0].moving = true
	scene.apply_snapshot(moving)
	await create_timer(0.15).timeout
	verify(scene.people["p:master"].position.distance_to(scene.world_to_canvas(Vector2(15.5, 15))) < 0.001, "adjacent supplied movement finishes at authoritative target")
	var final_position: Vector2 = scene.people["p:master"].position
	await create_timer(0.15).timeout
	verify(scene.people["p:master"].position == final_position, "presentation never extrapolates beyond last snapshot")
	moving.paused = true
	moving.people[0].x = 16
	scene.apply_snapshot(moving)
	verify(scene.people["p:master"].position.distance_to(scene.world_to_canvas(Vector2(16, 15))) < 0.001, "paused view uses exact supplied position")
	moving.people.remove_at(1)
	moving.buildings.clear()
	scene.apply_snapshot(moving)
	verify(scene.people.size() == 1 and scene.buildings.is_empty(), "removed entities leave retained scene")
	print("GODOT_SCENE_CHECKS=", checks, " FAILURES=", failures)
	scene.queue_free()
	await process_frame
	quit(0 if failures == 0 else 1)
