let ts_labels = [];
let ts_data = [];
let ts_title = '';
const ctx = document.getElementById('myChart');
let timeseries_chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ts_labels,
        datasets: [{
            label: ts_title,
            data: ts_data,
            borderWidth: 1
        }]
    },
    options: {
        maintainAspectRatio: false,
        scales: {
            x: {
                type: 'timeseries',
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
            }
        },
        plugins: {
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
    timeseries_chart.data.labels = ts_labels
    timeseries_chart.data.datasets[0].label = ts_title
    timeseries_chart.data.datasets[0].data = ts_data
    timeseries_chart.update();
    timeseries_chart.resetZoom();
}

function clickHandler(e) {
    const canvasPosition = Chart.helpers.getRelativePosition(e, timeseries_chart);
    const dataX = timeseries_chart.scales.x.getValueForPixel(canvasPosition.x);
    const dataY = timeseries_chart.scales.y.getValueForPixel(canvasPosition.y);
    label_date = new Date(dataX);

    console.log(label_date.toString());
    console.log(dataY);
    dial_target = dataY;
    animate_dial();
}

timeseries_chart.canvas.onclick = clickHandler;
