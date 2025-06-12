export const MPAControls = {
    props: {
        mpa: Object,
        maxDateUrl: {
            type: String,
            required: true
        }
    },
    template: `
                <div class="card">
                    <div class="card-body">
                        <div class="row justify-content-center">
                            <div class="col">
                                <div class="row">
                                    <div class="col align-content-center">
                                        <label for="btm_depth">Bottom Depth</label>
                                        <select class="form-select" id="btm_depth"
                                                v-model="state.depth"
                                                @change="getData">
                                            <option value="">Total Average Bottom Timeseries</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="row mt-2">
                                    <div class="col-auto align-content-center mt-4">
                                        <button type="button" class="btn btn-secondary me-1" title="-10 years"
                                                @click="panFrame(-10)"><<</button>
                                        <button type="button" class="btn btn-secondary" title="-5 years"
                                                @click="panFrame(-5)"><</button>
                                    </div>
                                    <div class="col">
                                        <label for="date_min" class="form-label">Start Date</label>
                                        <input id="date_min" type="date" class="form-control"
                                               v-model="state.dates.startDate"
                                               @change="setZoom"
                                               max="9999-12-31"/>
                                    </div>
                                    <div class="col">
                                        <label for="selected_date"
                                               class="form-label">Selected Date</label>
                                        <input id="selected_date" type="date" class="form-control"
                                               v-model="state.dates.selected"
                                               @change="setSelectedDate(state.dates.selected)"
                                               max="9999-12-31"/>
                                    </div>
                                    <div class="col">
                                        <label for="date_end" class="form-label">End Date</label>
                                        <input id="date_end" type="date" class="form-control"
                                               v-model="state.dates.endDate"
                                               @change="setZoom"
                                               max="9999-12-31"/>
                                    </div>
                                    <div class="col-auto align-content-center mt-4">
                                        <button type="button" class="btn btn-secondary me-1" title="+5 years"
                                                @click="panFrame(5)">></button>
                                        <button type="button" class="btn btn-secondary" title="+10 years"
                                                @click="panFrame(10)">>></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
    `,
    data() {
        return {
            state: {
                depth: "",
                dates: {
                    startDate: null,
                    endDate: null,
                    selected: null
                }
            },
            debounceTimer: null
        };
    },
    mounted() {
        // Fetch the max date from the server when component is mounted
        fetch(this.maxDateUrl)
            .then(response => response.json())
            .then(data => {
                // Set end date to max date from server
                const endDate = data.max_date;

                // Calculate start date (5 years before end date)
                const startDate = new Date(endDate);
                startDate.setFullYear(startDate.getFullYear() - 5);
                const defaultStartDate = startDate.toISOString().split('T')[0];

                // Update component state
                this.state.dates.endDate = endDate;
                this.state.dates.startDate = defaultStartDate;
                this.state.dates.selected = endDate;

                // Initialize with default zoom range
                this.$nextTick(() => {
                    this.setZoom();
                });
            })
            .catch(error => {
                console.error("Failed to fetch max date:", error);
            });
    },
    methods: {
        getData() {
            // Fetch data based on selected depth
            this.$emit('get-data', this.state.depth);
        },
        panFrame(years) {
            // Create new Date objects from current values
            const startDate = new Date(this.state.dates.startDate);
            const endDate = new Date(this.state.dates.endDate);

            // Add years to both dates
            startDate.setFullYear(startDate.getFullYear() + years);
            endDate.setFullYear(endDate.getFullYear() + years);

            // Convert back to YYYY-MM-DD format
            this.state.dates.startDate = startDate.toISOString().split('T')[0];
            this.state.dates.endDate = endDate.toISOString().split('T')[0];

            // Emit the pan-frame event with the years value
            this.$emit('pan-frame', years);

            // This will trigger the debounced setZoom via the watch properties
            // No need to call setZoom directly
        },
        setZoom() {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.$emit('set-zoom', {
                    min: this.state.dates.startDate,
                    max: this.state.dates.endDate
                });
            }, 750);
        },
        setSelectedDate(date) {
            // Update selected date
            this.$emit('date-selected', date);
        }
    },
    watch: {
        'state.dates.startDate': function (newVal) {
            // Emit only when we have a complete date value
            if (newVal && newVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
                this.setZoom();
            }
        },
        'state.dates.endDate': function (newVal) {
            if (newVal && newVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
                this.setZoom();
            }
        }
    }
};