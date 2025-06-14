import {TimeseriesChart} from "./vue-chart-timeseries.js";
import {LegendSectionPlugin} from './vue-chart-legend-plugin.js';

export const QuantileChart = {
    // Extend the TimeseriesChart component
    extends: TimeseriesChart,
    props: {
        dataUrl: String,
        depth: '',
        startDate: null,
        endDate: null,
    },

    data() {
        return {
            ...TimeseriesChart.data(),
            upperQuantile: 0.9,
            lowerQuantile: 0.1,
            lastFetchParams: null,
            quantileData: null,
            currentDelta: 0,
            currentPoint: null,
            currentQuantile: null,
            currentTSValue: null,
        };
    },
    watch: {
        async upperQuantile(newValue) {
            this.debouncedFetchData()
        },

        async lowerQuantile(newValue) {
            this.debouncedFetchData()
        }
    },
    methods: {
        isValidDateString(dateString) {
            if (!dateString) return false;
            const date = new Date(dateString);
            return date.toString() !== 'Invalid Date';
        },

        setDateIndicator(dateStr) {
            TimeseriesChart.methods.setDateIndicator.call(this, dateStr);
            if (!dateStr || !this.quantileData || !this.quantileData.data) return;

            // Find the data point for the selected date
            const dataPoint = this.timeseriesData.data.find(point => point.date === (dateStr + " 00:01"))
            if (!dataPoint) return;

            // Calculate anomaly (timeseries value - climatology value)
            const tsValue = parseFloat(dataPoint.ts_data);
            const climValue = parseFloat(dataPoint.clim);
            this.currentTSValue = tsValue
            this.currentDelta = tsValue - climValue;
            this.currentPoint = dataPoint;
            this.currentQuantile = this.quantileData.data.find(point => point.date === (dateStr + " 00:01"))
        },

        calculateProgressWidth() {
            if (!this.quantileData || !this.quantileData.min_delta || !this.quantileData.max_delta) return 50;

            const totalRange = this.quantileData.max_delta - this.quantileData.min_delta;
            if (totalRange === 0) return 50;

            // Calculate percentage position of current delta within min/max range
            const percentage = ((this.currentDelta - this.quantileData.min_delta) / totalRange) * 100;

            // Clamp between 0 and 100
            return Math.max(0, Math.min(100, percentage));
        },

        async fetchChartData() {
            if (!this.mpa || !this.mpa.id) return;
            if (!this.startDate || !this.endDate) return;

            // Create a fetch params signature to prevent duplicate requests
            const fetchParams = `${this.mpa.id}-${this.depth}-${this.startDate}-${this.endDate}-${this.upperQuantile}-${this.lowerQuantile}`;
            if (fetchParams === this.lastFetchParams) {
                console.log("Skipping duplicate request:", fetchParams);
                return;
            }
            this.lastFetchParams = fetchParams;

            try {
                this.localLoading = true;

                // Build URL with query parameters
                const url = new URL(this.dataUrl, window.location.origin);
                url.searchParams.append('mpa', this.mpa.id);
                url.searchParams.append('depth', this.depth);
                url.searchParams.append('start_date', this.startDate);
                url.searchParams.append('end_date', this.endDate);
                url.searchParams.append('upper_quantile', this.upperQuantile);
                url.searchParams.append('lower_quantile', this.lowerQuantile);

                // Try using a Promise-based approach for debugging
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const data = await response.json();
                this.quantileData = data;
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

            if (!this.quantileData || !this.quantileData.data) {
                return formattedData;
            }

            const dates = this.quantileData.data.map(d => new Date(d.date));
            const upperValues = this.quantileData.data.map(d => parseFloat(d.upperq));
            const lowerValues = this.quantileData.data.map(d => parseFloat(d.lowerq));

            const upperData = dates.map((date, i) => ({
                x: date,
                y: upperValues[i]
            }));

            const lowerData = dates.map((date, i) => ({
                x: date,
                y: lowerValues[i]
            }));

            formattedData.datasets.push(
                {
                    label: `Marine Heat Wave above (${this.upperQuantile})`,
                    data: upperData,
                    borderColor: '#CCCCCC',
                    borderWidth: 1.5,
                    backgroundColor: 'rgba(0,0,0,0)',
                    tension: 0.1,
                    pointRadius: 0.1,
                    fill: {
                        target: 0,
                        below: 'rgba(128, 0, 0, 0.8)',
                    },
                },
                {
                    label: `Marine Cold Wave below (${this.lowerQuantile})`,
                    data: lowerData,
                    borderColor: '#CCCCCC',
                    borderWidth: 1.5,
                    backgroundColor: 'rgba(0,0,0,0)',
                    tension: 0.1,
                    pointRadius: 0.1,
                    fill: {
                        target: 0,
                        above: 'rgba(0, 0, 128, 0.8)',
                    },
                },
                {
                    label: `Average Range`,
                    data: lowerData,
                    borderColor: '#CCCCCC',
                    borderWidth: 0,
                    backgroundColor: 'rgba(0,0,0,0)',
                    tension: 0.1,
                    pointRadius: 0.1,
                    fill: {
                        target: (formattedData.datasets.length),
                        below: 'rgba(128, 128, 128, 0.2)',
                    },
                }
            );
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
        <div class="row mb-1 mt-1">
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
                            min="0.5"
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
                            max="0.5"
                            step="0.1"
                            class="form-control">
                        </div>
                        <div class="row">
                            <div class="row">
                                <small class="form-text text-muted mt-1">Heat/Cold wave indicator</small>
                            </div>
                            <div class="row">
                                <div class="col">
                                    <div class="progress" style="height: 20px;" v-if="currentPoint">
                                        <div class="progress-bar" role="progressbar"
                                             :class="{
                                                'bg-danger': currentQuantile && parseFloat(currentTSValue) > parseFloat(currentQuantile.upperq),
                                                'bg-info': currentQuantile && parseFloat(currentTSValue) < parseFloat(currentQuantile.lowerq),
                                                'bg-success': currentQuantile && parseFloat(currentTSValue) <= parseFloat(currentQuantile.upperq) && 
                                                     parseFloat(currentTSValue) >= parseFloat(currentQuantile.lowerq)
                                            }"
                                             :style="{width: calculateProgressWidth() + '%'}"
                                             :aria-valuenow="currentDelta"
                                             :aria-valuemin="quantileData?.min_delta"
                                             :aria-valuemax="quantileData?.max_delta">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <!-- Separate text element positioned absolutely -->
                                <div class="d-flex justify-content-center align-items-center" style="top: 0; left: 0; text-shadow: 0 0 3px rgba(0,0,0,0.5);">
                                    <span>{{currentDelta.toFixed(2)}}°C</span>
                                </div>
                            </div>
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