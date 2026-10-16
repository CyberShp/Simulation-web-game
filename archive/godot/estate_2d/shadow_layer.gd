extends Node2D

# Shadows live on their own ground layer; no building shadow is baked into the terrain.
var footprints: Array[Dictionary] = []

func set_footprints(next: Array[Dictionary]) -> void:
	footprints = next
	queue_redraw()

func _ellipse(center: Vector2, radius: Vector2) -> PackedVector2Array:
	var points := PackedVector2Array()
	for index in range(32):
		var angle := TAU * float(index) / 32.0
		points.append(center + Vector2(cos(angle) * radius.x, sin(angle) * radius.y))
	return points

func _draw() -> void:
	for footprint in footprints:
		var centre: Vector2 = footprint.center
		var width: float = footprint.width
		var length: float = footprint.length
		for ring in range(4, 0, -1):
			var spread := float(ring) * 5.0
			var alpha := 0.035 if ring > 1 else 0.10
			draw_colored_polygon(_ellipse(centre + Vector2(18, 10), Vector2(width * 0.52 + spread, length + spread)), Color(0.09, 0.11, 0.09, alpha))
		# The roof projects a short shadow to the lower right, separate from its base.
		var cast := PackedVector2Array([
			centre + Vector2(-width * 0.40, -6), centre + Vector2(width * 0.40, -6),
			centre + Vector2(width * 0.53 + 38, 17), centre + Vector2(-width * 0.27 + 38, 17)
		])
		draw_colored_polygon(cast, Color(0.08, 0.10, 0.08, 0.12))
