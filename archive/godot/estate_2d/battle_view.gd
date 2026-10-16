extends Node2D
## Combat telegraphs and effects display the shared battle state.

var battle: Dictionary = {}
var font: Font

func _ready() -> void:
	font = load("res://estate_2d/assets/scene-labels.ttf")

func update_battle(value: Dictionary) -> void:
	battle = value
	visible = not battle.is_empty()
	queue_redraw()

func point(value: Dictionary) -> Vector2:
	var origin: Dictionary = battle.get("sceneFrame", {}).get("origin", {})
	return Vector2(80.0 + (float(origin.get("x", 0)) + float(value.get("x", 0))) * 21.0, 100.0 + (float(origin.get("y", 0)) + float(value.get("y", 0))) * 16.0)

func _draw() -> void:
	if battle.is_empty():
		return
	var player: Dictionary = battle.get("player", {})
	var p := point(player)
	if float(player.get("guard", 0)) > 0:
		draw_arc(p - Vector2(0, 24), 39.0, 0, TAU, 48, Color(0.5, 0.87, 0.8, 0.85), 3.0, true)
	if float(player.get("evade", 0)) > 0:
		draw_arc(p, 31.0, PI, TAU, 22, Color("daf4ee"), 4.0, true)
	for enemy in battle.get("enemies", []):
		var e := point(enemy)
		if float(enemy.get("hp", 0)) > 0:
			draw_rect(Rect2(e + Vector2(-31, -96), Vector2(62, 5)), Color("493528"))
			draw_rect(Rect2(e + Vector2(-31, -96), Vector2(62 * float(enemy.hp) / maxf(float(enemy.maxHp), 1.0), 5)), Color("ca7250"))
		var warning: Variant = enemy.get("telegraph", null)
		if warning is Dictionary:
			var centre := point(warning)
			var radius := float(warning.get("radius", 1.35)) * 21.0
			var fill := 1.0 - float(warning.get("remaining", 0)) / maxf(float(warning.get("total", 1)), 0.01)
			draw_circle(centre, radius, Color(0.82, 0.22, 0.13, 0.15 + fill * 0.22))
			draw_arc(centre, radius, -PI / 2, -PI / 2 + TAU * fill, 36, Color("f3a168"), 3.0, true)
			draw_string(font, e + Vector2(-58, -110), str(warning.get("kind", "")), HORIZONTAL_ALIGNMENT_CENTER, 116, 18, Color("f1d5a6"))
	for effect in battle.get("effects", []):
		var from := point(effect.get("from", {})) - Vector2(0, 25)
		var to := point(effect.get("to", {})) - Vector2(0, 25)
		var alpha := clampf(float(effect.get("remaining", 0)) / maxf(float(effect.get("total", 1)), 0.01), 0, 1)
		var ink := Color(0.72, 0.92, 0.84, alpha)
		if str(effect.get("kind", "")) in ["impact", "strike", "damage"]:
			ink = Color(0.97, 0.66, 0.39, alpha)
		draw_line(from, to, ink, 3.0 + alpha * 3.0, true)
		draw_arc(to, (1 - alpha) * 26 + 5, 0, TAU, 20, ink, 2.0, true)
		if float(effect.get("amount", 0)) > 0:
			draw_string(font, to + Vector2(-22, -26 - (1 - alpha) * 32), str(roundi(float(effect.amount))), HORIZONTAL_ALIGNMENT_CENTER, 44, 22, ink)
