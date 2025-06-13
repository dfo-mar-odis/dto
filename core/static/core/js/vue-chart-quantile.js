import {TimeseriesChart} from "./vue-chart-timeseries.js";
import {LegendSectionPlugin} from './vue-chart-legend-plugin.js';

export const QuantileChart = {
    // Extend the TimeseriesChart component
    extends: TimeseriesChart,
    props: {
    },

    data() {
        return {
            ...TimeseriesChart.data(),
        };
    },

    watch: {},

    methods: {
        async fetchChartData() {

        },

        // Override formatChartData to add species temperature ranges
        formatChartData() {
            const parentFormatData = TimeseriesChart.methods.formatChartData.bind(this);
            const formattedData = parentFormatData();

            return formattedData;
        },

        get_legend() {
            const legend = TimeseriesChart.methods.get_legend.call(this);
            legend.push(
                {
                    id: 'quantile',
                    matchFunction: (dataset) => {
                        return dataset.label.includes('Upper Quantile') ||
                            dataset.label.includes('Lower Quantile');
                    }
                }
            );
            return legend
        },

    },

    // Override the template to add species selection panel
    template: `
        <div class="row mb-1">
            <div class="col-md-3 species-panel">
                <div class="card">
                    <div class="card-header">Quantile Settings</div>
                    <div class="card-body">
                        <div class="form-group mb-3">
                            <label for="upperQuantile">Upper Quantile</label>
                            <input 
                            type="number" 
                            id="upperQuantile" 
                            v-model.number="upperQuantile" 
                            @change="fetchChartData"
                            min="0.1" 
                            max="1.0" 
                            step="0.1" 
                            class="form-control">
                        </div>
                        <div class="form-group mb-3">
                            <label for="lowerQuantile">Lower Quantile</label>
                            <input 
                            type="number" 
                            id="lowerQuantile" 
                            v-model.number="lowerQuantile" 
                            @change="fetchChartData"
                            min="0.0" 
                            max="0.9" 
                            step="0.1" 
                            class="form-control">
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-9">
                <div class="chart-container position-relative">
                    <div v-if="isLoading || localLoading" class="chart-loading-overlay">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <div :id="'custom-legend-placeholder-' + chartInstanceId" class="chart-legend-container"></div>
                    <canvas ref="chartCanvas"></canvas>
                    <div v-if="!mpa.name" class="text-center text-muted mt-5 pt-5">
                        <i class="bi bi-map"></i>
                        <p>Select an MPA on the map to view timeseries data</p>
                    </div>
                </div>
            </div>
        </div>
    `,
};