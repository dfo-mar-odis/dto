export const NetworkIndicator = {
    props: {
        dataPoint: {
            type: Object,
            default: null
        },
        quantile: {
            type: Object,
            default: null
        },
        minDelta: {
            type: Number,
            default: null
        },
        maxDelta: {
            type: Number,
            default: null
        },
        title: {
            type: String,
            default: "Heat/Cold wave indicator"
        },
        upperQuantileLabel: {
            type: Number,
            default: 0.9
        },
        lowerQuantileLabel: {
            type: Number,
            default: 0.1
        }
    },

    data() {
        return {
            currentDelta: 0,
        };
    },

    watch: {
        dataPoint: {
            handler(newPoint) {
                if (newPoint && newPoint.ts_data !== undefined && newPoint.clim !== undefined) {
                    this.currentDelta = Number(newPoint.ts_data) - Number(newPoint.clim);
                }
            },
            immediate: true
        }
    },

    methods: {
        calculateProgressWidth() {
            if (!this.minDelta || !this.maxDelta) return 50;

            const totalRange = this.maxDelta - this.minDelta;
            if (totalRange === 0) return 50;

            // Calculate percentage position of current delta within min/max range
            const percentage = ((this.currentDelta - this.minDelta) / totalRange) * 100;

            // Clamp between 0 and 100
            return Math.max(0, Math.min(100, percentage));
        },

        getStatusClass() {
            if (!this.quantile) return '';

            const value = parseFloat(this.dataPoint.ts_data);
            const upperQ = parseFloat(this.quantile.upperq);
            const lowerQ = parseFloat(this.quantile.lowerq);

            if (value > upperQ) return 'bg-danger';  // Heat wave
            if (value < lowerQ) return 'bg-info';    // Cold wave
            return 'bg-success';                     // Normal range
        },

        formatValue(value) {
            if (value === undefined || value === null) return '-';
            const num = Number(value);
            return isNaN(num) ? value : num.toFixed(3);
        },

        formatQuantileLabel(value) {
            const num = Number(value);
            return isNaN(num) ? String(value) : Math.round(num * 100) + "%";
        }
    },

    template: `
        <div class="wave-indicator">
            <div class="row">
                <small class="form-text text-muted mt-1">{{ title }}</small>
            </div>
            <div class="row">
                <div class="col">
                    <div class="progress" style="height: 20px;" v-if="dataPoint">
                        <div class="progress-bar" role="progressbar"
                             :class="getStatusClass()"
                             :style="{width: calculateProgressWidth() + '%'}"
                             :aria-valuenow="currentDelta"
                             :aria-valuemin="minDelta"
                             :aria-valuemax="maxDelta">
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col">
                    <table class="table table-sm table-bordered" v-if="dataPoint">
                        <tbody>
                            <tr>
                                <th scope="row">Anomaly (ΔT)</th>
                                <td>{{ formatValue(currentDelta) }}°C</td>
                            </tr>
                            <tr>
                                <th scope="row">Current Value</th>
                                <td>{{ formatValue(dataPoint.ts_data) }}°C</td>
                            </tr>
                            <tr>
                                <th scope="row">Climatology</th>
                                <td>{{ formatValue(dataPoint.clim) }}°C</td>
                            </tr>
                            <tr v-if="quantile">
                                <th scope="row">Upper Quantile ({{ formatQuantileLabel(upperQuantileLabel) }})</th>
                                <td>{{ formatValue(quantile.upperq) }}°C</td>
                            </tr>
                            <tr v-if="quantile">
                                <th scope="row">Lower Quantile ({{ formatQuantileLabel(lowerQuantileLabel) }})</th>
                                <td>{{ formatValue(quantile.lowerq) }}°C</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `
};