let dial_min = -5;
let dial_max = 35;
let dial_cur = 0;
let dial_target = -30;
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
            "width": 100
        },
    )
    $dial.val(dial_cur).trigger('change');
    get_color(dial_cur);
}

function get_color(v) {
    let percent = (v - dial_min)/(dial_max - dial_min);
    let rp = Math.abs(percent-0.5)/0.5;
    let gp = 1-rp;
    let bp = 0.33;
    let r = 255 * rp;
    let g = 255 * gp;
    let b = 255 * bp;
    let color = "rgb(" + r + ", " + g + ", " + b + ")"
    console.log("(" + rp + ", " + gp + ", " + bp + ")")
    console.log(color)
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