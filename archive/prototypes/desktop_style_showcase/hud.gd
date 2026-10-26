extends Control

var font: Font = preload("res://assets/scene-labels.ttf")
var style := "d"
var clock := 0.0
var phase := 0
var cooldown := PackedFloat32Array()
var people := 2
var evening := 0.0
const INK = Color(0.025,0.050,0.057,0.88)
const GOLD = Color("ceba88")
const PALE = Color("eee9d9")
const GREEN = Color("83d6c8")
const TITLES = ["山院全景", "主殿与建筑", "人物与行走", "招式与护持", "多人同场交战", "暮色与灯火"]
const SUBTITLES = ["前庭 · 侧院 · 松溪河桥", "瓦脊、木构与石阶的实际空间", "同一人物 · 连续骨骼动作", "剑气、飞剑、护盾与落雷", "30 人同场 · 两方招式与范围预警", "日照转暗 · 灯笼和术法照亮近处"]
const SKILLS = ["青岚剑","飞剑","灵壁","雷印","回风","凝霜","踏云","引灵","破阵","解缚","归元","凝神"]

func set_state(s: String,t: float,p: int,cd: PackedFloat32Array,n: int,dusk: float) -> void:
	style=s; clock=t; phase=p; cooldown=cd; people=n; evening=dusk
	queue_redraw()

func _text(pos: Vector2,text: String,sz: int=20,color: Color=PALE) -> void:
	draw_string(font,pos,text,HORIZONTAL_ALIGNMENT_LEFT,-1,sz,color)

func _panel(rect: Rect2) -> void:
	draw_style_box(_box(),rect)

func _box() -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color=INK
	b.border_color=Color(0.65,0.58,0.39,0.6)
	b.set_border_width_all(1)
	b.set_corner_radius_all(5)
	return b

func _draw() -> void:
	var s := size/Vector2(1600,900)
	draw_set_transform(Vector2.ZERO,0,s)
	_panel(Rect2(32,28,323,98))
	_text(Vector2(50,58),"云岫山院",25,GOLD)
	_text(Vector2(50,91),"D · 国风 3D" if style=="d" else "E · 高清像素",24)
	_text(Vector2(229,112),"自动演示",13,Color("9aa9a3"))
	_panel(Rect2(1150,28,418,98))
	_text(Vector2(1172,57),"%02d / 06   %s" % [phase+1,TITLES[phase]],22,GOLD)
	_text(Vector2(1172,86),SUBTITLES[phase],15)
	for i in 6:
		draw_rect(Rect2(1173+i*60,107,50,2),GOLD if i<=phase else Color("35433f"))
	var progress := clampf(clock/72.0,0,1)
	draw_rect(Rect2(0,896,1600,4),Color("1c2829"))
	draw_rect(Rect2(0,896,1600*progress,4),GOLD)
	_text(Vector2(35,877),"同场景 · 同流程    %02d:%02d / 01:12" % [int(clock)/60,int(clock)%60],15)
	_text(Vector2(1364,877),"%d 人  ·  %s" % [people,"暮色" if evening>0.4 else "日间"],15)
	if phase >= 3 and phase <= 4:
		_panel(Rect2(34,703,264,135))
		_text(Vector2(54,734),"掌门",23,GOLD)
		_text(Vector2(225,733),"亲控",15,GREEN)
		_text(Vector2(54,761),"生命",14)
		draw_rect(Rect2(96,750,178,9),Color("283a34"))
		draw_rect(Rect2(96,750,168-sin(clock)*6,9),Color("74ad83"))
		_text(Vector2(54,790),"灵力",14)
		draw_rect(Rect2(96,779,178,8),Color("273b43"))
		draw_rect(Rect2(96,779,135+sin(clock*0.8)*18,8),Color("76b3c7"))
		_text(Vector2(54,820),"演示数值 · 招式自动施放",14,Color("a3b7ad"))
		_panel(Rect2(474,719,654,153))
		for i in 12:
			var row := i/6
			var col := i%6
			var r := Rect2(486+float(col)*105,729+float(row)*68,96,61)
			draw_rect(r,Color("122c30"))
			draw_rect(r,Color(0.5,0.66,0.60,0.5),false,1)
			var c := Vector2(r.position.x+27,r.position.y+26)
			_icon(c,i,Color("82cfc3") if i%3!=2 else GOLD)
			_text(Vector2(r.position.x+52,r.position.y+24),str(col+1) if row==0 else "⇧"+str(col+1),14,Color("aebcae"))
			_text(Vector2(r.position.x+13,r.position.y+53),SKILLS[i],15)
			if cooldown.size()>i and cooldown[i]>0:
				draw_rect(r,Color(0.015,0.025,0.03,0.72))
				_text(Vector2(r.position.x+26,r.position.y+35),"%.1f" % cooldown[i],26,PALE)
		_panel(Rect2(1150,770,272,102))
		_text(Vector2(1167,793),"法宝             丹药",14,GOLD)
		for i in 4:
			var c := Vector2(1181+i*65,826)
			draw_circle(c,19,Color("294146"))
			_icon(c,i+3,GOLD)
			_text(c+Vector2(-7,34),["F","G","R","T"][i],12)

func _icon(c: Vector2,i: int,color: Color) -> void:
	match i%6:
		0:
			draw_line(c+Vector2(-12,13),c+Vector2(13,-15),color,3,true)
			draw_line(c+Vector2(-13,4),c+Vector2(-3,14),color,2,true)
			draw_arc(c,19,-1.3,0.5,18,color,1.5,true)
		1:
			for j in 3: draw_line(c+Vector2(-12+j*7,12),c+Vector2(-5+j*7,-12),color,2,true)
		2:
			draw_arc(c,16,0,TAU,32,color,2,true)
			draw_arc(c,10,0,TAU,24,color,1,true)
		3:
			draw_polyline(PackedVector2Array([c+Vector2(4,-17),c+Vector2(-9,1),c+Vector2(6,0),c+Vector2(-5,18)]),color,2.5,true)
		4:
			for j in 3: draw_arc(c+Vector2(0,j*6-6),13,3.4,6.0,20,color,1.5,true)
		5:
			for j in 6:
				var d := Vector2.from_angle(float(j)*TAU/6)*16
				draw_line(c,c+d,color,1.8,true)
