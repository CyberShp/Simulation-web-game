shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec4 tint : source_color = vec4(0.55, 0.57, 0.53, 1.0);
uniform float surface_kind = 0.0;
uniform float grain_strength = 0.1;
uniform bool pixel_style = false;
varying vec3 world_position;

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
               mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
void vertex() {
    world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
    vec3 p = world_position;
    if (pixel_style) { p = floor(p * 8.0) / 8.0; }
    float broad = noise21(p.xz * 0.32);
    float grain = noise21(p.xz * 8.0 + p.y * 0.7);
    float variation = (broad - 0.5) * grain_strength + (grain - 0.5) * grain_strength * 0.45;
    vec3 base = tint.rgb * COLOR.rgb;
    if (surface_kind > 0.5 && surface_kind < 1.5) {
        // Limestone veins are broad enough to remain stable in a moving camera.
        float vein = smoothstep(0.83, 0.99, noise21(p.xz * vec2(0.48, 2.8)));
        base *= 1.0 - vein * 0.12;
    }
    if (surface_kind > 1.5 && surface_kind < 2.5) {
        float wood = noise21(vec2(p.x * 14.0 + p.z * 11.0, p.y * 0.6));
        base *= 0.87 + wood * 0.22;
    }
    ALBEDO = max(base + vec3(variation), vec3(0.015));
    ROUGHNESS = surface_kind > 3.5 ? 0.60 + grain * 0.16 : (surface_kind > 2.5 ? 0.88 : 0.78);
    SPECULAR = 0.25;
}
