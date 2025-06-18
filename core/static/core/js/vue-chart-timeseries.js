import {LegendSectionPlugin} from './vue-chart-legend-plugin.js';

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

            this.timeseriesData.data.forEach(point => {
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
                        label: 'Bottom Temperature',
                        data: dataPoints,
                        borderColor: '#FF0000',
                        borderWidth: 2,
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
                        borderWidth: 2,
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
                        pointRadius: 0,
                        tooltip: {
                            display: false
                        }
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
                        pointRadius: 0,
                        tooltip: {
                            display: false
                        }
                    },
                ]
            };
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

        get_legend() {
            return [{
                id: 'timeseries',
                matchFunction: (dataset) => {
                    return !dataset.label.includes('Max Temp') &&
                        !dataset.label.includes('Min Temp') &&
                        !dataset.label.includes('Survivable Range');
                }
            }];
        },

        createNewChart(ctx, formattedData) {
            try {
                const component = this;
                const legend = this.get_legend();

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
                        ctx.fillText(dateStr.split('T')[0], xPos, yAxis.top - 5);
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
                            const canvasPosition = Chart.helpers.getRelativePosition(e, chart);
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
                                text: `Temperature Timeseries - ${this.mpa.name}`,
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
                                    return tooltipItem.datasetIndex < 2;
                                }
                            },
                            legend: {
                                position: 'top',
                                onClick: function (e, legendItem, legend) {
                                    // Prevent clicks on the divider/header
                                    if (legendItem.isHeader) return;

                                    const index = legendItem.datasetIndex;
                                    const ci = legend.chart;

                                    if (ci.isDatasetVisible(index)) {
                                        ci.hide(index);
                                    } else {
                                        ci.show(index);
                                    }
                                    ci.update();
                                }
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
                    },
                    plugins: [
                        LegendSectionPlugin(legend, this.chartInstanceId),
                        dateIndicatorPlugin
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
    `,
};
