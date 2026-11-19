import { requireRole, supabase } from "./supabaseClient.js";

const user = requireRole(["karyawan", "admin"]);
const elements = {
  yearsLoading: document.getElementById("years-loading"),
  yearsError: document.getElementById("years-error"),
  yearsEmpty: document.getElementById("years-empty"),
  yearsList: document.getElementById("years-list"),
  selectedYear: document.getElementById("selected-year"),
  monthsSection: document.getElementById("months-section"),
  monthsDescription: document.getElementById("months-description"),
  monthsLoading: document.getElementById("months-loading"),
  monthsError: document.getElementById("months-error"),
  monthsEmpty: document.getElementById("months-empty"),
  monthsList: document.getElementById("months-list"),
  selectedMonth: document.getElementById("selected-month"),
  calendarSection: document.getElementById("calendar-section"),
  calendarTitle: document.getElementById("calendar-title"),
  calendarDescription: document.getElementById("calendar-description"),
  calendarLoading: document.getElementById("calendar-loading"),
  calendarError: document.getElementById("calendar-error"),
  calendarGrid: document.getElementById("calendar-grid"),
  dateDetails: document.getElementById("date-details"),
  dateDetailsTitle: document.getElementById("date-details-title"),
  dateDetailsContent: document.getElementById("date-details-content"),
};

const PAGE_SIZE = 1000;
const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
let monthRequestId = 0;
let calendarRequestId = 0;
let activeCalendar = null;

function restrictToCurrentUser(query) {
  return user.role === "karyawan" ? query.eq("user_id", user.id) : query;
}

async function loadDistinctValues(column, year = null) {
  const values = new Set();
  let offset = 0;

  while (true) {
    let query = supabase
      .from("absensi")
      .select(column)
      .not(column, "is", null)
      .order(column, { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    query = restrictToCurrentUser(query);
    if (year !== null) query = query.eq("tahun", year);

    const { data, error } = await query;
    if (error) throw error;

    (data || []).forEach((row) => {
      const value = Number(row[column]);
      if (Number.isFinite(value)) values.add(value);
    });

    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return [...values].sort((a, b) => b - a);
}

function makePeriodCard({ label, value, className = "", onClick }) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `year-card ${className}`.trim();
  card.setAttribute("aria-pressed", "false");

  const cardLabel = document.createElement("span");
  cardLabel.className = "year-card-label";
  cardLabel.textContent = label;

  const cardValue = document.createElement("span");
  cardValue.className = "year-card-value";
  cardValue.textContent = value;

  card.append(cardLabel, cardValue);
  card.addEventListener("click", () => onClick(card));
  return card;
}

function markSelectedCard(list, selectedCard) {
  list.querySelectorAll(".year-card").forEach((card) => {
    card.setAttribute("aria-pressed", String(card === selectedCard));
  });
}

function hasAttendance(record) {
  return Boolean(record.jam_masuk || record.jam_pulang || record.jam || record.foto_masuk_url || record.foto_pulang_url || record.foto_url);
}

function isOffRecord(record) {
  if (hasAttendance(record)) return false;
  const note = String(record.keterangan || "").trim().toLocaleLowerCase("id-ID");
  return note === "off" || note.startsWith("off ") || note.includes("libur");
}

function dayStatus(records) {
  if (!records.length) return "no-record";
  if (records.some(hasAttendance)) return "has-record";
  if (records.some(isOffRecord)) return "off";
  return records.some((record) => String(record.keterangan || "").trim()) ? "note-status" : "no-record";
}

function refreshCalendarMarker(day) {
  if (!activeCalendar) return;
  const records = activeCalendar.records.filter((record) => Number(record.tanggal) === day);
  const status = dayStatus(records);
  const button = elements.calendarGrid.querySelector(`[data-day="${day}"]`);
  if (!button) return;
  button.classList.remove("has-record", "off", "note-status", "no-record");
  button.classList.add(status);
  const statusText = status === "has-record" ? "ada absensi" : status === "off" ? "OFF atau libur" : status === "note-status" ? "ada keterangan" : "belum tercatat";
  button.setAttribute("aria-label", `${day} ${monthNames[activeCalendar.month - 1]} ${activeCalendar.year}, ${statusText}`);
}

function resetMonthChoices() {
  elements.monthsList.replaceChildren();
  elements.monthsError.classList.add("hidden");
  elements.monthsEmpty.classList.add("hidden");
  elements.selectedMonth.classList.add("hidden");
  elements.calendarSection.classList.add("hidden");
  elements.calendarLoading.classList.add("hidden");
  elements.calendarError.classList.add("hidden");
  elements.calendarGrid.replaceChildren();
  elements.dateDetails.classList.add("hidden");
}

function formatTime(value) {
  if (!value) return "Belum tercatat";
  return String(value).slice(0, 8);
}

function appendPhoto(container, url, alt) {
  if (!url) return;
  try {
    const photoUrl = new URL(url, window.location.href);
    if (!['http:', 'https:'].includes(photoUrl.protocol)) return;
    const image = document.createElement("img");
    image.src = photoUrl.href;
    image.alt = alt;
    image.loading = "lazy";
    container.append(image);
  } catch {
    // Abaikan URL foto yang tidak valid.
  }
}

function renderEvent(title, time, photoUrl) {
  const event = document.createElement("div");
  event.className = "attendance-event";
  const heading = document.createElement("h5");
  heading.textContent = title;
  const timeText = document.createElement("p");
  timeText.textContent = formatTime(time);
  event.append(heading, timeText);
  appendPhoto(event, photoUrl, `Foto ${title.toLowerCase()}`);
  return event;
}

function attendanceNote(record) {
  const note = String(record.keterangan || "").trim();
  const complete = Boolean(record.jam_masuk && record.jam_pulang);
  if (!complete) return note || "Belum ada keterangan";
  if (!note || note.toLocaleLowerCase("id-ID") === "hadir") return "Hadir";
  return `Hadir · ${note}`;
}

function showDateDetails(year, month, day, records) {
  const date = new Date(year, month - 1, day);
  elements.dateDetailsTitle.textContent = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  elements.dateDetailsContent.replaceChildren();

  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "attendance-empty";
    empty.textContent = "Belum ada catatan absensi pada tanggal ini. Hari tanpa catatan belum tentu hari kerja.";
    elements.dateDetailsContent.append(empty);
  } else {
    records.forEach((record, index) => {
      const entry = document.createElement("article");
      entry.className = "attendance-record";
      let noteDisplay = null;

      if (user.role === "admin" || records.length > 1) {
        const title = document.createElement("p");
        title.className = "attendance-record-title";
        const employee = record.karyawan?.nama || record.karyawan?.username;
        title.textContent = employee || `Data lama · Catatan ${index + 1}`;
        entry.append(title);
      }

      if (hasAttendance(record)) {
        const events = document.createElement("div");
        events.className = "attendance-events";
        events.append(
          renderEvent("Absen Masuk", record.jam_masuk || record.jam, record.foto_masuk_url || record.foto_url),
          renderEvent("Absen Pulang", record.jam_pulang, record.foto_pulang_url),
        );
        entry.append(events);
      } else {
        const noAttendance = document.createElement("p");
        noAttendance.className = "attendance-empty";
        noAttendance.textContent = "Tidak ada jam atau foto absensi pada tanggal ini.";
        entry.append(noAttendance);
      }

      if (record.keterangan || hasAttendance(record)) {
        noteDisplay = document.createElement("p");
        noteDisplay.className = "attendance-note";
        noteDisplay.textContent = `Keterangan: ${attendanceNote(record)}`;
        entry.append(noteDisplay);
      }

      if (user.role === "admin") {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "btn secondary attendance-note-edit-button";
        editButton.textContent = "Edit Keterangan";
        const editor = document.createElement("div");
        editor.className = "attendance-note-editor hidden";
        const label = document.createElement("label");
        label.textContent = "Ubah keterangan";
        const textarea = document.createElement("textarea");
        textarea.rows = 2;
        textarea.maxLength = 500;
        textarea.value = record.keterangan || (record.jam_masuk && record.jam_pulang ? "Hadir" : "");
        textarea.setAttribute("aria-label", "Ubah keterangan absensi");
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.className = "btn primary";
        saveButton.textContent = "Simpan Keterangan";
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "btn secondary";
        cancelButton.textContent = "Batal";
        const status = document.createElement("span");
        status.className = "attendance-note-message";
        const actions = document.createElement("div");
        actions.className = "attendance-note-actions";
        label.append(textarea);
        actions.append(saveButton, cancelButton);
        editor.append(label, actions);
        editButton.addEventListener("click", () => {
          status.textContent = "";
          status.classList.remove("error");
          editButton.classList.add("hidden");
          editor.classList.remove("hidden");
          textarea.focus();
        });
        cancelButton.addEventListener("click", () => {
          textarea.value = record.keterangan || (record.jam_masuk && record.jam_pulang ? "Hadir" : "");
          status.textContent = "";
          status.classList.remove("error");
          editor.classList.add("hidden");
          editButton.classList.remove("hidden");
        });
        saveButton.addEventListener("click", async () => {
          const keterangan = textarea.value.trim() || null;
          saveButton.disabled = true;
          status.textContent = "Menyimpan...";
          try {
            const { data, error } = await supabase
              .from("absensi")
              .update({ keterangan })
              .eq("id", record.id)
              .select("id")
              .maybeSingle();
            if (error) throw error;
            if (!data) throw new Error("Data absensi tidak ditemukan atau tidak dapat diperbarui.");
            record.keterangan = keterangan;
            if (!noteDisplay) {
              noteDisplay = document.createElement("p");
              noteDisplay.className = "attendance-note";
              editButton.before(noteDisplay);
            }
            noteDisplay.textContent = `Keterangan: ${attendanceNote(record)}`;
            status.textContent = "Keterangan berhasil diperbarui.";
            status.classList.remove("error");
            refreshCalendarMarker(Number(record.tanggal));
            editor.classList.add("hidden");
            editButton.classList.remove("hidden");
          } catch (error) {
            status.textContent = `Gagal menyimpan: ${error.message || "Terjadi kesalahan."}`;
            status.classList.add("error");
          } finally {
            saveButton.disabled = false;
          }
        });
        entry.append(editButton, editor, status);
      }

      elements.dateDetailsContent.append(entry);
    });
  }

  elements.dateDetails.classList.remove("hidden");
}

function renderCalendar(year, month, records) {
  const monthName = monthNames[month - 1];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const recordsByDay = new Map();
  activeCalendar = { year, month, records };

  records.forEach((record) => {
    const day = Number(record.tanggal);
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth) return;
    const dayRecords = recordsByDay.get(day) || [];
    dayRecords.push(record);
    recordsByDay.set(day, dayRecords);
  });

  elements.calendarGrid.replaceChildren();
  for (let blank = 0; blank < firstWeekday; blank += 1) {
    const placeholder = document.createElement("span");
    placeholder.className = "calendar-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    elements.calendarGrid.append(placeholder);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayRecords = recordsByDay.get(day) || [];
    const button = document.createElement("button");
    button.type = "button";
    const statusText = dayStatus(dayRecords);
    const statusLabel = statusText === "has-record" ? "ada absensi" : statusText === "off" ? "OFF atau libur" : statusText === "note-status" ? "ada keterangan" : "belum tercatat";
    button.className = `calendar-day ${statusText}`;
    button.setAttribute("aria-pressed", "false");
    button.dataset.day = String(day);
    button.setAttribute("aria-label", `${day} ${monthName} ${year}, ${statusLabel}`);

    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = String(day);
    const status = document.createElement("span");
    status.className = "calendar-day-state";
    status.setAttribute("aria-hidden", "true");
    button.append(number, status);
    button.addEventListener("click", () => {
      elements.calendarGrid.querySelectorAll(".calendar-day").forEach((dateButton) => {
        dateButton.setAttribute("aria-pressed", String(dateButton === button));
      });
      showDateDetails(year, month, day, dayRecords);
    });
    elements.calendarGrid.append(button);
  }

  elements.calendarTitle.textContent = `Kalender Absensi · ${monthName} ${year}`;
  elements.calendarDescription.textContent = "Pilih tanggal untuk melihat jam masuk, jam pulang, foto, dan keterangan yang tersimpan.";
  elements.calendarSection.classList.remove("hidden");
  elements.dateDetails.classList.add("hidden");
}

async function selectMonth(year, month, card) {
  const requestId = ++calendarRequestId;
  markSelectedCard(elements.monthsList, card);
  elements.selectedMonth.textContent = `${monthNames[month - 1]} ${year} dipilih.`;
  elements.selectedMonth.classList.remove("hidden");
  elements.calendarSection.classList.remove("hidden");
  elements.calendarGrid.replaceChildren();
  elements.dateDetails.classList.add("hidden");
  elements.calendarTitle.textContent = `Kalender Absensi · ${monthNames[month - 1]} ${year}`;
  elements.calendarDescription.textContent = "Sedang memuat tanggal absensi...";
  elements.monthsError.classList.add("hidden");
  elements.calendarError.classList.add("hidden");
  elements.calendarLoading.classList.remove("hidden");

  try {
    let offset = 0;
    const records = [];
    while (true) {
      let query = supabase
        .from("absensi")
        .select("id,user_id,tanggal,bulan,tahun,jam_masuk,foto_masuk_url,jam_pulang,foto_pulang_url,jam,foto_url,keterangan,karyawan(nama,username)")
        .eq("tahun", year)
        .eq("bulan", month)
        .order("tanggal", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      query = restrictToCurrentUser(query);

      const { data, error } = await query;
      if (error) throw error;
      records.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    if (requestId !== calendarRequestId) return;
    renderCalendar(year, month, records);
  } catch (error) {
    if (requestId !== calendarRequestId) return;
    elements.calendarError.textContent = `Data tanggal gagal dimuat: ${error.message || "Terjadi kesalahan."}`;
    elements.calendarError.classList.remove("hidden");
  } finally {
    if (requestId === calendarRequestId) elements.calendarLoading.classList.add("hidden");
  }
}

async function selectYear(year, card) {
  const requestId = ++monthRequestId;
  calendarRequestId += 1;
  markSelectedCard(elements.yearsList, card);
  elements.selectedYear.textContent = `Tahun ${year} dipilih.`;
  elements.selectedYear.classList.remove("hidden");
  elements.monthsDescription.textContent = `Bulan yang memiliki data absensi pada tahun ${year}.`;
  elements.monthsSection.classList.remove("hidden");
  resetMonthChoices();
  elements.monthsLoading.classList.remove("hidden");

  try {
    const months = await loadDistinctValues("bulan", year);
    if (requestId !== monthRequestId) return;

    const validMonths = months.filter((month) => month >= 1 && month <= 12).sort((a, b) => a - b);
    elements.monthsEmpty.classList.toggle("hidden", validMonths.length > 0);
    validMonths.forEach((month) => {
      const monthCard = makePeriodCard({
        label: `Bulan ${String(month).padStart(2, "0")}`,
        value: monthNames[month - 1],
        className: "month-card",
        onClick: (selectedCard) => selectMonth(year, month, selectedCard),
      });
      elements.monthsList.append(monthCard);
    });
  } catch (error) {
    if (requestId !== monthRequestId) return;
    elements.monthsError.textContent = `Daftar bulan gagal dimuat: ${error.message || "Terjadi kesalahan."}`;
    elements.monthsError.classList.remove("hidden");
  } finally {
    if (requestId === monthRequestId) elements.monthsLoading.classList.add("hidden");
  }
}

function renderYears(years) {
  elements.yearsList.replaceChildren();
  elements.yearsEmpty.classList.toggle("hidden", years.length > 0);

  years.forEach((year) => {
    const card = makePeriodCard({
      label: "Tahun absensi",
      value: String(year),
      onClick: (selectedCard) => selectYear(year, selectedCard),
    });
    elements.yearsList.append(card);
  });
}

async function loadYears() {
  try {
    const years = await loadDistinctValues("tahun");
    renderYears(years);
  } catch (error) {
    elements.yearsError.textContent = `Daftar tahun gagal dimuat: ${error.message || "Terjadi kesalahan."}`;
    elements.yearsError.classList.remove("hidden");
  } finally {
    elements.yearsLoading.classList.add("hidden");
  }
}

if (user) loadYears();
