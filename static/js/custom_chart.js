let ts_labels = [];
let ts_title = 'Bottom Temperature Timeseries (°C)';
let ts_data = [];

let cs_title = 'Bottom Temperature Climatology (°C)';
let cs_data = [];

let lower_threshold_title = 'Lower Threshold';
let lower_threshold_data = [];

let upper_threshold_title = 'Upper Threshold';
let upper_threshold_data = [];

const ctx = document.getElementById('mpa_time_series_chart');

const date_indicator = {
    type: 'line',
    value: 'undefined',
    scaleID: 'x',
    borderColor: 'black',
}

const ds_climatology = {
    label: cs_title,
    data: cs_data,
    borderColor: 'black',
    borderWidth: 0.7,
    pointRadius: 0.5,
    fill: {
        target: '0',
        above: 'rgba(100, 100, 255, 0.4)',
        below: 'rgba(255, 100, 100, 0.4)'
    },
}

const ds_timeseries = {
    label: ts_title,
    data: ts_data,
    borderWidth: 1,
    borderColor: 'red',
    pointRadius: 0
}

const ds_upper_threshold = {
    label: upper_threshold_title,
    data: upper_threshold_data,
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    borderWidth: 0,
    pointRadius: 0,
    fill: {
        target: '0',
        below: 'red',
    },
}

const ds_lower_threshold = {
    label: lower_threshold_title,
    data: lower_threshold_data,
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    borderWidth: 0,
    pointRadius: 0,
    fill: {
        target: '0',
        above: 'blue',
    },
}

let timeseries_chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ts_labels,
        datasets: [
            ds_timeseries,
            ds_climatology,
            ds_upper_threshold,
            ds_lower_threshold,
        ]
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
            legend: {
                labels: {
                    filter: function(legendItem, data) {
                        if(legendItem.datasetIndex == 2 || legendItem.datasetIndex == 3 ) {
                            return null;
                        }
                        legendItem.lineWidth = 2;
                        return legendItem;
                    },
                    boxHeight: 1
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
    ds_climatology.data = cs_data;
    ds_timeseries.data = ts_data;
    ds_lower_threshold.data = lower_threshold_data;
    ds_upper_threshold.data = upper_threshold_data;

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

    const points = timeseries_chart.getElementsAtEventForMode(e, 'nearest', { intersect: false }, true);
    dial_target = 0;
    if(points.length) {
        const firstPoint = points[0];
        const clim = ds_climatology.data[firstPoint.index];
        const timeseries = ds_timeseries.data[firstPoint.index];
        dial_target = timeseries - clim;
        dial_value = timeseries
        dial_upper = ds_upper_threshold.data[firstPoint.index]
        dial_lower = ds_lower_threshold.data[firstPoint.index]
    }
    animate_dial();
}

timeseries_chart.canvas.onclick = clickHandler;
