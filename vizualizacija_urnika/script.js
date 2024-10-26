document.getElementById('uploadButton').addEventListener('click', function() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const data = parseCSV(content); // Assuming CSV format
            plotData(data);
        };
        reader.readAsText(file);
    } else {
        alert('Please select a file first.');
    }
});

function parseCSV(content) {
    const rows = content.split('\n');
    const labels = [];
    const values = [];
    rows.forEach(row => {
        const [label, value] = row.split(',');
        labels.push(label);
        values.push(parseFloat(value));
    });
    return { labels, values };
}

function plotData(data) {
    const ctx = document.getElementById('myChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Dataset',
                data: data.values,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}