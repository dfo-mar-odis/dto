class OceanChart {
    date_indicator = {
        type: 'line',
        value: 'undefined',
        scaleID: 'x',
        borderColor: 'black',
    }

    ds_climatology = {
        label: 'Bottom Temperature Climatology (°C)',
        data: [],
        borderColor: 'black',
        borderWidth: 0.7,
        pointRadius: 0.0,
        fill: {
            target: '0',
            above: 'rgba(150, 150, 255, 0.4)',
            below: 'rgba(255, 150, 150, 0.4)'
        },
    }

    ds_timeseries = {
        label: 'Bottom Temperature Timeseries (°C)',
        data: [],
        borderColor: 'rgba(120, 20, 20)',
        borderWidth: 0.7,
        pointRadius: 0.0,
    }

    ds_upper_threshold = {
        label: 'Upper Threshold',
        data: [],
        backgroundColor: 'rgba(128, 128, 128, 0.4)',
        borderWidth: 0.5,
        borderColor: 'grey',
        pointRadius: 0,
        fill: {
            target: '0',
            below: 'rgba(255, 75, 75)',
        },
    }

    ds_lower_threshold = {
        label: 'Lower Threshold',
        data: [],
        backgroundColor: 'rgba(128, 128, 128, 0.4)',
        borderWidth: 0.5,
        borderColor: 'grey',
        pointRadius: 0,
        fill: {
            target: '0',
            above: 'blue',
        },
    }

    constructor(ctx_element) {
        this.ctx = document.getElementById(ctx_element);

        this.timeseries_chart = new Chart(this.ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    this.ds_timeseries,
                    this.ds_climatology,
                    this.ds_upper_threshold,
                    this.ds_lower_threshold,
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
                            date_indeicator: this.date_indicator,
                            // max_indicator,
                            // min_indicator
                        }
                    },
                    legend: {
                        labels: {
                            filter: function(legendItem, data) {
                                if(legendItem.datasetIndex === 2 || legendItem.datasetIndex === 3 ) {
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
        })

        let ocean_obj = this;
        this.ctx.onclick = function(e) {
            ocean_obj.clickHandler(e)
        }

    }

    update_chart() {
        this.timeseries_chart.update();
        this.timeseries_chart.resetZoom();
    }

    clickHandler(e) {
        const canvasPosition = Chart.helpers.getRelativePosition(e, this.timeseries_chart);
        const points = this.timeseries_chart.getElementsAtEventForMode(e, 'nearest', { intersect: false }, true);

        this.date_indicator.value = this.timeseries_chart.scales.x.getValueForPixel(canvasPosition.x);
        this.timeseries_chart.update();

        dial_target = 0;
        if(points.length) {
            const firstPoint = points[0];
            const clim = this.ds_climatology.data[firstPoint.index];
            const timeseries = this.ds_timeseries.data[firstPoint.index];
            dial_target = timeseries - clim;
            dial_value = timeseries
            dial_upper = this.ds_upper_threshold.data[firstPoint.index]
            dial_lower = this.ds_lower_threshold.data[firstPoint.index]
        }
        animate_dial();

    }

}
