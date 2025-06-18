export const MPAControls = {
    props: {
        mpa: Object,
        maxDateUrl: {
            type: String,
            required: true
        },
        mpaDepthsUrl: {
            type: String,
            required: true
        },
        selectedDate: String
    },
    data() {
        return {
            state: {
                depth: "",
                dates: {
                    startDate: null,
                    endDate: null,
                    selected: null
                },
                depths: []
            },
            debounceTimer: null
        };
    },
    watch: {
        mpa: {
            handler(newMpa, oldMpa) {
                // Reset depth selection when MPA changes
                this.state.depth = "";
                // Fetch new depths for this MPA
                this.fetchDepths();
                this.setSelectedDepth();
            },
            deep: true
        },
        'state.dates.startDate': function (newVal, oldVal) {
            // Emit only when we have a complete date value and it has changed
            if (newVal &&
                newVal.match(/^\d{4}-\d{2}-\d{2}$/) &&
                newVal !== oldVal) {
                this.setDateRange();
            }
        },
        'state.dates.endDate': function (newVal, oldVal) {
            // Emit only when we have a complete date value and it has changed
            if (newVal &&
                newVal.match(/^\d{4}-\d{2}-\d{2}$/) &&
                newVal !== oldVal) {
                this.setDateRange();
            }
        },
        selectedDate: {
            handler(newVal) {
                if (newVal &&
                    newVal.match(/^\d{4}-\d{2}-\d{2}$/) &&
                    newVal !== this.state.dates.selected) {
                    this.setSelectedDate(newVal);
                }
            },
            immediate: true
        },
    },
    mounted() {
        // Fetch the max date from the server when component is mounted
        fetch(this.maxDateUrl)
            .then(response => response.json())
            .then(data => {
                // Calculate start date (5 years before end date)
                const startDate = new Date(data.max_date);
                startDate.setFullYear(startDate.getFullYear() - 5);

                const defaultEndDate = new Date(data.max_date);
                defaultEndDate.setDate(defaultEndDate.getDate() - 1);

                // Update component state
                this.state.dates.endDate = defaultEndDate.toISOString().split('T')[0];
                this.state.dates.startDate = startDate.toISOString().split('T')[0];
                this.state.dates.selected = this.state.dates.endDate;

                // Initialize with default zoom range
                this.$nextTick(() => {
                    this.setDateRange();
                    this.setSelectedDate(this.state.dates.selected);
                });
            })
            .catch(error => {
                console.error("Failed to fetch max date:", error);
            });

    },
    methods: {
        fetchDepths() {
            // Only proceed if we have a valid MPA
            if (this.mpa && this.mpa.id) {
                // Add the MPA ID as a query parameter
                const url = `${this.mpaDepthsUrl}?mpa_id=${this.mpa.id}`;

                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        this.state.depths = data.depths || [];
                    })
                    .catch(error => {
                        console.error("Failed to fetch depths:", error);
                    });
            } else {
                // Reset depths if no MPA is selected
                this.state.depths = [];
            }
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

        },

        setSelectedDate(date) {
            // If a date is provided, update the selected date
            if (date) {
                const formattedDate = date instanceof Date
                    ? date.toISOString().split('T')[0]
                    : date;

                // Validate the date is after 1800-01-01
                const minDate = new Date('1800-01-01');
                const selectedDate = new Date(formattedDate);

                if (!isNaN(selectedDate.getTime()) && selectedDate >= minDate) {
                    this.state.dates.selected = formattedDate;

                    // Emit an event for the selected date
                    this.$emit('selected-date-changed', this.state.dates.selected);
                }
            }
        },

        setDateRange() {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.$emit('date-range-change', {
                    min: this.state.dates.startDate,
                    max: this.state.dates.endDate
                });
            }, 1000);
        },

        setSelectedDepth() {
            // Fetch data based on selected depth
            this.$emit('depth-selected', this.state.depth);
        },
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
                                    @change="setSelectedDepth(state.depth)">
                                    <option value="">Total Average Bottom Timeseries</option>
                                    <option v-for="depth in state.depths" 
                                            :key="depth[0]" 
                                            :value="depth[0]">
                                        {{ depth[1] }}
                                    </option>
                                </select>
                            </div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-auto align-content-center mt-4">
                                <button type="button" class="btn btn-secondary me-1" title="-10 years"
                                        @click="panFrame(-10)"><<<</button>
                                <button type="button" class="btn btn-secondary me-1" title="-5 years"
                                        @click="panFrame(-5)"><<</button>
                                <button type="button" class="btn btn-secondary" title="-1 year"
                                        @click="panFrame(-1)"><</button>
                            </div>
                            <div class="col">
                                <label for="date_min" class="form-label">Start Date</label>
                                <input id="date_min" type="date" class="form-control"
                                       v-model="state.dates.startDate"
                                       @change="setDateRange"
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
                                       @change="setDateRange"
                                       max="9999-12-31"/>
                            </div>
                            <div class="col-auto align-content-center mt-4">
                                <button type="button" class="btn btn-secondary me-1" title="+1 year"
                                        @click="panFrame(1)">></button>
                                <button type="button" class="btn btn-secondary me-1" title="+5 years"
                                        @click="panFrame(5)">>></button>
                                <button type="button" class="btn btn-secondary" title="+10 years"
                                        @click="panFrame(10)">>>></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
};