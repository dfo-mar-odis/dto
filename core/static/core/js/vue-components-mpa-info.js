export const MPAInfo = {
    props: {
        generatePdfUrl: {
            type: String,
            default: ''
        },
        iconUrl: {
            type: String,
            default: ''
        },
        mpa: {
            type: Object,
            default: null
        },
        dates: {
            type: Object,
            default: () => ({})
        },
        depth: {
            type: String,
            default: ''
        }
    },
    computed: {
        t() {
            return window.translations || {};
        },
        completePdfUrl() {
            if (!this.mpa || !this.mpa.id) return this.generatePdfUrl;

            let url = this.generatePdfUrl;
            let separator = '&';
            url += `?mpa=${this.mpa.id}`;
            if (this.dates) {
                if (this.dates.startDate) {
                    url += `${separator}start_date=${this.dates.startDate}`;
                }
                if (this.dates.endDate) {
                    url += `${separator}end_date=${this.dates.endDate}`;
                }
                if (this.dates.selectedDate) {
                    url += `${separator}selected_date=${this.dates.selectedDate}`;
                }
            }

            url += `${separator}depth=${this.depth || ''}`;

            return url;
        },
        computekm2() {
            if (!this.mpa || !this.mpa.id || !this.mpa.km2) return '';

            return Number(this.mpa.km2).toFixed(2);

        }
    },
    template: `
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <h4 v-if="mpa.name">{{ t.mpa_description || 'Site Description' }}</h4>
          <h4 v-else>{{ t.about }}</h4>
        </div>
      </div>
      <div class="card-body" v-if="mpa.name">
        <div class="row">
          <div class="col"><b>{{ t.name || 'Name' }} :</b> {{ mpa.name }}</div>
        </div>
        <div class="row">
          <div class="col"><b>{{ t.classification || 'Classification' }} :</b> <a :href="mpa.classification">{{ mpa.class }}</a></div>
        </div>
        <div class="row">
          <div class="col"><b>{{ t.url || 'URL' }} :</b> <a v-if="mpa.url" :href="mpa.url">{{ t.additional_information || 'Additional Information' }}</a></div>
        </div>
        <div class="row">
          <div class="col"><b>{{ t.area || 'Area (km^2)' }} :</b> <span v-if="mpa.km2" class="col">{{ computekm2 }}</span></div>
        </div>
      </div>
      <div class="card-body alert-info" v-else>
        <p>{{ t.dto_description }}</p>
        <p>{{ t.select_mpa || 'Please select an MPA' }}</p>
      </div>
    </div>
  `
};