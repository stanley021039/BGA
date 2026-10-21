/* Own-character expression management; uses the shared profile and dialog controls. */
(() => {
  let api,
    tools,
    edit,
    remove,
    pending = false,
    target = null,
    initialName = '';
  const el = (tag, text) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    return n;
  };
  const q = (dialog, s) => dialog.querySelector(s);
  function active() {
    if (!api.appearance()) return null;
    const character = api.character(),
      expression = api.appearance().expression;
    return character?.owned && character.id.startsWith('user:') && character.expressions[expression]
      ? { character, expression }
      : null;
  }
  function dirty() {
    return (
      !!edit?.open &&
      (q(edit, '[name="name"]').value !== initialName ||
        !!q(edit, '[name="image"]').files[0] ||
        !!q(edit, '[name="artwork"]').value)
    );
  }
  function refresh() {
    if (!tools) return;
    const a = active();
    tools.hidden = !a;
    tools.querySelector('[data-remove]').hidden = !a || a.expression === 'neutral';
    tools.querySelector('[data-caption]').textContent = a
      ? '管理「' + api.label(a.character, a.expression) + '」'
      : '';
  }
  function show(dialog, trigger) {
    window.GameUI.openDialog(dialog, trigger);
  }
  function busy(value) {
    pending = value;
    for (const d of [edit, remove]) {
      d.setAttribute('aria-busy', String(value));
      for (const n of d.querySelectorAll('button,input,select')) n.disabled = value;
    }
  }
  function close(d) {
    if (!pending) d.close();
  }
  function dialog(title, id, body) {
    const d = el('dialog');
    d.className = 'ui-dialog profile-expression-dialog';
    d.setAttribute('aria-labelledby', id);
    d.innerHTML = '<h2 id="' + id + '">' + title + '</h2>' + body;
    d.addEventListener('cancel', (e) => {
      if (pending) e.preventDefault();
    });
    d.querySelector('[data-cancel]').onclick = () => close(d);
    document.body.append(d);
    return d;
  }
  function openEdit(event) {
    const a = active();
    if (!a) return;
    target = { id: a.character.id, expression: a.expression };
    initialName = api.label(a.character, a.expression);
    const form = q(edit, 'form');
    form.reset();
    q(edit, '[name="name"]').value = initialName;
    q(edit, '[data-preview]').src = a.character.expressions[a.expression];
    q(edit, '[data-preview]').alt = initialName;
    const select = q(edit, '[name="artwork"]');
    select.replaceChildren(new Option('保留目前圖片', ''));
    for (const item of api.artworks()) select.append(new Option(item.name, item.id));
    q(edit, '.upload-status').textContent = '';
    show(edit, event.currentTarget);
  }
  async function save(event) {
    event.preventDefault();
    if (pending || !target) return;
    const original = { ...target },
      form = q(edit, 'form'),
      data = { name: q(edit, '[name="name"]').value.trim() },
      file = q(edit, '[name="image"]').files[0],
      artworkId = q(edit, '[name="artwork"]').value;
    busy(true);
    try {
      if (file) Object.assign(data, await api.imagePayload(file, form));
      else if (artworkId) data.artworkId = artworkId;
      q(edit, '.upload-status').textContent = '正在儲存…';
      await api.json(
        '/api/profile/characters/' +
          original.id.slice(5) +
          '/expressions/' +
          original.expression +
          '/edit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      initialName = data.name;
      q(edit, '[name="image"]').value = '';
      q(edit, '[name="artwork"]').value = '';
      edit.close();
      await api.refreshGallery();
      api.message('表情已更新。');
    } catch (error) {
      q(edit, '.upload-status').textContent = error.message || '儲存失敗，請重試。';
    } finally {
      busy(false);
      refresh();
    }
  }
  function openRemove(event) {
    const a = active();
    if (!a || a.expression === 'neutral') return;
    target = { id: a.character.id, expression: a.expression };
    q(remove, '[data-description]').textContent =
      '確定刪除「' +
      api.label(a.character, a.expression) +
      '」？圖片與音效會一併移除。使用此表情的角色與頭像會改回「平常」。';
    q(remove, '[role="status"]').textContent = '';
    show(remove, event.currentTarget);
  }
  async function destroy() {
    if (pending || !target || target.expression === 'neutral') return;
    const original = { ...target };
    busy(true);
    try {
      await api.json(
        '/api/profile/characters/' +
          original.id.slice(5) +
          '/expressions/' +
          original.expression +
          '/delete',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );
      api.removed(original);
      remove.close();
      await api.refreshGallery();
      api.message('表情已刪除，相關音效已移除。');
    } catch (error) {
      q(remove, '[role="status"]').textContent = error.message || '刪除失敗，請重試。';
    } finally {
      busy(false);
      refresh();
    }
  }
  function mount(options) {
    api = options;
    tools = el('div');
    tools.id = 'expression-tools';
    tools.className = 'ui-control-row';
    tools.hidden = true;
    const caption = el('span');
    caption.dataset.caption = '';
    tools.append(caption);
    for (const [icon, label, handler, key] of [
      ['edit', '編輯表情', openEdit, 'edit'],
      ['remove', '刪除表情', openRemove, 'remove'],
    ]) {
      const b = el('button');
      b.type = 'button';
      b.dataset[key] = '';
      window.GameUI.decorateButton(b, icon, { iconOnly: true, label });
      b.onclick = handler;
      tools.append(b);
    }
    document.querySelector('#expressions').after(tools);
    edit = dialog(
      '編輯表情',
      'expression-edit-title',
      '<form id="edit-character-expression"><label>表情名稱（1–20 字）<input name="name" maxlength="40" required autocomplete="off"></label><img data-preview class="profile-expression-preview" alt=""><label>更換圖片<input name="image" type="file" accept="image/png,image/gif,image/webp"></label><p>PNG、GIF 或 WebP，最多 4 MB；未選擇圖片會保留原圖。</p><label>或使用我的圖庫<select name="artwork"></select></label><p class="upload-status" role="status" aria-live="polite"></p><div data-dialog-actions><button type="submit">儲存表情</button><button type="button" data-cancel>取消</button></div></form>',
    );
    q(edit, 'form').onsubmit = save;
    q(edit, '[name="image"]').onchange = () => {
      q(edit, '.upload-status').textContent = '';
      if (q(edit, '[name="image"]').files[0]) q(edit, '[name="artwork"]').value = '';
    };
    q(edit, '[name="artwork"]').onchange = () => {
      q(edit, '.upload-status').textContent = '';
      if (q(edit, '[name="artwork"]').value) q(edit, '[name="image"]').value = '';
    };
    remove = dialog(
      '刪除表情',
      'expression-remove-title',
      '<p data-description></p><p role="status" aria-live="polite"></p><div data-dialog-actions><button type="button" data-confirm>刪除表情</button><button type="button" data-cancel>取消</button></div>',
    );
    q(remove, '[data-confirm]').onclick = destroy;
    q(remove, '[data-cancel]').setAttribute('autofocus', '');
    refresh();
  }
  window.ProfileExpressionEditor = { mount, refresh, hasUnsavedChanges: () => pending || dirty() };
})();
