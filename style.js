function generateId(prefix) {
  return prefix + "_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
}

function formatDateISO(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

function formatNumber(num) {
  const n = Number(num) || 0;
  return n.toFixed(2);
}

function openWhatsApp(phone, message) {
  if (!phone) {
    alert("El paciente no tiene teléfono.");
    return;
  }
  const clean = phone.replace(/[^\d]/g, "");
  const text = encodeURIComponent(message || "Hola, le escribimos de la clínica dental.");
  const url = "https://wa.me/" + clean + "?text=" + text;
  window.open(url, "_blank");
}

function openCalendarEvent({ title, details, startDate, startTime }) {
  if (!startDate || !startTime) {
    alert("Faltan fecha u hora de la cita.");
    return;
  }
  const date = startDate.replace(/-/g, "");
  const time = startTime.replace(":", "") + "00";
  const start = date + "T" + time;
  const end = date + "T" + time;
  const url =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" +
    encodeURIComponent(title || "Cita dental") +
    "&details=" +
    encodeURIComponent(details || "") +
    "&dates=" +
    start +
    "/" +
    end;
  window.open(url, "_blank");
}
