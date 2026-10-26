extends Node

const LENGTH := 72.0
const ENV_SCRIPT = preload("res://environment.gd")
const EFFECTS_SCRIPT = preload("res://effects.gd")
const HUD_SCRIPT = preload("res://hud.gd")
var style := "d"
var both := true
var elapsed := 0.0
var stop_at := -1.0
var seek := 0.0
var capture_dir := ""
var viewport: SubViewport
var world: Node3D
var scenery: Node3D
var effects: Node3D
var camera: Camera3D
var sun: DirectionalLight3D
var environment: Environment
var display: TextureRect
var hud: Control
var actors: Array[Node3D] = []
var fired := {}
var captures := {}
var cooldown := PackedFloat32Array()
var frames := 0
var frame_samples: Array[float] = []
var started_at := 0
var sampled_seconds := 0.0
var stage := -1
var switching := false

func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--style="):
			style = arg.get_slice("=", 1)
			both = style == "both"
			if both: style = "d"
		if arg.begins_with("--capture-dir="): capture_dir = arg.trim_prefix("--capture-dir=")
		if arg.begins_with("--duration="): stop_at = arg.get_slice("=", 1).to_float()
		if arg.begins_with("--start="): seek = arg.get_slice("=", 1).to_float()
	if not capture_dir.is_empty(): DirAccess.make_dir_recursive_absolute(capture_dir)
	viewport = SubViewport.new()
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	display = TextureRect.new()
	display.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	display.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	display.texture = viewport.get_texture()
	add_child(display)
	hud = HUD_SCRIPT.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(hud)
	cooldown.resize(12)
	_build()
	elapsed = seek
	started_at = Time.get_ticks_msec()
	print("SHOWCASE_START ", style, " actors=30 native=true recording=", OS.has_feature("movie"))

func _build() -> void:
	var pixel := style == "pixel"
	viewport.size = Vector2i(640,360) if pixel else Vector2i(1600,900)
	viewport.msaa_3d = Viewport.MSAA_DISABLED if pixel else Viewport.MSAA_4X
	display.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST if pixel else CanvasItem.TEXTURE_FILTER_LINEAR
	world = Node3D.new()
	viewport.add_child(world)
	environment = Environment.new()
	environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("567a91")
	sky_material.sky_horizon_color = Color("bccac8")
	sky_material.ground_horizon_color = Color("a7b7b1")
	sky_material.ground_bottom_color = Color("394943")
	sky_material.sky_curve = 0.18
	sky.sky_material = sky_material
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("c4d2d8")
	environment.ambient_light_energy = 0.6
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.tonemap_exposure = 1.0
	environment.ssao_enabled = not pixel
	environment.ssao_radius = 1.0
	environment.ssao_intensity = 1.4
	environment.glow_enabled = true
	environment.glow_intensity = 0.45 if pixel else 0.65
	environment.glow_bloom = 0.04
	environment.glow_hdr_threshold = 1.2
	environment.fog_enabled = true
	environment.fog_light_color = Color("a3b9b8")
	environment.fog_density = 0.0018
	var we := WorldEnvironment.new()
	we.environment = environment
	world.add_child(we)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-43,-34,0)
	sun.light_color = Color("ffe2b0")
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 170
	sun.shadow_bias = 0.04
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	world.add_child(sun)
	scenery = ENV_SCRIPT.new()
	world.add_child(scenery)
	scenery.build(pixel)
	effects = EFFECTS_SCRIPT.new()
	world.add_child(effects)
	effects.setup(pixel)
	camera = Camera3D.new()
	camera.fov = 43
	camera.near = 0.1
	camera.far = 1000
	world.add_child(camera)
	camera.current = true
	var actor_script = load("res://pixel_actor.gd" if pixel else "res://actor.gd")
	for i in 30:
		var actor: Node3D = actor_script.new()
		world.add_child(actor)
		actor.setup(i == 0 or i % 5 == 0, 0 if i < 15 else 1, pixel)
		actors.append(actor)
	_update_scene(0.0)

func _process(delta: float) -> void:
	if switching: return
	elapsed += delta
	frames += 1
	if elapsed > 2.0:
		frame_samples.append(delta * 1000.0)
		sampled_seconds += delta
	if elapsed >= LENGTH:
		_finish_metrics()
		if both:
			switching = true
			call_deferred("_switch_style")
			return
		elif stop_at < 0:
			_reset()
		else:
			get_tree().quit()
			return
	_update_scene(delta)
	if stop_at > 0 and elapsed - seek >= stop_at:
		_finish_metrics()
		get_tree().quit()
	if not capture_dir.is_empty():
		for moment in [5,16,25,37,48,57,68]:
			if elapsed >= float(moment) and not captures.has(moment):
				captures[moment] = true
				_capture(moment)

func _reset() -> void:
	elapsed = 0.0
	fired.clear()
	captures.clear()
	cooldown.fill(0.0)
	frames = 0
	frame_samples.clear()
	sampled_seconds = 0.0
	started_at = Time.get_ticks_msec()

func _switch_style() -> void:
	world.queue_free()
	actors.clear()
	await get_tree().process_frame
	style = "pixel" if style == "d" else "d"
	_reset()
	_build()
	switching = false
	print("SHOWCASE_SWITCH ", style)

func _update_scene(delta: float) -> void:
	var t := elapsed
	var phase := 0 if t < 11 else (1 if t < 21 else (2 if t < 32 else (3 if t < 44 else (4 if t < 62 else 5))))
	if phase != stage:
		stage = phase
		print("SHOWCASE_PHASE ", style, " ", stage, " t=", snappedf(t,0.1))
	var evening := smoothstep(62.0, 70.0, t)
	sun.light_energy = lerpf(1.3,0.32,evening)
	sun.light_color = Color("ffe1b0").lerp(Color("e5a173"),evening)
	sun.rotation_degrees = Vector3(lerpf(-43,-12,evening),lerpf(-34,-56,evening),0)
	environment.ambient_light_color = Color("c4d2d8").lerp(Color("6b86b4"), evening)
	environment.ambient_light_energy = lerpf(0.6,0.35,evening)
	environment.fog_light_color = Color("a3b9b8").lerp(Color("667c98"),evening)
	if scenery.has_method("set_daylight"): scenery.set_daylight(1.0-evening)
	_place_actors(t, phase)
	_camera(t, phase)
	for actor in actors:
		if actor.has_method("face_camera"): actor.face_camera(camera)
		if actor.has_method("set_lighting"): actor.set_lighting(1.0-evening)
	_effect_timeline(t)
	effects.advance(delta)
	for i in 12: cooldown[i] = maxf(0.0,cooldown[i]-delta)
	hud.set_state(style,t,phase,cooldown,30 if t>=44 else 2, evening)

func _place_actors(t: float, phase: int) -> void:
	for i in 30:
		var actor := actors[i]
		var pos := Vector3.ZERO
		var movement := 0.0
		var action := 0
		actor.visible = i < 2 or t >= 43.0
		if i == 0:
			var walk := clampf((t-21.0)/9.0,0,1)
			pos = Vector3(-8,0.12,21).lerp(Vector3(-4,0.12,13),walk)
			movement = 1.0 if t >= 21 and t < 30 else 0.0
			actor.rotation.y = atan2(4.0,-8.0) if movement > 0 else PI/2.0
			if t>=44:
				pos = Vector3(-4+sin(t*0.4)*1.4,0.12,13+cos(t*0.4)*1.4)
				movement = 0.5
				actor.rotation.y = PI/2.0
			if (t>=32.5 and t<34.0) or (t>=37.0 and t<38.2): action = 1
			if (t>=34.8 and t<36.0) or (t>=39.5 and t<42.0): action = 2
			if t>=44 and fmod(t,3.8)<1.2: action = 2
		elif i == 1:
			pos = Vector3(4,0.12,13)
			actor.rotation.y = -PI/2.0
			if t>=32 and t<44: action = 2 if fmod(t,5.0)<1.5 else 0
			if t>=44:
				pos.x += sin(t*0.6)*1.2
				pos.z += cos(t*0.6)*1.2
				movement = 0.5
				action = 1 if fmod(t,3.2)<1 else 0
		else:
			var team := 0 if i < 15 else 1
			var n := i-2 if team == 0 else i-15
			var row := n / 5
			var col := n % 5
			var x := (-14.0 if team == 0 else 7.0)+float(col)*1.8
			var z := 4.0+float(row)*7.0
			var arrival := smoothstep(43.0,47.0,t)
			pos = Vector3(x+(-7.0 if team==0 else 7.0)*(1.0-arrival),0.12,z)
			pos.x += sin(t*0.6+float(i))*0.65*arrival
			pos.z += cos(t*0.5+float(i))*0.7*arrival
			actor.rotation.y = PI/2.0 if team == 0 else -PI/2.0
			movement = 1.0 if t<47 else 0.25
			action = 1+(i%2) if fmod(t+float(i)*0.67,4.5)<1.35 else 0
		if phase == 5:
			movement = 0.0
			action = 0
		actor.position = pos
		actor.pose(t+float(i)*0.19,movement,action)

func _camera(t: float, phase: int) -> void:
	var p: Vector3
	var target: Vector3
	if phase == 0:
		var u := smoothstep(0,11,t)
		p = Vector3(57,47,69).lerp(Vector3(40,33,48),u)
		target = Vector3(0,2,-9)
	elif phase == 1:
		var u := smoothstep(11,21,t)
		p = Vector3(21,13,4).lerp(Vector3(-14,10,3),u)
		target = Vector3(0,6,-23)
	elif phase == 2:
		var u := smoothstep(21,32,t)
		var a := actors[0].position
		p = a+Vector3(5.5-u*2.5,3.0,7.0)
		target = a+Vector3(0,1.05,0)
	elif phase == 3:
		var u := smoothstep(32,44,t)
		p = Vector3(13,14,32).lerp(Vector3(17,18,35),u)
		target = Vector3(0,0.6,13)
	elif phase == 4:
		var u := smoothstep(44,62,t)
		p = Vector3(24,31,46).lerp(Vector3(-21,31,46),u)
		target = Vector3(0,1,13)
	else:
		var u := smoothstep(62,72,t)
		p = Vector3(31,22,35).lerp(Vector3(47,34,55),u)
		target = Vector3(0,3,-10)
	camera.position = p
	camera.look_at(target)

func _effect_timeline(t: float) -> void:
	_event("sword_a",32.7,"sword",0,1,0,0)
	_event("bolt_a",35.0,"bolt",0,1,0,1)
	_event("ward_b",35.3,"ward",1,1,1,2)
	_event("sword_b",37.2,"sword",0,1,0,0)
	_event("bolt_b",38.0,"bolt",1,0,1,1)
	_event("seal_a",40.0,"seal",0,1,0,3)
	_event("ward_a",40.4,"ward",0,0,0,2)
	if t>=45 and t<61.5:
		var beat := int((t-45.0)/1.4)
		var key := "group_%s" % beat
		if not fired.has(key):
			fired[key] = true
			for n in 4:
				var source := 2+(beat*3+n*2)%13
				var target := 15+(beat+n*3)%15
				if n%2==1:
					var swap := source
					source = target
					target = swap
				effects.emit_effect("bolt" if n<3 else "sword",actors[source].position,actors[target].position,0 if source<15 else 1)
			if beat%3==0:
				effects.emit_effect("seal",actors[0].position,Vector3(6,0.12,9+float(beat%4)*2),0)
				cooldown[3]=8.0
			if beat%4==0:
				effects.emit_effect("ward",actors[0].position,actors[0].position,0)
				cooldown[2]=6.0
			cooldown[beat%2] = 3.0

func _event(key: String, when: float, kind: String, source: int, target: int, team: int, slot: int) -> void:
	if elapsed>=when and not fired.has(key):
		fired[key]=true
		effects.emit_effect(kind,actors[source].position,actors[target].position,team)
		cooldown[slot] = [3.5,4.0,6.0,8.0][slot]
		print("SHOWCASE_EFFECT ",style," ",key," ",kind)

func _capture(moment: int) -> void:
	await RenderingServer.frame_post_draw
	if is_inside_tree():
		var path := capture_dir.path_join("%s-%02d.png" % [style,moment])
		get_viewport().get_texture().get_image().save_png(path)
		print("SHOWCASE_CAPTURE ",path)

func _finish_metrics() -> void:
	if capture_dir.is_empty(): return
	frame_samples.sort()
	var p95 := frame_samples[int(float(frame_samples.size()-1)*0.95)] if not frame_samples.is_empty() else 0.0
	var data := {"style":style,"engine":Engine.get_version_info().string,"native_os":OS.get_name(),"movie_mode":OS.has_feature("movie"),"elapsed_demo_seconds":elapsed,"wall_seconds":float(Time.get_ticks_msec()-started_at)/1000.0,"frame_count":frames,"mean_fps_after_warmup":float(frame_samples.size())/maxf(sampled_seconds,0.01),"p95_frame_ms":p95,"actors":30,"render_size":str(viewport.size),"events":fired.keys(),"phase":stage}
	var file := FileAccess.open(capture_dir.path_join(style+"-metrics.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(data,"\t"))
	print("SHOWCASE_METRICS ",JSON.stringify(data))

func _unhandled_key_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"): get_tree().quit()
