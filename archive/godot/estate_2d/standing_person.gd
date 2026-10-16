extends Node2D
## Public visitor at their actual scene position.

var body: Sprite2D
var visual_height := 65.0
var body_image: Image
var base_position := Vector2.ZERO
var gait_distance := 0.0

func setup(texture_path: String) -> void:
	body = Sprite2D.new()
	body.texture = load(texture_path)
	body.centered = false
	body.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	body_image = body.texture.get_image()
	if body_image.is_compressed():
		body_image.decompress()
	var bounds := body_image.get_used_rect()
	var ratio := visual_height / maxf(float(bounds.size.y), 1.0)
	body.scale = Vector2.ONE * ratio
	base_position = -Vector2(float(bounds.position.x) + float(bounds.size.x) * 0.5, float(bounds.end.y)) * ratio
	body.position = base_position
	add_child(body)

func set_travel_distance(distance: float) -> void:
	gait_distance += distance

func set_facing(_direction: Vector2, _delta: float) -> void:
	pass

func set_motion(moving: bool, _working: bool, _delta: float) -> void:
	body.position = base_position + Vector2(0, -absf(sin(gait_distance * 0.18)) * 2.2 if moving else 0.0)

func hit_test(point: Vector2) -> bool:
	var pixel := Vector2i(body.to_local(point).floor())
	return Rect2i(Vector2i.ZERO, body_image.get_size()).has_point(pixel) and body_image.get_pixelv(pixel).a > 0.12
