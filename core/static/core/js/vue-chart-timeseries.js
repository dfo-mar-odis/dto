export const TimeseriesChart = {
    props: {
        timeseriesData: Object,
        mpa: {
            type: Object,
            default: () => ({})
        },
        startDate: String,
        endDate: String,
        depth: [String, Number],
        chartUrl: String,
        isActive: Boolean,
        isLoading: {
            type: Boolean,
            default: false
        }
    },

    data() {
        return {
            localLoading: false,
            loading: false,
            chart: null,
            chartData: null
        };
    },

    template: `
        <div class="chart-container position-relative">
          <div v-if="isLoading || localLoading" class="chart-loading-overlay">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          <canvas ref="chartCanvas"></canvas>
          <div v-if="!mpa.name" class="text-center text-muted mt-5 pt-5">
            <i class="bi bi-map"></i>
            <p>Select an MPA on the map to view timeseries data</p>
          </div>
        </div>
    `,

    watch: {
        mpa: {
            handler: 'fetchChartData',
            deep: true
        },
        startDate: 'fetchChartData',
        endDate: 'fetchChartData',
        depth: 'fetchChartData',
        isActive(newValue) {
            if (newValue && this.mpa.id) {
                this.fetchChartData();
            }
        },
        timeseriesData(newData) {
            if (newData) {
                this.chartData = newData;
                this.updateChart();
            }
        },
        loading(newValue) {
            // You could add additional behavior when loading state changes
            if (newValue) {
                // Chart is loading
            } else {
                // Chart finished loading
            }
        }
    },

    methods: {
        // This should be overridden in extending classes for specialized data.
        async fetchChartData() {

        },

        updateChart() {
            if (!this.chartData) return;
            this.renderChart();
        },

        formatChartData() {
            if (!this.chartData || !this.chartData.data || !Array.isArray(this.chartData.data)) {
                console.warn('Invalid chart data received:', this.chartData);
                return {datasets: []};
            }

            const dataPoints = [];
            const climPoints = [];
            const abovePoints = [];
            const belowPoints = [];

            this.chartData.data.forEach(point => {
                if (!point.date || !point.ts_data) return;

                const date = new Date(point.date);
                const tsValue = parseFloat(point.ts_data);
                const climValue = parseFloat(point.clim);

                // Add timeseries data point
                dataPoints.push({
                    x: date,
                    y: tsValue
                });

                // Add climatology data point
                climPoints.push({
                    x: date,
                    y: climValue
                });
            });

            return {
                datasets: [
                    // Main temperature line
                    {
                        label: 'Temperature',
                        data: dataPoints,
                        borderColor: '#FF0000',
                        backgroundColor: 'rgba(0,0,0,0)',
                        tension: 0.1,
                        pointRadius: 0.1,
                        fill: false
                    },
                    // Climatology line
                    {
                        label: 'Climatology',
                        data: climPoints,
                        borderColor: '#000000',
                        backgroundColor: 'rgba(0,0,0,0)',
                        tension: 0.1,
                        pointRadius: 0.1,
                    },
                    // Above average area (red)
                    {
                        label: 'Above Average (Warmer)',
                        data: dataPoints,
                        borderColor: 'rgba(0,0,0,0)',
                        backgroundColor: 'rgba(255, 0, 0, 0.2)',
                        fill: {
                            target: 1,
                            above: 'rgba(255, 0, 0, 0.2)',
                            below: 'rgba(0, 0, 0, 0)'
                        },
                        pointRadius: 0
                    },
                    // Below average area (blue)
                    {
                        label: 'Below Average (Cooler)',
                        data: dataPoints,
                        borderColor: 'rgba(0,0,0,0)',
                        backgroundColor: 'rgba(0, 0, 255, 0.2)',
                        fill: {
                            target: 1,
                            above: 'rgba(0, 0, 0, 0)',
                            below: 'rgba(0, 0, 255, 0.2)'
                        },
                        pointRadius: 0
                    },
                ]
            };
        },

        renderChart() {
            const ctx = this.$refs.chartCanvas.getContext('2d');

            if (this.chart) {
                this.chart.destroy();
            }

            const formattedData = this.formatChartData();

            this.chart = new Chart(ctx, {
                type: 'line',
                data: formattedData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `Temperature Timeseries - ${this.mpa.name}`
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'month'
                            },
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Temperature (°C)'
                            }
                        }
                    }
                }
            });
        }
    },

    mounted() {
        if (this.isActive && this.mpa.id) {
            this.fetchChartData();
        }
    },

    beforeUnmount() {
        if (this.chart) {
            this.chart.destroy();
        }
    },
}