import {TimeseriesChart} from "./vue-chart-timeseries.js";
import {LegendSectionPlugin} from './vue-chart-legend-plugin.js';

export const SpeciesChart = {
    // Extend the TimeseriesChart component
    extends: TimeseriesChart,
    props: {
        speciesList: {
            type: Array,
            default: () => []
        }
    },

    data() {
        return {
            ...TimeseriesChart.data(),
            selectedSpecies: null,
            speciesLoading: false
        };
    },

    watch: {},

    methods: {
        async fetchChartData() {

        },

        selectSpeciesById(speciesId) {
            this.selectedSpecies = null;
            if (speciesId) {
                this.selectedSpecies = this.speciesList.find(s => s.id == speciesId);
            }
            this.updateChart();
        },

        // Override formatChartData to add species temperature ranges
        formatChartData() {
            const parentFormatData = TimeseriesChart.methods.formatChartData.bind(this);
            const formattedData = parentFormatData();
            const dataset_elements = formattedData.datasets.length

            // Add species temperature ranges if a species is selected
            if (this.selectedSpecies &&
                this.selectedSpecies.lower_temperature !== undefined &&
                this.selectedSpecies.upper_temperature !== undefined) {
                const minTemp = parseFloat(this.selectedSpecies.lower_temperature);
                const maxTemp = parseFloat(this.selectedSpecies.upper_temperature);

                // Create horizontal lines for min and max temperatures
                if (formattedData.datasets && dataset_elements > 0) {
                    const datePoints = formattedData.datasets[0].data.map(point => point.x);

                    if (datePoints.length > 0) {
                        // Add max temperature line
                        formattedData.datasets.push({
                            label: `${this.selectedSpecies.name} Max Temp`,
                            data: datePoints.map(date => ({x: date, y: maxTemp})),
                            borderColor: 'rgba(255, 165, 0, 1)', // Orange
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false
                        });

                        // Add min temperature line
                        formattedData.datasets.push({
                            label: `${this.selectedSpecies.name} Min Temp`,
                            data: datePoints.map(date => ({x: date, y: minTemp})),
                            borderColor: 'rgba(70, 130, 180, 1)', // Steel blue
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false
                        });

                        // Add survivable range area
                        formattedData.datasets.push({
                            label: `${this.selectedSpecies.name} Survivable Range`,
                            data: datePoints.map(date => ({x: date, y: minTemp})),
                            borderColor: 'rgba(0, 0, 0, 0)',
                            backgroundColor: 'rgba(144, 238, 144, 0.3)', // Light green
                            fill: {
                                target: dataset_elements,
                                above: 'rgba(0, 0, 0, 0)',
                                below: 'rgba(144, 238, 144, 0.3)',
                            },
                            pointRadius: 0
                        });
                    }
                }
            }

            return formattedData;
        },

        get_legend() {
            const legend = TimeseriesChart.methods.get_legend.call(this);
            legend.push(
                {
                    id: 'species',
                    matchFunction: (dataset) => {
                        return dataset.label.includes('Max Temp') ||
                            dataset.label.includes('Min Temp') ||
                            dataset.label.includes('Survivable Range');
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
                    <div class="card-header">Species Select</div>
                    <div class="card-body">
                        <div v-if="speciesLoading" class="text-center p-3">
                            <div class="spinner-border spinner-border-sm text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                        <div v-else-if="speciesList.length === 0" class="text-center text-muted p-3">
                            <i class="bi bi-fish"></i>
                            <p>No species data available</p>
                        </div>
                        <div v-else class="species-list">
                            <select class="form-select form-select-sm" 
                                    :disabled="speciesLoading"
                                    @change="selectSpeciesById($event.target.value)">
                                <option value="">Select a Species</option>
                                <option v-for="species in speciesList"
                                        :key="species.id"
                                        :value="species.id"
                                        :selected="selectedSpecies && selectedSpecies.id === species.id">
                                    {{ species.name }}
                                </option>
                            </select>
                        
                            <div v-if="selectedSpecies" class="species-details mt-3">
                                <p class="text-muted fst-italic">{{ selectedSpecies.scientific_name }}</p>
                                
                                <div class="species-info">
                                    <div v-if="selectedSpecies.grouping" class="mb-2">
                                        <strong>Group:</strong> {{ selectedSpecies.grouping.display }}
                                    </div>
                                    <div v-if="selectedSpecies.status" class="mb-2">
                                        <strong>Status:</strong> {{ selectedSpecies.status.display }}
                                    </div>
                                    <div v-if="selectedSpecies.importance" class="mb-2">
                                        <strong>Importance:</strong> {{ selectedSpecies.importance.display }}
                                    </div>
                            
                                    <hr>
                            
                                    <div class="mb-2">
                                        <strong>Temperature Range:</strong><br>
                                        {{ selectedSpecies.lower_temperature }}°C - {{ selectedSpecies.upper_temperature }}°C
                                    </div>
                                    <div class="mb-2">
                                        <strong>Depth Range:</strong><br>
                                        {{ selectedSpecies.lower_depth }}m - {{ selectedSpecies.upper_depth }}m
                                    </div>
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