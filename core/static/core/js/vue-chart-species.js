import {TimeseriesChart} from "./vue-chart-timeseries.js";
import {LegendSectionPlugin} from './vue-plugin-legend.js';

export const SpeciesChart = {
    // Extend the TimeseriesChart component
    extends: TimeseriesChart,
    props: {
        speciesList: {
            type: Array,
            default: () => []
        }
    },
    computed: {
        t() {
            return window.translations || {};
        },
    },
    data() {
        return {
            ...TimeseriesChart.data(),
            selectedSpecies: null,
            speciesLoading: false,
            loadingSpeciesImage: true
        };
    },

    watch: {
        selectedSpecies(newSpecies) {
            if (newSpecies) {
                this.fetchSpeciesImage();
            }
        }
    },

    methods: {
        async fetchChartData() {

        },

        fetchSpeciesImage() {
            if (!this.selectedSpecies) {
                return;
            }

            // const phylopic_url = "https://api.phylopic.org/images?build=517&page=0";
            const phylopic_url = "https://api.phylopic.org";
            let build = null;

            const url = new URL(phylopic_url, window.location.origin);

            this.loadingSpeciesImage = true;
            fetch(url.toString())
                .then(response => response.json())
                .then(data => {
                    if (data.build) {
                        const nextUrl = new URL(phylopic_url + "/images", window.location.origin);
                        build = data.build
                        nextUrl.searchParams.append('filter_name', this.selectedSpecies.scientific_name.toLowerCase());
                        nextUrl.searchParams.append("build", data.build)
                        nextUrl.searchParams.append("page", 0)
                        return fetch(nextUrl.toString());
                    } else {
                        return null;
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data._links && data._links.items && data._links.items.length > 0) {
                        const href = data._links.items[data._links.items.length - 1].href;
                        const nextUrl = new URL(href, "https://api.phylopic.org");
                        nextUrl.searchParams.append("build", build)
                        return fetch(nextUrl.toString());
                    } else {
                        return null;
                    }
                })
                .then(response => { if(response) return response.json(); })
                .then(nextData => {
                    console.log(nextData);
                    if (nextData && nextData._links && nextData._links.vectorFile) {
                        const vectorFile = nextData._links.vectorFile;
                        const [width, height] = vectorFile.sizes.split('x').map(Number);

                        this.selectedSpecies.vector_link = vectorFile.href;

                        if (height > width) {
                            // Rotate -90 degrees aournd the top left corner and then
                            // translate down by the 96px, which is what we set the
                            // size of the species-vector class to in the main.css
                            this.selectedSpecies.rotationStyle = `
                                width: 96px;
                                transform-origin: top left;
                                transform: rotate(-90deg) translateX(-96px);
                            `;
                        } else {
                            this.selectedSpecies.rotationStyle = `
                                height: 96px;
                            `;
                        }
                    }
                })
                .catch(error => {
                    console.error("Error fetching data:", error);
                })
                .finally(() => {
                    this.loadingSpeciesImage = false;
                });
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
                        formattedData.datasets.push(
                            {
                                label: `${this.selectedSpecies.name} Max Temp`,
                                data: datePoints.map(date => ({x: date, y: maxTemp})),
                                borderColor: 'rgba(255, 165, 0, 1)', // Orange
                                borderWidth: 2,
                                borderDash: [5, 5],
                                pointRadius: 0,
                                fill: false,
                                meta: {
                                    legendId: 'species_1'
                                }
                            },

                            // Add min temperature line
                            {
                                label: `${this.selectedSpecies.name} Min Temp`,
                                data: datePoints.map(date => ({x: date, y: minTemp})),
                                borderColor: 'rgba(70, 130, 180, 1)', // Steel blue
                                borderWidth: 2,
                                borderDash: [5, 5],
                                pointRadius: 0,
                                fill: false,
                                meta: {
                                    legendId: 'species_2'
                                }
                            },

                            // Add survivable range area
                            {
                                label: `${this.selectedSpecies.name} Survivable Range`,
                                data: datePoints.map(date => ({x: date, y: minTemp})),
                                borderColor: 'rgba(0, 0, 0, 0)',
                                backgroundColor: 'rgba(144, 238, 144, 0.3)', // Light green
                                fill: {
                                    target: dataset_elements,
                                    above: 'rgba(0, 0, 0, 0)',
                                    below: 'rgba(144, 238, 144, 0.3)',
                                },
                                pointRadius: 0,
                                meta: {
                                    legendId: 'species_3'
                                }
                            }
                        );
                    }
                }
            }

            return formattedData;
        },

        match_timeseries_legend_function(dataset) {
            let match = TimeseriesChart.methods.match_timeseries_legend_function.call(this, dataset);
            match = match && !(this.match_species_legend_function(dataset))
            return match;
        },

        match_species_legend_function(dataset) {
            return dataset.meta.legendId.includes('species')
        },

        get_legend() {
            const legendConfig = TimeseriesChart.methods.get_legend.call(this);
            // This is where you can filter layers out of the custom legend if you want them to be
            // drawn on the chart, but not visible in the legend
            legendConfig.push(
                {
                    id: 'species-legend',
                    matchFunction: (dataset) => this.match_species_legend_function(dataset)
                }
            );
            return legendConfig;
        },

    },

    // Override the template to add species selection panel
    template: `
      <div class="row mb-1">
        <div class="col-md-3 species-panel">
          <div class="card">
            <div class="card-header">{{ t.species_select || 'Species Select' }}</div>
            <div class="card-body">
              <div v-if="speciesLoading" class="text-center p-3">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                  <span class="visually-hidden">{{ t.loading || 'Loading...' }}</span>
                </div>
              </div>
              <div v-else-if="speciesList.length === 0" class="text-center text-muted p-3">
                <i class="bi bi-fish"></i>
                <p>{{ t.no_data_available || 'No data available' }}</p>
              </div>
              <div v-else class="species-list">
                <select class="form-select form-select-sm"
                        :disabled="speciesLoading"
                        @change="selectSpeciesById($event.target.value)">
                  <option value="">{{ t.select_species || 'Select a Species' }}</option>
                  <option v-for="species in speciesList"
                          :key="species.id"
                          :value="species.id"
                          :selected="selectedSpecies && selectedSpecies.id === species.id">
                    {{ species.name }}
                  </option>
                </select>

                <div v-if="selectedSpecies" class="species-details mt-1">
                  <p class="text-muted fst-italic">{{ selectedSpecies.scientific_name }}</p>
                  <div v-if="loadingSpeciesImage" class="species-vector">
                    <div class="spinner-border text-primary" role="status">
                      <span class="visually-hidden">{{ t.loading || 'Loading...' }}</span>
                    </div>
                  </div>
                  <div v-else-if="selectedSpecies.vector_link" class="species-vector">
                    <img :src="selectedSpecies.vector_link" :alt="selectedSpecies.scientific_name" class="img-fluid"
                         :style="selectedSpecies.rotationStyle">
                  </div>
                  <div class="species-info">
                    <div v-if="selectedSpecies.grouping" class="mb-2">
                      <strong>{{ t.species_group || 'Group' }} :</strong> {{ selectedSpecies.grouping.display }}
                    </div>
                    <div v-if="selectedSpecies.status" class="mb-2">
                      <strong>{{ t.species_status || 'Status' }} :</strong> {{ selectedSpecies.status.display }}
                    </div>
                    <div v-if="selectedSpecies.importance" class="mb-2">
                      <strong>{{ t.species_importance || 'Importance' }} :</strong>
                      {{ selectedSpecies.importance.display }}
                    </div>

                    <hr>

                    <div class="mb-2">
                      <strong>{{ t.temperature }} :</strong>
                      {{ selectedSpecies.lower_temperature }}°C - {{ selectedSpecies.upper_temperature }}°C
                    </div>
                    <div class="mb-2">
                      <strong>{{ t.depth }} :</strong>
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
        </div>
      </div>
    `,
};