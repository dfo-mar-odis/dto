window.ChartComponents = window.ChartComponents || {};

if (!window.ChartComponents.RangeChart) {
    window.ChartComponents.RangeChart = class StandardAnomaliesChart {
        chart_name = null;

        years = [];

        temperatureAnomalies = [];

        backgroundColors = this.temperatureAnomalies.map(value =>
            value >= 0 ? 'rgba(255, 99, 132, 0.6)' : 'rgba(54, 162, 235, 0.6)'
        );

        borderColors = this.temperatureAnomalies.map(value =>
            value >= 0 ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)'
        );

        ds_temperatureAnomalies = {
            label: 'Temperature Anomaly (σ)',
            data: this.temperatureAnomalies,
            backgroundColor: this.backgroundColors,
            borderColor: this.borderColors,
            borderWidth: 1
        }

        constructor(ctx_element, data_url, upper_limit = 5.0, lower_limit = 2.0) {
            this.data_url = data_url
            this.get_chart_html(ctx_element);
        }

        initialize(ctx_element) {
            this.chart_name = ctx_element
            this.ctx = document.getElementById(ctx_element);

            this.timeseries_chart = new Chart(this.ctx, {
                type: 'bar',
                data: {
                    labels: this.years,
                    datasets: [
                        this.ds_temperatureAnomalies
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Yearly Temperature Standard Anomaly',
                            font: {
                                size: 16
                            }
                        },
                        legend: {
                            display: true
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    const value = context.parsed.y;
                                    label += value > 0 ? '+' + value.toFixed(2) : value.toFixed(2);
                                    label += ' σ';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: function (context) {
                                    if (context.tick.value === 0) {
                                        return 'rgba(0, 0, 0, 0.8)'; // Bold line at zero
                                    }
                                    return 'rgba(0, 0, 0, 0.1)';
                                },
                                lineWidth: function (context) {
                                    if (context.tick.value === 0) {
                                        return 2; // Thicker line at zero
                                    }
                                    return 1;
                                }
                            },
                            ticks: {
                                callback: function (value) {
                                    return value + ' σ';
                                }
                            },
                            title: {
                                display: true,
                                text: 'Temperature Anomaly (σ)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            title: {
                                display: true,
                                text: 'Year'
                            }
                        }
                    }
                }
            });
            this.initialized();
        }

        initialized() {
        };

        post_initialize() {
        };

        set_loading(loading) {
        }

        set_zoom(start_date, end_date) {
        }

        get_chart_html(chart_name, append_to = "div_id_stda_card") {
            const chart_obj = this;
            let url = this.data_url + '?chart_name=' + chart_name;
            $.ajax({
                method: "GET",
                url: url,
                success: function (data) {
                    $("#" + append_to).append(data);
                    chart_obj.initialize(chart_name);
                },
                error: function (error_data) {
                    console.log("error");
                    console.log(error_data);
                },
                complete: function (data) {
                    chart_obj.post_initialize()
                }
            });
        }

        clear_data() {
            this.mpa_id = null;
            this.timeseries_chart.data.labels = [];
            this.update_chart();
        }

        update_data(date_labels, temp_data) {

            this.timeseries_chart.data.labels = date_labels;
            this.ds_temperatureAnomalies.data = temp_data

            // Update backgroundColor and borderColor based on new data
            this.backgroundColors = temp_data.map(value =>
                value >= 0 ?
                    (value < 1 ?
                        (value < 0.5 ? 'rgba(255, 99, 99, 0.4)' : 'rgba(255, 99, 99, 0.6)') :
                        (value < 1.5 ? 'rgba(255, 99, 99, 0.8)' : 'rgba(255, 99, 99, 1.0)')) :
                    (value > -1 ?
                        (value > -0.5 ? 'rgba(99, 99, 255, 0.4)' : 'rgba(99, 99, 255, 0.6)') :
                        (value > -1.5 ? 'rgba(99, 99, 255, 0.8)' : 'rgba(99, 99, 255, 1.0)'))
            );
            this.borderColors = temp_data.map(value =>
                value >= 0 ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)'
            );
            this.ds_temperatureAnomalies.backgroundColor = this.backgroundColors;
            this.ds_temperatureAnomalies.borderColor = this.borderColors;

            this.update_chart();
        }

        update_chart() {
            this.timeseries_chart.update();
        }

    }
}