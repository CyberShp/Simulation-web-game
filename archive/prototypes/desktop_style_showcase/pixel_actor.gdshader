shader_type spatial;
render_mode unshaded, cull_disabled, depth_prepass_alpha;

uniform sampler2D sprite_texture : source_color, filter_nearest, repeat_disable;
uniform float daylight : hint_range(0.0, 1.0) = 1.0;

void vertex() {
	// Match Sprite3D's camera-facing plane while keeping its foot at the origin.
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}

void fragment() {
	vec2 texel = 1.0 / vec2(textureSize(sprite_texture, 0));
	vec4 pixel = texture(sprite_texture, UV);
	float edge = max(max(texture(sprite_texture, UV + vec2(texel.x, 0.0)).a, texture(sprite_texture, UV - vec2(texel.x, 0.0)).a), max(texture(sprite_texture, UV + vec2(0.0, texel.y)).a, texture(sprite_texture, UV - vec2(0.0, texel.y)).a));
	vec3 levels = vec3(9.0, 10.0, 8.0);
	vec3 color = floor(pixel.rgb * levels + 0.5) / levels;
	ALBEDO = (pixel.a > 0.4 ? color : vec3(0.055, 0.075, 0.09)) * mix(0.53, 1.0, daylight);
	ALPHA = max(step(0.4, pixel.a), step(0.4, edge));
	ALPHA_SCISSOR_THRESHOLD = 0.5;
}
