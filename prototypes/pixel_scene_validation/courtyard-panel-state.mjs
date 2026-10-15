/** Read-only UI choices for the courtyard's public projections. */
export function transportLimit(available, retained = 0) {
  const amount = Number.isFinite(available) ? available : 0;
  const reserve = Number.isFinite(retained) ? Math.max(0, retained) : 0;
  return Math.min(40, Math.max(0, amount - reserve));
}

export function transportQuantity(value, available, retained = 0) {
  const quantity = Number(value), maximum = transportLimit(available, retained);
  return Number.isFinite(quantity) && quantity >= 1 && quantity <= maximum ? quantity : null;
}

export function filterPeople(people, { query = '', scope = 'all', activity = 'all', ids = null } = {}) {
  const needle = query.trim().toLocaleLowerCase('zh-CN');
  return people.filter(person => (!ids || ids.includes(person.id)) &&
    (scope === 'all' || (scope === 'resident' ? person.resident : !person.resident)) &&
    (activity === 'all' || (activity === 'attention'
      ? person.wound > 0 || ['blocked', 'waiting', 'paused'].includes(person.activityDetail?.phase)
      : activity === 'indoor' ? person.indoor : person.activity === activity || person.activityDetail?.kind === activity)) &&
    (!needle || [person.name, person.role, person.activityLabel, person.location?.label].some(text => String(text || '').toLocaleLowerCase('zh-CN').includes(needle))));
}

export function filterArts(arts, { query = '', kind = 'all', access = 'all' } = {}) {
  const needle = query.trim().toLocaleLowerCase('zh-CN');
  return arts.filter(art => (kind === 'all' || art.kind === kind) &&
    (access === 'all' || (access === 'learned' ? art.understanding > 0 : access === 'readable' ? art.access !== false : art.access === false)) &&
    (!needle || [art.name, art.kindLabel, art.purpose, art.source].some(text => String(text || '').toLocaleLowerCase('zh-CN').includes(needle))));
}

export function sameBuilding(left, right) {
  return left != null && right != null && String(left).replace(/^building:yunxiu:/, '') === String(right).replace(/^building:yunxiu:/, '');
}
