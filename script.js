const services = [
  {
    name: "Coupe homme",
    duration: 30,
    price: "à partir de 22 €",
    description: "Coupe, finitions et coiffage."
  },
  {
    name: "Coupe femme",
    duration: 45,
    price: "à partir de 35 €",
    description: "Diagnostic, coupe et mise en forme."
  },
  {
    name: "Brushing",
    duration: 35,
    price: "à partir de 25 €",
    description: "Brushing souple, lisse ou volume."
  },
  {
    name: "Couleur",
    duration: 90,
    price: "sur devis",
    description: "Coloration avec conseil personnalisé."
  },
  {
    name: "Soin profond",
    duration: 40,
    price: "à partir de 30 €",
    description: "Soin réparateur et finition."
  },
  {
    name: "Barbe",
    duration: 25,
    price: "à partir de 15 €",
    description: "Taille, contours et finition nette."
  }
];

const stylists = [
  {
    name: "Sabrina",
    role: "Responsable du salon",
    specialty: "Coupes structurées, barbe, conseil personnalisé",
    photo: "assets/staff-sabrina.png",
    days: [2, 3, 4, 5, 6]
  },
  {
    name: "Nadia",
    role: "Coloriste",
    specialty: "Couleurs, soins, brushing et transformations",
    photo: "assets/staff-nadia.png",
    days: [2, 3, 5, 6]
  },
  {
    name: "Samir",
    role: "Coiffeur barbier",
    specialty: "Coupes homme, dégradés et finitions barbe",
    photo: "assets/staff-samir.png",
    days: [3, 4, 5, 6]
  }
];

const openingHours = {
  2: { start: "10:00", end: "18:30" },
  3: { start: "10:00", end: "18:30" },
  4: { start: "10:00", end: "18:30" },
  5: { start: "10:00", end: "18:30" },
  6: { start: "09:00", end: "17:00" }
};

const serviceGrid = document.querySelector("#serviceGrid");
const staffGrid = document.querySelector("#staffGrid");
const serviceSelect = document.querySelector("#service");
const stylistSelect = document.querySelector("#stylist");
const dateInput = document.querySelector("#date");
const timeSelect = document.querySelector("#time");
const summary = document.querySelector("#summary");
const bookingForm = document.querySelector("#bookingForm");
const toast = document.querySelector("#toast");
const bookingStorageKey = "salonKamelBookings";
const supabaseUrl = "https://ltoapqqzrrweijrkxdpi.supabase.co";
const supabaseKey = "sb_publishable_rL_RaUsT07dsW7Q9CFcWfw_DHLUpz5R";
let cachedBookings = [];

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

function bookingToDatabase(booking) {
  return {
    client_name: booking.clientName,
    phone: booking.phone,
    service: booking.service,
    stylist: booking.stylist,
    date: booking.date,
    time: booking.time,
    duration: booking.duration,
    message: booking.message,
    status: booking.status
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
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

function minutes(value) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function timeLabel(total) {
  const hours = Math.floor(total / 60).toString().padStart(2, "0");
  const mins = (total % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function selectedService() {
  return services.find((service) => service.name === serviceSelect.value) || services[0];
}

function selectedStylist() {
  return stylists.find((stylist) => stylist.name === stylistSelect.value) || stylists[0];
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

async function refreshBookings() {
  try {
    const rows = await supabaseRequest("rendez_vous?select=*&status=eq.confirmé&order=date.asc,time.asc");
    cachedBookings = rows.map(bookingFromDatabase);
  } catch (error) {
    cachedBookings = loadLocalBookings();
    showToast("Connexion planning en ligne impossible. Mode test local utilisé.");
  }
}

async function createBooking(booking) {
  try {
    const rows = await supabaseRequest("rendez_vous", {
      method: "POST",
      body: JSON.stringify(bookingToDatabase(booking))
    });
    return bookingFromDatabase(rows[0]);
  } catch (error) {
    const localBooking = {
      ...booking,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
    };
    const bookings = loadLocalBookings();
    bookings.push(localBooking);
    saveLocalBookings(bookings);
    return localBooking;
  }
}

function isSlotAvailable(date, stylist, time, duration) {
  const start = minutes(time);
  const end = start + duration;

  return !cachedBookings.some((booking) => {
    if (booking.date !== date || booking.stylist !== stylist) return false;

    const bookedStart = minutes(booking.time);
    const bookedEnd = bookedStart + Number(booking.duration || 30);
    return start < bookedEnd && end > bookedStart;
  });
}

function renderServices() {
  serviceGrid.innerHTML = services
    .map(
      (service) => `
        <article class="service-card">
          <div>
            <h3>${service.name}</h3>
            <p>${service.description}</p>
          </div>
          <div class="price-row">
            <span>${service.price}</span>
            <span>${service.duration} min</span>
          </div>
        </article>
      `
    )
    .join("");

  serviceSelect.innerHTML = services
    .map((service) => `<option value="${service.name}">${service.name} - ${service.duration} min</option>`)
    .join("");
}

function renderStylists() {
  staffGrid.innerHTML = stylists
    .map(
      (stylist) => `
        <article class="staff-card">
          <img class="staff-photo" src="${stylist.photo}" alt="Portrait de ${stylist.name}" />
          <h3>${stylist.name}</h3>
          <p><strong>${stylist.role}</strong></p>
          <p>${stylist.specialty}</p>
        </article>
      `
    )
    .join("");

  stylistSelect.innerHTML = stylists
    .map((stylist) => `<option value="${stylist.name}">${stylist.name}</option>`)
    .join("");
}

function setMinimumDate() {
  const today = new Date();
  const nextOpenDay = new Date(today);

  while (!openingHours[nextOpenDay.getDay()]) {
    nextOpenDay.setDate(nextOpenDay.getDate() + 1);
  }

  const iso = today.toLocaleDateString("en-CA");
  const defaultDate = nextOpenDay.toLocaleDateString("en-CA");
  dateInput.min = iso;
  dateInput.value = defaultDate;
}

function updateTimes() {
  const date = new Date(`${dateInput.value}T12:00:00`);
  const day = date.getDay();
  const stylist = selectedStylist();
  const hours = openingHours[day];

  timeSelect.innerHTML = "";

  if (!hours || !stylist.days.includes(day)) {
    const option = new Option("Aucun créneau disponible ce jour", "");
    timeSelect.append(option);
    timeSelect.disabled = true;
    updateSummary();
    return;
  }

  const service = selectedService();
  const start = minutes(hours.start);
  const end = minutes(hours.end) - service.duration;

  for (let slot = start; slot <= end; slot += 30) {
    const slotLabel = timeLabel(slot);
    if (isSlotAvailable(dateInput.value, stylist.name, slotLabel, service.duration)) {
      timeSelect.append(new Option(slotLabel, slotLabel));
    }
  }

  if (!timeSelect.options.length) {
    const option = new Option("Complet pour ce coiffeur", "");
    timeSelect.append(option);
    timeSelect.disabled = true;
    updateSummary();
    return;
  }

  timeSelect.disabled = false;
  updateSummary();
}

function formatDate(value) {
  if (!value) return "date à choisir";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function updateSummary() {
  const service = selectedService();
  const stylist = selectedStylist();
  const time = timeSelect.value || "horaire à confirmer";

  summary.innerHTML = `
    <strong>${service.name}</strong> avec <strong>${stylist.name}</strong><br />
    ${formatDate(dateInput.value)} à ${time}<br />
    Durée estimée : ${service.duration} min - ${service.price}
  `;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3600);
}

function showBookingSaved(booking) {
  summary.innerHTML = `
    <strong>Rendez-vous ajouté au planning.</strong><br />
    ${booking.time} - ${booking.service} avec ${booking.stylist}<br />
    Client : ${booking.clientName}<br />
    <a href="equipe.html">Voir le planning équipe</a>
  `;
}

async function submitBooking(event) {
  event.preventDefault();

  if (timeSelect.disabled || !timeSelect.value) {
    showToast("Choisissez un jour ouvert pour ce coiffeur.");
    return;
  }

  const form = new FormData(bookingForm);
  const service = selectedService();
  await refreshBookings();

  const booking = {
    createdAt: new Date().toISOString(),
    clientName: form.get("name"),
    phone: form.get("phone"),
    service: service.name,
    duration: service.duration,
    stylist: form.get("stylist"),
    date: form.get("date"),
    time: form.get("time"),
    message: form.get("message") || "",
    status: "confirmé"
  };

  if (!isSlotAvailable(booking.date, booking.stylist, booking.time, booking.duration)) {
    showToast("Ce créneau vient d'être pris. Choisissez un autre horaire.");
    updateTimes();
    return;
  }

  const savedBooking = await createBooking(booking);
  cachedBookings.push(savedBooking);
  showBookingSaved(savedBooking);
  showToast("Rendez-vous ajouté au planning équipe.");
}

async function init() {
  renderServices();
  renderStylists();
  setMinimumDate();
  await refreshBookings();
  updateTimes();
}

serviceSelect.addEventListener("change", updateTimes);
stylistSelect.addEventListener("change", updateTimes);
dateInput.addEventListener("change", async () => {
  await refreshBookings();
  updateTimes();
});
timeSelect.addEventListener("change", updateSummary);
bookingForm.addEventListener("submit", submitBooking);

init();
