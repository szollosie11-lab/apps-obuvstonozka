const [catalogue, translations] = await Promise.all([
  fetch('media.json').then(response => response.json()),
  fetch('media-i18n.json').then(response => response.json())
]);
const words = () => translations[document.documentElement.lang] || translations.en;
const dialog = document.createElement('dialog');
dialog.className = 'media-dialog';
dialog.setAttribute('aria-labelledby', 'media-heading');
dialog.innerHTML = `<header class="media-heading"><h2 id="media-heading"></h2><button type="button" class="media-close"></button></header><div class="media-stage"></div><div class="media-navigation"><button type="button" class="media-prev"></button><span class="media-counter" aria-live="polite"></span><button type="button" class="media-next"></button></div><div class="media-picker"></div><p class="media-note"></p>`;
document.body.append(dialog);
const stage = dialog.querySelector('.media-stage');
const picker = dialog.querySelector('.media-picker');
let items = [], position = 0, gameName = '', opener;
function stopMedia() {
  stage.querySelectorAll('video').forEach(video => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  stage.replaceChildren();
}
function showItem(index) {
  stopMedia();
  position = (index + items.length) % items.length;
  const item = items[position], t = words();
  const element = document.createElement(item.type === 'video' ? 'video' : 'img');
  if (item.type === 'video') {
    element.controls = true;
    element.playsInline = true;
    element.preload = 'none';
    element.poster = item.poster;
    element.setAttribute('aria-label', `${gameName} — ${t[1]}`);
  } else {
    element.alt = `${gameName} — ${t[7]} ${position + 1}`;
  }
  element.src = item.file;
  stage.append(element);
  dialog.querySelector('.media-counter').textContent = `${position + 1} / ${items.length}`;
  dialog.querySelector('.media-note').textContent = t[item.type === 'video' ? 6 : 5];
  [...picker.children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === position)));
}
function openGallery(card, index, button) {
  const data = catalogue[card.id];
  if (!data?.images.length) return;
  opener = button;
  gameName = card.querySelector('h3').textContent;
  items = data.images.map(file => ({type: 'image', file}));
  if (data.video) items.push({type: 'video', file: data.video, poster: data.poster});
  const t = words();
  dialog.querySelector('h2').textContent = gameName;
  dialog.querySelector('.media-close').textContent = `${t[2]} ×`;
  dialog.querySelector('.media-prev').textContent = `← ${t[3]}`;
  dialog.querySelector('.media-next').textContent = `${t[4]} →`;
  picker.replaceChildren();
  items.forEach((item, i) => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.setAttribute('aria-label', `${item.type === 'video' ? t[1] : t[7]} ${i + 1}`);
    if (item.type === 'video') choice.textContent = `▶ ${t[1]}`;
    else {
      const image = document.createElement('img');
      image.src = item.file;
      image.alt = '';
      image.loading = 'lazy';
      choice.append(image);
    }
    choice.onclick = () => showItem(i);
    picker.append(choice);
  });
  showItem(index);
  dialog.showModal();
  document.body.classList.add('media-open');
}
dialog.querySelector('.media-close').onclick = () => dialog.close();
dialog.querySelector('.media-prev').onclick = () => showItem(position - 1);
dialog.querySelector('.media-next').onclick = () => showItem(position + 1);
dialog.addEventListener('close', () => {
  stopMedia();
  document.body.classList.remove('media-open');
  if (opener?.isConnected) opener.focus();
});
dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }
});
dialog.addEventListener('keydown', event => {
  if (event.target.tagName === 'VIDEO') return;
  if (event.key === 'ArrowLeft') {event.preventDefault(); showItem(position - 1);}
  if (event.key === 'ArrowRight') {event.preventDefault(); showItem(position + 1);}
});
function decorateCards() {
  document.querySelectorAll('#cards > .card').forEach(card => {
    if (card.querySelector('.media-tools')) return;
    const data = catalogue[card.id];
    if (!data?.images.length) return;
    const t = words(), name = card.querySelector('h3').textContent;
    const tools = document.createElement('div');
    tools.className = 'media-tools';
    const thumbs = document.createElement('div');
    thumbs.className = 'media-thumbs';
    data.images.slice(0, 3).forEach((file, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `${name} — ${t[7]} ${index + 1}`);
      const image = document.createElement('img');
      image.src = file;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 48;
      image.height = 58;
      button.append(image);
      button.onclick = () => openGallery(card, index, button);
      thumbs.append(button);
    });
    const actions = document.createElement('div');
    actions.className = 'media-buttons';
    const gallery = document.createElement('button');
    gallery.type = 'button';
    gallery.textContent = `${t[0]} · ${data.images.length}`;
    gallery.setAttribute('aria-label', `${name} — ${t[0]} · ${data.images.length}`);
    gallery.onclick = () => openGallery(card, 0, gallery);
    actions.append(gallery);
    if (data.video) {
      const video = document.createElement('button');
      video.type = 'button';
      video.className = 'media-video-link';
      video.textContent = `▶ ${t[1]}`;
      video.setAttribute('aria-label', `${name} — ${t[1]}`);
      video.onclick = () => openGallery(card, data.images.length, video);
      actions.append(video);
    }
    tools.append(thumbs, actions);
    card.querySelector('.body').insertBefore(tools, card.querySelector('.downloads'));
  });
}
document.addEventListener('click', event => {
  const cover = event.target.closest('#cards > .card .cover');
  if (!cover) return;
  const card = cover.closest('.card');
  if (catalogue[card.id]?.images.length) {
    event.preventDefault();
    openGallery(card, 0, cover);
  }
});
new MutationObserver(decorateCards).observe(document.getElementById('cards'), {childList: true});
decorateCards();
