const FUTURE_YEAR = 2025;
let salesChart; // Global chart instance
let inventoryChart;

async function fetchSales(year) {
    try {
        const response = await fetch(`/sales/${year}`);
        if (!response.ok) throw new Error("Network response was not ok");
        return await response.json();
    } catch (error) {
        console.error("Fetch sales error:", error);
        return null;
    }
}

async function fetchPrediction(year) {
    try {
        const response = await fetch(`/predict/${year}`);
        if (!response.ok) throw new Error("Network response was not ok");
        return await response.json();
    } catch (error) {
        console.error("Fetch prediction error:", error);
        return null;
    }
}

async function fetchInventory() {
    try{
        const response = await fetch("/sub-category");
        if (!response.ok) throw new Error("Inventory response was not ok");
        return await response.json();
    }catch(error){
        console.error("Fetch inventory error:", error);
        return [];
    }
}

async function populateInventoryTable(selectedYear) {
    const inventorySection = document.getElementById("inventorySection");
    const tableBody = document.querySelector("#inventoryTable tbody");

    // if (selectedYear === FUTURE_YEAR) {
    //     inventorySection.style.display = "none";
    //     return;
    // }

    inventorySection.style.display = "block";
    tableBody.innerHTML = "";

    const inventoryData = await fetchInventory();
    if (!inventoryData.length) return;

    const labels = [];
    const currentSales = [];
    const futureSales = [];
    const growthRates = [];

    inventoryData.forEach(item => {
        const baseSales = Number(item.Sales_2024 || 0);
        const growth = Number(item.growth || 0);
        const predicted = baseSales * (1 + growth / 100);

        labels.push(item["Sub-Category"]);
        currentSales.push(baseSales.toFixed(2));
        futureSales.push(predicted.toFixed(2));
        growthRates.push(growth);

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item["Sub-Category"]}</td>
            <td>${baseSales.toFixed(2)}</td>
            <td>${predicted.toFixed(2)}</td>
            <td>${growth.toFixed(2)}%</td>
            <td>${item.campaignSuggestion || "-"}</td>
        `;
        tableBody.appendChild(row);
    });

    renderInventoryChart(labels, currentSales, futureSales, growthRates);
}




/* ===== Populate Table for Past Year ===== */
async function populateTable(year) {
    const tableBody = document.querySelector("#salesTable tbody");
    tableBody.innerHTML = "";

    const data = await fetchSales(year);
    if (!data) return;

    let actualSales = [];
    let predictedSales = [];
    let quarters = [];

    data.quarterlyBreakdown.forEach(item => {
        const quarterLabel = new Date(item.ds).toLocaleString("default", { month: "short" }) + " Q";
        quarters.push(quarterLabel);

        actualSales.push(item.actualSales.toFixed(2));
        predictedSales.push(item.predictedSales.toFixed(2));

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${quarterLabel} ${data.year}</td>
            <td>${item.actualSales.toFixed(2)}</td>
            <td>${item.actualProfit.toFixed(2)}</td>
            <td>${item.predictedSales.toFixed(2)}</td>
            <td>${item.absoluteError.toFixed(2)}</td>
            <td>${item.errorPercentage.toFixed(2)}%</td>
        `;
        tableBody.appendChild(row);
    });

    const summary = data.yearlySummary;
    const totalRow = document.createElement("tr");
    totalRow.innerHTML = `
        <th>Total</th>
        <th>${summary.totalActualSales.toFixed(2)}</th>
        <th>${summary.totalProfit.toFixed(2)}</th>
        <th>${summary.totalPredictedSales.toFixed(2)}</th>
        <th>${summary.totalAbsoluteError.toFixed(2)}</th>
        <th>${summary.totalErrorPercentage}%</th>
    `;
    tableBody.appendChild(totalRow);

    renderChart(quarters, actualSales, predictedSales, "Quarterly Sales vs Predicted Sales");
}


/* ===== Populate Table for Future Year ===== */
async function populatePrediction(year) {
    const tableBody = document.querySelector("#salesTable tbody");
    tableBody.innerHTML = "";

    const data = await fetchPrediction(year);
    if (!data) return;

    let months = [];
    let predictedSales = [];
    let actualSales = [];

    data.predicted.forEach(item => {
        const month = new Date(item.ds).toLocaleString("default", { month: "short" });
        months.push(month);
        predictedSales.push(item.yhat.toFixed(2));
        actualSales.push(0); // no actual sales

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${month} ${year}</td>
            <td>-</td>
            <td>-</td>
            <td>${item.yhat.toFixed(2)}</td>
            <td>-</td>
            <td>-</td>
        `;
        tableBody.appendChild(row);
    });

    const totalRow = document.createElement("tr");
    totalRow.innerHTML = `
        <th>Total</th>
        <th>-</th>
        <th>-</th>
        <th>${data.totalPredictedSales.toFixed(2)}</th>
        <th>-</th>
        <th>-</th>
    `;
    tableBody.appendChild(totalRow);

    renderChart(months, actualSales, predictedSales, `Predicted Sales for ${year}`);
}

/* ===== Render Chart ===== */
function renderChart(labels, actualSales, predictedSales, title) {
    const ctx = document.getElementById("salesChart").getContext("2d");

    if (salesChart) salesChart.destroy();

   
    const gradientActual = ctx.createLinearGradient(0, 0, 0, 400);
    gradientActual.addColorStop(0, "rgba(58, 123, 213, 0.5)");
    gradientActual.addColorStop(1, "rgba(58, 123, 213, 0.05)");

    const gradientPredicted = ctx.createLinearGradient(0, 0, 0, 400);
    gradientPredicted.addColorStop(0, "rgba(242, 100, 25, 0.5)");
    gradientPredicted.addColorStop(1, "rgba(242, 100, 25, 0.05)");

    salesChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Actual Sales",
                    data: actualSales,
                    borderColor: "#3A7BD5",        // Deep blue
                    backgroundColor: gradientActual,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 6,
                    pointBackgroundColor: "#3A7BD5",
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: "#3A7BD5",
                    pointHoverBorderColor: "#fff",
                    pointHoverBorderWidth: 2,
                    shadowOffsetX: 2,
                    shadowOffsetY: 2
                },
                {
                    label: "Predicted Sales",
                    data: predictedSales,
                    borderColor: "#F26419",        // Vibrant orange
                    backgroundColor: gradientPredicted,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    borderDash: [8, 4],            // Dashed line for predictions
                    pointRadius: 6,
                    pointBackgroundColor: "#F26419",
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: "#F26419",
                    pointHoverBorderColor: "#fff",
                    pointHoverBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: "index", intersect: false },
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 20, weight: "bold", family: "Arial" }
                },
                tooltip: {
                    mode: "nearest",
                    backgroundColor: "#333",
                    titleColor: "#fff",
                    bodyColor: "#fff",
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: $${context.formattedValue}`;
                        }
                    }
                },
                legend: {
                    position: "top",
                    labels: {
                        usePointStyle: true,
                        pointStyle: "circle",
                        padding: 15,
                        font: { size: 14, family: "Arial" }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: "rgba(0,0,0,0.05)",
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: "Sales ($)",
                        font: { size: 14, weight: "bold", family: "Arial" }
                    }
                },
                x: {
                    grid: { color: "rgba(0,0,0,0.05)" },
                    title: {
                        display: true,
                        text: "Month",
                        font: { size: 14, weight: "bold", family: "Arial" }
                    }
                }
            }
        }
    });
}

function renderInventoryChart(labels, currentSales, futureSales, growthRates) {
    const ctx = document.getElementById("inventoryChart").getContext("2d");

    if (inventoryChart) inventoryChart.destroy();

    const futureColors = growthRates.map(g =>
        g > 0 ? "rgba(46, 204, 113, 0.8)" :
        g < 0 ? "rgba(231, 76, 60, 0.8)" :
                "rgba(241, 196, 15, 0.8)"
    );

    inventoryChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Current Year Sales (2024)",
                    data: currentSales,
                    backgroundColor: "rgba(52, 152, 219, 0.8)", // blue
                    borderRadius: 8
                },
                {
                    label: "Future Year Sales (2025)",
                    data: futureSales,
                    backgroundColor: futureColors,
                    borderRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: "Inventory Sales Trend (Current vs Future)",
                    font: { size: 18, weight: "bold" }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            const i = ctx.dataIndex;
                            if (ctx.datasetIndex === 1) {
                                return `Future: $${ctx.formattedValue} (${growthRates[i]}%)`;
                            }
                            return `Current: $${ctx.formattedValue}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: false
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Sales ($)"
                    }
                }
            }
        }
    });
}




/* ===== Year Dropdown ===== */
function populateYearDropdown() {
    const select = document.getElementById("yearSelect");
    const currentYear = 2025;      // your current year
    const lastYear = currentYear - 1;

    // Include all years from lastYear to FUTURE_YEAR
    for (let y = lastYear; y <= FUTURE_YEAR; y++) {
        const option = document.createElement("option");
        option.value = y;
        option.textContent = y;
        select.appendChild(option);
    }

    // Set default selected year to last year
    select.value = lastYear;

    handleYearChange(select.value);

    select.addEventListener("change", () => {
        handleYearChange(select.value);
    });
}



function handleYearChange(year) {
    year = parseInt(year);

    if (year === FUTURE_YEAR) {
        populatePrediction(year);
    } else {
        populateTable(year);
    }
    populateInventoryTable(year);
}

window.addEventListener("DOMContentLoaded", populateYearDropdown);
