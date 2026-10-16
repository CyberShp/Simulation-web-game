extends Node2D
## U-107 / DOMAIN-01..04: overview terrain and a bounded, authored walking trail.
## Coordinates belong to this art trial; formal saves keep their meter contract.

var definition: Dictionary = {}
var world_rect := Rect2(-120000, -45000, 240000, 135000)
var detail_rect := Rect2(-1500, 0, 5000, 3300)
var trail: Array[Vector2] = []
var widths: Array[float] = []
var distances: Array[float] = []
var trail_length := 0.0
var gateway := Vector2(1230, 804)
var destination := Vector2.ZERO
var places: Array[Dictionary] = []
var overview: Sprite2D
var approach: Sprite2D

func _ready() -> void:
	definition = JSON.parse_string(FileAccess.get_file_as_string("res://painted_courtyard/assets/domain-layout.json"))
	var bounds: Array = definition.world_rect
	world_rect = Rect2(bounds[0], bounds[1], bounds[2], bounds[3])
	overview = _painting(str(definition.overview_texture), world_rect, -40)
	var near: Dictionary = definition.approach
	var origin := _point(near.position)
	var extent := _point(near.size)
	detail_rect = Rect2(origin, extent)
	approach = _painting(str(near.texture), detail_rect, -30)
	approach.rotation = float(near.get("rotation", 0.0))
	for value in definition.trail:
		trail.append(_point(value))
	for value in definition.trail_widths:
		widths.append(float(value))
	for i in trail.size():
		if i > 0:
			trail_length += trail[i - 1].distance_to(trail[i])
		distances.append(trail_length)
	gateway = trail[0]
	destination = trail[-1]
	for place in definition.places:
		places.append(place)

func _point(value: Array) -> Vector2:
	return Vector2(float(value[0]), float(value[1]))

func _painting(texture_name: String, bounds: Rect2, depth: int) -> Sprite2D:
	var sprite := Sprite2D.new()
	sprite.texture = load("res://painted_courtyard/assets/" + texture_name)
	sprite.centered = false
	sprite.position = bounds.position
	sprite.scale = bounds.size / sprite.texture.get_size()
	sprite.z_index = depth
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	add_child(sprite)
	return sprite

func nearest(point: Vector2) -> Dictionary:
	var result := {"point": gateway, "distance": INF, "along": 0.0, "segment": 0, "width": 0.0}
	for i in range(trail.size() - 1):
		var nearest_point := Geometry2D.get_closest_point_to_segment(point, trail[i], trail[i + 1])
		var distance := point.distance_to(nearest_point)
		if distance < float(result.distance):
			result = {"point": nearest_point, "distance": distance, "along": distances[i] + trail[i].distance_to(nearest_point), "segment": i, "width": widths[i]}
	return result

func contains(point: Vector2, clearance: float = 6.0) -> bool:
	var sample := nearest(point)
	return float(sample.distance) <= maxf(0.0, float(sample.width) - clearance)

func path(from: Vector2, to: Vector2) -> Array[Vector2]:
	var result: Array[Vector2] = []
	if not contains(from) or not contains(to):
		return result
	var start := nearest(from)
	var finish := nearest(to)
	result.append(start.point)
	if float(start.along) < float(finish.along):
		for i in range(1, trail.size()):
			if distances[i] > float(start.along) and distances[i] < float(finish.along):
				result.append(trail[i])
	else:
		for i in range(trail.size() - 2, -1, -1):
			if distances[i] < float(start.along) and distances[i] > float(finish.along):
				result.append(trail[i])
	result.append(finish.point)
	result.append(to)
	return result

func place_position(place: Dictionary) -> Vector2:
	return world_rect.position + _point(place.uv) * world_rect.size

func set_view(is_overview: bool) -> void:
	overview.visible = is_overview
	approach.visible = not is_overview and not bool(definition.approach.get("shared_ground", false))
