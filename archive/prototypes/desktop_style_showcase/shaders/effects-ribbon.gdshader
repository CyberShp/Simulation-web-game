shader_type spatial;
render_mode unshaded, cull_disabled, blend_mix, depth_draw_never, shadows_disabled;

uniform vec4 tint : source_color = vec4(0.4, 0.95, 0.85, 0.8);
uniform float effect_age = 0.0;
uniform float begins = 0.0;
uniform float ends = 1.0;
uniform float attack = 0.05;
uniform float release = 0.25;
uniform float emission_strength = 1.1;
uniform float pulse_speed = 0.0;
uniform float reveal_seconds = 0.0;

void fragment() {
	float fade_in = smoothstep(begins, begins + attack, effect_age);
	float fade_out = 1.0 - smoothstep(max(begins + attack, ends - release), ends, effect_age);
	float pulse = pulse_speed > 0.0 ? 0.84 + 0.16 * sin((effect_age - begins) * pulse_speed) : 1.0;
	float reveal = reveal_seconds > 0.0 ? smoothstep(UV.x - 0.07, UV.x + 0.07, (effect_age - begins) / reveal_seconds) : 1.0;
	vec3 ink = tint.rgb * COLOR.rgb;
	ALBEDO = ink;
	EMISSION = ink * emission_strength * pulse;
	ALPHA = tint.a * COLOR.a * fade_in * fade_out * reveal;
}
