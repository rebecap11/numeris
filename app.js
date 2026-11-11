/* Numeris — lógica da aplicação. */
"use strict";

let meaningsData = {};
let meaningsFailed = false;
let meaningsReady = null;
let evolutionChart = null;
let currentSelectedElement = null;
let lastFocused = null;

const NO_MEANING = "Não existe interpretação definida para este valor.";

const $ = (selector) => document.querySelector(selector);

function sumDigitsOnce(value) {
  const n = Math.abs(Math.trunc(Number(value) || 0));
  if (n < 10) return n;
  return String(n).split("").reduce((sum, digit) => sum + Number(digit), 0);
}

function parseLocalDate(value) {
  // setFullYear evita que anos < 100 sejam interpretados como 19xx.
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(2000, 0, 1, 12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date;
}

function calculateNumerology(birthDate) {
  const day = birthDate.getDate();
  const month = birthDate.getMonth() + 1;
  const year = birthDate.getFullYear();
  const dayStr = String(day).padStart(2, "0");
  const monthStr = String(month).padStart(2, "0");
  const yearStr = String(year);
  const dateDigits = `${dayStr}${monthStr}${yearStr}`;
  const sumRaw = [...dateDigits].reduce((sum, digit) => sum + Number(digit), 0);
  const sumOnce = sumDigitsOnce(sumRaw);
  const firstDigitOfDay = Number(String(day)[0]);
  // Se der negativo, passa a positivo (ex.: -6 → 6).
  const thirdRaw = Math.abs(sumRaw - 2 * firstDigitOfDay);
  const thirdReduced = sumDigitsOnce(thirdRaw);

  const numbersUsed = [
    { category: "day", label: "Dia", value: day },
    { category: "month", label: "Mês", value: month },
    { category: "year", label: "Ano", value: year },
    { category: "destiny", label: "Soma", value: sumRaw },
    { category: "destiny_reduced", label: "Reduzido", value: sumOnce },
    { category: "lifelesson", label: "Lição", value: thirdRaw },
    { category: "lifelesson_reduced", label: "Lição reduzida", value: thirdReduced }
  ];

  const counts = Array(10).fill(0);
  for (const item of numbersUsed) {
    for (const digit of String(Math.abs(item.value))) {
      if (digit >= "0" && digit <= "9") counts[Number(digit)] += 1;
    }
  }

  return { birthDate, dayStr, monthStr, yearStr, sumRaw, sumOnce, thirdRaw, thirdReduced, numbersUsed, counts };
}

function getEvolutionCode(birthDate) {
  const product = birthDate.getDate() * (birthDate.getMonth() + 1) * birthDate.getFullYear();
  return String(product).split("").map(Number);
}

function setStatus(message, isError = false) {
  const status = $("#status-message");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function loadMeanings() {
  try {
    const response = await fetch("meanings.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    meaningsData = await response.json();
    meaningsFailed = false;
  } catch (error) {
    console.warn("Não foi possível carregar meanings.json:", error);
    meaningsData = {};
    meaningsFailed = true;
  }
}

function openPanel(element, title, description, symbol = "✳") {
  if (currentSelectedElement) currentSelectedElement.classList.remove("selected");
  currentSelectedElement = element || null;
  if (currentSelectedElement) currentSelectedElement.classList.add("selected");

  const panel = $("#right-panel");
  if (!panel.classList.contains("open")) lastFocused = document.activeElement;

  $("#panel-title").textContent = title || "Interpretação";

  const parts = (description || NO_MEANING)
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter(Boolean);
  const paragraphs = parts.map((text) => {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  });
  $("#description-text").replaceChildren(...paragraphs);
  $("#interpretation-number").textContent = symbol;

  panel.inert = false;
  panel.classList.add("open");
  $("#panel-backdrop").classList.add("visible");
  document.body.style.overflow = "hidden";
  $("#close-panel").focus();
}

function closePanel(restoreFocus = true) {
  const panel = $("#right-panel");
  const wasOpen = panel.classList.contains("open");
  panel.classList.remove("open");
  panel.inert = true;
  $("#panel-backdrop").classList.remove("visible");
  document.body.style.overflow = "";
  if (currentSelectedElement) currentSelectedElement.classList.remove("selected");
  currentSelectedElement = null;
  if (wasOpen && restoreFocus && lastFocused && document.contains(lastFocused)) {
    lastFocused.focus();
  }
  lastFocused = null;
}

function findMeaning(list, number, occurrences) {
  if (!Array.isArray(list)) return null;
  return list.find(item =>
    Number(item.number) === Number(number) &&
    (occurrences === undefined || Number(item.occurrences) === Number(occurrences))
  ) || null;
}

function showMeaning(element, item, fallbackTitle, symbol) {
  openPanel(element, item?.title || fallbackTitle, item?.description || NO_MEANING, symbol);
}

function handleMatrixClick(number, occurrences, element) {
  const found = findMeaning(meaningsData.matrix, number, occurrences);
  showMeaning(element, found, `Número ${number} · ${occurrences} ocorrências`, String(number));
}

function handleNumberClick(category, number, element, label) {
  const found = findMeaning(meaningsData.meanings?.[category], number);
  showMeaning(element, found, `${label}: ${number}`, String(number));
}

function handleSubcycleClick(value, element, index) {
  const found = findMeaning(meaningsData.meanings?.subcycle, value);
  showMeaning(element, found, `Subciclo ${value} · posição ${index + 1}`, String(value));
}

function renderNumbers(numbers) {
  const container = $("#numbers-used-container");
  container.replaceChildren();
  numbers.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "number-item";
    const value = document.createElement("strong");
    value.textContent = item.value;
    const label = document.createElement("span");
    label.textContent = item.label;
    button.append(value, label);
    if (item.category === "year") {
      button.disabled = true;
      button.title = "O ano faz parte do cálculo, mas não tem interpretação individual nesta vista.";
    } else {
      button.addEventListener("click", () => handleNumberClick(item.category, item.value, button, item.label));
    }
    container.appendChild(button);
  });
}

function renderMatrix(counts) {
  for (let number = 1; number <= 9; number += 1) {
    const cell = $(`#c${number}`);
    const count = counts[number];
    cell.replaceChildren();

    const big = document.createElement("span");
    big.className = count === 0 ? "matrix-digit matrix-zero" : "matrix-digit";
    big.textContent = count === 0 ? "0" : String(number).repeat(count);
    // Reduz o tamanho da letra quando há muitas ocorrências, para não transbordar.
    big.style.fontSize = count > 7 ? ".85rem" : count > 5 ? "1rem" : count > 3 ? "1.25rem" : "";
    cell.appendChild(big);

    cell.setAttribute("aria-label", `Número ${number}, ${count} ${count === 1 ? "ocorrência" : "ocorrências"}`);
    cell.onclick = () => handleMatrixClick(number, count, cell);
  }
}

function buildEvolutionGrid(birthDate, codeValues) {
  const container = $("#evolution-grid-container");
  container.replaceChildren();
  const startYear = birthDate.getFullYear();
  const currentYear = new Date().getFullYear();
  const maxAge = 66;
  const rows = Math.ceil(maxAge / codeValues.length);

  codeValues.forEach((value, col) => {
    const column = document.createElement("div");
    column.className = "evolution-column";
    const header = document.createElement("button");
    header.type = "button";
    header.className = "evolution-column-header";
    header.textContent = value;
    header.setAttribute("aria-label", `Ver interpretação do subciclo ${value}`);
    header.addEventListener("click", () => handleSubcycleClick(value, header, col));
    column.appendChild(header);

    for (let row = 0; row < rows; row += 1) {
      const year = startYear + col + row * codeValues.length;
      if (year > startYear + maxAge) continue;
      const yearElement = document.createElement("div");
      yearElement.className = "evolution-year";
      yearElement.textContent = year;
      if (year === currentYear) {
        yearElement.classList.add("current-year");
        yearElement.title = "Ano atual";
      }
      column.appendChild(yearElement);
    }
    container.appendChild(column);
  });
}

function renderChart(codeValues) {
  const canvas = $("#evolutionChart");
  if (typeof Chart === "undefined") {
    if (canvas) {
      canvas.replaceWith(Object.assign(document.createElement("p"), {
        className: "microcopy",
        textContent: "O gráfico não ficou disponível. Verifica a ligação à internet e atualiza a página."
      }));
    }
    return;
  }
  if (evolutionChart) evolutionChart.destroy();

  evolutionChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: codeValues.map((_, index) => `Subciclo ${index + 1}`),
      datasets: [{
        label: "Número do subciclo",
        data: codeValues,
        borderColor: "#7655a2",
        backgroundColor: "rgba(118, 85, 162, .12)",
        pointBackgroundColor: "#7655a2",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        tension: .28,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false }
      },
      scales: {
        y: {
          min: 0, max: 9,
          ticks: { stepSize: 1, color: "#81798d" },
          grid: { color: "rgba(233, 227, 238, .8)" }
        },
        x: {
          ticks: { display: false },
          grid: { display: false }
        }
      },
      onClick: (_event, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        handleSubcycleClick(codeValues[index], null, index);
      }
    }
  });
}

function calculateAndRender(dateValue) {
  const birthDate = parseLocalDate(dateValue);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  if (Number.isNaN(birthDate.getTime()) || birthDate > endOfToday) {
    setStatus("Escolhe uma data válida que não esteja no futuro.", true);
    return;
  }
  if (birthDate.getFullYear() < 1900) {
    setStatus("Escolhe uma data a partir do ano 1900.", true);
    return;
  }

  const result = calculateNumerology(birthDate);
  const codeValues = getEvolutionCode(birthDate);

  $("#birthdate-summary").textContent = birthDate.toLocaleDateString("pt-PT", {
    day: "numeric", month: "long", year: "numeric"
  });
  renderNumbers(result.numbersUsed);
  renderMatrix(result.counts);
  buildEvolutionGrid(birthDate, codeValues);
  renderChart(codeValues);
  $("#results-section").hidden = false;
  closePanel(false);

  if (meaningsFailed) {
    setStatus("Mapa calculado, mas as interpretações não estão disponíveis (meanings.json não foi encontrado).", true);
  } else {
    setStatus("O teu mapa está pronto. Seleciona qualquer número para explorar a leitura.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Começa a carregar as interpretações logo à partida.
  meaningsReady = loadMeanings();

  $("#right-panel").inert = true;

  // Limites do campo de data (componentes locais, não UTC).
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  $("#birthdate").max = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  $("#birthdate").min = "1900-01-01";

  $("#numerology-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = $("#birthdate").value;
    if (!value) {
      setStatus("Introduz primeiro a tua data de nascimento.", true);
      return;
    }
    await meaningsReady;
    calculateAndRender(value);
  });

  $("#btn-grafico-info").addEventListener("click", () => {
    const panel = $("#grafico-info-panel");
    panel.hidden = !panel.hidden;
    $("#btn-grafico-info").setAttribute("aria-expanded", String(!panel.hidden));
  });

  $("#close-panel").addEventListener("click", () => closePanel());
  $("#panel-backdrop").addEventListener("click", () => closePanel());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $("#right-panel").classList.contains("open")) closePanel();
  });
});
