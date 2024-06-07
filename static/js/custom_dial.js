let dial_min = -3;
let dial_max = 3;
let dial_cur = 0;
let dial_value = 0;
let dial_upper = 0;
let dial_lower = 0;
let dial_target = 0;
let $dial = $(".dial");
$(function($) {
    $dial.knob({
        "readOnly":true,
    });
    configure_dial();
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

function get_color() {
    let positive = (dial_value > dial_upper);
    let negative = (dial_value < dial_lower );
    let r = 255 * (negative ? 0.25 : (positive ? 1.0 : 0.25));
    let g = 255 * (negative ? 0.25 : (positive ? 0.25 : 1.0));
    let b = 255 * (negative ? 1.0 : 0.25);

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
            get_color()
        },
        complete: function() {
            dial_target = dial_target * -1;
            get_color()
        }
    })
}