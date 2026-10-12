const $ = s => document.querySelector(s);
const state = { me: null, posts: [], friends: [], adminPosts: [], section: null, editing: null, busy: false };
const names = { music: 'Music', dance: 'Ballroom', journal: 'Journal', friends: '朋友管理', articles: '文章权限', preview: '读者预览' };
const policies = { self: '仅自己', section: '该栏目的朋友', selected: '指定朋友', circle: 'Journal 圈' };
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const variant = post => post.variants[$('#language').value] || Object.values(post.variants)[0];
function status(text, error = false) { $('#status').textContent = text; $('#status').classList.toggle('error', error); }
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  if (response.redirected || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('登录已过期，请刷新页面重新登录。');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作失败，请重试。');
  return data;
}
const put = (path, value) => api(path, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(value) });
async function action(callback) {
  if (state.busy) return;
  state.busy = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await callback(); } catch (error) { status(error.message, true); }
  finally { state.busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
async function load() {
  state.me = await api('/api/me');
  state.posts = (await api('/api/posts')).posts;
  if (state.me.owner) {
    const [friends, posts] = await Promise.all([api('/api/admin/friends'), api('/api/admin/posts')]);
    state.friends = friends.friends; state.adminPosts = posts.posts;
  }
  $('#identity').textContent = `${state.me.email}${state.me.owner ? ' · 网站所有者' : ''}`;
  renderNavigation(); renderFriends(); renderAdmin();
}
function renderNavigation() {
  const sections = ['music','dance','journal'].filter(s => state.me.owner || state.posts.some(p => p.section === s));
  if (state.me.owner) sections.push('friends','articles','preview');
  if (!sections.includes(state.section)) state.section = sections[0] || null;
  $('#navigation').hidden = !sections.length;
  $('#navigation').innerHTML = sections.map(s => `<button type="button" data-section="${s}" aria-pressed="${state.section === s}">${names[s]}</button>`).join('');
  showSection();
}
function showSection() {
  for (const s of ['friends','articles','preview']) $(`#${s}`).hidden = state.section !== s;
  $('#content').hidden = ['friends','articles','preview'].includes(state.section);
  $('#editor').hidden = true;
  document.querySelectorAll('[data-section]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.section === state.section)));
  if (!$('#content').hidden) renderPosts();
  if (state.section === 'preview') renderPreview().catch(error => status(error.message, true));
}
function renderPosts() {
  const posts = state.posts.filter(p => p.section === state.section);
  $('#content').innerHTML = posts.map(p => `<article class="panel"><h2 class="post-title">${escape(variant(p).title)}</h2><div class="actions"><button type="button" data-read="${p.id}">阅读</button><span class="meta">${escape(p.updated_at.slice(0,10))}</span>${state.me.owner ? `<span class="tag">${policies[p.visibility]}</span>` : ''}</div></article>`).join('') || '<p>目前没有可阅读的文章。</p>';
}
async function read(id) {
  const post = await api(`/api/posts/${encodeURIComponent(id)}`);
  const text = variant(post);
  const article = document.createElement('article'); article.className = 'panel';
  const back = document.createElement('button'); back.type = 'button'; back.textContent = '返回列表'; back.addEventListener('click', renderPosts);
  const title = document.createElement('h2'); title.textContent = text.title;
  const body = document.createElement('div'); body.className = 'article-text'; body.textContent = text.body;
  article.append(back,title,body);
  for (const media of post.media) {
    const element = document.createElement(media.type.startsWith('video/') ? 'video' : media.type.startsWith('audio/') ? 'audio' : 'img');
    if (element.tagName === 'IMG') element.alt = text.title;
    else { element.controls = true; element.preload = 'metadata'; }
    element.src = `/api/media/${encodeURIComponent(id)}/${encodeURIComponent(media.file)}`;
    article.append(element);
  }
  $('#content').replaceChildren(article);
}
function renderFriends() {
  $('#friends-list').innerHTML = state.friends.map((f,i) => `<form class="panel friend-form" data-friend="${i}"><h3>${escape(f.name)}</h3><div class="meta">${escape(f.email)} · ${f.active ? '已获准' : '已撤销'}</div><div class="checks">${[['active','允许访问'],['music','Music'],['dance','Ballroom'],['journal','Journal 圈']].map(([k,t]) => `<label><input type="checkbox" name="${k}" ${f[k] ? 'checked' : ''}>${t}</label>`).join('')}</div><div class="actions"><button type="submit">保存权限</button><button type="button" data-revoke="${i}">撤销全部访问</button></div></form>`).join('');
  const previous = $('#preview-person').value;
  $('#preview-person').innerHTML = `<option value="">选择朋友</option><option value="${escape(state.me?.email || '')}">我自己</option>` + state.friends.map(f => `<option value="${escape(f.email)}">${escape(f.name)}${f.active ? '' : '（已撤销）'}</option>`).join('');
  if ([...$('#preview-person').options].some(o => o.value === previous)) $('#preview-person').value = previous;
}
function renderAdmin() {
  $('#admin-posts').innerHTML = state.adminPosts.map(p => `<div class="panel actions"><h3>${escape(variant(p).title)}</h3><span class="tag">${names[p.section]} · ${policies[p.visibility]}</span><button type="button" data-edit="${p.id}">编辑与授权</button></div>`).join('') || '<p>写下第一篇文章，默认仅自己可见。</p>';
}
async function renderPreview() {
  const email = $('#preview-person').value;
  $('#preview-content').replaceChildren();
  if (!email) return;
  const { posts } = await api(`/api/posts?as=${encodeURIComponent(email)}`);
  if ($('#preview-person').value !== email) return;
  $('#preview-content').innerHTML = `<p>此身份可见的栏目与文章标题：</p>${['music','dance','journal'].filter(s => posts.some(p => p.section === s)).map(s => `<div class="panel"><h3>${names[s]}</h3>${posts.filter(p => p.section === s).map(p => `<p>${escape(variant(p).title)}</p>`).join('')}</div>`).join('') || '<p>没有可见文章。</p>'}`;
}
function setVisibilityOptions(section, selected = 'self') {
  const choices = section === 'journal' ? ['self','selected','circle'] : ['self','section','selected'];
  $('#post-form').elements.visibility.innerHTML = choices.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${policies[v]}</option>`).join('');
  $('#reader-choices').hidden = $('#post-form').elements.visibility.value !== 'selected';
}
function edit(post = null) {
  state.editing = post?.id || null;
  const form = $('#post-form'); form.reset();
  form.elements.id.disabled = !!post;
  form.elements.id.value = post?.id || '';
  form.elements.section.value = post?.section || 'journal';
  setVisibilityOptions(form.elements.section.value, post?.visibility || 'self');
  for (const lang of ['zh','en']) {
    form.elements[`${lang}-title`].value = post?.variants[lang]?.title || '';
    form.elements[`${lang}-body`].value = post?.variants[lang]?.body || '';
  }
  $('#reader-checkboxes').innerHTML = state.friends.filter(f => f.active).map(f => `<label><input type="checkbox" name="reader" value="${escape(f.email)}" ${post?.readers.includes(f.email) ? 'checked' : ''}> ${escape(f.name)}</label>`).join('') || '<p>先添加朋友，再设置逐篇授权。</p>';
  $('#editor').hidden = false; $('#upload-panel').hidden = !post;
  $('#editor').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start' });
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || state.busy) return;
  if (b.dataset.section) { state.section = b.dataset.section; showSection(); }
  if (b.dataset.read) action(() => read(b.dataset.read));
  if (b.dataset.edit) edit(state.adminPosts.find(p => p.id === b.dataset.edit));
  if (b.id === 'new-post') edit();
  if (b.id === 'close-editor') $('#editor').hidden = true;
  if (b.dataset.revoke !== undefined) action(async () => {
    const f = state.friends[Number(b.dataset.revoke)];
    await put('/api/admin/friends', { email:f.email, name:f.name, active:false, music:!!f.music, dance:!!f.dance, journal:!!f.journal });
    await load(); status('已撤销访问。新的文章与媒体请求会被拒绝。');
  });
});
document.addEventListener('submit', e => {
  e.preventDefault(); if (state.busy) return;
  const form = e.target;
  if (form.getAttribute('id') === 'add-friend') action(async () => {
    await put('/api/admin/friends', { name:form.elements.name.value, email:form.elements.email.value.trim(), active:true, music:true, dance:true, journal:false });
    form.reset(); await load(); status('朋友已添加。请把此空间链接发给对方；Journal 默认未开放。');
  });
  if (form.classList.contains('friend-form')) action(async () => {
    const f = state.friends[Number(form.dataset.friend)];
    await put('/api/admin/friends', { email:f.email, name:f.name, ...Object.fromEntries(['active','music','dance','journal'].map(k => [k,form.elements[k].checked])) });
    await load(); status('朋友权限已保存。');
  });
  if (form.getAttribute('id') === 'post-form') action(async () => {
    const id = state.editing || form.elements.id.value;
    const variants = {};
    for (const lang of ['zh','en']) {
      const title = form.elements[`${lang}-title`].value.trim(), body = form.elements[`${lang}-body`].value;
      if (!title && body) throw new Error('有正文的语言版本需要填写标题。');
      if (title) variants[lang] = { title,body };
    }
    await put(`/api/admin/posts/${encodeURIComponent(id)}`, { section:form.elements.section.value, visibility:form.elements.visibility.value, variants, readers:[...form.querySelectorAll('[name=reader]:checked')].map(x => x.value) });
    await load(); edit(state.adminPosts.find(p => p.id === id)); status('文章与权限已保存。');
  });
  if (form.getAttribute('id') === 'media-form') action(async () => {
    const file = $('#media-file').files[0];
    if (!file || !state.editing) throw new Error('请先保存文章，再选择文件。');
    if (file.size > 50 * 1024 * 1024) throw new Error('单个文件最大 50 MiB。');
    const extension = { 'video/mp4':'mp4','audio/mpeg':'mp3','audio/mp4':'m4a','audio/wav':'wav','image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[file.type];
    if (!extension) throw new Error('暂不支持这个媒体格式。');
    const id = state.editing;
    const name = `${crypto.randomUUID()}.${extension}`;
    await api(`/api/admin/posts/${id}/media/${name}`, { method:'PUT',headers:{'Content-Type':file.type},body:file });
    await load(); edit(state.adminPosts.find(p => p.id === id)); status('媒体已上传，与文章共用访问权限。');
  });
});
$('#post-form').elements.section.addEventListener('change', e => setVisibilityOptions(e.target.value));
$('#post-form').elements.visibility.addEventListener('change', e => $('#reader-choices').hidden = e.target.value !== 'selected');
$('#preview-person').addEventListener('change', () => action(renderPreview));
$('#language').addEventListener('change', () => { renderAdmin(); if (state.section === 'preview') action(renderPreview); else if (!$('#content').hidden) renderPosts(); });
action(async () => { await load(); status(''); });
