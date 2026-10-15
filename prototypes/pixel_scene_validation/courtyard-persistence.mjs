/** SR-XF-030 / PERSIST-02: keep save failure protection separate from user pause. */
export function createCourtyardPersistence({ getSnapshot, saveSnapshot, exportSnapshot, onStateChange = () => {}, now = () => Date.now() }) {
  if (typeof getSnapshot !== 'function' || typeof saveSnapshot !== 'function') throw new TypeError('Snapshot and save callbacks are required');
  const state = { protected: false, saving: false, pending: 0, error: null, lastSavedAt: null, lastSavedTick: null, recoveryExportedAt: null, recoveryPath: null };
  let queue = Promise.resolve();
  let exporting = null;
  const status = () => ({ ...state, exporting: !!exporting });
  // A display callback cannot change whether the disk write actually succeeded.
  const notify = () => { try { onStateChange(status()); } catch {} };
  const errorText = error => error?.message || String(error || '保存失败');
  const blocked = () => ({ ok: false, protected: true, error: state.error || '本次变化尚未保存，请重试保存或导出恢复文件。' });
  function save({ reason = 'manual' } = {}) {
    if (!['auto', 'manual', 'closing', 'retry'].includes(reason)) return Promise.resolve({ ok: false, error: '未知保存请求。' });
    if (state.protected && reason !== 'retry') return Promise.resolve(blocked());
    if (reason === 'auto' && state.pending) return Promise.resolve({ ok: false, busy: true });
    state.pending++;
    notify();
    const result = queue.then(async () => {
      // A queued close/manual save must not silently clear a preceding failure.
      if (state.protected && reason !== 'retry') return blocked();
      state.saving = true;
      notify();
      try {
        // Read at execution time so a queued close saves the latest frozen world.
        const snapshot = structuredClone(getSnapshot());
        const receipt = await saveSnapshot(snapshot);
        if (receipt?.ok !== true) throw Error(receipt?.error || '保存失败');
        state.lastSavedAt = now();
        state.lastSavedTick = snapshot?.state?.worldTick ?? snapshot?.worldTick ?? null;
        if (reason === 'retry') { state.protected = false; state.error = null; }
        return { ...receipt, protected: state.protected, savedTick: state.lastSavedTick };
      } catch (error) {
        state.protected = true;
        state.error = errorText(error);
        return blocked();
      } finally {
        state.saving = false;
      }
    }).finally(() => { state.pending--; notify(); });
    queue = result.then(() => undefined, () => undefined);
    return result;
  }
  function exportRecovery() {
    if (exporting) return exporting;
    if (typeof exportSnapshot !== 'function') return Promise.resolve({ ok: false, error: '恢复文件导出尚未接入。' });
    // Export is a separate destination. It never marks the primary save current
    // or removes protection, including when the user cancels the native dialog.
    exporting = Promise.resolve().then(async () => {
      try {
        const snapshot = structuredClone(getSnapshot());
        const receipt = await exportSnapshot(snapshot);
        if (receipt?.cancelled) return { ok: false, cancelled: true };
        if (receipt?.ok !== true) throw Error(receipt?.error || '恢复文件导出失败');
        state.recoveryExportedAt = now();
        state.recoveryPath = receipt.path || null;
        return receipt;
      } catch (error) { return { ok: false, error: errorText(error) }; }
    }).finally(() => { exporting = null; notify(); });
    notify();
    return exporting;
  }
  return { save, retry: () => save({ reason: 'retry' }), exportRecovery, status, waitForIdle: () => queue };
}
