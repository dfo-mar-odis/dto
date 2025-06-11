window.ChartComponents = window.ChartComponents || {};

if (!window.ChartComponents.RangeChart) {
    window.ChartComponents.RangeChart = class RangeChart {
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
                below: 'rgba(255, 150, 150, 0.4)',

            },
        };

        ds_timeseries = {
            label: 'Bottom Temperature Timeseries (°C)',
            data: [],
            borderColor: 'rgba(120, 20, 20)',
            borderWidth: 1,
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

        depth = null;

        q_upper = 5.0;
        q_lower = 3.0;

        dial_min = -3.00;
        dial_max = 3.00;
        dial_cur = 0.00;
        dial_value = 0;
        dial_upper = 0;
        dial_lower = 0;
        dial_target = 0;
        dial = null;

        mpa_id = null;

        constructor(ctx_element, data_url, upper_limit = 5.0, lower_limit = 2.0) {
            this.data_url = data_url

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
                    animation: false,
                    interaction: {
                        mode: 'x'
                    },
                    scales: {
                        x: {
                            type: 'timeseries',
                            min: new Date('1993-01-01 00:00').valueOf(),
                            max: new Date('9999-12-31 11:59').valueOf(),
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
                            },
                            limits: {
                                x: {
                                    min: new Date('1993-01-01 00:00').valueOf(),
                                    max: new Date('9999-12-31 11:59').valueOf(),
                                },
                            },
                        },
                    }
                }
            })

            // let ocean_obj = this;
            // this.ctx.onclick = function(e) {
            //     ocean_obj.clickHandler(e)
            // }

            this.dial = $("#" + ctx_element + "_riskdial");
            this.dial.knob({
                "readOnly": true,
            });
            this.configure_dial();

            const chart_obj = this

            $("#" + chart_obj.chart_name + "_q_upper").val(this.q_upper);
            $("#" + chart_obj.chart_name + "_q_lower").val(this.q_lower);

            this.update_btn = $("#btn_" + ctx_element + "_update_thresholds");
            this.update_btn.on('click', function (e) {
                chart_obj.update_thresholds()
            });
            chart_obj.update_thresholds().then(
                chart_obj.initialized()
            );

            $("#" + ctx_element + "_select_id_species").on('change', function (e) {
                chart_obj.get_species_range(e)
            });
        }

        initialized() {
        };

        post_initialize() {
        };

        set_loading(loading) {
        }

        set_depth(depth) {
            this.depth = depth
        }


        get_chart_html(chart_name, append_to = "div_id_range_card") {
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

        async set_zoom(start_date, end_date) {
            this.timeseries_chart.options.scales.x.min = new Date(start_date).valueOf();
            this.timeseries_chart.options.scales.x.max = new Date(end_date).valueOf();
            // this.timeseries_chart.update();
        }

        filter_legend(legendItem, data) {
            if (legendItem.datasetIndex === 2 || legendItem.datasetIndex === 3) {
                return null;
            }
            legendItem.lineWidth = 5;
            return legendItem;
        }

        async update_chart() {
            this.timeseries_chart.update();
            this.timeseries_chart.resetZoom();
        }

        async clear_timeseries() {
            this.dial_cur = 0;
            this.configure_dial();

            this.mpa_id = null;
            this.timeseries_chart.data.labels = [];
            this.ds_timeseries.data = [];
            this.ds_climatology.data = [];

            this.date_indicator.value = "undefined";
            await this.update_chart();
        }

        async get_species_range(event) {
            const selected_id = event.target.value
            const chart_obj = this;

            let url = this.update_btn.data('url') + selected_id + "/?";

            url = url + "depth=" + ((this.depth) ? this.depth : "");
            url = url + "&start_date=" + (new Date(this.timeseries_chart.options.scales.x.min)).toLocaleDateString();
            url = url + "&end_date=" + (new Date(this.timeseries_chart.options.scales.x.max)).toLocaleDateString();

            await $.ajax({
                method: "GET",
                url: url,
                beforeSend: function () {
                    $("#" + chart_obj.chart_name + "_loading_threshold").addClass("loader-sm");
                },
                success: function (data) {
                    chart_obj.q_upper = data.upper;
                    chart_obj.q_lower = data.lower;
                },
                error: function (error_data) {
                    console.log("error");
                    console.log(error_data);
                },
                complete: function () {
                    $("#" + chart_obj.chart_name + "_q_upper").val(chart_obj.q_upper);
                    $("#" + chart_obj.chart_name + "_q_lower").val(chart_obj.q_lower);
                    chart_obj.update_thresholds();
                    chart_obj.update_chart();
                    $("#" + chart_obj.chart_name + "_loading_threshold").removeClass("loader-sm");
                }
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
        }

        async update_data(date_labels, temp_data, climate_data) {
            this.configure_dial();

            this.timeseries_chart.options.scales.x.min = date_labels[0];
            this.timeseries_chart.options.scales.x.max = date_labels[date_labels.length - 1]
            this.timeseries_chart.data.labels = date_labels;

            this.ds_timeseries.data = temp_data;
            this.ds_climatology.data = climate_data;
        }

        set_selected_date(targetDate) {
            let labels = this.timeseries_chart.data.labels;
            let min_index = 0;
            let max_index = labels.length
            let current_index = max_index / 2;
            let found = false;
            while (!found) {
                let cur_date = new Date(labels[current_index]);
                if (current_index === max_index || current_index === min_index) {
                    found = true;
                    break;
                } else if (cur_date < targetDate) {
                    min_index = current_index;
                } else {
                    max_index = current_index;
                }

                current_index = Math.floor((min_index + max_index) / 2);
            }

            this.date_indicator.value = labels[current_index];
            this.timeseries_chart.update();

            this.set_selected_point({value: labels[current_index], index: current_index});
        }

        set_selected_point(point) {
            const clim = this.ds_climatology.data[point.index];
            const timeseries = this.ds_timeseries.data[point.index];
            this.dial_target = timeseries - clim;
            this.dial_value = timeseries
            this.dial_upper = this.ds_upper_threshold.data[point.index]
            this.dial_lower = this.ds_lower_threshold.data[point.index]

            this.animate_dial();
        }

        configure_dial() {
            this.dial.trigger(
                'configure',
                {
                    "min": Math.round(this.dial_min * 100) / 100,
                    "max": Math.round(this.dial_max * 100) / 100,
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
            let color = "rgb(55, 255, 55)"
            let value = Number(this.dial_value)
            let upper_tolerance = Number(this.dial_upper)
            let lower_tolerance = Number(this.dial_lower)
            if (value < lower_tolerance) {
                color = "rgb(55, 55, 255)"
            } else if (value > upper_tolerance) {
                color = "rgb(255, 55, 55)"
            }

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
                step: function () {
                    chart_obj.dial_cur = this.animateVal;
                    chart_obj.dial.val(chart_obj.dial_cur).trigger('change');
                    chart_obj.get_dial_color()
                },
                complete: function () {
                    chart_obj.dial_target = chart_obj.dial_target * -1;
                    chart_obj.get_dial_color()
                }
            })
        }
    }
}