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
          <div class="row">
            <div class="col-1">
              <img class="img-fluid" :src="iconUrl">
            </div>
            <div class="col">
              <h2>{{ t.mpa_description || 'MPA Description' }}</h2>
            </div>
<!--            <div class="col-auto">-->
<!--              <a id="btn_id_pdf" class="btn btn-primary" :style="{ display: mpa.name ? 'block' : 'none' }"-->
<!--                 :href="completePdfUrl">{{ t.generate_report || 'Generate PDF' }}</a>-->
<!--            </div>-->
          </div>
        </div>
      </div>
      <div class="card-body" v-if="mpa.name">
        <div class="row">
          <div class="col-2"><b>{{ t.name || 'Name' }} :</b></div>
          <div class="col">{{ mpa.name }}</div>
        </div>
        <div class="row">
          <div class="col-2"><b>{{ t.classification || 'Classification' }} :</b></div>
          <div class="col"><a :href="mpa.classification">{{ mpa.class }}</a></div>
        </div>
        <div class="row">
          <div class="col-2"><b>{{ t.url || 'URL' }} :</b></div>
          <div class="col"><a v-if="mpa.url" :href="mpa.url">{{ t.additional_information || 'Additional Information' }}</a></div>
        </div>
        <div class="row">
          <div class="col-2"><b>{{ t.area || 'Area (km^2)' }} :</b></div>
          <div v-if="mpa.km2" class="col">{{ computekm2 }}</div>
        </div>
      </div>
      <div class="card-body alert-info" v-else>
        {{ t.select_mpa || 'Please select an MPA' }}
      </div>
    </div>
  `
};