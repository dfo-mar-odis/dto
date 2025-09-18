export const LegendSectionPlugin = (sectionConfig, chartInstanceId) => {
    // Use closure to maintain state between renders
    // Store as a property on the window using the chartInstanceId to avoid conflicts
    const stateKey = `legendState_${chartInstanceId}`;

    // Initialize only if not already set
    if (window[stateKey] === undefined) {
        window[stateKey] = { visible: true };
    }

    return {
        id: 'legendSections',
        beforeInit(chart) {
            chart.options.plugins.legend.display = false;
        },
        afterRender(chart) {
            const placeholderId = `custom-legend-placeholder-${chartInstanceId}`;
            const placeholder = document.getElementById(placeholderId);

            if (!placeholder) {
                console.warn(`Legend placeholder not found: ${placeholderId}`);
                return;
            }

            const chartContainer = placeholder.closest('.chart-container');

            // Clear the placeholder content
            placeholder.innerHTML = '';

            // Add toggle button if it doesn't exist
            let toggleBtn = chartContainer.querySelector('.legend-toggle-btn');
            if (!toggleBtn) {
                toggleBtn = document.createElement('button');
                toggleBtn.className = 'legend-toggle-btn';
                toggleBtn.innerHTML = window[stateKey].visible ? '<i class="bi bi-x"></i>' : '<i class="bi bi-list"></i>';
                toggleBtn.title = 'Toggle Legend';
                toggleBtn.onclick = function () {
                    window[stateKey].visible = !window[stateKey].visible;
                    placeholder.style.display = window[stateKey].visible ? 'flex' : 'none';
                    toggleBtn.innerHTML = window[stateKey].visible ?
                        '<i class="bi bi-x"></i>' :
                        '<i class="bi bi-list"></i>';
                };
                chartContainer.appendChild(toggleBtn);
            }

            // Use persistent state instead of local variable
            placeholder.style.display = window[stateKey].visible ? 'flex' : 'none';
            if (toggleBtn) {
                toggleBtn.innerHTML = window[stateKey].visible ?
                    '<i class="bi bi-x"></i>' :
                    '<i class="bi bi-list"></i>';
            }

            // Group datasets by section
            const sectioned = {};
            chart.data.datasets.forEach((dataset, idx) => {
                for (const section of sectionConfig) {
                    if (section.matchFunction(dataset)) {
                        if (!sectioned[section.id])
                            sectioned[section.id] = [];
                        sectioned[section.id].push({dataset, index: idx});
                    }
                }
            });

            // Create sections within the placeholder
            for (const section of sectionConfig) {
                if (sectioned[section.id]?.length) {
                    const sectionDiv = document.createElement('div');
                    sectionDiv.className = 'legend-section';
                    sectionDiv.id = section.id;

                    sectioned[section.id].forEach(({dataset, index}) => {
                        const item = document.createElement('div');
                        item.className = 'legend-item';

                        const colorBox = document.createElement('span');
                        colorBox.className = 'legend-color';

                        // Improved color selection logic for filled areas
                        let color = dataset.borderColor;

                        if (!dataset.fill) {
                            color = dataset.borderColor;
                        } else if (dataset.fill.above != null && dataset.fill.above !== 'rgba(0, 0, 0, 0)') {
                            color = dataset.fill.above;
                        } else if (dataset.fill.below != null && dataset.fill.below !== 'rgba(0, 0, 0, 0)') {
                            color = dataset.fill.below;
                        } else {
                            // If borderColor is transparent, use backgroundColor or fill color
                            color = dataset.backgroundColor || 'rgba(128, 128, 128, 0.5)';
                        }

                        colorBox.style.backgroundColor = color;

                        const text = document.createElement('span');
                        text.innerText = dataset.label;

                        item.appendChild(colorBox);
                        item.appendChild(text);

                        item.onclick = function () {
                            const meta = chart.getDatasetMeta(index);
                            meta.hidden = !meta.hidden;
                            chart.update();

                            if (meta.hidden) {
                                item.classList.add('legend-item-hidden');
                            } else {
                                item.classList.remove('legend-item-hidden');
                            }
                        };

                        sectionDiv.appendChild(item);
                    });

                    placeholder.appendChild(sectionDiv);
                }
            }

            // Add CSS styles
            if (!document.getElementById('custom-legend-styles')) {
                const style = document.createElement('style');
                style.id = 'custom-legend-styles';
                style.textContent = `
                    .chart-container {
                        position: relative;
                        min-height: 425px;
                    }
                    .chart-legend-container {
                        display: flex;
                        flex-direction: column;
                        position: absolute;
                        top: 30px;
                        right: 10px;
                        max-width: 200px;
                        z-index: 10;
                        background-color: rgba(255, 255, 255, 0.8);
                        border-radius: 4px;
                        padding: 5px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }
                    .legend-section {
                        display: flex;
                        flex-direction: column;
                        margin-bottom: 5px;
                    }
                    .legend-item {
                        display: flex;
                        align-items: flex-start;
                        cursor: pointer;
                        padding: 2px 4px;
                        margin-bottom: 2px;
                        font-size: 0.85em;
                        border-radius: 3px;
                    }
                    .legend-color {
                        display: inline-block;
                        width: 12px;
                        height: 12px;
                        margin-right: 5px;
                        margin-top: 3px;
                        flex-shrink: 0;
                        border: 1px solid rgba(0, 0, 0, 0.2);
                    }
                    .legend-item-hidden {
                        opacity: 0.5;
                        text-decoration: line-through;
                    }
                    .legend-toggle-btn {
                        position: absolute;
                        top: 5px;
                        right: 5px;
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
                    .legend-toggle-btn:hover {
                        background: rgba(180, 180, 180, 0.95);
                    }
                    .legend-toggle-btn:hover {
                        background: rgba(240, 240, 240, 0.9);
                    }
                `;
                document.head.appendChild(style);
            }
        }
    };
};