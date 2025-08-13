import {SpeciesChart} from './vue-chart-species.js';

export const SpeciesChartContainer = {
    props: {
        timeseriesData: Object,
        selectedDate: String,
        mpa: {
            type: Object,
            default: () => ({})
        },
        isActive: Boolean,
        isLoading: {
            type: Boolean,
            default: false
        },
        speciesList: {
            type: Array,
            default: () => []
        }
    },
    components: {
        SpeciesChart
    },
    computed: {
        t() {
            return window.translations || {};
        },
    },
    data() {
        return {
            charts: [],
        };
    },
    emits: ['date-selected'],
    watch: {},
    methods: {
        addChart() {
            this.charts.push({
                id: this.charts.length+1
            });
        },
        handleDateSelected(date) {
            this.$emit('date-selected', date);
        }
    },
    template: `
        <div class="row mt-1 mb-1">
            <div class="col">
                <button id="btn_id_add_chart" class="btn btn-primary btn-sm"
                        @click="addChart"
                        title="{{ t.add_chart || 'Add Chart' }}">{{ t.add_chart || 'Add Chart' }}</button>
                <div id="btn_id_add_chart_loading"></div>
            </div>
        </div>
        <div id="div_id_species_charts">
            <species-chart
                :key="chart.id"
                v-for="chart in charts"
                :mpa="mpa"
                :species-list="speciesList"
                :timeseries-data="timeseriesData"
                :selected-date="selectedDate"
                :is-active="isActive"
                :is-loading="isLoading"
                data-url="dataUrl"
                @date-selected="handleDateSelected"
            ></species-chart>
        </div>
      `,
};