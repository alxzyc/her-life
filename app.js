/* ══════════════════════════════════════════
   HER LIFE — App Logic
   Estado, mapa, contatos, SOS
══════════════════════════════════════════ */

const state = {
  user: null,
  contacts: [],
  map: null,
  userMarker: null,
  routeLayer: null,
  userLatLng: null,

  activity: {
  active: false,
  path: [],
  watchId: null,
  startTime: null
}
};

/* ─── Toast ─── */
function toast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ═══════════════════════════════════════
   LOGIN
═══════════════════════════════════════ */
function loginApp() {
  const name  = document.getElementById('login-name').value.trim();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const fb    = document.getElementById('login-feedback');

  if (!name || !email) {
    fb.textContent = 'Preencha seu nome e e-mail para continuar.';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fb.textContent = 'Informe um e-mail válido.';
    return;
  }

  state.user = { name, email };

  document.getElementById('welcome').textContent = `Bem-vinda, ${name}! 💜`;
  document.getElementById('login-overlay').classList.remove('open');

  // Load persisted contacts from localStorage
  loadContactsFromStorage();

  toast(`Bem-vinda, ${name}! Você está protegida. 💜`);
}

/* ═══════════════════════════════════════
   MAP
═══════════════════════════════════════ */
function initMap() {
  // Default: Goiânia, GO (adjust if needed)
  const defaultCenter = [-16.6869, -49.2648];

  state.map = L.map('map-home', {
    zoomControl: true,
    attributionControl: true,
  }).setView(defaultCenter, 14);

  // OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);

  // Try to get user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        state.userLatLng = [latitude, longitude];

        const userIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:18px;height:18px;
            background:linear-gradient(135deg,#E8558A,#7C3AED);
            border-radius:50%;
            border:3px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,.25);
          "></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        state.userMarker = L.marker(state.userLatLng, { icon: userIcon })
          .addTo(state.map)
          .bindPopup('<strong>Você está aqui</strong>')
          .openPopup();

        state.map.setView(state.userLatLng, 15);

        // Update status chip
        const chip = document.getElementById('chip-location-text');
        chip.textContent = 'Localização ativa';
        document.getElementById('chip-location').classList.add('active');
      },
      () => {
        // Geolocation denied — show default location
        addDefaultMarker(defaultCenter);
        document.getElementById('chip-location-text').textContent = 'Localização indisponível';
      }
    );
  } else {
    addDefaultMarker(defaultCenter);
    document.getElementById('chip-location-text').textContent = 'Geolocalização não suportada';
  }
}

function addDefaultMarker(latlng) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;
      background:#E8558A;
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,.2);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  L.marker(latlng, { icon }).addTo(state.map).bindPopup('Posição aproximada');
}

function centerOnUser() {
  if (state.userLatLng) {
    state.map.flyTo(state.userLatLng, 16, { animate: true, duration: 1.2 });
    state.userMarker && state.userMarker.openPopup();
  } else {
    toast('Localização não disponível. Verifique as permissões do navegador.');
  }
}

/* ─── Route ─── */
async function definirRota() {
  const from = document.getElementById('route-from').value.trim();
  const to   = document.getElementById('route-to').value.trim();

  if (!from || !to) {
    toast('Preencha a origem e o destino da rota.');
    return;
  }

  toast('Buscando rota...');

  try {
    // Geocode "from"
    const fromCoords = await geocode(from);
    const toCoords   = await geocode(to);

    if (!fromCoords || !toCoords) {
      toast('Não foi possível encontrar um ou mais endereços. Tente ser mais específico.');
      return;
    }

    // Draw route
    if (state.routeLayer) state.map.removeLayer(state.routeLayer);

const routeCoords = await getRoute(fromCoords, toCoords);

if (state.routeLayer) state.map.removeLayer(state.routeLayer);

if (routeCoords) {
  state.routeLayer = L.polyline(routeCoords, {
    color: '#FC4C02',
    weight: 5,
    opacity: 0.9,
  }).addTo(state.map);
} else {
  // fallback (linha simples)
  state.routeLayer = L.polyline([fromCoords, toCoords], {
    color: '#999',
    weight: 4,
    dashArray: '6,6'
  }).addTo(state.map);

  toast('Usando rota simples (API indisponível)');
}
    // Markers
    const fromIcon = makeRouteIcon('#34C759', 'A');
    const toIcon   = makeRouteIcon('#E8558A', 'B');

    L.marker(fromCoords, { icon: fromIcon }).addTo(state.map).bindPopup(`<strong>Origem:</strong> ${from}`);
    L.marker(toCoords,   { icon: toIcon   }).addTo(state.map).bindPopup(`<strong>Destino:</strong> ${to}`);

    state.map.fitBounds(state.routeLayer.getBounds(), { padding: [30, 30] });
    document.getElementById('clear-route-btn').style.display = 'inline-flex';

    toast(`Rota traçada: ${from} → ${to}`);
  } catch (err) {
  console.error('Erro real da rota:', err);
  toast('Erro ao traçar rota.');
  }

  async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

  const res  = await fetch(url, {
    headers: { 'Accept-Language': 'pt-BR' }
  });

  const data = await res.json();

  if (!data.length) return null;

  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}
async function getRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;

    const res = await fetch(url);

    if (!res.ok) {
      console.error('Erro HTTP:', res.status);
      return null;
    }

    const data = await res.json();

    if (!data.routes || !data.routes.length) {
      console.error('Sem rota encontrada:', data);
      return null;
    }

    return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
  } catch (err) {
    console.error('Erro no getRoute:', err);
    return null;
  }
}

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res  = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
  const data = await res.json();
  if (!data.length) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

function makeRouteIcon(color, letter) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;
      background:${color};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,.25);
      display:flex;align-items:center;justify-content:center;
    "><span style="
      transform:rotate(45deg);
      color:white;font-weight:800;
      font-size:12px;font-family:'DM Sans',sans-serif;
      display:block;
    ">${letter}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

function clearRoute() {
  if (state.routeLayer) {
    state.map.removeLayer(state.routeLayer);
    state.routeLayer = null;
  }
  // Remove any route markers (re-init map layer approach: just reload tiles layer)
  document.getElementById('route-from').value = '';
  document.getElementById('route-to').value   = '';
  document.getElementById('clear-route-btn').style.display = 'none';
  toast('Rota removida.');
}

/* ═══════════════════════════════════════
   CONTACTS
═══════════════════════════════════════ */
function openContactModal()  { document.getElementById('contact-modal').classList.add('open'); }
function closeContactModal() {
  document.getElementById('contact-modal').classList.remove('open');
  ['contact-name','contact-email','contact-phone'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('contact-priority').value = 'alta';
}

function addContact() {
  const name     = document.getElementById('contact-name').value.trim();
  const phone    = document.getElementById('contact-phone').value.trim();
  const email    = document.getElementById('contact-email').value.trim().toLowerCase();
  const priority = document.getElementById('contact-priority').value;

  if (!name || !phone || !email) {
    toast('Preencha todos os campos do contato.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('Informe um e-mail válido para o contato.');
    return;
  }
  if (state.contacts.some(c => c.email === email)) {
    toast('Já existe um contato com esse e-mail.');
    return;
  }

  state.contacts.push({ id: Date.now(), name, phone, email, priority });
  saveContactsToStorage();
  renderContacts();
  closeContactModal();
  toast(`${name} adicionado(a) como contato de emergência.`);
}

function removeContact(id) {
  state.contacts = state.contacts.filter(c => c.id !== id);
  saveContactsToStorage();
  renderContacts();
  toast('Contato removido.');
}

function renderContacts() {
  const el    = document.getElementById('contacts-list');
  const empty = document.getElementById('contacts-empty');
  const count = state.contacts.length;

  // Update chips
  document.getElementById('contacts-count-chip').textContent = `${count} contato${count !== 1 ? 's' : ''}`;
  const chip = document.getElementById('chip-contacts');
  chip.classList.toggle('active', count > 0);

  if (!count) {
    el.innerHTML = '';
    // Re-add empty state
    const div = document.createElement('div');
    div.className = 'contacts-empty';
    div.id = 'contacts-empty';
    div.innerHTML = `
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".25"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <p>Nenhum contato cadastrado ainda.<br/><small>Adicione pessoas de confiança para acionar em uma emergência.</small></p>
    `;
    el.appendChild(div);
    return;
  }

  el.innerHTML = state.contacts.map(c => {
    const initial = c.name.charAt(0).toUpperCase();
    return `
      <div class="contact-item">
        <div class="contact-avatar">${initial}</div>
        <div class="contact-info">
          <div class="contact-name">${escapeHtml(c.name)}</div>
          <div class="contact-details">${escapeHtml(c.phone)} · ${escapeHtml(c.email)}</div>
        </div>
        <div class="contact-right">
          <span class="priority-badge ${c.priority}">${c.priority === 'alta' ? 'ALTA' : 'MÉDIA'}</span>
          <button class="btn-delete" onclick="removeContact(${c.id})" title="Remover contato">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/* ─── Persistence ─── */
function saveContactsToStorage() {
  try { localStorage.setItem('herlife_contacts', JSON.stringify(state.contacts)); } catch(_) {}
}
function loadContactsFromStorage() {
  try {
    const raw = localStorage.getItem('herlife_contacts');
    if (raw) {
      state.contacts = JSON.parse(raw);
      renderContacts();
    }
  } catch(_) {}
}

/* ═══════════════════════════════════════
   SOS
═══════════════════════════════════════ */
function activateSOS() {
  if (!state.user) {
    toast('Faça login para ativar o SOS.');
    return;
  }
  if (!state.contacts.length) {
    toast('Adicione ao menos 1 contato de emergência antes de usar o SOS.');
    return;
  }

  const modal = document.getElementById('sos-modal');
  const list  = document.getElementById('sos-contacts-sent');

  list.innerHTML = state.contacts.map(c => `
    <div class="sos-contact-chip">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span><strong>${escapeHtml(c.name)}</strong> · ${escapeHtml(c.phone)}</span>
    </div>
  `).join('');

  modal.classList.add('open');
}

function closeSosModal() {
  document.getElementById('sos-modal').classList.remove('open');
  toast('Alerta encerrado. Fique segura! 💜');
}

/* ─── Util ─── */
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  renderContacts();

  // Allow pressing Enter in login inputs
  ['login-name', 'login-email'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') loginApp();
    });
  });

  // Phone mask (simple)
  document.getElementById('contact-phone').addEventListener('input', function() {
    let v = this.value.replace(/\D/g,'');
    if (v.length <= 10)      v = v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
    else if (v.length <= 11) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
    this.value = v;
  });
});


// começar atividade

function startActivity() {
  if (!navigator.geolocation) {
    toast('Geolocalização não suportada.');
    return;
  }

  state.activity.liveId = generateLiveId();

const liveUrl =
 `${window.location.origin}/live.html?id=${state.activity.liveId}`;

toast('Link de rastreamento criado!');
console.log(liveUrl);

  // evita bug de estado travado
  if (state.activity.active) {
    toast('Já existe uma atividade em andamento.');
    return;
  }

  // limpa qualquer resto antigo
  if (state.activity.watchId) {
    navigator.geolocation.clearWatch(state.activity.watchId);
  }

  state.activity = {
    active: true,
    path: [],
    watchId: null,
    startTime: Date.now()
  };

  toast('Atividade iniciada 🚀');

  state.activity.watchId = navigator.geolocation.watchPosition(
    (pos) => {

dbSet(
  dbRef(window.db, 'liveLocations/' + state.activity.liveId),
  {
    name: state.user.name,
    lat: latitude,
    lng: longitude,
    updatedAt: Date.now(),
    active: true
  }
);

      updateActivityUI();

      const { latitude, longitude } = pos.coords;
      const point = [latitude, longitude];

      state.activity.path.push(point);

    if (state.activity.path.length % 5 === 0) {
  sendWhatsAppLocation(latitude, longitude);
}

      drawActivityPath();
    },
    (err) => {
      console.error(err);
      toast('Erro ao rastrear localização.');
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );
}

  // parar ativadade

 function stopActivity() {
  if (!state.activity.active) {
    toast('Nenhuma atividade em andamento.');
    return;
  }

  if (state.activity.watchId) {
    navigator.geolocation.clearWatch(state.activity.watchId);
  }

  state.activity.active = false;
  state.activity.watchId = null;

  const duration = Math.floor((Date.now() - state.activity.startTime) / 1000);

  toast(`Atividade finalizada (${duration}s)`);

  console.log('Caminho:', state.activity.path);

  const distance = calculateDistance(state.activity.path);

  toast(`Distância: ${(distance/1000).toFixed(2)} km`);
}

// trajeto

function drawActivityPath() {
  if (state.routeLayer) {
    state.map.removeLayer(state.routeLayer);
  }

  state.routeLayer = L.polyline(state.activity.path, {
    color: '#FC4C02',
    weight: 5
  }).addTo(state.map);
}

// calcular distancia 

function calculateDistance(path) {
  let total = 0;

  for (let i = 1; i < path.length; i++) {
    const [lat1, lon1] = path[i - 1];
    const [lat2, lon2] = path[i];

    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a =
      Math.sin(Δφ/2) * Math.sin(Δφ/2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ/2) * Math.sin(Δλ/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    total += R * c;
  }

  return total; // metros
}

// enviar localização para contatos

function sendWhatsAppLocation(lat, lng) {
  const message = `🚨 Estou em atividade no Her Life.\n\nMinha localização:\nhttps://www.google.com/maps?q=${lat},${lng}`;

  state.contacts.forEach(c => {
    const phone = c.phone.replace(/\D/g, ''); // só números
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  });
}

// botao de compartilhar localização

function shareLocationNow() {
  if (!state.userLatLng) {
    toast('Localização não disponível.');
    return;
  }

  if (!state.contacts.length) {
    toast('Adicione contatos antes de compartilhar.');
    return;
  }

  const [lat, lng] = state.userLatLng;

  const message = `📍 Minha localização atual:\nhttps://www.google.com/maps?q=${lat},${lng}`;

  state.contacts.forEach(c => {
    const phone = c.phone.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  });

  toast('Localização compartilhada!');
}

// atualização

function updateActivityUI() {
  const panel = document.getElementById('activity-panel');

  if (!state.activity.active) {
    panel.style.display = 'none';
    return;
  }

  const speed = calculateSpeed(state.activity.path);
  const safeSpeed = speed > 50 ? 0 : speed; // ignora valores absurdos
  document.getElementById('activity-speed').textContent =
  `${safeSpeed.toFixed(1)} km/h`;

  panel.style.display = 'block';

  // tempo
  const seconds = Math.floor((Date.now() - state.activity.startTime) / 1000);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  document.getElementById('activity-time').textContent =
    `${min}:${sec.toString().padStart(2, '0')}`;

  // distância
  const dist = calculateDistance(state.activity.path);
  document.getElementById('activity-distance').textContent =
    `${(dist / 1000).toFixed(2)} km`;
}

// velocidade em tempo real 

function calculateSpeed(path) {
  if (path.length < 2) return 0;

  const last = path[path.length - 1];
  const prev = path[path.length - 2];

  const [lat1, lon1] = prev;
  const [lat2, lon2] = last;

  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a =
    Math.sin(Δφ/2) * Math.sin(Δφ/2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ/2) * Math.sin(Δλ/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const distance = R * c; // metros

  const time = 5; // segundos (aprox entre updates GPS)

  const speed = distance / time; // m/s

  return speed * 3.6; // km/h
}

setInterval(updateActivityUI, 1000);


function generateLiveId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

