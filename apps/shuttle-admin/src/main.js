// EcoCommute Shuttle Admin Dashboard Logic

const API_BASE = window.location.port === '8080' ? '' : 'http://localhost:8080';

// Fallback seed data if gateway isn't connected
const FALLBACK_VEHICLES = [
  { id: 1, plate_no: 'NC-8821', type: 'Toyota Coaster', capacity: 30, active: true },
  { id: 2, plate_no: 'WP-6490', type: 'Toyota HiAce', capacity: 14, active: true },
  { id: 3, plate_no: 'CP-4521', type: 'Nissan Civilian', capacity: 22, active: true },
];

const FALLBACK_TRIPS = [
  {
    id: 1,
    routeName: 'Kaduwela Express',
    originName: 'Kaduwela Interchange',
    destinationName: 'Colombo Fort',
    vehicle: { id: 1, plateNo: 'NC-8821', type: 'Toyota Coaster', capacity: 30 },
    departAt: new Date(Date.now() + 3600000 * 2).toISOString(),
    arriveAt: new Date(Date.now() + 3600000 * 3).toISOString(),
    status: 'scheduled',
    availableSeats: 24,
    totalCapacity: 30,
  },
  {
    id: 2,
    routeName: 'Kaduwela Express',
    originName: 'Kaduwela Interchange',
    destinationName: 'Colombo Fort',
    vehicle: { id: 2, plateNo: 'WP-6490', type: 'Toyota HiAce', capacity: 14 },
    departAt: new Date(Date.now() + 3600000 * 3).toISOString(),
    arriveAt: new Date(Date.now() + 3600000 * 4).toISOString(),
    status: 'scheduled',
    availableSeats: 8,
    totalCapacity: 14,
  },
  {
    id: 3,
    routeName: 'Moratuwa Coastal Line',
    originName: 'Moratuwa Bus Stand',
    destinationName: 'Colombo Fort',
    vehicle: { id: 3, plateNo: 'CP-4521', type: 'Nissan Civilian', capacity: 22 },
    departAt: new Date(Date.now() + 3600000 * 2.5).toISOString(),
    arriveAt: new Date(Date.now() + 3600000 * 3.7).toISOString(),
    status: 'scheduled',
    availableSeats: 19,
    totalCapacity: 22,
  },
];

let currentTrips = [...FALLBACK_TRIPS];
let currentVehicles = [...FALLBACK_VEHICLES];

// Navigation Tabs
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-item');
  const title = document.getElementById('page-title');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const targetView = tab.dataset.view;
      document.querySelectorAll('.content-section').forEach((sec) => sec.classList.add('hidden'));
      const activeSection = document.getElementById(`view-${targetView}`);
      if (activeSection) activeSection.classList.remove('hidden');

      if (title) {
        title.textContent = tab.textContent.trim();
      }
    });
  });
}

// Format time
function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

// Render Upcoming Trips in Overview Table
function renderUpcomingTable(trips) {
  const tbody = document.getElementById('tbody-upcoming-trips');
  if (!tbody) return;

  tbody.innerHTML = trips.slice(0, 5).map((t) => `
    <tr>
      <td><strong>#${t.id}</strong></td>
      <td><strong>${t.routeName || 'Shuttle Line'}</strong><br><small style="color:var(--text-muted)">${t.originName} → ${t.destinationName}</small></td>
      <td><span class="plate-badge">${t.vehicle?.plateNo || t.plate_no || 'NC-8821'}</span></td>
      <td>${formatTime(t.departAt)}</td>
      <td>${formatTime(t.arriveAt)}</td>
      <td><strong>${t.availableSeats ?? 20}</strong> / ${t.vehicle?.capacity || 30}</td>
      <td><span class="status-pill scheduled">${t.status}</span></td>
      <td>
        <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem;" onclick="viewSeatMap(${t.id})">Inspect</button>
      </td>
    </tr>
  `).join('');
}

// Render All Trips Table
function renderAllTripsTable(trips) {
  const tbody = document.getElementById('tbody-all-trips');
  if (!tbody) return;

  tbody.innerHTML = trips.map((t) => `
    <tr>
      <td>#${t.id}</td>
      <td>${t.routeName || 'Shuttle Route'}</td>
      <td>${t.originName} → ${t.destinationName}</td>
      <td><span class="plate-badge">${t.vehicle?.plateNo || 'NC-8821'}</span></td>
      <td>${formatTime(t.departAt)}</td>
      <td>${t.bookingCutoffAt ? formatTime(t.bookingCutoffAt) : '30 min prior'}</td>
      <td><span class="status-pill scheduled">${t.status}</span></td>
    </tr>
  `).join('');
}

// Render Fleet Cards
function renderFleetCards(vehicles) {
  const container = document.getElementById('fleet-cards-container');
  if (!container) return;

  container.innerHTML = vehicles.map((v) => `
    <div class="vehicle-card">
      <div class="vehicle-card-header">
        <h4 class="vehicle-title">${v.type}</h4>
        <span class="plate-badge">${v.plate_no}</span>
      </div>
      <div style="margin-bottom:14px; color:var(--text-muted); font-size:0.9rem;">
        Passenger Capacity: <strong style="color:var(--text-main)">${v.capacity} Seats</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="status-pill completed">Active in Fleet</span>
        <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.8rem;">Layout Grid</button>
      </div>
    </div>
  `).join('');
}

// Render Seat Map Canvas
window.viewSeatMap = function(tripId) {
  const tab = document.getElementById('tab-occupancy');
  if (tab) tab.click();
  const select = document.getElementById('select-trip-map');
  if (select) {
    select.value = tripId;
    renderSeatMapForTrip(tripId);
  }
};

function renderSeatMapForTrip(tripId) {
  const canvas = document.getElementById('vehicle-seat-canvas');
  if (!canvas) return;

  // Render a 10-row bus layout (30 seats: 10 rows x 3 seats with aisle)
  let html = '';
  for (let row = 1; row <= 10; row++) {
    const isBookedA = (row * tripId) % 3 === 0;
    const isBookedB = (row + tripId) % 4 === 0;
    const isBookedC = (row * 2 + tripId) % 5 === 0;

    html += `
      <div class="seat-row">
        <div class="seat-item ${isBookedA ? 'occupied' : 'available'}">${row}A</div>
        <div class="seat-item ${isBookedB ? 'occupied' : 'available'}">${row}B</div>
        <div style="width:28px;"></div>
        <div class="seat-item ${isBookedC ? 'occupied' : 'available'}">${row}C</div>
      </div>
    `;
  }
  canvas.innerHTML = html;
}

// Fetch data from gateway if available
async function loadData() {
  try {
    const statusText = document.getElementById('gateway-status-text');
    const tripsRes = await fetch(`${API_BASE}/api/v1/trips`).catch(() => null);
    if (tripsRes && tripsRes.ok) {
      const data = await tripsRes.json();
      if (data.trips && data.trips.length > 0) {
        currentTrips = data.trips;
      }
      if (statusText) statusText.textContent = 'Connected (8080)';
    }

    const vehiclesRes = await fetch(`${API_BASE}/api/v1/vehicles`).catch(() => null);
    if (vehiclesRes && vehiclesRes.ok) {
      const data = await vehiclesRes.json();
      if (data.vehicles && data.vehicles.length > 0) {
        currentVehicles = data.vehicles;
      }
    }
  } catch (e) {
    console.warn('Could not contact gateway, using cached seed data');
  }

  renderUpcomingTable(currentTrips);
  renderAllTripsTable(currentTrips);
  renderFleetCards(currentVehicles);

  const select = document.getElementById('select-trip-map');
  if (select) {
    select.innerHTML = currentTrips.map((t) => `<option value="${t.id}">Trip #${t.id} - ${t.routeName || 'Shuttle'} (${t.originName} → ${t.destinationName})</option>`).join('');
    select.addEventListener('change', (e) => {
      renderSeatMapForTrip(parseInt(e.target.value, 10));
    });
    if (currentTrips.length > 0) {
      renderSeatMapForTrip(currentTrips[0].id);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadData();

  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadData);
  }
});
