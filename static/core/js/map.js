let timeseries_update_url = null;
let anomaly_update_url = null;

// Charts are for any chart that takes the timeseries and climatology data
const charts = {};

// Anomaly charts take computed yearly binned data
let standard_anomalies_chart = null

let range_charts = 1;
let mpa_id = null;
let date_labels = [];
let ts_data = [];
let climate_data = [];
let selectedLayer = null;
let previous_layers = [];
let date_update_listeners = [];

function update_polygons_properties(base_url, layer, mpa, date) {
    let mpa_id = mpa.id;
    let url = base_url + "?mpa=" + mpa_id + "&date=" + date;
    $.ajax({
        method: 'GET',
        url: url,
        success: function (data) {
            let style = 'success';
            if (data.current < data.lower) {
                style = 'info';
            } else if (data.current > data.upper) {
                style = 'danger';
            }
            let html = '<div class="row">' +
                '<div class="col"><b>' + mpa.properties.name + '</b></div>' +
                '</div><div class="row">' +
                '<div class="col">' +
                '<div class="progress" role="progressbar" aria-label="Basic example" aria-valuenow="' + data.current + '" aria-valuemin="' + data.min + '" aria-valuemax="' + data.max + '">' +
                '<div class="progress-bar bg-' + style + '" style="width: 25%">' + data.current + '</div>' +
                '</div></div>'
            '</div>';
            // layer.setPopupContent(html);
            layer.setTooltipContent(html);
        }
    });
}

function get_selected_date() {
    let selected_date = null;
    try {
        selected_date = new Date($('#selected_date').val());
        // if the user entered a date like 202 by mistake, the selected date trigger could have been sprung
        if(selected_date.getFullYear() < 1900) {
            return null;
        }
        selected_date.setDate(selected_date.getDate() + 1);
    } catch(err) {
        console.error("Could not parse date")
    }
    if(selected_date == 'Invalid Date') {
        return null;
    }

    return selected_date
}

function update_selected_date() {
    let selected_date = get_selected_date();

    if(!isNaN(selected_date)) {
        date_update_listeners.forEach(listener => {listener(selected_date)});
    }
}

function get_selected_date_string(date) {
    if( date == null) {
        return null;
    }

    let year = date.getFullYear();
    let month = String(date.getMonth()+1).padStart(2, '0');
    let day = String(date.getDate()).padStart(2, '0');

    return year + '-' + month + '-' + day;
}

function add_indicators() {
    let $indicator_card = $("#div_id_indicator_card");
    $indicator_card.empty();
    let $indicator_card_row = $('<div></div>', {class:"row"}).appendTo($indicator_card);

    // This will eventually be done through an AJAX query that will return the indicator and its
    // min/max/current values. The current value will be dependent on the user clicking on a time
    // series chart or selecting a "Current Date" on the conditions card
    let min = -10;
    let max = 10;
    let indicators = [
        ['Temperature', 'temperature', min, max, Math.floor(Math.random() * (max - min + 1) + min)],
        ['Salinity', 'salinity', min, max, Math.floor(Math.random() * (max - min + 1) + min)],
        ['CHL', 'chlorophyll', min, max, Math.floor(Math.random() * (max - min + 1) + min)]
    ];

    indicators.forEach(indicator => {
        let column = add_indicator(indicator[0], indicator[1], indicator[2], indicator[3], indicator[4]);
        column.appendTo($indicator_card_row)
    });
}

function add_network_indicators(base_url, selected_date) {
    let $indicator_card = $("#div_id_network_card");
    $indicator_card.empty();
    let $indicator_card_row = $('<div></div>', {class:"row"}).appendTo($indicator_card);

    previous_layers.forEach(layer => {
        let min = layer.indicator.min;
        let max = layer.indicator.max;
        let current = layer.indicator.current;
        let date = layer.indicator.date;

        let column = add_indicator(layer.feature.properties.name, layer.feature.id, min, max, current);
        column.appendTo($indicator_card_row)

        let $indicator =  $("#" + get_indicator_id(layer.feature.id));

        if(date == null || date != selected_date) {
            query_indicator(base_url, layer.feature.id, selected_date)
        } else {
            set_dial_color($indicator, layer.indicator.upper, layer.indicator.lower)
        }
    });
}

async function query_indicator(base_url, mpa_id, date) {
    let url = base_url + "?mpa=" + mpa_id + "&date=" + date;
    $.ajax({
        method: "GET",
        url: url,
        beforeSend: function () {
        },
        success: function(data) {
            previous_layers.filter(layer => layer.feature.id === data.mpa)[0].indicator = data
            let $indicator = $("#" + get_indicator_id(data.mpa));
            $indicator.trigger('configure', {"min": data.min, "max": data.max});
            $indicator.val(data.current).trigger('change')
            set_dial_color($indicator, data.upper, data.lower)
        },
        error: function (error_data) {
            console.log("error");
            console.log(error_data);
        }
    });
}

function pan_frame(pan) {
    const min_date = $("#zoom_min").val();
    const max_date = $("#zoom_max").val();

    let min_d = new Date(min_date);
    let max_d = new Date(max_date);

    min_d.setFullYear(min_d.getFullYear()+pan);
    max_d.setFullYear(max_d.getFullYear()+pan);

    $("#zoom_min").val(min_d.toISOString().substring(0, 10));
    $("#zoom_max").val(max_d.toISOString().substring(0, 10));

    for (const key in charts) {
        set_chart_zoom(charts[key]);
    }
    get_data();
}

function get_link(base_url) {
    const min_date = $("#zoom_min").val();
    const max_date = $("#zoom_max").val();
    const btm_depth = $("#btm_depth").val();

    let url = base_url + "?mpa=" + mpa_id;
    url = url + "&depth=" + btm_depth;
    url = url + "&start_date=" + min_date;
    url = url + "&end_date=" + max_date;

    return url;
}

function set_chart_zoom(chart) {
    const min_date = $("#zoom_min").val();
    const max_date = $("#zoom_max").val();

    chart.set_zoom(min_date, max_date);
}

function add_range_chart(chart_base_url) {

    set_chart_loading(true);
    set_chart_loading(true).then(function() {
        range_charts += 1;

        const label = 'mpa_ts_range_chart_' + range_charts.toString();
        charts[label] = new RangeChart(label, chart_base_url);
        charts[label].initialized = function() {
            let chart_obj = this;
            let selected_date = get_selected_date();

            this.ctx.onclick = function(e) { handle_set_date(e, chart_obj)};

            if(mpa_id) {
                charts[label].mpa_id = mpa_id;
                charts[label].update_data(date_labels, ts_data, climate_data);
            }

            if(selected_date != null) {
                charts[label].set_selected_date(selected_date);
            }

            date_update_listeners.push(function(selected_date) {
                charts[label].set_selected_date(selected_date);
            });
            set_chart_loading(false);
            set_chart_zoom(chart_obj)
        }
    });
}

async function set_chart_loading(loading) {
    // Sets the 'Add Chart' button to loading or not
    if(loading) {
        $("#btn_id_add_chart").hide();
        $("#btn_id_add_chart_loading").addClass("loader-sm");
    } else {
        $("#btn_id_add_chart_loading").removeClass("loader-sm");
        $("#btn_id_add_chart").show();
    }
}

function clear_data() {
    qs_data = [];

    standard_anomalies_chart.clear_data();
    for (const key in charts) {
        charts[key].clear_timeseries();
    }
}

function get_depths(base_url) {
    let url = base_url + "?mpa=" + mpa_id

    $.ajax({
        method: "GET",
        url: url,
        beforeSend: function () {
        },
        success: function(data) {
            let select = $("#btm_depth");
            select.empty();
            // select.append($('<option>', { value: '', text: '{% trans "Total Average Bottom Timeseries" %}' }));

            data['depths'].forEach(opt => {
                select.append($('<option>', { value: opt[0], text: opt[1] }));
            })
        },
        error: function (error_data) {
            console.log("error");
            console.log(error_data);
        }
    });
}

// The timeseries should update for all charts
function get_data() {
    const min_date = $("#zoom_min").val();
    const max_date = $("#zoom_max").val();
    const btm_depth = $("#btm_depth").val();

    let selected_date = get_selected_date();
    let timeseries_url = timeseries_update_url + "?mpa=" + mpa_id + "&depth=" + btm_depth +
        "&start_date=" + min_date + "&end_date=" + max_date
    let anomaly_url = anomaly_update_url + "?mpa=" + mpa_id + "&depth=" + btm_depth
    clear_data();

    $.ajax({
        method: "GET",
        url: timeseries_url,
        success: function(data) {
            if(data == null || data.data == null) {
                console.error("No data returned from timeseries query");
                return;
            }
            const qs_data = data.data;
            date_labels = $.map(qs_data, function (value, key) { return Date.parse(value.date); });
            ts_data = $.map(qs_data, function (value, key) { return value.ts_data; });
            climate_data = $.map(qs_data, function (value, key) { return value.clim; });

            for (const key in charts) {
                let chart = charts[key];
                chart.mpa_id = mpa_id;
                chart.dial_max = data.max_delta;
                chart.dial_min = data.min_delta;
                chart.set_depth(btm_depth);
                chart.update_data(date_labels, ts_data, climate_data);
                set_chart_zoom(chart);
                if(selected_date != null) {
                    chart.set_selected_date(selected_date);
                }
            }
        },
        error: function (error_data) {
            console.log("error");
            console.log(error_data);
        },
    });
    $.ajax({
        method: "GET",
        url: anomaly_url,
        success: function(data) {
            standard_anomalies_chart.update_data(data['dates'], data['values'])
        },
        error: function (error_data) {
            console.log("error");
            console.log(error_data);
        },
    })
}

// click handler for chartjs charts to set the selected date and cause a refresh of date dependent components
function handle_set_date(e, chart) {
    const canvasPosition = Chart.helpers.getRelativePosition(e, chart.timeseries_chart);

    let selected_date = new Date(chart.timeseries_chart.scales.x.getValueForPixel(canvasPosition.x))

    let day = ("0" + selected_date.getDate()).slice(-2);
    let month = ("0" + (selected_date.getMonth() + 1)).slice(-2);
    let selected = selected_date.getFullYear()+"-"+(month)+"-"+(day) ;

    $('#selected_date').val(selected);
    update_selected_date();
}