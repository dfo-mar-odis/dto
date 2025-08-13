import {LegendSectionPlugin} from './vue-chart-plugin-legend.js';
import {ToggleObservationsPlugin} from './vue-chart-plugin-toggle-observations.js';

export const TimeseriesChart = {
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
        }
    },
    computed: {
        t() {
            return window.translations || {};
        },
    },
    data() {
        return {
            localLoading: false,
            loading: false,
            chart: null,
            fetchTimeout: null,
            chartInstanceId: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Generate unique ID
        };
    },
    watch: {
        selectedDate: {
            handler(newVal, oldVal) {
                if (newVal && newVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    this.setDateIndicator(newVal);
                }
            },
            immediate: true
        },
        isActive(newData) {
            if (newData && this.mpa.id) {
                this.debouncedFetchData();
            }
        },
        timeseriesData: {
            handler(newData) {
                if (newData) {
                    this.debouncedFetchData();
                }
            },
            immediate: true
        },
    },
    methods: {
        debouncedFetchData() {
            if (this.fetchTimeout) {
                clearTimeout(this.fetchTimeout);
            }

            this.fetchTimeout = setTimeout(async () => {
                await this.fetchChartData();
                this.updateChart();
            }, 300);
        },

        // This should be overridden in extending classes for specialized data.
        async fetchChartData() {

        },

        updateChart() {
            if (!this.timeseriesData) return;

            this.renderChart();
        },

        formatChartData() {
            if (!this.timeseriesData || !this.timeseriesData.data || !Array.isArray(this.timeseriesData.data)) {
                console.warn('Invalid chart data received:', this.timeseriesData);
                return {datasets: []};
            }

            const dataPoints = [];
            const climPoints = [];
            const obsPoints = [];
            let obsCount = 0;
            this.timeseriesData.data.forEach(point => {
                if (!point.date || !point.ts_data) return;

                const date = new Date(point.date);
                const tsValue = parseFloat(point.ts_data);
                const climValue = parseFloat(point.clim);
                if(point.observation) {
                    const obsValue = parseFloat(point.observation.value);
                    obsPoints.push({
                        x: date,
                        y: obsValue,
                        label: "n=" + String(point.observation.count) + ", σ=" + String(point.observation.std_dev)
                    });
                    obsCount += 1;
                } else {
                    obsPoints.push({
                        x: date,
                        y: NaN,
                    });
                }

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

            let observation_dataset = {
                type: 'scatter',
                label: window.translations?.observations || 'Observations',
                data: obsPoints,
                borderColor: '#0074D9',
                pointRadius: 1,
                pointBorderWidth: 1,
                showLine: false, // Ensures it's treated as points only
                fill: false,
                meta: {
                    legendId: "timeseries_5",
                    showToolTip: true
                }
            }
            if (obsCount < 100) {
                observation_dataset.pointRadius = 10
                observation_dataset.pointBorderWidth = 3
                observation_dataset.pointStyle = 'cross'
            }

            return {
                datasets: [
                    // Main temperature line
                    {
                        label: window.translations?.bottom_temperature || 'Bottom Temperature',
                        data: dataPoints,
                        borderColor: '#FF0000',
                        borderWidth: 2,
                        backgroundColor: 'rgba(0,0,0,0)',
                        tension: 0.1,
                        pointRadius: 0.1,
                        fill: false,
                        meta: {
                            legendId: "timeseries_1",
                            showToolTip: true
                        }
                    },
                    // Climatology line
                    {
                        label: window.translations?.climatology || 'Climatology',
                        data: climPoints,
                        borderColor: '#000000',
                        borderWidth: 2,
                        backgroundColor: 'rgba(0,0,0,0)',
                        tension: 0.1,
                        pointRadius: 0.1,
                        meta: {
                            legendId: "timeseries_2",
                            showToolTip: true
                        }
                    },
                    // Above average area (red)
                    {
                        label: window.translations?.above_average_temp || 'Above Average (Warmer)',
                        data: dataPoints,
                        borderColor: 'rgba(0,0,0,0)',
                        backgroundColor: 'rgba(255, 0, 0, 0.2)',
                        fill: {
                            target: 1,
                            above: 'rgba(255, 0, 0, 0.2)',
                            below: 'rgba(0, 0, 0, 0)'
                        },
                        pointRadius: 0,
                        meta: {
                            legendId: "timeseries_3"
                        }
                    },
                    // Below average area (blue)
                    {
                        label: window.translations?.below_average_temp || 'Below Average (Cooler)',
                        data: dataPoints,
                        borderColor: 'rgba(0,0,0,0)',
                        backgroundColor: 'rgba(0, 0, 255, 0.2)',
                        fill: {
                            target: 1,
                            above: 'rgba(0, 0, 0, 0)',
                            below: 'rgba(0, 0, 255, 0.2)'
                        },
                        pointRadius: 0,
                        meta: {
                            legendId: "timeseries_4"
                        }
                    },
                    // Observation points
                    observation_dataset,
                ]
            };
        },

        match_timeseries_legend_function(dataset) {
            return dataset.meta.legendId !== 'timeseries_5';
        },

        get_legend() {
            const legendConfig = [];
            legendConfig.push({
                id: 'timeseries',
                matchFunction: (dataset) => this.match_timeseries_legend_function(dataset)
            });
            return legendConfig;
        },

        renderChart() {

            // Safely check if we can get a context
            if (!this.$refs.chartCanvas) {
                console.warn("Chart canvas element not available, will retry");
                setTimeout(() => this.renderChart(), 100);
                return;
            }

            let ctx;
            try {
                ctx = this.$refs.chartCanvas.getContext('2d');
            } catch (e) {
                console.warn("Error getting canvas context, will retry:", e);
                setTimeout(() => this.renderChart(), 100);
                return;
            }

            if (!ctx) {
                console.warn("Canvas context is null, will retry");
                setTimeout(() => this.renderChart(), 100);
                return;
            }

            // Safely destroy existing chart
            if (!this.chart) {
                const formattedData = this.formatChartData();
                this.createNewChart(ctx, formattedData);
                return;
            }

            try {
                // Stop any ongoing animations first
                if (this.chart.animating) {
                    this.chart.stop();
                }

                // Give a small delay to ensure animations are fully stopped
                setTimeout(() => {
                    try {
                        this.chart.destroy();
                    } catch (e) {
                        console.warn("Error destroying previous chart:", e);
                    } finally {
                        this.chart = null;

                        // Continue with chart creation in the next tick
                        this.$nextTick(() => {
                            const formattedData = this.formatChartData();
                            this.createNewChart(ctx, formattedData);
                        });
                    }
                }, 10);

            } catch (e) {
                console.warn("Error destroying previous chart:", e);
                this.chart = null;
            }
        },

        createNewChart(ctx, formattedData) {
            try {
                const component = this;
                const legendConfig = this.get_legend();

                const observation_dataset = formattedData.datasets.findIndex(dataset => dataset.meta?.legendId==='timeseries_5')

                // Custom date indicator plugin that doesn't rely on the annotation plugin
                const dateIndicatorPlugin = {
                    id: 'dateIndicatorPlugin',
                    afterDraw: function (chart) {
                        // Get the date from component's non-reactive property
                        const dateStr = component._dateIndicatorValue;
                        if (!dateStr) return;

                        const date = new Date(dateStr);
                        const xScale = chart.scales.x;
                        if (!xScale) return;

                        const xPos = xScale.getPixelForValue(date);
                        const yAxis = chart.scales.y;

                        // Draw vertical line
                        const ctx = chart.ctx;
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(xPos, yAxis.top);
                        ctx.lineTo(xPos, yAxis.bottom);
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                        ctx.stroke();

                        // Draw label
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                        ctx.textAlign = 'center';
                        ctx.fillText(dateStr.split('T')[0], xPos, yAxis.bottom + 10);
                        ctx.restore();
                    }
                };

                this.chart = new Chart(ctx, {
                    type: 'line',
                    data: formattedData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: false,
                        onClick: (e, elements, chart) => {
                            // Get the x coordinate of the click position
                            const canvasPosition = window.getRelativePosition(e.native, chart);
                            const xScale = chart.scales.x;

                            // Convert x position to date value
                            const dateValue = xScale.getValueForPixel(canvasPosition.x);

                            // Format the date as expected by your indicator
                            const date = new Date(dateValue);

                            component.handleChartDateClick(date);
                        },
                        plugins: {
                            title: {
                                display: true,
                                text: (window.translations?.temperature_timeseries || 'Temperature Timeseries' ) + ' - ' + this.mpa.name,
                                padding: {
                                    top: 5,
                                    bottom: 15
                                }
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                filter: function (tooltipItem) {
                                    // Only show tooltips for datasets 0 and 1 (Temperature and Climatology)
                                    return tooltipItem.dataset.meta?.showToolTip;
                                },
                                callbacks: {
                                    label: function (context) {
                                        if (context.dataset.meta?.legendId === "timeseries_5") {
                                            // Format tooltip for the "Observations" dataset
                                            return `${context.dataset.label}: ${context.raw.y} (${context.raw.label})`;
                                        }
                                        // Default tooltip formatting for other datasets
                                        return `${context.dataset.label}: ${context.raw.y}`;
                                    }
                                },
                            },
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    unit: 'month',
                                },
                                adapters: {
                                    date: {
                                        locale: window.dateFnsLocales[window.currentLanguage || 'en']
                                    }
                                },
                                title: {
                                    display: true,
                                    text: window.translations?.date || 'Date'
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: (window.translations?.temperature || 'Temperature') + ' (°C)'
                                }
                            }
                        }
                    },
                    plugins: [
                        LegendSectionPlugin(legendConfig, this.chartInstanceId),
                        dateIndicatorPlugin,
                        ToggleObservationsPlugin(observation_dataset, this.chartInstanceId)
                    ]
                });

                if (this.selectedDate) {
                    this.setDateIndicator(this.selectedDate);
                }
            } catch
                (err) {
                console.error("Chart rendering error:", err);
                setTimeout(() => this.renderChart(), 100);
            }
        },

        setDateIndicator(dateStr) {
            if (!dateStr) return;

            try {
                // Store as a non-reactive property
                this._dateIndicatorValue = dateStr;

                // Force a redraw without update() or render()
                if (this.chart && this.chart.draw) {
                    requestAnimationFrame(() => this.chart.draw());
                }
            } catch (error) {
                console.error('Error setting date indicator:', error);
            }
        },

        handleChartDateClick(date) {
            let day = ("0" + date.getDate()).slice(-2);
            let month = ("0" + (date.getMonth() + 1)).slice(-2);
            let selected = date.getFullYear() + "-" + (month) + "-" + (day);

            // Emit an event with the selected date
            this.$emit('date-selected', selected);
        }
    },

    mounted() {
        this.dateIndicatorValue = 'undefined'
        if (this.isActive && this.mpa.id) {
            this.fetchChartData();
        }
    },

    beforeUnmount() {
        if (this.chart) {
            this.chart.destroy();
        }
    },

    template: `
        <div class="chart-container position-relative">
          <div v-if="isLoading || localLoading" class="chart-loading-overlay">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">{{ t.loading || 'Loading...' }}</span>
            </div>
          </div>
          <div :id="'custom-observation-placeholder-' + chartInstanceId"></div>
          <div :id="'custom-legend-placeholder-' + chartInstanceId" class="chart-legend-container"></div>
          <canvas ref="chartCanvas"></canvas>
          <div v-if="!mpa.name" class="text-center text-muted mt-5 pt-5">
            <i class="bi bi-map"></i>
            <p>{{ t.select_mpa_on_map || 'Select an MPA on the map to view timeseries data' }}</p>
          </div>
        </div>
    `,
};
