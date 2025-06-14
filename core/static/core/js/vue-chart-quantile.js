import {TimeseriesChart} from "./vue-chart-timeseries.js";
import {LegendSectionPlugin} from './vue-chart-legend-plugin.js';

export const QuantileChart = {
    // Extend the TimeseriesChart component
    extends: TimeseriesChart,
    props: {
        dataUrl: String,
    },

    data() {
        return {
            ...TimeseriesChart.data(),
            upperQuantile: 0.9,
            lowerQuantile: 0.1,
        };
    },
    watch: {},

    methods: {
        async fetchChartData() {
            this.localLoading = true;

            try {
                if (!this.mpa || !this.mpa.id) {
                    console.warn("No MPA selected, cannot fetch data");
                    return;
                }

                // Build URL with query parameters
                const url = new URL(this.dataUrl, window.location.origin);
                url.searchParams.append('mpa', this.mpa.id);
                url.searchParams.append('upper_quantile', this.upperQuantile);
                url.searchParams.append('lower_quantile', this.lowerQuantile);

                // Fetch data
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const data = await response.json();
                this.chartData = data;

                // Render the chart
                this.$nextTick(() => {
                    this.renderChart();
                });
            } catch (error) {
                console.error('Error fetching quantile chart data:', error);
            } finally {
                this.localLoading = false;
            }
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
    mounted() {
        // Ensure data is available before first render completes
        this.$nextTick(() => {
            this.fetchChartData();
        });
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
                            min="0.0"
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
                            max="1.0"
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