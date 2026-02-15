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
    const isMobile = window.innerWidth <= 768;

    // Build annotations for climbs
    let annotations = climbs.map(climb => {
        // Top point index
        let topIndex = climb.distance.length - 1;
        let topDist = climb.distance[topIndex];
        let topElev = climb.elevation[topIndex];

        let text;
        if (!(isMobile)) {
            if (climb.category === 'hupser' || climb.category === 'uncategorized') {
                text = `${climb.length}km<br>${climb.gradient}%`;
            } else {
                text = `${climb.name}<br>${climb.length}km<br>${climb.gradient}%`;
            }
        } else {
            text = `${climb.length}km<br>${climb.gradient}%`;
        }

        if (text === undefined) {
            // Skip annotation for this climb if no text is set (e.g., on mobile for hupser/uncategorized)
            return null;
        }

        // Wrap text to prevent long lines
        text = wrapAnnotationText(text, 20);
        
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

    // Show the plot section
    document.getElementById('plot-section').style.display = 'block';

    // Adjust margins based on screen size
    const plotMargins = isMobile 
        ? { t: 20, r: 25, b: 70, l: 50 }  // More bottom space for x-axis label
        : { t: 40, r: 80, b: 90, l: 60 }; // Comfortable margins for desktop

    Plotly.newPlot('plot', traces, {
        title: '',  // Remove title as we have a section title now
        xaxis: { title: 'Distance (km)' },
        yaxis: { title: 'Elevation (m)', zeroline: false, range: [ylim_min, ylim_max] },
        annotations: annotations,
        hovermode: 'closest',
        margin: plotMargins
    }, {
        displayModeBar: false,
        staticPlot: true
    }).then(() => {
        // Adjust annotation positions after plot is rendered
        adjustAnnotationPositions(annotations);
    });

    // Create detailed climb plots
    createClimbDetailPlots(climbs);
    
    // Store climbs data globally for download function
    window.currentClimbsData = climbs.filter(climb => climb.category !== 'hupser' && climb.category !== 'uncategorized');
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


function wrapAnnotationText(text, maxCharsPerLine = 20) {
    // Split by existing line breaks first
    const lines = text.split('<br>');
    const wrappedLines = [];
    
    lines.forEach(line => {
        if (line.length <= maxCharsPerLine) {
            wrappedLines.push(line);
        } else {
            // Wrap this line
            const words = line.split(' ');
            let currentLine = '';
            
            words.forEach((word, index) => {
                // Check if adding this word would exceed the limit
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                
                if (testLine.length <= maxCharsPerLine) {
                    currentLine = testLine;
                } else {
                    // Current line is full, push it and start new line
                    if (currentLine) {
                        wrappedLines.push(currentLine);
                        currentLine = word;
                    } else {
                        // Single word is longer than max, split it
                        wrappedLines.push(word);
                        currentLine = '';
                    }
                }
            });
            
            // Push remaining text
            if (currentLine) {
                wrappedLines.push(currentLine);
            }
        }
    });
    
    return wrappedLines.join('<br>');
}


async function adjustAnnotationPositions(annotations) {
    if (annotations.length === 0) return;
    
    const baseOffset = -50; // Base arrow offset (negative = above)
    const padding = 10; // Extra padding between boxes
    
    // First, set all annotations to base position
    annotations.forEach(ann => {
        ann.ay = baseOffset;
    });
    
    // Get the plot div
    const plotDiv = document.getElementById('plot');
    if (!plotDiv) return;
    
    // Helper function to get actual bounding box from DOM
    function getActualBBox(annotationIndex) {
        // Plotly creates annotation elements with specific structure
        // The text box is in .annotation-text-g or similar
        const annotationElements = plotDiv.querySelectorAll('.annotation-text');
        
        if (annotationIndex < annotationElements.length) {
            const element = annotationElements[annotationIndex];
            const rect = element.getBoundingClientRect();
            const plotRect = plotDiv.getBoundingClientRect();
            
            // Convert to plot-relative coordinates
            return {
                left: rect.left - plotRect.left,
                right: rect.right - plotRect.left,
                top: rect.top - plotRect.top,
                bottom: rect.bottom - plotRect.top,
                width: rect.width,
                height: rect.height
            };
        }
        
        // Fallback: try to find by other selectors
        const allAnnotations = plotDiv.querySelectorAll('g.annotation');
        if (annotationIndex < allAnnotations.length) {
            const annotationGroup = allAnnotations[annotationIndex];
            // Look for the text element specifically (not the line/arrow)
            const textElement = annotationGroup.querySelector('text');
            
            if (textElement) {
                const rect = textElement.getBoundingClientRect();
                const plotRect = plotDiv.getBoundingClientRect();
                
                // Get the background rectangle if it exists
                const bgRect = annotationGroup.querySelector('rect');
                if (bgRect) {
                    const bgBox = bgRect.getBoundingClientRect();
                    return {
                        left: bgBox.left - plotRect.left,
                        right: bgBox.right - plotRect.left,
                        top: bgBox.top - plotRect.top,
                        bottom: bgBox.bottom - plotRect.top,
                        width: bgBox.width,
                        height: bgBox.height
                    };
                }
                
                // Fallback to text element bounds
                return {
                    left: rect.left - plotRect.left,
                    right: rect.right - plotRect.left,
                    top: rect.top - plotRect.top,
                    bottom: rect.bottom - plotRect.top,
                    width: rect.width,
                    height: rect.height
                };
            }
        }
        
        return null;
    }
    
    // Helper function to check if two bounding boxes overlap
    function boxesOverlap(box1, box2) {
        if (!box1 || !box2) return false;
        return !(box1.right + padding < box2.left || 
                 box1.left - padding > box2.right || 
                 box1.bottom + padding < box2.top || 
                 box1.top - padding > box2.bottom);
    }
    
    // Sort annotations by x position (left to right)
    const sortedIndices = annotations
        .map((ann, idx) => ({ idx, x: ann.x }))
        .sort((a, b) => a.x - b.x);
    
    // Process from left to right, adjusting each annotation if it overlaps with the previous one
    // We need to do this iteratively because moving one annotation might require re-checking
    let maxIterations = 5;
    let iteration = 0;
    let madeChanges = true;
    
    while (madeChanges && iteration < maxIterations) {
        madeChanges = false;
        iteration++;
        console.log(`Annotation adjustment iteration ${iteration}`);

        // Update the plot to get new bounding boxes after any changes
        if (iteration > 1) {
            await Plotly.relayout('plot', { annotations: annotations });
            // Small delay to let DOM fully update
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        for (let i = 1; i < sortedIndices.length; i++) {
            const prevIdx = sortedIndices[i - 1].idx;
            const currIdx = sortedIndices[i].idx;
            const prevAnn = annotations[prevIdx];
            const currAnn = annotations[currIdx];
            
            // Get actual bounding boxes from DOM
            const prevBox = getActualBBox(prevIdx);
            const currBox = getActualBBox(currIdx);
            
            // If they overlap, move current annotation up
            if (boxesOverlap(prevBox, currBox)) {
                madeChanges = true;
                
                // Calculate how much to move up to clear the overlap
                const overlapAmount = currBox.bottom - prevBox.top + padding;
                
                // Move current annotation up
                currAnn.ay = (currAnn.ay || baseOffset) - overlapAmount;
                
                // Ensure we don't go too far (reasonable limit)
                currAnn.ay = Math.max(currAnn.ay, -400);
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

    // Sort climbs by their position in the route and assign IDs and names
    climbs.sort((a, b) => a.start - b.start);
    
    // Assign unique IDs to all climbs (including hupsers)
    climbs.forEach((climb, index) => {
        climb.id = index;
    });
    
    // Assign display names only to non-hupser climbs
    let climb_idx = 1;
    climbs.forEach((climb) => {
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

    // Filter out hupsers and uncategorized climbs for display
    const displayedClimbs = climbs.filter(climb => climb.category !== 'hupser' && climb.category !== 'uncategorized');

    if (displayedClimbs.length === 0) {
        climbDetailsContainer.innerHTML = '<p style="text-align: center; color: #666;">No significant climbs found in this route.</p>';
        return;
    }

    displayedClimbs.forEach((climb, displayIndex) => {
        // Calculate max 100m gradient
        const max100mGradient = calculateMax100mGradient(climb);
        climb.maxGradient = max100mGradient; // Store for download
        
        // Calculate estimated times for different power outputs
        const timeEstimates = calculateClimbingTime(climb);
        
        // Create container for this climb
        const climbDiv = document.createElement('div');
        climbDiv.className = 'climb-detail';
        climbDiv.id = `climb-container-${displayIndex}`;
        
        // Create header with climb stats - use the climb's original ID for title lookup
        const header = document.createElement('div');
        header.className = 'climb-header';
        header.innerHTML = `
            <h3 id="climb-title-${climb.id}">${climb.name}</h3>
            <div class="climb-stats">
                <span><strong>Length:</strong> ${climb.length} km</span>
                <span><strong>Elevation+:</strong> ${Math.round(climb.elevationGain)} m</span>
                <span><strong>Gradient:</strong> ${climb.gradient.toFixed(1)}% (<strong>max:</strong> ${max100mGradient.toFixed(1)}%)</span>
                <span><strong>To go:</strong> ${climb.toGo} km</span>
            </div>
            <div class="climb-time-estimates">
                <span class="time-label">Estimated time:</span>
                <span class="time-estimate time-2w">2 W/kg: ${timeEstimates.time2w}</span>
                <span class="time-estimate time-3w">3 W/kg: ${timeEstimates.time3w}</span>
                <span class="time-estimate time-4w">4 W/kg: ${timeEstimates.time4w}</span>
            </div>
        `;
        climbDiv.appendChild(header);

        // Create plot div
        const plotDiv = document.createElement('div');
        plotDiv.className = 'climb-plot';
        plotDiv.id = `climb-plot-${displayIndex}`;
        climbDiv.appendChild(plotDiv);

        climbDetailsContainer.appendChild(climbDiv);

        // Create color-coded segments based on adaptive gradient analysis
        const segments = calculateAdaptiveSegments(climb);
        const traces = createGradientColoredTracesWithLabels(climb, segments, plotDiv.id);

        // Find min and max elevation for y-axis range
        const minElev = Math.min(...climb.elevation);
        const maxElev = Math.max(...climb.elevation);
        const yRangePadding = Math.min(100, (maxElev - minElev) * 0.1); // Add 10% padding or at least 100m

        // Adjust margins based on screen size
        const isMobile = window.innerWidth <= 768;
        const climbPlotMargins = isMobile 
            ? { t: 0, b: 30, l: 0, r: 0 }  // More bottom space for labels on mobile
            : { t: 20, b: 20, l: 0, r: 0 }; // Standard margins for desktop

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
            margin: climbPlotMargins,
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
    
    // Fetch names for displayed climbs only (won't block the UI)
    fetchClimbNames(displayedClimbs, climbs);
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


function calculateClimbingTime(climb) {
    // Constants
    const riderMass = 75; // kg
    const bikeMass = 8; // kg  
    const totalMass = riderMass + bikeMass;
    const g = 9.81; // gravity m/s^2
    const Crr = 0.004; // rolling resistance coefficient
    const CdA = 0.35; // drag coefficient * frontal area (m^2)
    const rho = 1.225; // air density kg/m^3
    const drivetrain = 0.97; // drivetrain efficiency
    
    // Climb parameters
    const distance = climb.length * 1000; // convert km to meters
    const gradient = climb.gradient / 100; // convert percentage to decimal
    
    // Calculate for each power level
    const powerLevels = [2, 3, 4]; // W/kg
    const times = {};
    
    powerLevels.forEach(wkg => {
        const power = wkg * riderMass; // total watts
        const effectivePower = power * drivetrain; // after drivetrain losses
        
        // For climbing, we'll use a simplified model
        // Assume relatively low speed where air resistance is minimal
        // Main forces: gravity and rolling resistance
        
        // Use iterative approach to find speed
        // Start with estimate based on power and gradient
        let speed = 5; // m/s initial guess (18 km/h)
        
        // Iterate to find equilibrium speed
        for (let iter = 0; iter < 10; iter++) {
            // Forces
            const gravityForce = totalMass * g * Math.sin(Math.atan(gradient));
            const rollingForce = totalMass * g * Math.cos(Math.atan(gradient)) * Crr;
            const dragForce = 0.5 * CdA * rho * speed * speed;
            
            const totalForce = gravityForce + rollingForce + dragForce;
            
            // Speed from power balance: Power = Force * Velocity
            speed = effectivePower / totalForce;
            
            // Limit speed to reasonable range
            speed = Math.max(1, Math.min(15, speed));
        }
        
        // Calculate time
        const timeSeconds = distance / speed;
        const timeMinutes = Math.round(timeSeconds / 60);
        
        // Format time as HH:MM or MM:SS
        let timeString;
        if (timeMinutes >= 60) {
            const hours = Math.floor(timeMinutes / 60);
            const mins = timeMinutes % 60;
            timeString = `${hours}h ${mins}m`;
        } else {
            timeString = `${timeMinutes}m`;
        }
        
        times[`time${wkg}w`] = timeString;
    });
    
    return times;
}


async function fetchClimbNames(displayedClimbs, allClimbs) {
    // Process displayed climbs one by one with a delay to respect OSM rate limits
    for (let i = 0; i < displayedClimbs.length; i++) {
        const climb = displayedClimbs[i];
        
        // Add delay between requests (1 second to respect OSM's Nominatim usage policy)
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1100));
        }
        
        try {
            const name = await getClimbName(climb);
            if (name) {
                // Update the climb object's name
                climb.name = name;
                
                // Update the climb title in the detail section using climb's ID
                const titleElement = document.getElementById(`climb-title-${climb.id}`);
                if (titleElement) {
                    titleElement.textContent = `${name}`;
                }
                
                // Update the annotation text (but don't adjust positions yet)
                const annotationIndex = allClimbs.findIndex(c => c.id === climb.id);
                if (annotationIndex !== -1) {
                    updateMainPlotAnnotationTextOnly(annotationIndex, climb);
                }
            }
        } catch (error) {
            console.error(`Failed to fetch name for climb ${i + 1}:`, error);
        }
    }
    
    // After all names are fetched, adjust annotation positions once
    const plotDiv = document.getElementById('plot');
    if (plotDiv && plotDiv.layout && plotDiv.layout.annotations) {
        await adjustAnnotationPositions(plotDiv.layout.annotations);
    }
}


function updateMainPlotAnnotationTextOnly(annotationIndex, climb) {
    // Get the current plot
    const plotDiv = document.getElementById('plot');
    if (!plotDiv || !plotDiv.layout || !plotDiv.layout.annotations) {
        return;
    }
    
    const annotations = plotDiv.layout.annotations;
    const isMobile = window.innerWidth <= 768;
    
    // The annotations array corresponds directly to allClimbs array
    // So we can use annotationIndex directly
    if (annotationIndex < annotations.length) {
        // Update the annotation text with the new name
        let text;
        if (isMobile) {
            // On mobile, we only show length and gradient to save space
            text = `${climb.length}km<br>${climb.gradient}%`;
        } else {
            text = `${climb.name}<br>${climb.length}km<br>${climb.gradient}%`;                
            // Wrap text to prevent long lines
            text = wrapAnnotationText(text, 20);
        }
        annotations[annotationIndex].text = text;
        
        // Update the plot with the new annotations (but don't adjust positions)
        Plotly.relayout('plot', { annotations: annotations });
    }
}


async function updateMainPlotAnnotation(annotationIndex, climb) {
    // Get the current plot
    const plotDiv = document.getElementById('plot');
    if (!plotDiv || !plotDiv.layout || !plotDiv.layout.annotations) {
        return;
    }
    
    const annotations = plotDiv.layout.annotations;
    
    // The annotations array corresponds directly to allClimbs array
    // So we can use annotationIndex directly
    if (annotationIndex < annotations.length) {
        // Update the annotation text with the new name
        let text = `${climb.name}<br>${climb.length}km<br>${climb.gradient}%`;
        
        // Wrap text to prevent long lines
        text = wrapAnnotationText(text, 20);
        
        annotations[annotationIndex].text = text;
        
        // Update the plot with the new annotations
        await Plotly.relayout('plot', { annotations: annotations });

        // Adjust annotation positions to prevent overlap (after DOM updates)
        await adjustAnnotationPositions(annotations);
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
        const bottomLabelSize = isMobile ? 14 : 16;
        const elevationLabelSize = isMobile ? 14 : 16;
        const distanceLabelSize = isMobile ? 14 : 16;
        
        // Segment labels at the bottom
        segments.forEach((segment, idx) => {
            // Find middle point of segment
            const midIdx = Math.floor(segment.distances.length / 2);
            const x = segment.distances[midIdx];

            const segmentStart = segment.distances[0];
            const segmentMid = segmentStart + segment.length / 2;
            // Format the label
            let gradientText;
            if (!isMobile) {
                gradientText = segment.gradient.toFixed(1);
            } else {
                gradientText = parseInt(segment.gradient.toFixed(0));
            }
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
    const minSegmentLength = isMobile ? max(climb.length / 40, 0.1) * 2 : max(climb.length / 40, 0.1); // 250m on mobile, 100m on desktop
    const gradientTolerance = isMobile ? 2.5 : 2; // More tolerance on mobile
    
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
  const fileNameElement = document.getElementById('file-name');
  if (this.files.length) {
    fileNameElement.textContent = `✓ ${this.files[0].name}`;
    fileNameElement.style.color = 'var(--color-primary)';
    fileNameElement.style.fontWeight = '600';
  } else {
    fileNameElement.textContent = 'No file selected';
    fileNameElement.style.color = '';
    fileNameElement.style.fontWeight = '';
  }
});


// Download plots functionality
document.getElementById('download-plots-btn').addEventListener('click', async function() {
  const button = this;
  const originalText = button.innerHTML;
  
  // Show loading state
  button.disabled = true;
  button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> Generating...';
  
  try {
    // Get stored climb data
    const climbs = window.currentClimbsData || [];
    
    // Get GPX filename
    const fileInput = document.getElementById('fileInput');
    const fileName = fileInput.files[0] ? fileInput.files[0].name.replace('.gpx', '') : 'Route';
    
    // Calculate total canvas height
    const headerHeight = 100;
    const mainPlotHeight = 800; // 100 title + 700 plot
    const climbPlotHeight = 800; // 80 header + 100 stats + 600 plot + 20 margin
    const totalHeight = headerHeight + mainPlotHeight + (climbs.length * climbPlotHeight) + 50;
    
    // Create main canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw main header
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(0, 0, canvas.width, headerHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.fillText(fileName, 40, 70);
    
    let yPosition = headerHeight + 20;
    
    // Draw main plot title
    ctx.fillStyle = '#212529';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillText('Route Elevation Profile', 40, yPosition + 35);
    
    yPosition += 80;
    
    // Get and draw main elevation profile
    const mainImgData = await Plotly.toImage('plot', {
      format: 'png',
      width: 1400,
      height: 700
    });
    
    const mainImg = new Image();
    await new Promise((resolve, reject) => {
      mainImg.onload = resolve;
      mainImg.onerror = reject;
      mainImg.src = mainImgData;
    });
    
    ctx.drawImage(mainImg, 0, yPosition, 1400, 700);
    yPosition += 720;
    
    // Draw each climb plot with stats
    for (let i = 0; i < climbs.length; i++) {
      const climb = climbs[i];
      const plotDiv = document.getElementById(`climb-plot-${i}`);
      
      if (plotDiv) {
        // White background for this climb section
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, yPosition, canvas.width, climbPlotHeight - 20);
        
        // Draw climb header bar
        ctx.fillStyle = '#2d6a4f';
        ctx.fillRect(0, yPosition, canvas.width, 80);
        
        // Draw climb name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial, sans-serif';
        ctx.fillText(climb.name || `Climb ${i + 1}`, 30, yPosition + 50);
        
        yPosition += 80;
        
        // Draw stats boxes
        const stats = [
          { label: 'Length', value: `${climb.length} km` },
          { label: 'Elevation Gain', value: `${Math.round(climb.elevationGain)} m` },
          { label: 'Avg Gradient', value: `${climb.gradient}%` },
          { label: 'Max Gradient', value: `${climb.maxGradient ? climb.maxGradient.toFixed(1) : 'N/A'}%` },
        ];
        
        let xPos = 30;
        
        stats.forEach(stat => {
          // Background box
          ctx.fillStyle = '#f8f9fa';
          ctx.fillRect(xPos, yPosition + 10, 260, 80);
          
          // Label
          ctx.fillStyle = '#6c757d';
          ctx.font = 'bold 14px Arial, sans-serif';
          ctx.fillText(stat.label, xPos + 15, yPosition + 35);
          
          // Value
          ctx.fillStyle = '#212529';
          ctx.font = 'bold 24px Arial, sans-serif';
          ctx.fillText(stat.value, xPos + 15, yPosition + 70);
          
          xPos += 270;
        });
        
        yPosition += 110;
        
        // Get and draw climb plot
        const climbImgData = await Plotly.toImage(plotDiv, {
          format: 'png',
          width: 1400,
          height: 600
        });
        
        const climbImg = new Image();
        await new Promise((resolve, reject) => {
          climbImg.onload = resolve;
          climbImg.onerror = reject;
          climbImg.src = climbImgData;
        });
        
        ctx.drawImage(climbImg, 0, yPosition, 1400, 600);
        yPosition += 620;
        
        // Small delay for smoother rendering
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Add footer
    ctx.fillStyle = '#6c757d';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('Generated by Climb Viewer • Powered by OpenStreetMap', 40, yPosition + 30);
    
    // Convert canvas to blob and download
    const safeFileName = fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileName}-complete-analysis.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
    
    // Success state
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Downloaded!';
    
    // Reset button after 2 seconds
    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Download error:', error);
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Error';
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = false;
    }, 2000);
  }
});