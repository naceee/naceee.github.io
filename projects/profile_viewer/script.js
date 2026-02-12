document.getElementById('fileInput').addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(e.target.result, "application/xml");
    const points = xmlDoc.getElementsByTagName("trkpt");

    let lat = [];
    let lon = [];
    let ele = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      lat.push(parseFloat(p.getAttribute("lat")));
      lon.push(parseFloat(p.getAttribute("lon")));
      ele.push(parseFloat(p.getElementsByTagName("ele")[0].textContent));
    }

    // Calculate cumulative distance
    let dist = [0];
    for (let i = 1; i < lat.length; i++) {
      dist.push(dist[i - 1] + haversine(lat[i - 1], lon[i - 1], lat[i], lon[i]));
    }

    let climbs = getClimbsData(dist, ele, lat, lon);

    for (let i = 0; i < climbs.length; i++) {
        console.log(climbs[i])
    }

    // Build annotations for climbs
    let annotations = climbs.map(climb => {
        // Top point index
        let topIndex = climb.distance.length - 1;
        let topDist = climb.distance[topIndex];
        let topElev = climb.elevation[topIndex];

        if (climb.category === 'hupser' || climb.category === 'uncategorized') {
            text = `${climb.length}km<br>${climb.gradient}%`;
        } else {
            text = `${climb.name}<br>${climb.length}km<br>${climb.gradient}%`;
        }
        return {
            x: topDist,
            y: topElev,
            text: text,
            showarrow: true,
            arrowhead: 2,
            ax: 0,
            ay: -50,
            bgcolor: 'white',
            bordercolor: 'black',
            borderwidth: 1,
            font: { size: 10 }
        };
    });

    const min_ele = Math.min(...ele);
    const max_ele = Math.max(...ele);
    const delta_ele = max_ele - min_ele;

    const ylim_min = min_ele - Math.max(20, delta_ele * 0.05);
    const ylim_max = max_ele + Math.max(200, delta_ele * 0.2);

    console.log(`Elevation range: ${min_ele}m to ${max_ele}m, y-axis limits: ${ylim_min}m to ${ylim_max}m`);

    // Create traces for the main plot
    let traces = [{
        x: dist,
        y: Array(dist.length).fill(ylim_min),
        mode: 'lines',
        type: 'scatter',
        line: { color: 'green' },
        showlegend: false
    }];

    traces.push({
        x: dist,
        y: ele,
        mode: 'lines',
        type: 'scatter',
        line: { color: 'green' },
        fill: 'tonexty',
        fillcolor: 'rgba(0, 128, 0, 0.3)',
        name: 'Elevation',
        showlegend: false
    });

    // Add shaded regions for each climb (all same dark green color)
    climbs.forEach((climb, index) => {
        traces.push({
            x: climb.distance,
            y: Array(climb.distance.length).fill(ylim_min),
            mode: 'lines',
            type: 'scatter',
            line: { color: 'green' },
            showlegend: false
        });

        traces.push({
            x: climb.distance,
            y: climb.elevation,
            mode: 'lines',
            type: 'scatter',
            line: { color: 'transparent' },
            fill: 'tonexty',
            fillcolor: 'rgba(0, 100, 0, 0.3)',
            name: `Climb ${index + 1}: ${climb.length}km @ ${climb.gradient}%`,
            showlegend: false
        });
    });

    // Adjust annotation positions to prevent overlap
    adjustAnnotationPositions(annotations);

    Plotly.newPlot('plot', traces, {
        title: 'Elevation Profile',
        // remove x axis 
        xaxis: { title: 'Distance (km)' },
        yaxis: { title: 'Elevation (m)', zeroline: false, range: [ylim_min, ylim_max] },
        annotations: annotations,
        hovermode: 'closest'
    }, {
        displayModeBar: false,
        staticPlot: true
    });

    // Create detailed climb plots
    createClimbDetailPlots(climbs);
  };

  reader.readAsText(file);

});

// Haversine distance between two lat/lon points (in km)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = angle => angle * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


function adjustAnnotationPositions(annotations) {
    if (annotations.length === 0) return;
    
    // Calculate total route length from annotations
    const allX = annotations.map(ann => ann.x);
    const totalLength = Math.max(...allX) - Math.min(...allX);
    const overlapThreshold = totalLength * 0.1; // 10% of total length
    
    // Sort annotations by x position to process them left to right
    const sortedIndices = annotations
        .map((ann, idx) => ({ idx, x: ann.x }))
        .sort((a, b) => a.x - b.x);
    
    // Calculate vertical positions to avoid overlap
    const positions = [];

    const minVerticalSpacing = 15; // Minimum pixels between annotation boxes
    const baseOffset = -50; // Base arrow offset (negative = above)
    
    sortedIndices.forEach((item, i) => {
        const ann = annotations[item.idx];
        const currentX = ann.x;
        
        // Start with the base offset (above the climb)
        let targetOffset = baseOffset;
        
        // Check against previous annotations for overlap
        for (let j = 0; j < i; j++) {
            const prevItem = sortedIndices[j];
            const prevAnn = annotations[prevItem.idx];
            const prevX = prevAnn.x;
            
            // Calculate horizontal distance
            const horizontalDistance = Math.abs(currentX - prevX);
            
            // If annotations are close horizontally, adjust vertical position
            if (horizontalDistance < overlapThreshold) {
                const prevOffset = positions[j] || baseOffset;
                
                // Calculate how much overlap there might be based on distance
                const overlapFactor = Math.max(0, (overlapThreshold - horizontalDistance) / overlapThreshold);
                const verticalAdjustment = minVerticalSpacing * overlapFactor;
                
                // Move further up if too close
                if (horizontalDistance < overlapThreshold * 0.3) {
                    // Very close: stack them further up
                    targetOffset = prevOffset - minVerticalSpacing;
                } else {
                    // Moderately close: move up proportionally
                    targetOffset = Math.min(targetOffset, prevOffset - verticalAdjustment);
                }
            }
        }
        
        // Ensure we never go below the base offset (always keep arrows above)
        targetOffset = Math.min(targetOffset, baseOffset);
        
        // Apply the calculated offset
        ann.ay = targetOffset;
        positions.push(targetOffset);
    });
    
    // Second pass: ensure no two annotations have overlapping boxes
    for (let i = 1; i < sortedIndices.length; i++) {
        const currentItem = sortedIndices[i];
        const currentAnn = annotations[currentItem.idx];
        
        for (let j = 0; j < i; j++) {
            const prevItem = sortedIndices[j];
            const prevAnn = annotations[prevItem.idx];
            
            const xDist = Math.abs(currentAnn.x - prevAnn.x);
            
            // If very close horizontally, make sure they're well separated vertically
            if (xDist < overlapThreshold * 0.5) {
                const currentY = currentAnn.y + (currentAnn.ay || baseOffset) / 5;
                const prevY = prevAnn.y + (prevAnn.ay || baseOffset) / 5;
                
                // If too close vertically, push current one further up
                if (Math.abs(currentY - prevY) < 120) {
                    // Always move up (more negative)
                    currentAnn.ay = Math.min(currentAnn.ay, prevAnn.ay - minVerticalSpacing * 1.5);
                }
            }
        }
    }
}




function getClimbsData(distance, elevation, lat, lon) {
    let candidates = [];
    let d1 = 0;
    let d2 = 1;
    while (d2 < distance.length && distance[d2] - distance[d1] < 0.25) {
        d2++;
    }
    let d3 = d2 + 1;
    while (d3 < distance.length && distance[d3] - distance[d2] < 0.25) {
        d3++;
    }

    while (d2 < distance.length) {
        // elevation slice max
        let elevSlice = elevation.slice(d1, d3);
        let maxElev = Math.max(...elevSlice);

        if (elevation[d2] === maxElev) {
            if (candidates.length === 0 || candidates[candidates.length - 1] < d1) {
                candidates.push(d2);
            }
        }

        d2++;
        while (d2 < distance.length && distance[d2] - distance[d1] > 0.25) {
            d1++;
        }
        d3 = d2 + 1;
        while (d3 < distance.length && distance[d3] - distance[d2] < 0.25) {
            d3++;
        }
    }

    function classify(length, heightDiff, heightTop) {
        return (1 + Math.pow(heightTop / 2000, 2)) * Math.pow(heightDiff, 2) / length;
    }
    let cid = 0;
    let classifiedClimbs = [];
    for (let top of candidates) {
        let startClimb = 0;
        let bestHardnessScore = 0;
        let i = top - 1;

        while (
            elevation[top] - elevation[i] > 0 &&
            i >= 0 &&
            elevation[i] - Math.min(...elevation.slice(i, top)) < 100
        ) {
            if (elevation[top] - elevation[i] > 30) {
                let hardnessScore = classify(
                    distance[top] - distance[i],
                    elevation[top] - elevation[i],
                    elevation[top]
                );

                if (hardnessScore > bestHardnessScore) {
                    bestHardnessScore = hardnessScore;
                    startClimb = i;
                }
            }
            i--;
        }

        // Create Climb object with coordinates
        let c = new Climb(
            distance.slice(startClimb, top + 1),
            elevation.slice(startClimb, top + 1),
            distance[distance.length - 1],
            lat.slice(startClimb, top + 1),
            lon.slice(startClimb, top + 1),
            cid++
        );

        if (c.category !== 'uncategorized') {
            classifiedClimbs.push(c);
        }
    }

    // Remove overlapping climbs
    let hardness = classifiedClimbs.map(c => c.hardness);
    let climbs = [];

    while (classifiedClimbs.length > 0) {
        // Find hardest climb index
        let hardestClimb = hardness.indexOf(Math.max(...hardness));

        let newClimb = classifiedClimbs.splice(hardestClimb, 1)[0];
        hardness.splice(hardestClimb, 1);

        let notDuplicated = true;
        for (let climb of climbs) {
            if (newClimb.start <= climb.start) {
                if (newClimb.end > climb.start) {
                    notDuplicated = false;
                    break;
                }
            }
            if (climb.start <= newClimb.start && newClimb.start <= climb.end) {
                notDuplicated = false;
                break;
            }
        }

        if (notDuplicated) {
            climbs.push(newClimb);
        }
    }

    // Sort climbs by their position in the route and assign names
    climbs.sort((a, b) => a.start - b.start);
    let climb_idx = 1;
    climbs.forEach((climb, index) => {
        if (climb.category != 'uncategorized' && climb.category != 'hupser') {
            climb.name = `Climb ${climb_idx}`;
            climb_idx++;
        } 
    });


    return climbs;
}


class Climb {
    constructor(distanceData, elevationData, totalDistance, latData, lonData, cid) {
        this.start = distanceData[0];
        this.end = distanceData[distanceData.length - 1];
        this.toGo = +(totalDistance - this.end).toFixed(1);
        this.length = +(this.end - this.start).toFixed(1);
        this.climbDistance = distanceData.map(d => d - this.start);
        this.elevationStart = elevationData[0];
        this.elevationTop = elevationData[elevationData.length - 1];
        this.elevationGain = this.elevationTop - this.elevationStart;
        this.name = "Climb";
        this.cid = cid;

        if (this.length > 0) {
            this.gradient = +(this.elevationGain / (this.length * 10)).toFixed(2);
        } else {
            this.gradient = 0;
        }

        this.distance = distanceData;
        this.elevation = elevationData;
        this.lat = latData;
        this.lon = lonData;
        this.hardness = 0;
        this.category = '';

        this.classify();
    }

    toString() {
        return `at ${this.toGo}km to go: ${this.length}km @ ${this.gradient}% (CAT ${this.category}, ${this.hardness})`;
    }

    // This is equivalent to Python's __lt__ for sorting
    isLessThan(other) {
        return this.start < other.start;
    }

    classify() {
        if (this.elevationGain > 0) {
            this.hardness = (1 + (Math.pow(this.elevationTop / 2000, 4)) / 2) *
                            Math.pow(this.elevationGain, 2) / (this.length * 1000);

            if (this.length < 1) {
                this.hardness *= this.length;
            }
            if (this.gradient < 2) {
                this.hardness = 0;
            }
            if (this.gradient < 3) {
                this.hardness *= this.gradient * 0.25;
            }
        } else {
            this.hardness = 0;
        }

        this.hardness = +this.hardness.toFixed(1);

        if (this.hardness > 100) {
            this.category = 'HC';
        } else if (this.hardness > 60) {
            this.category = '1';
        } else if (this.hardness > 30) {
            this.category = '2';
        } else if (this.hardness > 15) {
            this.category = '3';
        } else if (this.hardness > 4) {
            this.category = '4';
        } else if (this.hardness > 1) {
            this.category = 'hupser';
        } else {
            this.category = 'uncategorized';
        }
    }
}


function createClimbDetailPlots(climbs) {
    const climbDetailsContainer = document.getElementById('climb-details');
    climbDetailsContainer.innerHTML = ''; // Clear previous content

    climbs = climbs.filter(climb => climb.category !== 'hupser' && climb.category !== 'uncategorized');

    if (climbs.length === 0) {
        climbDetailsContainer.innerHTML = '<p style="text-align: center; color: #666;">No significant climbs found in this route.</p>';
        return;
    }

    climbs.forEach((climb, index) => {
        // Calculate max 100m gradient
        const max100mGradient = calculateMax100mGradient(climb);
        
        // Create container for this climb
        const climbDiv = document.createElement('div');
        climbDiv.className = 'climb-detail';
        climbDiv.id = `climb-container-${index}`;
        
        // Create header with climb stats
        const header = document.createElement('div');
        header.className = 'climb-header';
        header.innerHTML = `
            <h3 id="climb-title-${climb.cid}">${climb.name}</h3>
            <div class="climb-stats">
                <span><strong>Length:</strong> ${climb.length} km</span>
                <span><strong>Elevation Gain:</strong> ${Math.round(climb.elevationGain)} m</span>
                <span><strong>Avg Gradient:</strong> ${climb.gradient}%</span>
                <span><strong>Max Gradient:</strong> ${max100mGradient.toFixed(1)}%</span>
                <span><strong>Distance to go:</strong> ${climb.toGo} km</span>
            </div>
        `;
        climbDiv.appendChild(header);

        // Create plot div
        const plotDiv = document.createElement('div');
        plotDiv.className = 'climb-plot';
        plotDiv.id = `climb-plot-${index}`;
        climbDiv.appendChild(plotDiv);

        climbDetailsContainer.appendChild(climbDiv);

        // Create color-coded segments based on adaptive gradient analysis
        const segments = calculateAdaptiveSegments(climb);
        const traces = createGradientColoredTracesWithLabels(climb, segments, plotDiv.id);

        // Find min and max elevation for y-axis range
        const minElev = Math.min(...climb.elevation);
        const maxElev = Math.max(...climb.elevation);
        const yRangePadding = Math.min(100, (maxElev - minElev) * 0.1); // Add 10% padding or at least 100m

        const layout = {
            title: '',
            xaxis: { 
                title: '',
                showgrid: false,
                showticklabels: false,
                zeroline: false
            },
            yaxis: { 
                title: '',
                showgrid: false,
                showticklabels: false,
                zeroline: false,
                range: [minElev - yRangePadding, maxElev + yRangePadding]
            },
            hovermode: 'closest',
            showlegend: false,
            margin: { t: 20, b: 20, l: 20, r: 20 },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white'
        };

        Plotly.newPlot(plotDiv.id, traces, layout, {
            responsive: true,
            displayModeBar: false,
            staticPlot: true
        });
        
        // Add segment labels as annotations after plot is created
        addSegmentLabels(plotDiv.id, segments, climb);
    });
    
    // Fetch names for all climbs asynchronously (won't block the UI)
    fetchClimbNames(climbs);
}


function calculateMax100mGradient(climb) {
    let maxGradient = 0;
    const targetDistance = 0.15; // 150m in km
    
    for (let i = 0; i < climb.climbDistance.length - 1; i++) {
        // Find the point approximately 100m ahead
        for (let j = i + 1; j < climb.climbDistance.length; j++) {
            const dist = climb.climbDistance[j] - climb.climbDistance[i];
            
            if (dist >= targetDistance * 0.8) {
                const elevDiff = climb.elevation[j] - climb.elevation[i];
                const gradient = (elevDiff / (dist * 10));
                maxGradient = Math.max(maxGradient, gradient);
                break;
            }
            
            if (dist > targetDistance * 1.1) break;
        }
    }
    
    return maxGradient;
}


async function fetchClimbNames(climbs) {
    // Process climbs one by one with a delay to respect OSM rate limits
    for (let i = 0; i < climbs.length; i++) {
        const climb = climbs[i];
        
        // Add delay between requests (1 second to respect OSM's Nominatim usage policy)
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1100));
        }
        
        try {
            const name = await getClimbName(climb);
            if (name) {
                // Update the climb object's name
                climb.name = name;
                
                // Update the climb title in the detail section
                const titleElement = document.getElementById(`climb-title-${climb.cid}`);
                if (titleElement) {
                    titleElement.textContent = `${name}`;
                }
                
                // Update the main plot annotation
                updateMainPlotAnnotation(i, climb);
            }
        } catch (error) {
            console.error(`Failed to fetch name for climb ${i + 1}:`, error);
        }
    }
}


function updateMainPlotAnnotation(climbIndex, climb) {
    // Get the current plot
    const plotDiv = document.getElementById('plot');
    if (!plotDiv || !plotDiv.layout || !plotDiv.layout.annotations) {
        return;
    }
    
    // Find the annotation for this climb
    // The annotations are in the same order as the climbs
    const annotations = plotDiv.layout.annotations;
    if (climbIndex < annotations.length) {
        // Update the annotation text with the new name
        let text;
        if (climb.category === 'hupser' || climb.category === 'uncategorized') {
            text = `${climb.length}km<br>${climb.gradient}%`;
        } else {
            text = `${climb.name}<br>${climb.length}km<br>${climb.gradient}%`;
        }
        
        annotations[climbIndex].text = text;
        
        // Adjust annotation positions to prevent overlap
        adjustAnnotationPositions(annotations);
        
        // Update the plot with the new annotations
        Plotly.relayout('plot', { annotations: annotations });
    }
}


async function getClimbName(climb) {
    const topIndex = climb.lat.length - 1;

    const lat = climb.lat[topIndex];
    const lon = climb.lon[topIndex];

    try {
        const url =
            `https://us1.locationiq.com/v1/reverse` +
            `?key=pk.618803e0fa6be84950d2493e50142eec` +
            `&lat=${lat}` +
            `&lon=${lon}` +
            `&format=json`;

        console.log(`Fetching name for climb at lat: ${lat}, lon: ${lon}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return extractClimbName(data);

    } catch (error) {
        console.error("Error fetching location name:", error);
        return null;
    }
}


function extractClimbName(osmData) {
    if (!osmData || !osmData.address) {
        return null;
    }

    const addr = osmData.address;

    const possibleNames = [
        'peak', 'mountain_pass', 'tower', 'hamlet', 'village', 
        'suburb', 'neighbourhood', 'town', 'road', 'city'];
    let names = possibleNames.map(key => addr[key]).filter(name => name);

    return names.length > 0 ? names[0] : (osmData.display_name ? osmData.display_name.split(",")[0].trim() : null);
}


function createGradientColoredTracesWithLabels(climb, segments, plotId) {
    const traces = [];
    
    // Function to get color from continuous colormap based on gradient
    // Using a perceptually uniform colormap: light blue -> cyan -> green -> yellow -> orange -> red -> dark red
    function getGradientColor(gradient) {
        // Clamp gradient between 0 and 20% for color mapping
        const clampedGradient = Math.max(0, Math.min(20, gradient));
        const ratio = clampedGradient / 20;
        
        let r, g, b;
        
        if (ratio < 0.2) { // 0-4%: Light blue to cyan
            const t = ratio / 0.2;
            r = Math.round(173 + (64 - 173) * t);
            g = Math.round(216 + (224 - 216) * t);
            b = Math.round(230 + (208 - 230) * t);
        } else if (ratio < 0.35) { // 4-7%: Cyan to green
            const t = (ratio - 0.2) / 0.15;
            r = Math.round(64 + (72 - 64) * t);
            g = Math.round(224 + (209 - 224) * t);
            b = Math.round(208 + (107 - 208) * t);
        } else if (ratio < 0.5) { // 7-10%: Green to yellow
            const t = (ratio - 0.35) / 0.15;
            r = Math.round(72 + (254 - 72) * t);
            g = Math.round(209 + (224 - 209) * t);
            b = Math.round(107 + (84 - 107) * t);
        } else if (ratio < 0.7) { // 10-14%: Yellow to orange
            const t = (ratio - 0.5) / 0.2;
            r = Math.round(254 + (252 - 254) * t);
            g = Math.round(224 + (141 - 224) * t);
            b = Math.round(84 + (58 - 84) * t);
        } else if (ratio < 0.85) { // 14-17%: Orange to red
            const t = (ratio - 0.7) / 0.15;
            r = Math.round(252 + (239 - 252) * t);
            g = Math.round(141 + (68 - 141) * t);
            b = Math.round(58 + (68 - 58) * t);
        } else { // 17-20%: Red to dark red
            const t = (ratio - 0.85) / 0.15;
            r = Math.round(239 + (165 - 239) * t);
            g = Math.round(68 + (0 - 68) * t);
            b = Math.round(68 + (38 - 68) * t);
        }
        
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    }

    // Create traces for each segment with borders
    segments.forEach((segment, idx) => {
        const color = getGradientColor(segment.gradient);
        
        // Main filled area for the segment
        traces.push({
            x: segment.distances,
            y: segment.elevations,
            mode: 'lines',
            type: 'scatter',
            line: { color: 'transparent', width: 0 },
            fill: 'tozeroy',
            fillcolor: color,
            name: `Segment ${idx + 1}`,
            showlegend: false,
            hovertemplate: `Distance: %{x:.2f} km<br>Elevation: %{y:.0f} m<br>Gradient: ${segment.gradient.toFixed(1)}%<extra></extra>`
        });
        
        // Top border (thick black line)
        traces.push({
            x: segment.distances,
            y: segment.elevations,
            mode: 'lines',
            type: 'scatter',
            line: { color: 'black', width: 3 },
            showlegend: false,
            hoverinfo: 'skip'
        });
        
        // Vertical separator at the end of segment (thin black line)
        if (idx < segments.length - 1) {
            const lastX = segment.distances[segment.distances.length - 1];
            const lastY = segment.elevations[segment.elevations.length - 1];
            traces.push({
                x: [lastX, lastX],
                y: [0, lastY],
                mode: 'lines',
                type: 'scatter',
                line: { color: 'black', width: 1.5 },
                showlegend: false,
                hoverinfo: 'skip'
            });
        }
    });

    return traces;
}


function addSegmentLabels(plotId, segments, climb) {
    // Wait a bit for the plot to render
    setTimeout(() => {
        const plotDiv = document.getElementById(plotId);
        if (!plotDiv || !plotDiv.layout) return;
        
        const annotations = [];
        const isMobile = window.innerWidth <= 768;
        
        // Adjust font sizes based on device
        const bottomLabelSize = isMobile ? 18 : 16;
        const elevationLabelSize = isMobile ? 18 : 16;
        const distanceLabelSize = isMobile ? 18 : 16;
        
        // Segment labels at the bottom
        segments.forEach((segment, idx) => {
            // Find middle point of segment
            const midIdx = Math.floor(segment.distances.length / 2);
            const x = segment.distances[midIdx];

            const segmentStart = segment.distances[0];
            const segmentMid = segmentStart + segment.length / 2;
            // Format the label
            const gradientText = segment.gradient.toFixed(1);
            const label = `${gradientText}%`;
            
            annotations.push({
                x: segmentMid,
                y: 0,
                yref: 'paper',
                xref: 'x',
                xanchor: 'center',
                text: label,
                showarrow: false,
                font: {
                    size: bottomLabelSize,
                    color: 'black',
                    family: 'Arial, sans-serif',
                    weight: 'bold'
                },
                //bgcolor: 'rgba(255, 255, 255, 0.7)',
                //borderpad: 3,
                // borderwidth: 0
            });
        });

        // Distance markers at each segment boundary (vertical black lines)
        // Start with 0.0 km
        annotations.push({
            x: climb.climbDistance[0],
            y: 0,
            yref: 'paper',
            xref: 'x',
            xanchor: 'center',
            yanchor: 'top',
            text: '0.0',
            showarrow: false,
            font: {
                size: distanceLabelSize,
                color: '#555',
                family: 'Arial, sans-serif'
            }
        });

        // Add distance labels at each segment boundary
        segments.forEach((segment, idx) => {
            if (idx < segments.length - 1) {
                // Distance from start of climb
                const distanceFromStart = segment.distances[segment.distances.length - 1] - climb.climbDistance[0];
                const nextSeg = segments[idx + 1];
                const distanceToNext = nextSeg.distances[nextSeg.distances.length - 1] - segment.distances[segment.distances.length - 1];
                console.log(`Segment ${idx + 1} ends at ${distanceFromStart.toFixed(1)} km, next segment starts in ${distanceToNext.toFixed(2)} km`);
                if (distanceToNext > 0.2) { // Only add label if next segment is at least 200m away
                    annotations.push({
                        x: segment.distances[segment.distances.length - 1],
                        y: 0,
                        yref: 'paper',
                        xref: 'x',
                        xanchor: 'center',
                        yanchor: 'top',
                        text: distanceFromStart.toFixed(1),
                        showarrow: false,
                        font: {
                            size: distanceLabelSize,
                            color: '#555',
                            family: 'Arial, sans-serif'
                        }
                    });
                }
            }
        });

        // End with total length
        const totalLength = climb.climbDistance[climb.climbDistance.length - 1] - climb.climbDistance[0];
        annotations.push({
            x: climb.climbDistance[climb.climbDistance.length - 1],
            y: 0,
            yref: 'paper',
            xref: 'x',
            xanchor: 'center',
            yanchor: 'top',
            text: totalLength.toFixed(1),
            showarrow: false,
            font: {
                size: distanceLabelSize,
                color: '#555',
                family: 'Arial, sans-serif'
            }
        });

        const xMargin = (climb.climbDistance[climb.climbDistance.length - 1] - climb.climbDistance[0]) * 0.005;

        // Start elevation annotation
        const startElev = Math.round(climb.elevation[0]);
        annotations.push({
            x: -xMargin,
            y: climb.elevation[0],
            xanchor: 'right',
            xref: 'x',
            yref: 'y',
            text: `${startElev}m`,
            showarrow: false,
            arrowcolor: 'black',
            font: {
                size: elevationLabelSize,
                color: 'black',
                family: 'Arial, sans-serif',
                weight: 'bold'
            }
        });
        
        // End elevation annotation
        const endElev = Math.round(climb.elevation[climb.elevation.length - 1]);
        annotations.push({
            x: climb.climbDistance[climb.climbDistance.length - 1] + xMargin,
            y: climb.elevation[climb.elevation.length - 1],
            xanchor: 'left',
            xref: 'x',
            yref: 'y',
            text: `${endElev}m`,
            showarrow: false,
            arrowcolor: 'black',
            font: {
                size: elevationLabelSize,
                color: 'black',
                family: 'Arial, sans-serif',
                weight: 'bold'
            }
        });
        
        Plotly.relayout(plotId, { annotations: annotations });
    }, 100);
}


function max(a, b) {
    return a > b ? a : b
} 

function calculateAdaptiveSegments(climb) {
    const segments = [];
    
    // Detect if mobile device
    const isMobile = window.innerWidth <= 768;

    
    // Adjust parameters based on device
    const minSegmentLength = isMobile ? max(climb.length / 20, 0.1) * 2 : max(climb.length / 25, 0.1); // 250m on mobile, 100m on desktop
    const gradientTolerance = isMobile ? 3 : 2; // More tolerance on mobile
    
    let i = 0;
    
    while (i < climb.climbDistance.length - 1) {
        let segmentStart = i;
        let segmentEnd = i + 1;
        
        // Find a reasonable initial window
        while (segmentEnd < climb.climbDistance.length && 
               (climb.climbDistance[segmentEnd] - climb.climbDistance[segmentStart] < minSegmentLength ||
                segmentEnd - segmentStart < 10)) {
            segmentEnd++;
        }
        
        if (segmentEnd >= climb.climbDistance.length) {
            segmentEnd = climb.climbDistance.length - 1;
        }
        
        // Calculate initial gradient for this segment
        let segmentDist = climb.climbDistance[segmentEnd] - climb.climbDistance[segmentStart];
        let segmentElev = climb.elevation[segmentEnd] - climb.elevation[segmentStart];
        let currentGradient = segmentDist > 0 ? (segmentElev / (segmentDist * 10)) : 0;
        
        // Extend the segment while gradient remains similar
        let extendedEnd = segmentEnd;
        while (extendedEnd < climb.climbDistance.length - 1) {
            let testEnd = extendedEnd + 1;
            
            // Calculate gradient if we extend to testEnd
            let testDist = climb.climbDistance[testEnd] - climb.climbDistance[segmentStart];
            let testElev = climb.elevation[testEnd] - climb.elevation[segmentStart];
            let testGradient = testDist > 0 ? (testElev / (testDist * 10)) : 0;
            
            // Also check the gradient of just the extension part
            let extDist = climb.climbDistance[testEnd] - climb.climbDistance[extendedEnd];
            let extElev = climb.elevation[testEnd] - climb.elevation[extendedEnd];
            let extGradient = extDist > 0 ? (extElev / (extDist * 10)) : 0;
            
            // Check if gradients are similar (within tolerance)
            if (Math.abs(testGradient - currentGradient) <= gradientTolerance &&
                Math.abs(extGradient - currentGradient) <= gradientTolerance * 1.5) {
                extendedEnd = testEnd;
                currentGradient = testGradient; // Update to the new average
            } else {
                break;
            }
        }
        
        // Create the segment
        segments.push({
            distances: climb.climbDistance.slice(segmentStart, extendedEnd + 1),
            elevations: climb.elevation.slice(segmentStart, extendedEnd + 1),
            gradient: currentGradient,
            length: climb.climbDistance[extendedEnd] - climb.climbDistance[segmentStart]
        });
        
        // Move to next segment
        i = extendedEnd;
    }
    
    // Post-process: merge very short segments with similar gradients
    let merged = [];
    const mergeThreshold = isMobile ? minSegmentLength * 2.5 : minSegmentLength * 2;
    
    for (let j = 0; j < segments.length; j++) {
        if (merged.length === 0) {
            merged.push(segments[j]);
        } else {
            let lastSeg = merged[merged.length - 1];
            let currentSeg = segments[j];
            
            // If current segment is short and gradient is similar to previous, merge
            if (currentSeg.length < mergeThreshold && 
                Math.abs(currentSeg.gradient - lastSeg.gradient) <= gradientTolerance) {
                // Merge with previous segment
                lastSeg.distances = lastSeg.distances.concat(currentSeg.distances.slice(1));
                lastSeg.elevations = lastSeg.elevations.concat(currentSeg.elevations.slice(1));
                lastSeg.length = lastSeg.distances[lastSeg.distances.length - 1] - lastSeg.distances[0];
                
                // Recalculate gradient
                let totalDist = lastSeg.length;
                let totalElev = lastSeg.elevations[lastSeg.elevations.length - 1] - lastSeg.elevations[0];
                lastSeg.gradient = totalDist > 0 ? (totalElev / (totalDist * 10)) : 0;
            } else {
                merged.push(currentSeg);
            }
        }
    }
    
    return merged;
}


// Button
document.getElementById('fileInput').addEventListener('change', function() {
  const fileName = this.files.length ? this.files[0].name : 'No file selected.';
  document.getElementById('file-name').textContent = fileName;
});