const stylists = ["Tous les coiffeurs", "Sabrina", "Nadia", "Samir"];
const bookingStorageKey = "salonKamelBookings";
const supabaseUrl = "https://ltoapqqzrrweijrkxdpi.supabase.co";
const supabaseKey = "sb_publishable_rL_RaUsT07dsW7Q9CFcWfw_DHLUpz5R";
const teamAccessCode = "salon2026";
const teamSessionKey = "salonKamelTeamAccess";

const teamShell = document.querySelector("#teamShell");
const teamLogin = document.querySelector("#teamLogin");
const teamLoginForm = document.querySelector("#teamLoginForm");
const teamAccessCodeInput = document.querySelector("#teamAccessCode");
const teamPlanning = document.querySelector("#teamPlanning");
const teamStylist = document.querySelector("#teamStylist");
const teamDate = document.querySelector("#teamDate");
const agendaList = document.querySelector("#agendaList");
const appointmentCount = document.querySelector("#appointmentCount");
const selectedDayLabel = document.querySelector("#selectedDayLabel");
const selectedStylistLabel = document.querySelector("#selectedStylistLabel");
const clearDay = document.querySelector("#clearDay");
const logoutTeam = document.querySelector("#logoutTeam");
const toast = document.querySelector("#toast");

function bookingFromDatabase(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    clientName: row.client_name,
    phone: row.phone,
    service: row.service,
    duration: row.duration,
    stylist: row.stylist,
    date: row.date,
    time: row.time,
    message: row.message || "",
    status: row.status || "confirmé"
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Erreur Supabase");
  }

  if (response.status === 204) return null;
  return response.json();
}

function loadLocalBookings() {
  try {
    return JSON.parse(localStorage.getItem(bookingStorageKey)) || [];
  } catch (error) {
    return [];
  }
}

function saveLocalBookings(bookings) {
  localStorage.setItem(bookingStorageKey, JSON.stringify(bookings));
}

async function loadBookings() {
  try {
    const rows = await supabaseRequest("rendez_vous?select=*&status=eq.confirmé&order=date.asc,time.asc");
    return rows.map(bookingFromDatabase);
  } catch (error) {
    showToast("Connexion planning en ligne impossible. Mode test local utilisé.");
    return loadLocalBookings();
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

function hasTeamAccess() {
  return sessionStorage.getItem(teamSessionKey) === "ok";
}

function showTeamApp() {
  teamShell.classList.remove("locked");
  teamLogin.hidden = true;
  teamPlanning.scrollIntoView({ block: "start", behavior: "auto" });
}

function showTeamLogin() {
  teamShell.classList.add("locked");
  teamLogin.hidden = false;
  teamAccessCodeInput.focus();
}

function renderStylistOptions() {
  teamStylist.innerHTML = stylists
    .map((stylist) => `<option value="${stylist}">${stylist}</option>`)
    .join("");
}

async function setDefaultDate() {
  const today = new Date().toLocaleDateString("en-CA");
  const nextBooking = (await loadBookings())
    .filter((booking) => booking.date >= today)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];

  teamDate.value = nextBooking?.date || today;
}

async function filteredBookings() {
  const stylist = teamStylist.value;
  return (await loadBookings())
    .filter((booking) => booking.date === teamDate.value)
    .filter((booking) => stylist === "Tous les coiffeurs" || booking.stylist === stylist)
    .sort((a, b) => a.time.localeCompare(b.time));
}

async function renderAgenda() {
  const bookings = await filteredBookings();
  appointmentCount.textContent = `${bookings.length} rendez-vous`;
  selectedDayLabel.textContent = formatDate(teamDate.value);
  selectedStylistLabel.textContent = teamStylist.value;

  if (!bookings.length) {
    agendaList.innerHTML = `
      <article class="empty-agenda">
        <h2>Aucun rendez-vous</h2>
        <p>Les nouvelles réservations apparaîtront ici dès qu'un client validera le formulaire.</p>
      </article>
    `;
    return;
  }

  agendaList.innerHTML = bookings
    .map(
      (booking) => `
        <article class="appointment-card">
          <div class="appointment-time">
            <strong>${booking.time}</strong>
            <span>${booking.duration} min</span>
          </div>
          <div class="appointment-main">
            <h2>${booking.service}</h2>
            <p>${booking.clientName} - ${booking.phone}</p>
            ${booking.message ? `<p class="appointment-note">${booking.message}</p>` : ""}
          </div>
          <div class="appointment-meta">
            <span>${booking.stylist}</span>
            <button type="button" data-id="${booking.id}">Terminer</button>
          </div>
        </article>
      `
    )
    .join("");
}

async function removeBooking(id) {
  try {
    await supabaseRequest(`rendez_vous?id=eq.${id}`, { method: "DELETE" });
  } catch (error) {
    saveLocalBookings(loadLocalBookings().filter((booking) => booking.id !== id));
  }

  await renderAgenda();
  showToast("Rendez-vous retiré du planning.");
}

async function init() {
  if (!hasTeamAccess()) {
    showTeamLogin();
    return;
  }

  showTeamApp();
  renderStylistOptions();
  await setDefaultDate();
  await renderAgenda();
}

teamStylist.addEventListener("change", renderAgenda);
teamDate.addEventListener("change", renderAgenda);

agendaList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (button) removeBooking(button.dataset.id);
});

clearDay.addEventListener("click", async () => {
  const stylist = teamStylist.value;
  const bookings = await loadBookings();
  const toDelete = bookings.filter((booking) => {
    const sameDay = booking.date === teamDate.value;
    const sameStylist = stylist === "Tous les coiffeurs" || booking.stylist === stylist;
    return sameDay && sameStylist;
  });

  await Promise.all(
    toDelete.map((booking) => supabaseRequest(`rendez_vous?id=eq.${booking.id}`, { method: "DELETE" }).catch(() => null))
  );
  saveLocalBookings(
    loadLocalBookings().filter((booking) => {
      const sameDay = booking.date === teamDate.value;
      const sameStylist = stylist === "Tous les coiffeurs" || booking.stylist === stylist;
      return !(sameDay && sameStylist);
    })
  );
  await renderAgenda();
  showToast("La journée affichée a été vidée.");
});

teamLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (teamAccessCodeInput.value.trim() !== teamAccessCode) {
    showToast("Code incorrect.");
    teamAccessCodeInput.select();
    return;
  }

  sessionStorage.setItem(teamSessionKey, "ok");
  await init();
  teamPlanning.scrollIntoView({ block: "start", behavior: "auto" });
});

logoutTeam.addEventListener("click", () => {
  sessionStorage.removeItem(teamSessionKey);
  showTeamLogin();
});

init();
