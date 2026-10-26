shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec4 shallow_color : source_color = vec4(0.12, 0.36, 0.35, 1.0);
uniform vec4 deep_color : source_color = vec4(0.035, 0.15, 0.19, 1.0);
uniform float daylight = 1.0;
uniform bool pixel_style = false;
varying vec3 world_position;

void vertex() {
    world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    VERTEX.y += sin(world_position.z * 0.55 + TIME * 0.65) * 0.035;
}
void fragment() {
    vec2 p = world_position.xz;
    if (pixel_style) { p = floor(p * 6.0) / 6.0; }
    float current = sin(p.y * 1.8 + p.x * 0.4 - TIME * 1.3);
    float detail = sin(p.y * 5.6 - p.x * 0.9 - TIME * 1.1);
    float stripe = smoothstep(0.92, 1.0, current * 0.75 + detail * 0.25);
    float pool = 0.5 + 0.5 * sin(p.x * 0.7 + sin(p.y * 0.12));
    ALBEDO = mix(deep_color.rgb, shallow_color.rgb, pool * 0.6 + 0.18);
    ALBEDO += vec3(0.18, 0.25, 0.22) * stripe * daylight;
    NORMAL_MAP = vec3(0.5 + 0.08 * current, 0.5 + 0.07 * detail, 1.0);
    NORMAL_MAP_DEPTH = 0.35;
    ROUGHNESS = 0.27;
    METALLIC = 0.12;
    SPECULAR = 0.7;
}
