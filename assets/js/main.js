// Import libraries
import 'htmx.org';
import * as L from 'leaflet';
import jQuery from 'jquery';
import Chart from 'chart.js/auto';
import { getRelativePosition } from "chart.js/helpers";
import Hammer from 'hammerjs';
import 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';
import 'chartjs-plugin-annotation';
import 'chartjs-plugin-datalabels';
import * as Vue from 'vue';
import * as d3 from 'd3';
import { fr } from 'date-fns/locale';

// Make libraries available globally
window.L = L;
window.jQuery = window.$ = jQuery;
window.Hammer = Hammer;
window.Chart = Chart;
window.getRelativePosition = getRelativePosition;
window.d3 = d3;

// Make Vue and its APIs available globally
window.Vue = Vue;

// Set up the French locale for date-fns
window.dateFnsLocales = window.dateFnsLocales || {};
window.dateFnsLocales.fr = fr;

// Import CSS (requires additional webpack configuration)
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'leaflet/dist/leaflet.css';
