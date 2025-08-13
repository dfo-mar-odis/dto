
function setButtonState(btn, visible) {
    if (visible) {
        btn.innerHTML = '<i class="bi bi-eye"></i>'; // Show all
        btn.title = window.translations?.showing_observations || 'Showing observations';
    } else {
        btn.innerHTML = '<i class="bi bi-eye-slash"></i>'; // Hide all
        btn.title = window.translations?.hiding_observations || 'Hiding observations';
    }
}

export const ToggleObservationsPlugin = (dataset_index, chartInstanceId) => {
    // add a special button to the chart to show and hide the observations

    // Use closure to maintain state between renders
    // Store as a property on the window using the chartInstanceId to avoid conflicts
    const stateKey = `observations_${chartInstanceId}`;

    // Initialize only if not already set
    if (window[stateKey] === undefined) {
        window[stateKey] = { visible: true };
    }

    return {
        id: 'observationAnnotationPlugin',

        beforeDatasetDraw: function(chart, args) {
            if (args.index === dataset_index && !window[stateKey].visible) {
                // Skip rendering the dataset
                return false;
            }
        },
        afterDraw: function(chart) {
            const placeholderId = `custom-observation-placeholder-${chartInstanceId}`;
            const placeholder = document.getElementById(placeholderId);

            if (!placeholder) {
                console.warn(`Observation placeholder not found: ${placeholderId}`);
                return;
            }

            const chartContainer = placeholder.closest('.chart-container');

            // Clear the placeholder content
            placeholder.innerHTML = '';

            // Add toggle button if it doesn't exist
            let toggleBtn = chartContainer.querySelector('.observation-toggle-btn');
            if (!toggleBtn) {
                toggleBtn = document.createElement('button');
                toggleBtn.className = 'observation-toggle-btn';
                setButtonState(toggleBtn, window[stateKey].visible);
                toggleBtn.onclick = function () {
                    if (chart && dataset_index >= 0 && dataset_index < chart.data.datasets.length) {
                        try {
                            // Toggle visibility state
                            window[stateKey].visible = !window[stateKey].visible;

                            // Update dataset visibility using Chart.js API
                            // chart.setDatasetVisibility(dataset_index, false);
                            const meta = chart.getDatasetMeta(dataset_index);
                            meta.hidden = window[stateKey].visible;

                            // Update button icon based on state
                            setButtonState(this, window[stateKey].visible);

                            // Ensure the chart is updated when ready
                            if (chart.ctx) chart.update();
                        } catch (error) {
                            console.error('Error toggling dataset visibility:', error);
                        }
                    }
                };
                chartContainer.appendChild(toggleBtn);
            }

            // Update display based on current state
            placeholder.style.display = window[stateKey].visible ? 'flex' : 'none';

            // Add CSS styles
            if (!document.getElementById('custom-observation-styles')) {
                const style = document.createElement('style');
                style.id = 'custom-observation-styles';
                style.textContent = `
                    .observation-toggle-btn {
                        position: absolute;
                        top: 5px;
                        right: 32px;
                        z-index: 11;
                        border: none;
                        background: rgba(200, 200, 200, 0.95);
                        border-radius: 4px;
                        width: 24px;
                        height: 24px;
                        padding: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                    .observation-toggle-btn:hover {
                        background: rgba(180, 180, 180, 0.95);
                    }
                `;
                document.head.appendChild(style);
            }
        },
        afterEvent: function(chart, event) {
            const elements = chart.getActiveElements();

            if (elements.length > 0) {
                const element = elements[0];
                if (element.datasetIndex === dataset_index) {
                    this.drawAnnotation(chart, element);
                }
            }
        },
        drawAnnotation(chart, element) {
            const ctx = chart.ctx;
            ctx.save();

            const dataset = chart.data.datasets[dataset_index];
            const point = dataset.data[element.index];

            if (!point || point.y === null) return;

            const x = chart.scales.x.getPixelForValue(point.x);
            const y = chart.scales.y.getPixelForValue(point.y);

            const text = `${point.x.toISOString().split('T')[0]} : ${point.y.toFixed(1)}°C (${point.label})`;

            const textWidth = ctx.measureText(text).width;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(x - textWidth / 2 - 3, y - 30, textWidth + 6, 20);

            ctx.fillStyle = '#0074D9';
            ctx.textAlign = 'center';
            ctx.fillText(text, x, y - 15);

            ctx.restore();
        }
    }
}