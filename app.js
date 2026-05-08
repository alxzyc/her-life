/* Her Life — App Logic */

const state = {
  user: null,
  contacts: [],
  map: null,
  userMarker: null,
  routeLayer: null,
  routeMarkers: [],
  userLatLng: null,
  activityLayer: null,
  activity: {
    active: false,
    path: [],
    watchId: null,
    startTime: null,
    lastShareAt: 0
  }
};

function toast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


async function saveLocationToBackend(latitude, longitude, source = 'manual') {
  try {
    await fetch('/.netlify/functions/save-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: state.user?.email || 'anon@herlife.local',
        userName: state.user?.name || 'Usuária',
        latitude,
        longitude,
        source,
        timestamp: Date.now()
      })
    });
  } catch (err) {
    console.warn('Falha ao salvar localização no backend:', err);
  }
}

function loginApp() {
  const name = document.getElementById('login-name').value.trim();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const fb = document.getElementById('login-feedback');

  if (!name || !email) return (fb.textContent = 'Preencha seu nome e e-mail para continuar.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (fb.textContent = 'Informe um e-mail válido.');

  fb.textContent = '';
  state.user = { name, email };
  document.getElementById('welcome').textContent = `Bem-vinda, ${name}! 💜`;
  document.getElementById('login-overlay').classList.remove('open');
  loadContactsFromStorage();
  toast(`Bem-vinda, ${name}! Você está protegida. 💜`);
}

function initMap() {
  const defaultCenter = [-16.6869, -49.2648];
  state.map = L.map('map-home', { zoomControl: true, attributionControl: true }).setView(defaultCenter, 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(state.map);

  refreshUserLocation();
}

function refreshUserLocation() {
  if (!navigator.geolocation) {
    addDefaultMarker([-16.6869, -49.2648]);
    document.getElementById('chip-location-text').textContent = 'Geolocalização não suportada';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      state.userLatLng = [latitude, longitude];

      if (state.userMarker) state.map.removeLayer(state.userMarker);
      const userIcon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;background:linear-gradient(135deg,#E8558A,#7C3AED);border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      state.userMarker = L.marker(state.userLatLng, { icon: userIcon }).addTo(state.map).bindPopup('<strong>Você está aqui</strong>');
      state.map.setView(state.userLatLng, 15);
      document.getElementById('chip-location-text').textContent = 'Localização ativa';
      document.getElementById('chip-location').classList.add('active');
      saveLocationToBackend(latitude, longitude, 'map-init');
    },
    () => {
      addDefaultMarker([-16.6869, -49.2648]);
      document.getElementById('chip-location-text').textContent = 'Localização indisponível';
      document.getElementById('chip-location').classList.remove('active');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function addDefaultMarker(latlng) {
  const icon = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;background:#E8558A;border-radius:50%;border:3px solid white"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
  L.marker(latlng, { icon }).addTo(state.map).bindPopup('Posição aproximada');
}

function centerOnUser() {
  if (state.userLatLng) return state.map.flyTo(state.userLatLng, 16, { animate: true, duration: 1.2 });
  refreshUserLocation();
  toast('Buscando sua localização...');
}

async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
  const data = await res.json();
  if (!data.length) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

async function getRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes?.length) return null;
    return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
  } catch {
    return null;
  }
}

function makeRouteIcon(color, letter) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:12px">${letter}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });
}

async function definirRota() {
  const from = document.getElementById('route-from').value.trim();
  const to = document.getElementById('route-to').value.trim();
  if (!from || !to) return toast('Preencha a origem e o destino da rota.');

  toast('Buscando rota...');
  try {
    const fromCoords = await geocode(from);
    const toCoords = await geocode(to);
    if (!fromCoords || !toCoords) return toast('Não foi possível encontrar os endereços informados.');

    if (state.routeLayer) state.map.removeLayer(state.routeLayer);
    state.routeMarkers.forEach((m) => state.map.removeLayer(m));
    state.routeMarkers = [];

    const routeCoords = await getRoute(fromCoords, toCoords);
    state.routeLayer = L.polyline(routeCoords || [fromCoords, toCoords], {
      color: routeCoords ? '#FC4C02' : '#999',
      weight: 5,
      dashArray: routeCoords ? null : '6,6'
    }).addTo(state.map);

    state.routeMarkers.push(L.marker(fromCoords, { icon: makeRouteIcon('#34C759', 'A') }).addTo(state.map).bindPopup(`<strong>Origem:</strong> ${escapeHtml(from)}`));
    state.routeMarkers.push(L.marker(toCoords, { icon: makeRouteIcon('#E8558A', 'B') }).addTo(state.map).bindPopup(`<strong>Destino:</strong> ${escapeHtml(to)}`));

    state.map.fitBounds(state.routeLayer.getBounds(), { padding: [30, 30] });
    document.getElementById('clear-route-btn').style.display = 'inline-flex';
    toast(routeCoords ? 'Rota traçada com sucesso.' : 'Rota simples traçada (fallback).');
  } catch (err) {
    console.error(err);
    toast('Erro ao traçar rota.');
  }
}

function clearRoute() {
  if (state.routeLayer) state.map.removeLayer(state.routeLayer);
  state.routeLayer = null;
  state.routeMarkers.forEach((m) => state.map.removeLayer(m));
  state.routeMarkers = [];
  document.getElementById('route-from').value = '';
  document.getElementById('route-to').value = '';
  document.getElementById('clear-route-btn').style.display = 'none';
  toast('Rota removida.');
}

function openContactModal() { document.getElementById('contact-modal').classList.add('open'); }
function closeContactModal() {
  document.getElementById('contact-modal').classList.remove('open');
  ['contact-name', 'contact-email', 'contact-phone'].forEach((id) => (document.getElementById(id).value = ''));
  document.getElementById('contact-priority').value = 'alta';
}
function saveContactsToStorage() { localStorage.setItem('herlife_contacts', JSON.stringify(state.contacts)); }
function loadContactsFromStorage() {
  try {
    const raw = localStorage.getItem('herlife_contacts');
    state.contacts = raw ? JSON.parse(raw) : [];
  } catch { state.contacts = []; }
  renderContacts();
}
function addContact() {
  const name = document.getElementById('contact-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const email = document.getElementById('contact-email').value.trim().toLowerCase();
  const priority = document.getElementById('contact-priority').value;
  if (!name || !phone || !email) return toast('Preencha todos os campos do contato.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Informe um e-mail válido.');
  if (state.contacts.some((c) => c.email === email)) return toast('Já existe um contato com esse e-mail.');
  state.contacts.push({ id: Date.now(), name, phone, email, priority });
  saveContactsToStorage(); renderContacts(); closeContactModal();
}
function removeContact(id) { state.contacts = state.contacts.filter((c) => c.id !== id); saveContactsToStorage(); renderContacts(); }

function renderContacts() {
  const el = document.getElementById('contacts-list');
  const count = state.contacts.length;
  document.getElementById('contacts-count-chip').textContent = `${count} contato${count === 1 ? '' : 's'}`;
  document.getElementById('chip-contacts').classList.toggle('active', count > 0);
  if (!count) {
    el.innerHTML = '<div class="contacts-empty" id="contacts-empty"><p>Nenhum contato cadastrado ainda.</p></div>';
    return;
  }
  el.innerHTML = state.contacts.map((c) => `<div class="contact-item"><div class="contact-avatar">${escapeHtml(c.name.charAt(0).toUpperCase())}</div><div class="contact-info"><div class="contact-name">${escapeHtml(c.name)}</div><div class="contact-details">${escapeHtml(c.phone)} · ${escapeHtml(c.email)}</div></div><div class="contact-right"><span class="priority-badge ${c.priority}">${c.priority.toUpperCase()}</span><button class="btn-delete" onclick="removeContact(${c.id})">🗑️</button></div></div>`).join('');
}

function activateSOS() {
  if (!state.user) return toast('Faça login para ativar o SOS.');
  if (!state.contacts.length) return toast('Adicione contatos antes de usar o SOS.');
  const list = document.getElementById('sos-contacts-sent');
  list.innerHTML = state.contacts.map((c) => `<div class="sos-contact-chip"><span><strong>${escapeHtml(c.name)}</strong> · ${escapeHtml(c.phone)}</span></div>`).join('');
  document.getElementById('sos-modal').classList.add('open');
}
function closeSosModal() { document.getElementById('sos-modal').classList.remove('open'); }

function sendWhatsAppLocation(lat, lng) {
  const message = `📍 Minha localização: https://www.google.com/maps?q=${lat},${lng}`;
  state.contacts.forEach((c) => {
    const phone = c.phone.replace(/\D/g, '');
    if (!phone) return;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  });
}

function shareLocationNow() {
  if (!state.contacts.length) return toast('Adicione contatos antes de compartilhar.');
  const share = (lat, lng) => {
    sendWhatsAppLocation(lat, lng);
    saveLocationToBackend(lat, lng, 'share-now');
    toast('Localização compartilhada!');
  };

  if (state.userLatLng) return share(state.userLatLng[0], state.userLatLng[1]);
  if (!navigator.geolocation) return toast('Geolocalização não suportada.');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      state.userLatLng = [latitude, longitude];
      share(latitude, longitude);
    },
    () => toast('Não foi possível obter sua localização atual.'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function drawActivityPath() {
  if (state.activityLayer) state.map.removeLayer(state.activityLayer);
  if (state.activity.path.length < 2) return;
  state.activityLayer = L.polyline(state.activity.path, { color: '#FC4C02', weight: 5 }).addTo(state.map);
}

function calculateDistance(path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [lat1, lon1] = path[i - 1];
    const [lat2, lon2] = path[i];
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    total += R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  return total;
}

function calculateSpeed(path) {
  if (path.length < 2) return 0;
  const lastTwo = path.slice(-2);
  return (calculateDistance(lastTwo) / 5) * 3.6;
}

function updateActivityUI() {
  const panel = document.getElementById('activity-panel');
  if (!state.activity.active) return (panel.style.display = 'none');
  panel.style.display = 'block';
  const seconds = Math.floor((Date.now() - state.activity.startTime) / 1000);
  document.getElementById('activity-time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  document.getElementById('activity-distance').textContent = `${(calculateDistance(state.activity.path) / 1000).toFixed(2)} km`;
  const speed = Math.min(50, calculateSpeed(state.activity.path));
  document.getElementById('activity-speed').textContent = `${speed.toFixed(1)} km/h`;
}

function startActivity() {
  if (state.activity.active) return toast('Já existe uma atividade em andamento.');
  if (!navigator.geolocation) return toast('Geolocalização não suportada.');

  state.activity = { active: true, path: [], watchId: null, startTime: Date.now(), lastShareAt: 0 };
  toast('Atividade iniciada 🚀');

  state.activity.watchId = navigator.geolocation.watchPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    state.userLatLng = [latitude, longitude];
    state.activity.path.push([latitude, longitude]);
    saveLocationToBackend(latitude, longitude, 'activity');
    drawActivityPath();
    updateActivityUI();

    if (state.contacts.length && Date.now() - state.activity.lastShareAt > 120000) {
      state.activity.lastShareAt = Date.now();
      sendWhatsAppLocation(latitude, longitude);
    }
  }, () => toast('Erro ao rastrear localização.'), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
}

function stopActivity() {
  if (!state.activity.active) return toast('Nenhuma atividade em andamento.');
  if (state.activity.watchId) navigator.geolocation.clearWatch(state.activity.watchId);
  state.activity.active = false;
  state.activity.watchId = null;
  updateActivityUI();
  toast(`Atividade finalizada. Distância ${(calculateDistance(state.activity.path) / 1000).toFixed(2)} km`);
}

window.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadContactsFromStorage();

  ['login-name', 'login-email'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => e.key === 'Enter' && loginApp());
  });

  document.getElementById('contact-phone').addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '');
    if (v.length <= 10) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    else v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    this.value = v;
  });

  setInterval(updateActivityUI, 1000);
});
