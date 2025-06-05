class QuantileChart extends RangeChart {

    constructor(ctx_element, data_url, upper_limit=0.9, lower_limit=0.1) {
        super(ctx_element, data_url, upper_limit, lower_limit);
    }

    async get_chart_html(chart_name, append_to = "div_id_quantile_card") {
        await super.get_chart_html(chart_name, append_to);
    }

    async update_thresholds() {
        const chart_obj = this
        let url = this.update_btn.data('url');

        if(this.mpa_id==null) {
            return;
        }

        $("#" + chart_obj.chart_name + "_q_upper").on('input', function (e) {
            chart_obj.q_upper = parseFloat($(this).val());
        });

        $("#" + chart_obj.chart_name + "_q_lower").on('input', function (e) {
            chart_obj.q_lower = parseFloat($(this).val());
        });

        url += '?mpa=' + this.mpa_id;

        const date_scale = this.timeseries_chart.scales.x.ticks;

        url = url + "&depth=" + ((this.depth) ? this.depth : "");
        url = url + "&start_date=" + (new Date(date_scale[0].value)).toLocaleDateString();
        url = url + "&end_date=" + (new Date(date_scale[date_scale.length-1].value)).toLocaleDateString();
        url = url + '&upper=' + this.q_upper;
        url = url + '&lower=' + this.q_lower

        await $.ajax({
            method: "GET",
            url: url,
            beforeSend: function () {
                $("#" + chart_obj.chart_name + "_loading_threshold").addClass("loader-sm");
            },
            success: function (data) {
                let qs_data = data.data;
                const u_qunat = $.map(qs_data, function (value, key) { return value.upperq; });
                const l_quant = $.map(qs_data, function (value, key) { return value.lowerq; });

                chart_obj.ds_upper_threshold.data = u_qunat;
                chart_obj.ds_lower_threshold.data = l_quant;

                chart_obj.timeseries_chart.update();
            },
            error: function (error_data) {
                console.log("error");
                console.log(error_data);
            },
            complete: function () {
                $("#" + chart_obj.chart_name + "_loading_threshold").removeClass("loader-sm");
            }
        });
    }
}