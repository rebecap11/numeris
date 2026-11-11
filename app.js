/* Numeris — lógica da aplicação. */
"use strict";

let meaningsData = {};
let evolutionChart = null;
let currentSelectedElement = null;
let lastResult = null;

const $ = (selector) => document.querySelector(selector);

function sumDigitsOnce(value) {
  const n = Math.abs(Math.trunc(Number(value) || 0));
  if (n < 10) return n;
  return String(n).split("").reduce((sum, digit) => sum + Number(digit), 0);
}

function parseLocalDate(value) {
  // Evita o desvio de um dia causado por new Date("AAAA-MM-DD") em fusos horários.
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
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
  const thirdRaw = sumRaw - 2 * firstDigitOfDay;
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
    const response = await fetch("meanings.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    meaningsData = await response.json();
  } catch (error) {
    console.warn("Não foi possível carregar meanings.json:", error);
    meaningsData = {};
    setStatus("Mapa calculado. As interpretações não estão disponíveis porque meanings.json não foi encontrado.", true);
  }
}

function openPanel(element, title, description, symbol = "✳") {
  if (currentSelectedElement) currentSelectedElement.classList.remove("selected");
  currentSelectedElement = element || null;
  if (currentSelectedElement) currentSelectedElement.classList.add("selected");

  $("#panel-title").textContent = title || "Interpretação";
  $("#description-text").replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = title || "Interpretação";
  const paragraph = document.createElement("p");
  paragraph.textContent = description || "Significado ainda não definido. Adiciona esta interpretação em meanings.json.";
  $("#description-text").append(heading, paragraph);
  $("#interpretation-number").textContent = symbol;
  $("#right-panel").classList.add("open");
  $("#right-panel").setAttribute("aria-hidden", "false");
  $("#panel-backdrop").classList.add("visible");
  $("#close-panel").focus();
}

function closePanel() {
  $("#right-panel").classList.remove("open");
  $("#right-panel").setAttribute("aria-hidden", "true");
  $("#panel-backdrop").classList.remove("visible");
  if (currentSelectedElement) currentSelectedElement.classList.remove("selected");
  currentSelectedElement = null;
}

function findMeaning(list, number, occurrences) {
  if (!Array.isArray(list)) return null;
  return list.find(item =>
    Number(item.number) === Number(number) &&
    (occurrences === undefined || Number(item.occurrences) === Number(occurrences))
  ) || null;
}

function showMeaning(element, item, fallback, symbol) {
  openPanel(element, item?.title || fallback, item?.description || "Significado ainda não definido. Podes acrescentá-lo em meanings.json.", symbol);
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
    cell.append(document.createTextNode(count ? String(number).repeat(count) : "0"));
    const small = document.createElement("small");
    small.textContent = `${count} ${count === 1 ? "ocorrência" : "ocorrências"}`;
    cell.appendChild(small);
    cell.setAttribute("aria-label", `Número ${number}, ${count} ocorrências`);
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
    canvas.replaceWith(Object.assign(document.createElement("p"), {
      className: "microcopy",
      textContent: "O gráfico não ficou disponível. Verifica a ligação à internet e atualiza a página."
    }));
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
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
    setStatus("Escolhe uma data válida que não esteja no futuro.", true);
    return;
  }
  const result = calculateNumerology(birthDate);
  const codeValues = getEvolutionCode(birthDate);
  lastResult = result;

  $("#birthdate-summary").textContent = birthDate.toLocaleDateString("pt-PT", {
    day: "numeric", month: "long", year: "numeric"
  });
  renderNumbers(result.numbersUsed);
  renderMatrix(result.counts);
  buildEvolutionGrid(birthDate, codeValues);
  renderChart(codeValues);
  $("#results-section").hidden = false;
  closePanel();
  setStatus("O teu mapa está pronto. Seleciona qualquer número para explorar a leitura.");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadMeanings();

  $("#numerology-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = $("#birthdate").value;
    if (!value) {
      setStatus("Introduz primeiro a tua data de nascimento.", true);
      return;
    }
    calculateAndRender(value);
  });

  $("#btn-grafico-info").addEventListener("click", () => {
    const panel = $("#grafico-info-panel");
    panel.hidden = !panel.hidden;
    $("#btn-grafico-info").setAttribute("aria-expanded", String(!panel.hidden));
  });

  $("#close-panel").addEventListener("click", closePanel);
  $("#panel-backdrop").addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });
});
