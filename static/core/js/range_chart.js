class RangeChart {
    chart_name = null;

    date_indicator = {
        type: 'line',
        value: 'undefined',
        scaleID: 'x',
        borderColor: 'black',
    };

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
    };

    ds_timeseries = {
        label: 'Bottom Temperature Timeseries (°C)',
        data: [],
        borderColor: 'rgba(120, 20, 20)',
        borderWidth: 0.7,
        pointRadius: 0.0,
    };

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

    q_upper = 5.0;
    q_lower = 3.0;

    dial_min = -3;
    dial_max = 3;
    dial_cur = 0;
    dial_value = 0;
    dial_upper = 0;
    dial_lower = 0;
    dial_target = 0;
    dial = null;

    mpa_id = null;

    constructor(ctx_element, upper_limit=5.0, lower_limit=2.0) {
        this.get_chart_html(ctx_element);

        this.q_upper = upper_limit;
        this.q_lower = lower_limit;
    }

    initialize(ctx_element) {
        this.chart_name = ctx_element
        this.ctx = document.getElementById(ctx_element);

        this.timeseries_chart = new Chart(this.ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    this.ds_timeseries,
                    this.ds_climatology,
                    this.ds_upper_threshold,
                    this.ds_lower_threshold
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
                            filter: this.filter_legend,
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

        this.dial = $("#" + ctx_element + "_riskdial");
        this.dial.knob({
            "readOnly":true,
        });
        this.configure_dial();

        const chart_obj = this

        $("#" + chart_obj.chart_name + "_q_upper").val(this.q_upper);
        $("#" + chart_obj.chart_name + "_q_lower").val(this.q_lower);

        this.update_btn = $("#btn_" + ctx_element + "_update_thresholds");
        this.update_btn.on('click', function(e) {chart_obj.update_thresholds()});
        chart_obj.update_thresholds().then(
            chart_obj.initialized()
        );

        $("#" + ctx_element + "_select_id_species").on('change', function(e) {chart_obj.get_species_range(e)});
    }

    initialized() {};

    get_chart_html(chart_name, url="/range_chart/", append_to="div_id_range_card") {
        const chart_obj = this;
        url = url + '?chart_name=' + chart_name;
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
        });
    }

    set_loading(loading) {
        if(loading) {
            $("#" + this.chart_name + "_loading_chart").addClass("loader");
            $("#" + this.chart_name).hide();
        } else {
            $("#" + this.chart_name + "_loading_chart").removeClass("loader");
            $("#" + this.chart_name).show();
        }
    }

    filter_legend(legendItem, data) {
        if(legendItem.datasetIndex === 2 || legendItem.datasetIndex === 3 ) {
            return null;
        }
        legendItem.lineWidth = 2;
        return legendItem;
    }

    update_chart() {
        this.timeseries_chart.update();
        this.timeseries_chart.resetZoom();
    }

    clear_timeseries() {
        this.dial_cur = 0;
        this.configure_dial();

        this.mpa_id = null;
        this.timeseries_chart.data.labels = [];
        this.ds_timeseries.data = [];
        this.ds_climatology.data = [];

        this.date_indicator.value = "undefined";
        this.update_chart();
    }


    async get_species_range(event) {
        const selected_id = event.target.value
        const url = '/species_range/' + selected_id + "/"
        const chart_obj = this;
        await $.ajax({
            method: "GET",
            url: url,
            beforeSend: function () {
                $("#" + chart_obj.chart_name + "_loading_threshold").addClass("loader-sm");
            },
            success: function(data) {
                chart_obj.q_upper = data.upper;
                chart_obj.q_lower = data.lower;
            },
            error: function (error_data) {
                console.log("error");
                console.log(error_data);
            },
            complete: function () {
                $("#" + chart_obj.chart_name + "_loading_threshold").removeClass("loader-sm");
            }
        }).then(function() {
            $("#" + chart_obj.chart_name + "_q_upper").val(chart_obj.q_upper);
            $("#" + chart_obj.chart_name + "_q_lower").val(chart_obj.q_lower);
            chart_obj.update_thresholds();
        });
    }

    async update_thresholds() {
        const chart_obj = this

        $("#" + chart_obj.chart_name + "_q_upper").on('input', function (e) {
            chart_obj.q_upper = parseFloat($(this).val());
        });

        $("#" + chart_obj.chart_name + "_q_lower").on('input', function (e) {
            chart_obj.q_lower = parseFloat($(this).val());
        });

        chart_obj.ds_upper_threshold.data = chart_obj.timeseries_chart.data.labels.map((x) => chart_obj.q_upper);
        chart_obj.ds_lower_threshold.data = chart_obj.timeseries_chart.data.labels.map((x) => chart_obj.q_lower);

        chart_obj.timeseries_chart.update();
    }

    update_timeseries_data(date_labels, temp_data, climate_data) {
        this.configure_dial();

        this.timeseries_chart.data.labels = date_labels;
        this.ds_timeseries.data = temp_data;
        this.ds_climatology.data = climate_data;

        this.update_thresholds();
        this.update_chart();
    }

    clickHandler(e) {
        const canvasPosition = Chart.helpers.getRelativePosition(e, this.timeseries_chart);
        const points = this.timeseries_chart.getElementsAtEventForMode(e, 'nearest', { intersect: false }, true);

        this.date_indicator.value = this.timeseries_chart.scales.x.getValueForPixel(canvasPosition.x);
        this.timeseries_chart.update();

        this.dial_target = 0;
        if(points.length) {
            this.set_selected_point(points[0]);
        }
        this.animate_dial();
    }

    set_selected_point(point) {
        const clim = this.ds_climatology.data[point.index];
        const timeseries = this.ds_timeseries.data[point.index];
        this.dial_target = timeseries - clim;
        this.dial_value = timeseries
        this.dial_upper = this.ds_upper_threshold.data[point.index]
        this.dial_lower = this.ds_lower_threshold.data[point.index]
    }

    configure_dial() {
        this.dial.trigger(
            'configure',
            {
                "min": this.dial_min,
                "max": this.dial_max,
                "angleOffset": -115,
                "angleArc": 230,
                "skin": "tron",
                "step": 0.001,
                "thickness": 0.25,
                "inputColor": "#000000",
            },
        )
        this.dial.val(this.dial_cur).trigger('change');
        this.get_dial_color();
    }

    get_dial_color() {
        let positive = (this.dial_value > this.dial_upper);
        let negative = (this.dial_value < this.dial_lower );
        let r = 255 * (negative ? 0.25 : (positive ? 1.0 : 0.25));
        let g = 255 * (negative ? 0.25 : (positive ? 0.25 : 1.0));
        let b = 255 * (negative ? 1.0 : 0.25);

        let color = "rgb(" + r + ", " + g + ", " + b + ")"
        this.dial.trigger('configure', {"fgColor": color});
    }

    animate_dial() {
        const chart_obj = this;
        $({
            animateVal: chart_obj.dial_cur
        }).animate({
            animateVal: chart_obj.dial_target
        }, {
            duration: 1000,
            easing: "swing",
            step: function() {
                chart_obj.dial_cur = this.animateVal;
                chart_obj.dial.val(chart_obj.dial_cur).trigger('change');
                chart_obj.get_dial_color()
            },
            complete: function() {
                chart_obj.dial_target = chart_obj.dial_target * -1;
                chart_obj.get_dial_color()
            }
        })
    }
}
