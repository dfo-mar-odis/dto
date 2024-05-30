let dial_min = -5;
let dial_max = 35;
let tolerance_min = 2;
let tolerance_max = 5;
let dial_cur = 0;
let dial_target = -30;
let $dial = $(".dial");
$(function($) {
    $dial.knob({
        "readOnly":true,
    });
    configure_dial();

    let $min_dial = $("#dial_min")
    let $max_dial = $("#dial_max")
    $min_dial.val(tolerance_min);
    $min_dial.on('input', function(e) {
        tolerance_min = $(this).val()
        get_color(dial_cur)
    })
    $max_dial.val(tolerance_max);
    $max_dial.on('input', function(e) {
        tolerance_max = $(this).val()
        get_color(dial_cur)
    })
});

function configure_dial() {
    $dial.trigger(
        'configure',
        {
            "min": dial_min,
            "max": dial_max,
            "angleOffset": -115,
            "angleArc": 230,
            "skin": "tron",
            "step": 0.001,
            "thickness": 0.25,
            "inputColor": "#000000",
        },
    )
    $dial.val(dial_cur).trigger('change');
    get_color(dial_cur);
}

function get_color(v) {
    let danger = ( v < tolerance_min || v > tolerance_max )
    let r = 255 * (danger ? 1.0 : 0.25);
    let g = 255 * (danger ? 0.25 : 1.0);
    let b = 255 * 0.25;

    let color = "rgb(" + r + ", " + g + ", " + b + ")"
    $dial.trigger('configure', {"fgColor": color});
}

function animate_dial() {
    $({
        animateVal: dial_cur
    }).animate({
        animateVal: dial_target
    }, {
        duration: 1000,
        easing: "swing",
        step: function() {
            dial_cur = this.animateVal;
            $dial.val(dial_cur).trigger('change');
            get_color(dial_cur)
        },
        complete: function() {
            dial_target = dial_target * -1;
        }
    })
}