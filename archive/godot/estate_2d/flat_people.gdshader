shader_type canvas_item;

uniform vec4 exclude_region = vec4(0.0);

// Visible art and alpha hit tests use the same authored silhouette threshold.
void fragment() {
	vec4 painted = texture(TEXTURE, UV);
	vec2 pixel = UV / TEXTURE_PIXEL_SIZE;
	if (pixel.x >= exclude_region.x && pixel.y >= exclude_region.y
			&& pixel.x < exclude_region.x + exclude_region.z
			&& pixel.y < exclude_region.y + exclude_region.w) {
		discard;
	}
	if (painted.a < 0.12549) {
		discard;
	}
}
