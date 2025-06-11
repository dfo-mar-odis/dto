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

function set_chart_zoom(chart) {
    const min_date = $("#zoom_min").val();
    const max_date = $("#zoom_max").val();

    chart.set_zoom(min_date, max_date);
}

function add_range_chart(chart_base_url) {

    const min_date = $("#zoom_min").val();
    const max_date = $("#zoom_max").val();
    const btm_depth = $("#btm_depth").val();

    set_chart_loading(true);
    range_charts += 1;

    const label = 'mpa_ts_range_chart_' + range_charts.toString();
    charts[label] = new RangeChart(label, chart_base_url);
    charts[label].initialized = function() {
        let chart_obj = this;

        this.ctx.onclick = function(e) { handle_set_date(e, chart_obj)};

        if(mpa_id) {
            charts[label].mpa_id = mpa_id;
            charts[label].set_zoom(min_date, max_date);
            charts[label].set_depth(btm_depth);
            charts[label].update_data(date_labels, ts_data, climate_data);
            charts[label].update_thresholds();
            charts[label].update_chart();
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
}

function set_chart_loading(loading) {
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