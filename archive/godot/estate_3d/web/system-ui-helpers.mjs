/** Shared U-120 UI helpers; rendering never changes simulation state. */
export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const amount = value => Number.isFinite(Number(value)) ? String(Number(Number(value).toFixed(2))) : '0';
export function portrait(person, large=false) {
  const index = person?.appearance;
  const cls = `system-portrait ${large?'system-portrait-large':''}`;
  return Number.isInteger(index) && index >= 0 && index < 6
    ? `<span class="${cls}" role="img" aria-label="${escape(person.name)}" style="--portrait-x:${index%3*50}%;--portrait-y:${Math.floor(index/3)*100}%"></span>`
    : `<span class="${cls} portrait-monogram" aria-label="${escape(person?.name)}">${escape(person?.name?.slice(-1)||'人')}</span>`;
}
export function bar(label,value,max=100,tone='jade') {
  return `<div class="system-meter meter-${escape(tone)}"><span>${escape(label)}</span><div><i style="width:${Math.max(0,Math.min(100,(Number(value)||0)/Math.max(1,Number(max)||1)*100))}%"></i></div><b>${amount(value)}<small> / ${amount(max)}</small></b></div>`;
}
export function icon(kind) {
    const paths={
      person:'<circle cx="24" cy="12" r="6"/><path d="M14 37l3-17 7 5 7-5 3 17M17 20L9 31m22-11 8 11M19 36l-2 7m12-7 2 7"/>',
      sword:'<path d="M35 5l8 0-1 8-21 22-7-7Z"/><path d="M34 9L17 29M11 26l12 12M15 33l-8 8m-3-3 6 6"/>',
      book:'<path d="M11 7h26v34H11zM15 7v34M20 13h11M20 18h11M21 24h9M21 29h9"/><path d="M8 10v29"/>',
      scroll:'<path d="M13 8h22v29H13zM10 8h6m16 0h6M10 37h6m16 0h6M18 14h12m-12 6h12m-12 6h7"/>',
      herb:'<path d="M22 42Q27 22 21 8M24 25C8 23 6 14 8 10c11-2 18 7 16 15ZM24 32c15-1 19-10 16-16-12 0-17 7-16 16Z"/>',
      pill:'<path d="M18 8h12v6H18zM19 14c0 7-7 9-7 18 0 7 4 10 12 10s12-3 12-10c0-9-7-11-7-18"/><path d="M13 29h22M20 23h8m-6 10h4"/>',
      wood:'<path d="M10 17L31 7l8 22-22 11Z"/><ellipse cx="15" cy="29" rx="6" ry="11" transform="rotate(-20 15 29)"/><path d="M19 19l13-6m-10 14 14-6"/>',
      stone:'<path d="M6 28l8-15 17-6 12 14-6 17-21 3Z"/><path d="M14 13l10 10 19-2M24 23l-8 18m8-18 13 15"/>',
      jade:'<path d="M24 4l14 9 3 17-17 15L7 30l3-17Z"/><path d="M24 4l-7 18 7 23 7-23ZM10 13l7 9-10 8m31-17-7 9 10 8"/>',
      robe:'<path d="M17 7l7 6 7-6 12 14-8 7-4-6 4 20H13l4-20-4 6-8-7Z"/><path d="M17 7l10 21-3 14m7-35-7 16m-10 8h20"/>',
      boot:'<path d="M16 6h17l-2 23 10 6v7H9v-8l8-7Z"/><path d="M17 13h15M17 20h15M10 37h30"/>',
      ring:'<circle cx="24" cy="28" r="13"/><path d="M17 13l7-9 7 9-7 8Z"/><path d="M18 28a6 6 0 0 0 12 0"/>',
      cauldron:'<path d="M10 20h28l-2 15c-3 5-21 5-24 0ZM7 20c-8 0-3 14 5 12m26-12c8 0 3 14-5 12M17 39l-3 6m17-6 3 6M13 15h22M21 8l3-4 3 4"/><path d="M23 23l-5 6 6 6 6-6-7-6"/>',
      forge:'<path d="M7 26h34l-8 8h-7v7H13v-7H9ZM25 7l10-2 7 13-9 4Zm3 13-10 8M7 41h25"/>',
      puppet:'<circle cx="24" cy="10" r="6"/><path d="M18 20h12v15H18ZM18 22l-9 5-4-7m25 2 9 5 4-7M20 35l-8 9m16-9 8 9"/><circle cx="24" cy="26" r="3"/>',
      build:'<path d="M6 23l18-13 18 13M8 20h32M13 24v16m22-16v16M9 40h30M20 40V27h8v13M24 5v6"/>',
      mountain:'<path d="M4 39L18 14l8 11 7-19 12 33ZM11 27l7-3 5 7m7-15 4 5 4-2"/>',
      flag:'<path d="M11 44V5m1 3h26l-6 9 6 9H12"/><path d="M18 14h9m-9 6h12"/>',
      food:'<path d="M7 27h34c-2 12-7 16-17 16S9 39 7 27Zm6-7c-2-6 5-6 3-12m8 12c-2-6 5-6 3-12m8 12c-2-6 5-6 3-12"/>'
    };
    return `<svg class="game-icon icon-${kind}" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[kind]||paths.scroll}</svg>`;
  }
