let ts_labels = [];
let ts_title = 'Timeseries';
let ts_data = [];

let cs_title = 'Climatology';
let cs_data = [];

const ctx = document.getElementById('mpa_time_series_chart');

const date_indicator = {
    type: 'line',
    value: 'undefined',
    scaleID: 'x',
    borderColor: 'black',
}

const max_indicator = {
    type: 'line',
    value: tolerance_max,
    scaleID: 'y',
    borderColor: 'red',
    borderWidth: 2
}

const min_indicator = {
    type: 'line',
    value: tolerance_min,
    scaleID: 'y',
    borderColor: 'red',
    borderWidth: 2
}

let timeseries_chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ts_labels,
        datasets: [{
            label: cs_title,
            data: cs_data,
            background: 'red',
            borderWidth: 1,
            pointRadius: 0.9,
            fill: {
                target: '+1',
                above: 'purple',
                below: 'orange'
            },
        },
        {
            label: ts_title,
            data: ts_data,
            borderWidth: 1,
            background: 'blue',
            pointRadius: 0.9
        }]
    },
    options: {
        maintainAspectRatio: false,
        interaction: {
            mode: 'x'
        },
        scales: {
            x: {
                type: 'timeseries',
                min: '1993-01-01 00:00:00',
                max: '2024-12-31 11:59:00',
                title: {
                    display: true,
                    text: "Date"
                },
            },
            y: {
                title: {
                    display: true,
                    text: "Temperature (C)"
                }
            },
        },
        plugins: {
            annotation: {
                annotations: {
                    date_indicator,
                    // max_indicator,
                    // min_indicator
                }
            },
            zoom: {
                zoom: {
                    wheel: {
                        enabled: true,
                    },
                    pinch: {
                        enabled: true,
                    },
                    mode: 'x',
                },
                pan: {
                    enabled: true,
                    mode: 'x',
                }
            },
        }
    }
});

function update_chart() {
    timeseries_chart.data.labels = ts_labels;
    timeseries_chart.data.datasets[1].label = ts_title;
    timeseries_chart.data.datasets[1].data = ts_data;

    timeseries_chart.data.datasets[0].label = cs_title;
    timeseries_chart.data.datasets[0].data = cs_data;

    timeseries_chart.update();
    timeseries_chart.resetZoom();
}

function clickHandler(e) {
    const canvasPosition = Chart.helpers.getRelativePosition(e, timeseries_chart);
    const dataX = timeseries_chart.scales.x.getValueForPixel(canvasPosition.x);
    const dataY = timeseries_chart.scales.y.getValueForPixel(canvasPosition.y);
    label_date = new Date(dataX);

    date_indicator.value = dataX;
    timeseries_chart.update();

    const points = timeseries_chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
    dial_target = 0;
    if(points.length) {
        const firstPoint = points[0];
        const clim = timeseries_chart.data.datasets[0].data[firstPoint.index];
        const timeseries = timeseries_chart.data.datasets[1].data[firstPoint.index];
        dial_target = timeseries - clim;
    }
    animate_dial();
}

timeseries_chart.canvas.onclick = clickHandler;