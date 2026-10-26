extends Node3D
## Presentation effects. The director owns time and supplies feet in world-root coordinates.

const RIBBON = preload("res://shaders/effects-ribbon.gdshader")
const MAX_EFFECTS := 28
const MAX_LIGHTS := 4
const GROUND_Y := 0.12
const GOLD := Color(1.0, 0.88, 0.56, 0.92)
const IVORY := Color(1.0, 0.98, 0.85, 0.98)
const JADE := Color(0.21, 0.83, 0.77, 0.68)
const VERMILION := Color(0.93, 0.32, 0.18, 0.68)

var _pixel_style := false
var _effects: Array[Dictionary] = []
var _serial := 0


func setup(pixel_style: bool = false) -> void:
	for effect: Dictionary in _effects:
		_destroy(effect)
	_effects.clear()
	_pixel_style = pixel_style
	_serial = 0
	set_process(false)


func emit_effect(kind: String, from: Vector3, to: Vector3, team: int = 0) -> void:
	if not kind in ["sword", "bolt", "ward", "seal", "dash"]:
		return
	if _effects.size() >= MAX_EFFECTS:
		_destroy(_effects.pop_front())
	var holder := Node3D.new()
	holder.name = "Effect_%s_%d" % [kind, _serial]
	_serial += 1
	add_child(holder)
	var direction := Vector3(to.x - from.x, 0.0, to.z - from.z)
	if direction.length_squared() < 0.0001:
		direction = Vector3.FORWARD * -1.0
	direction = direction.normalized()
	var accent: Color = JADE if team % 2 == 0 else VERMILION
	var life: float = {"sword":0.58, "bolt":0.76, "ward":2.5, "seal":1.8, "dash":0.7}[kind]
	var effect := {"root":holder, "kind":kind, "age":0.0, "life":life, "materials":[],
		"from":from, "to":to, "direction":direction, "yaw":atan2(direction.x, direction.z), "light":null}
	holder.position = to if kind == "seal" else from
	if kind in ["sword", "bolt"]:
		holder.rotation.y = effect.yaw
	match kind:
		"sword": _sword(effect, accent)
		"bolt": _bolt(effect, accent)
		"ward": _ward(effect, accent)
		"seal": _seal(effect, accent)
		"dash": _dash(effect, accent)
	_effects.append(effect)
	_update(effect)


func advance(delta: float) -> void:
	if delta <= 0.0 or not is_finite(delta):
		return
	for index: int in range(_effects.size() - 1, -1, -1):
		var effect: Dictionary = _effects[index]
		effect.age += delta
		if effect.age >= effect.life:
			_destroy(effect)
			_effects.remove_at(index)
		else:
			_update(effect)


func _destroy(effect: Dictionary) -> void:
	var holder: Node3D = effect.root
	if is_instance_valid(holder):
		remove_child(holder)
		holder.free()


func _update(effect: Dictionary) -> void:
	var age: float = effect.age
	if _pixel_style:
		age = floorf(age * 12.0) / 12.0
	for material: ShaderMaterial in effect.materials:
		material.set_shader_parameter("effect_age", age)
	var holder: Node3D = effect.root
	match effect.kind:
		"sword":
			holder.rotation.y = effect.yaw + lerpf(-0.35, 0.3, minf(age / 0.22, 1.0))
		"bolt":
			var progress := clampf(age / 0.62, 0.0, 1.0)
			holder.position = (effect.from as Vector3).lerp(effect.to, progress)
		"ward":
			holder.rotation.y = age * 0.28
		"seal":
			holder.rotation.y = minf(age, 1.0) * 0.18
	var light: OmniLight3D = effect.light
	if is_instance_valid(light):
		var strength := 0.0
		match effect.kind:
			"sword", "bolt": strength = maxf(0.0, 1.0 - age / effect.life) * 0.65
			"ward": strength = sin(minf(age / 0.2, 1.0) * PI / 2.0) * minf((2.5 - age) / 0.4, 1.0) * 0.24
			"seal": strength = 0.10 if age < 1.0 else maxf(0.0, 1.0 - (age - 1.0) / 0.65) * 1.1
		light.light_energy = strength


func _sword(effect: Dictionary, accent: Color) -> void:
	var veil := _geometry()
	_arc(veil, 1.58, 0.19, 0.85, -1.35, 0.92, 0.50)
	_layer(effect, veil, Color(accent, 0.24), 0.0, 0.48, 0.13)
	var edge := _geometry()
	_arc(edge, 1.62, 0.026, 0.86, -1.28, 0.91)
	_arc(edge, 1.46, 0.025, 0.83, -1.10, 0.65, 0.64)
	_layer(effect, edge, IVORY, 0.015, 0.38, 0.11)
	var filaments := _geometry()
	_arc(filaments, 1.86, 0.028, 0.80, -1.0, 0.52, 0.65)
	_arc(filaments, 1.28, 0.022, 0.92, -0.85, 0.88, 0.8)
	_sparks(filaments, Vector3(0.92, 0.88, 1.12), 0.56, 7, 0.06)
	_layer(effect, filaments, GOLD, 0.04, 0.58)
	_light(effect, accent, Vector3(0.0, 1.05, 0.75), 3.0)


func _bolt(effect: Dictionary, accent: Color) -> void:
	var core := _geometry()
	_diamond(core, Vector3(0.0, 1.12, 0.36), Vector3(0.055, 0.055, 0.62))
	_stroke(core, Vector3(-0.19, 1.12, -0.05), Vector3(0.19, 1.12, -0.05), 0.035)
	_layer(effect, core, IVORY, 0.0, 0.73)
	var stream := _geometry()
	_stroke(stream, Vector3(0.0, 1.12, -1.7), Vector3(0.0, 1.12, 0.38), 0.10, 0.48)
	for sign_value: float in [-1.0, 1.0]:
		var prior := Vector3(sign_value * 0.20, 1.1, -1.85)
		for i: int in range(1, 13):
			var t := float(i) / 12.0
			var point := Vector3(sign_value * sin(t * PI) * 0.16, 1.1 + sin(t * TAU) * 0.07, -1.85 + t * 2.0)
			_stroke(stream, prior, point, 0.027, t)
			prior = point
	_layer(effect, stream, accent, 0.0, 0.76)
	var motes := _geometry()
	_sparks(motes, Vector3(0.0, 1.12, -0.75), 0.68, 8, 0.045)
	_layer(effect, motes, GOLD, 0.04, 0.68)
	_light(effect, accent, Vector3(0.0, 1.1, 0.0), 2.5)


func _ward(effect: Dictionary, accent: Color) -> void:
	var rings := _geometry()
	_arc(rings, 0.91, 0.026, 0.22, 0.0, TAU)
	_arc(rings, 1.04, 0.022, 1.04, 0.0, TAU)
	for offset: float in [0.0, PI / 2.0]:
		for i: int in range(36):
			var a := TAU * float(i) / 36.0
			var b := TAU * float(i + 1) / 36.0
			var p := Vector3(cos(a) * cos(offset), sin(a) * 1.05 + 1.1, cos(a) * sin(offset))
			var q := Vector3(cos(b) * cos(offset), sin(b) * 1.05 + 1.1, cos(b) * sin(offset))
			_stroke(rings, p, q, 0.022, 0.58)
	_layer(effect, rings, accent, 0.0, 2.5, 0.0, 5.0)
	var marks := _geometry()
	for i: int in range(8):
		var angle := TAU * float(i) / 8.0
		var center := Vector3(sin(angle), 0.75 if i % 2 == 0 else 1.42, cos(angle))
		_sigils(marks, center, angle, 0.16)
	_layer(effect, marks, GOLD, 0.08, 2.45, 0.0, 3.0)
	var foot := _geometry()
	_arc(foot, 0.67, 0.017, GROUND_Y, 0.0, TAU)
	for i: int in range(12):
		var angle := float(i) * TAU / 12.0
		_stroke(foot, Vector3(sin(angle), 0.13, cos(angle)) * Vector3(0.79, 1.0, 0.79),
			Vector3(sin(angle), 0.13, cos(angle)) * Vector3(0.89, 1.0, 0.89), 0.025)
	_layer(effect, foot, IVORY, 0.0, 2.25)
	_light(effect, accent, Vector3(0.0, 0.9, 0.0), 2.7)


func _seal(effect: Dictionary, accent: Color) -> void:
	var boundary := _geometry()
	_arc(boundary, 2.14, 0.035, GROUND_Y, 0.0, TAU)
	_arc(boundary, 1.85, 0.02, GROUND_Y + 0.01, 0.0, TAU)
	for i: int in range(24):
		var angle := float(i) * TAU / 24.0
		var axis := Vector3(sin(angle), 0.0, cos(angle))
		_stroke(boundary, axis * 1.98 + Vector3.UP * 0.14, axis * (2.12 if i % 3 else 2.24) + Vector3.UP * 0.14, 0.035)
	_layer(effect, boundary, accent, 0.0, 1.65, 0.0, 9.0)
	var runes := _geometry()
	_arc(runes, 1.16, 0.025, GROUND_Y + 0.025, 0.0, TAU)
	for i: int in range(8):
		var angle := float(i) * TAU / 8.0
		var axis := Vector3(sin(angle), 0.0, cos(angle))
		var tangent := Vector3(cos(angle), 0.0, -sin(angle))
		var center := axis * 1.54 + Vector3.UP * 0.16
		for row: int in range(3):
			var midpoint := center + axis * (float(row) - 1.0) * 0.09
			if (row + i) % 3 == 0:
				_stroke(runes, midpoint - tangent * 0.20, midpoint - tangent * 0.055, 0.035)
				_stroke(runes, midpoint + tangent * 0.055, midpoint + tangent * 0.20, 0.035)
			else:
				_stroke(runes, midpoint - tangent * 0.20, midpoint + tangent * 0.20, 0.035)
		_stroke(runes, axis * 0.68 + Vector3.UP * 0.15, axis.rotated(Vector3.UP, PI / 4.0) * 0.68 + Vector3.UP * 0.15, 0.024)
	_layer(effect, runes, GOLD, 0.1, 1.8, 0.65, 6.0)
	var strike := _geometry()
	var last := Vector3(0.0, 5.5, 0.0)
	for i: int in range(1, 10):
		var point := Vector3(sin(float(i) * 8.3) * 0.22, 5.5 - float(i) * 0.59, cos(float(i) * 6.7) * 0.17)
		_stroke(strike, last, point, 0.055, 1.0, true)
		last = point
	_arc(strike, 0.72, 0.06, GROUND_Y + 0.07, 0.0, TAU)
	_sparks(strike, Vector3(0.0, 0.25, 0.0), 1.5, 16, 0.06)
	_layer(effect, strike, IVORY, 1.0, 1.58)
	var pillar := _geometry()
	_stroke(pillar, Vector3(0.0, 0.18, 0.0), Vector3(0.0, 4.0, 0.0), 0.20, 0.25, true)
	_arc(pillar, 1.03, 0.028, 0.24, 0.0, TAU)
	_arc(pillar, 1.48, 0.025, 0.22, 0.0, TAU)
	_layer(effect, pillar, accent, 1.05, 1.8)
	_light(effect, accent, Vector3(0.0, 0.85, 0.0), 4.0)


func _dash(effect: Dictionary, accent: Color) -> void:
	var start: Vector3 = effect.from
	var end: Vector3 = effect.to
	var local_end := end - start
	var side := Vector3(effect.direction.z, 0.0, -effect.direction.x)
	var trail := _geometry()
	for offset: float in [-0.18, 0.18]:
		_stroke(trail, side * offset + Vector3.UP * 0.28, local_end + side * offset + Vector3.UP * 0.28, 0.035, 0.65)
	_layer(effect, trail, accent, 0.0, 0.65)
	var ghosts := _geometry()
	for i: int in range(5):
		var t := float(i) / 5.0
		var feet := local_end * t
		var opacity := (1.0 - t) * 0.48 + 0.12
		_stroke(ghosts, feet + side * 0.30 + Vector3.UP * 0.30, feet + side * 0.16 + Vector3.UP * 1.42, 0.075, opacity)
		_stroke(ghosts, feet - side * 0.30 + Vector3.UP * 0.30, feet - side * 0.16 + Vector3.UP * 1.42, 0.075, opacity)
		_stroke(ghosts, feet - side * 0.16 + Vector3.UP * 1.42, feet + side * 0.16 + Vector3.UP * 1.42, 0.06, opacity)
		_diamond(ghosts, feet + Vector3.UP * 1.66, Vector3(0.10, 0.14, 0.10), opacity)
	_layer(effect, ghosts, Color(accent, 0.4), 0.0, 0.7)
	var glints := _geometry()
	for i: int in range(7):
		_diamond(glints, local_end * float(i) / 7.0 + side * sin(float(i) * 2.3) * 0.3 + Vector3.UP * 0.35, Vector3(0.04, 0.10, 0.04))
	_layer(effect, glints, GOLD, 0.02, 0.48)


func _geometry() -> Dictionary:
	return {"vertices":PackedVector3Array(), "colors":PackedColorArray(), "uvs":PackedVector2Array()}


func _quad(data: Dictionary, a: Vector3, b: Vector3, c: Vector3, d: Vector3, alpha: float = 1.0, u: float = 0.0, v: float = 1.0) -> void:
	for index: int in [0, 1, 2, 0, 2, 3]:
		var point: Vector3 = [a, b, c, d][index]
		if _pixel_style:
			point = point.snapped(Vector3.ONE * 0.025)
		data.vertices.append(point)
		data.colors.append(Color(1.0, 1.0, 1.0, alpha))
		data.uvs.append(Vector2(u if index < 2 else v, 0.0 if index % 3 == 0 else 1.0))


func _stroke(data: Dictionary, a: Vector3, b: Vector3, width: float, alpha: float = 1.0, crossed: bool = false) -> void:
	if _pixel_style:
		width = maxf(width, 0.05)
	var direction := (b - a).normalized()
	var side := direction.cross(Vector3.UP).normalized()
	if side.length_squared() < 0.01:
		side = Vector3.RIGHT
	var half := side * width * 0.5
	_quad(data, a - half, a + half, b + half, b - half, alpha)
	if crossed:
		half = direction.cross(side).normalized() * width * 0.5
		_quad(data, a - half, a + half, b + half, b - half, alpha)


func _arc(data: Dictionary, radius: float, width: float, height: float, start: float, finish: float, alpha: float = 1.0) -> void:
	if _pixel_style:
		width = maxf(width, 0.05)
	var count := maxi(4, int(absf(finish - start) / TAU * (32.0 if _pixel_style else 96.0)))
	for i: int in range(count):
		var a := lerpf(start, finish, float(i) / count)
		var b := lerpf(start, finish, float(i + 1) / count)
		var axis_a := Vector3(sin(a), 0.0, cos(a))
		var axis_b := Vector3(sin(b), 0.0, cos(b))
		var up := Vector3.UP * height
		_quad(data, axis_a * (radius - width * 0.5) + up, axis_a * (radius + width * 0.5) + up,
			axis_b * (radius + width * 0.5) + up, axis_b * (radius - width * 0.5) + up,
			alpha, float(i) / count, float(i + 1) / count)


func _diamond(data: Dictionary, center: Vector3, size: Vector3, alpha: float = 1.0) -> void:
	if _pixel_style:
		_quad(data, center + Vector3(-size.x, -size.y, 0.0), center + Vector3(size.x, -size.y, 0.0),
			center + Vector3(size.x, size.y, 0.0), center + Vector3(-size.x, size.y, 0.0), alpha)
		_quad(data, center + Vector3(-size.x, 0.0, -size.z), center + Vector3(size.x, 0.0, -size.z),
			center + Vector3(size.x, 0.0, size.z), center + Vector3(-size.x, 0.0, size.z), alpha)
	else:
		_quad(data, center + Vector3(-size.x, 0.0, 0.0), center + Vector3(0.0, size.y, 0.0),
			center + Vector3(size.x, 0.0, 0.0), center - Vector3(0.0, size.y, 0.0), alpha)
		_quad(data, center + Vector3(-size.x, 0.0, 0.0), center + Vector3(0.0, 0.0, size.z),
			center + Vector3(size.x, 0.0, 0.0), center - Vector3(0.0, 0.0, size.z), alpha)


func _sparks(data: Dictionary, center: Vector3, radius: float, count: int, size: float) -> void:
	for i: int in range(count):
		var angle := float(i) * 2.399963
		var distance := radius * (0.35 + 0.65 * float(i + 1) / count)
		var point := center + Vector3(cos(angle) * distance, sin(float(i) * 1.7) * radius * 0.25, sin(angle) * distance)
		_diamond(data, point, Vector3(size, size * (1.0 if _pixel_style else 2.2), size), 0.5 + float(i % 3) * 0.2)


func _sigils(data: Dictionary, center: Vector3, angle: float, scale_value: float) -> void:
	var tangent := Vector3(cos(angle), 0.0, -sin(angle)) * scale_value
	var up := Vector3.UP * scale_value
	_stroke(data, center - up, center + up, 0.022)
	_stroke(data, center + up, center + tangent * 0.7 + up * 0.4, 0.022)
	_stroke(data, center - tangent * 0.7, center + tangent * 0.7, 0.022)
	_stroke(data, center - up * 0.45, center - tangent * 0.65 - up * 0.8, 0.022)


func _layer(effect: Dictionary, data: Dictionary, color: Color, begins: float, ends: float, reveal: float = 0.0, pulse: float = 0.0) -> void:
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = data.vertices
	arrays[Mesh.ARRAY_COLOR] = data.colors
	arrays[Mesh.ARRAY_TEX_UV] = data.uvs
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var material := ShaderMaterial.new()
	material.shader = RIBBON
	material.set_shader_parameter("tint", color)
	material.set_shader_parameter("begins", begins)
	material.set_shader_parameter("ends", ends)
	material.set_shader_parameter("attack", 0.025 if effect.kind != "ward" else 0.15)
	material.set_shader_parameter("release", minf((ends - begins) * 0.55, 0.40))
	material.set_shader_parameter("pulse_speed", pulse)
	material.set_shader_parameter("reveal_seconds", reveal)
	material.set_shader_parameter("emission_strength", 0.7 if _pixel_style else 1.1)
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	instance.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
	effect.root.add_child(instance)
	effect.materials.append(material)


func _light(effect: Dictionary, color: Color, point: Vector3, reach: float) -> void:
	if _pixel_style:
		return
	var existing := 0
	for other: Dictionary in _effects:
		if is_instance_valid(other.light):
			existing += 1
	if existing >= MAX_LIGHTS:
		return
	var light := OmniLight3D.new()
	light.position = point
	light.light_color = Color(color, 1.0)
	light.light_energy = 0.0
	light.omni_range = reach
	light.omni_attenuation = 1.6
	light.shadow_enabled = false
	effect.root.add_child(light)
	effect.light = light
