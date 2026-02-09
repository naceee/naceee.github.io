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

    let climbs = getClimbsData(dist, ele);

    for (let i = 0; i < climbs.length; i++) {
        console.log(climbs[i])
    }

    // Build annotations for climbs
    let annotations = climbs.map(climb => {
        // Top point index
        let topIndex = climb.distance.length - 1;
        let topDist = climb.distance[topIndex];
        let topElev = climb.elevation[topIndex];

        return {
            x: topDist,
            y: topElev,
            text: `${climb.length}km<br>${climb.gradient}%`,
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

    // Create traces for the main plot
    let traces = [{
        x: dist,
        y: ele,
        mode: 'lines',
        type: 'scatter',
        line: { color: 'green' },
        fill: 'tozeroy',
        fillcolor: 'rgba(0, 128, 0, 0.3)',
        name: 'Elevation'
    }];

    // Add shaded regions for each climb (all same dark green color)
    climbs.forEach((climb, index) => {
        traces.push({
            x: climb.distance,
            y: climb.elevation,
            mode: 'lines',
            type: 'scatter',
            line: { color: 'transparent' },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 100, 0, 0.3)',
            name: `Climb ${index + 1}: ${climb.length}km @ ${climb.gradient}%`,
            showlegend: true
        });
    });

    Plotly.newPlot('plot', traces, {
        title: 'Elevation Profile',
        xaxis: { title: 'Distance (km)' },
        yaxis: { title: 'Elevation (m)', range: [0, Math.max(...ele) + 50] },
        annotations: annotations
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



function getClimbsData(distance, elevation) {
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

        // Create Climb object
        let c = new Climb(
            distance.slice(startClimb, top + 1),
            elevation.slice(startClimb, top + 1),
            distance[distance.length - 1]
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

    return climbs;
}


class Climb {
    constructor(distanceData, elevationData, totalDistance) {
        this.start = distanceData[0];
        this.end = distanceData[distanceData.length - 1];
        this.toGo = +(totalDistance - this.end).toFixed(1);
        this.length = +(this.end - this.start).toFixed(1);
        this.climbDistance = distanceData.map(d => d - this.start);
        this.elevationStart = elevationData[0];
        this.elevationTop = elevationData[elevationData.length - 1];
        this.elevationGain = this.elevationTop - this.elevationStart;

        if (this.length > 0) {
            this.gradient = +(this.elevationGain / (this.length * 10)).toFixed(2);
        } else {
            this.gradient = 0;
        }

        this.distance = distanceData;
        this.elevation = elevationData;
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
        } else if (this.hardness > 5) {
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

    if (climbs.length === 0) {
        climbDetailsContainer.innerHTML = '<p style="text-align: center; color: #666;">No significant climbs found in this route.</p>';
        return;
    }

    climbs.forEach((climb, index) => {
        // Create container for this climb
        const climbDiv = document.createElement('div');
        climbDiv.className = 'climb-detail';
        
        // Create header with climb stats
        const header = document.createElement('div');
        header.className = 'climb-header';
        header.innerHTML = `
            <h3>Climb ${index + 1} - Category ${climb.category}</h3>
            <div class="climb-stats">
                <span><strong>Length:</strong> ${climb.length} km</span>
                <span><strong>Elevation Gain:</strong> ${Math.round(climb.elevationGain)} m</span>
                <span><strong>Avg Gradient:</strong> ${climb.gradient}%</span>
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

        // Calculate kilometer-by-kilometer stats
        const kmData = calculateKmByKmStats(climb);

        // Create color-coded segments based on gradient
        const traces = createGradientColoredTraces(climb, kmData);

        // Find min and max elevation for y-axis range
        const minElev = Math.min(...climb.elevation);
        const maxElev = Math.max(...climb.elevation);

        const layout = {
            title: `Kilometer-by-Kilometer Analysis`,
            xaxis: { 
                title: 'Distance from start of climb (km)',
                gridcolor: '#e0e0e0'
            },
            yaxis: { 
                title: 'Elevation (m)',
                gridcolor: '#e0e0e0',
                range: [minElev - 100, maxElev + 100]
            },
            hovermode: 'x unified',
            showlegend: true,
            legend: { x: 0.01, y: 0.99 },
            margin: { t: 50, b: 50, l: 60, r: 60 }
        };

        Plotly.newPlot(plotDiv.id, traces, layout, {responsive: true});
    });
}


function createGradientColoredTraces(climb, kmData) {
    const traces = [];
    
    // Function to determine color based on gradient
    function getGradientColor(gradient) {
        if (gradient >= 15) return { color: 'rgba(0, 0, 0, 0.6)', name: 'Insane (≥15%)' }; // Black
        if (gradient >= 10) return { color: 'rgba(255, 0, 0, 0.6)', name: 'Very Hard (10-15%)' }; // Red
        if (gradient >= 7) return { color: 'rgba(255, 255, 0, 0.6)', name: 'Hard (7-10%)' }; // Yellow
        if (gradient >= 4) return { color: 'rgba(0, 200, 0, 0.6)', name: 'Moderate (4-7%)' }; // Green
        return { color: 'rgba(0, 150, 255, 0.6)', name: 'Easy (<4%)' }; // Blue
    }

    // Create segments for each kilometer
    for (let i = 0; i < kmData.positions.length; i++) {
        const km = Math.round(kmData.positions[i] - 0.5);
        
        // Find the index range for this kilometer segment
        let startIdx = 0;
        let endIdx = climb.climbDistance.length - 1;
        
        for (let j = 0; j < climb.climbDistance.length; j++) {
            if (Math.abs(climb.climbDistance[j] - km) < Math.abs(climb.climbDistance[startIdx] - km)) {
                startIdx = j;
            }
        }
        
        for (let j = 0; j < climb.climbDistance.length; j++) {
            if (Math.abs(climb.climbDistance[j] - (km + 1)) < Math.abs(climb.climbDistance[endIdx] - (km + 1))) {
                endIdx = j;
            }
        }

        if (endIdx > startIdx) {
            const gradient = kmData.gradients[i];
            const colorInfo = getGradientColor(gradient);
            
            traces.push({
                x: climb.climbDistance.slice(startIdx, endIdx + 1),
                y: climb.elevation.slice(startIdx, endIdx + 1),
                mode: 'lines',
                type: 'scatter',
                line: { color: 'transparent', width: 0 },
                fill: 'tozeroy',
                fillcolor: colorInfo.color,
                name: `${colorInfo.name}`,
                showlegend: i === 0 || 
                    (i > 0 && getGradientColor(kmData.gradients[i-1]).name !== colorInfo.name),
                legendgroup: colorInfo.name,
                hovertemplate: `Distance: %{x:.2f} km<br>Elevation: %{y:.0f} m<br>Gradient: ${gradient}%<extra></extra>`
            });
        }
    }

    return traces;
}


function calculateKmByKmStats(climb) {
    const positions = [];
    const gradients = [];
    const elevations = [];

    // For each kilometer mark
    for (let km = 1; km <= Math.ceil(climb.length); km++) {
        const targetDist = km;
        
        // Find the index range for this kilometer
        let startIdx = 0;
        let endIdx = climb.climbDistance.length - 1;
        
        // Find closest point to (km-1)
        for (let i = 0; i < climb.climbDistance.length; i++) {
            if (Math.abs(climb.climbDistance[i] - (km - 1)) < Math.abs(climb.climbDistance[startIdx] - (km - 1))) {
                startIdx = i;
            }
        }
        
        // Find closest point to km
        for (let i = 0; i < climb.climbDistance.length; i++) {
            if (Math.abs(climb.climbDistance[i] - km) < Math.abs(climb.climbDistance[endIdx] - km)) {
                endIdx = i;
            }
        }

        if (endIdx > startIdx) {
            const distDiff = climb.climbDistance[endIdx] - climb.climbDistance[startIdx];
            const elevDiff = climb.elevation[endIdx] - climb.elevation[startIdx];
            const gradient = distDiff > 0 ? (elevDiff / (distDiff * 10)) : 0;
            
            positions.push(km - 0.5); // Middle of the km
            gradients.push(parseFloat(gradient.toFixed(2)));
            elevations.push(Math.round(climb.elevation[endIdx]));
        }
    }

    return { positions, gradients, elevations };
}


// Button
document.getElementById('fileInput').addEventListener('change', function() {
  const fileName = this.files.length ? this.files[0].name : 'No file selected.';
  document.getElementById('file-name').textContent = fileName;
});

