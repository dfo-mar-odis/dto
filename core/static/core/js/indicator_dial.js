function get_indicator_id(indicator_key) {
    return 'indicator_dial_' + indicator_key;
}

function add_indicator(label, indicator_key, min, max, current) {
    let $indicator_id = get_indicator_id(indicator_key)

    let $indicator_column = $('<div></div>', {class:"col"}); //.appendTo($indicator_card_row)

    let $indicator_label_div_row = $('<div></div>', {class:"row"});
    let $indicator_label_div = $('<div></div>', {class:"col text-center"}).appendTo($indicator_label_div_row);
    let $indicator_label = $('<label></label>', { for:$indicator_id, class:"text-center", text:label}).appendTo($indicator_label_div);

    let $indicator_dial_div_row = $('<div></div>', {class:"row"});
    let $indicator_dial_div = $('<div></div>', {class:"col text-center"}).appendTo($indicator_dial_div_row);
    let $indicator_input = $('<input />', {type:'text', id:$indicator_id, class:'dial'}).appendTo($indicator_dial_div);

    $indicator_column.append(
        $indicator_label_div_row,
        $indicator_dial_div_row
    );

    $indicator_input.knob({
        "readOnly": true,
    });
    $indicator_input.trigger(
        'configure',
        {
            "min": min,
            "max": max,
            "angleOffset": -115,
            "angleArc": 230,
            "skin": "tron",
            "step": 0.001,
            "thickness": 0.25,
            "inputColor": "#000000",
        },
    )
    $indicator_input.val(current).trigger('change');

    return $indicator_column;
}

function set_dial_color(dial, upper, lower) {
    let color = "rgb(55, 255, 55)"
    let value = dial.val();
    let upper_tolerance = Number(upper);
    let lower_tolerance = Number(lower);
    if(value < lower_tolerance) {
        color = "rgb(55, 55, 255)"
    } else if(value > upper_tolerance) {
        color = "rgb(255, 55, 55)"
    }

    dial.trigger('configure', {"fgColor": color});
}
