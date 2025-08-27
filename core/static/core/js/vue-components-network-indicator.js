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
            default: window.translations?.heat_cold_indicator || "Heat/Cold wave indicator"
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
    computed: {
        t() {
            return window.translations || {};
        },
    },
    data() {
        return {
            networkIndicatorData: {
                currentPoint: null,
                currentQuantile: null,
                quantileData: {
                    minDelta: null,
                    maxDelta: null
                }
            },
            currentDelta: 0,
        };
    },

    watch: {
        dataPoint: {
            handler(newPoint) {
                if (newPoint && newPoint.ts_data !== undefined && newPoint.climatology !== undefined) {
                    this.currentDelta = (Number(newPoint.ts_data) - Number(newPoint.climatology)) / Number(newPoint.std_dev);
                }
            },
            immediate: true
        }
    },

    methods: {
        calculateMaxAnom() {
            if(this.currentDelta < this.dataPoint.climatology)
                return Math.abs(this.minDelta/Number(this.dataPoint.std_dev))

            return (this.maxDelta/Number(this.dataPoint.std_dev));
        },
        calculateProgressWidth() {
            if (!this.minDelta || !this.maxDelta) return 50;

            // Calculate percentage position of current delta within min/max range
            const percentage = (Math.abs(this.currentDelta) / this.calculateMaxAnom()) * 100;

            // Clamp between 0 and 100
            return Math.max(0, Math.min(100, percentage));
        },

        getStatusClass() {
            if (!this.quantile) return '';

            const value = parseFloat(this.dataPoint.ts_data);
            const clim = parseFloat(this.dataPoint.climatology)
            const upperQ = parseFloat(this.quantile.upperq);
            const lowerQ = parseFloat(this.quantile.lowerq);

            if (value > upperQ) return 'bg-danger';  // Heat wave
            else if (value > clim) return 'bg-danger-subtle';
            else if (value < lowerQ) return 'bg-primary';    // Cold wave
            else if (value < clim) return 'bg-primary-subtle';
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
        <div class="wave-indicator card-body">
            <div class="row">
                <small class="form-text text-muted mt-1">{{ title }}</small>
            </div>
            <div class="row">
                <div class="col">
                    <div class="progress" style="height: 20px;" v-if="dataPoint">
                        <div class="progress-bar" role="progressbar"
                             :class="getStatusClass()"
                             :style="{width: calculateProgressWidth() + '%'}"
                             :aria-valuenow="calculateProgressWidth()"
                             :aria-valuemin="0"
                             :aria-valuemax="calculateMaxAnom()">
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col">
                    <table class="table table-sm table-bordered" v-if="dataPoint">
                        <tbody>
                            <tr>
                                <th scope="row">{{ t.standard_anomaly }}</th>
                                <td>{{ formatValue(currentDelta) }}</td>
                            </tr>
                            <tr>
                                <th scope="row">{{ t.current_value }}</th>
                                <td>{{ formatValue(dataPoint.ts_data) }}°C</td>
                            </tr>
                            <tr>
                                <th scope="row">{{ t.climatology }}</th>
                                <td>{{ formatValue(dataPoint.climatology) }}°C</td>
                            </tr>
                            <tr>
                                <th scope="row">{{ t.standard_deviation }}</th>
                                <td>{{ formatValue(dataPoint.std_dev) }}°C</td>
                            </tr>
                            <tr v-if="quantile">
                                <th scope="row">{{ t.upper_quantile }} ({{ formatQuantileLabel(upperQuantileLabel) }})</th>
                                <td>{{ formatValue(quantile.upperq) }}°C</td>
                            </tr>
                            <tr v-if="quantile">
                                <th scope="row">{{ t.lower_quantile || 'Lower Quantile' }} ({{ formatQuantileLabel(lowerQuantileLabel) }})</th>
                                <td>{{ formatValue(quantile.lowerq) }}°C</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `
};