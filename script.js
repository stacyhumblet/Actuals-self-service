let data = [];
let headers = [];
const csvUrl = 'https://docs.google.com/spreadsheets/d/1j165dsa1a-DDapOCgyBLrJQ_UBa4LzCWdWez4_obLD0/export?format=csv&gid=1768057434';

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('downloadCsv').addEventListener('click', downloadCsv);
    document.getElementById('generateLink').addEventListener('click', generateLink);
});

function loadData() {
    Papa.parse(csvUrl, {
        download: true,
        header: true,
        complete: function(results) {
            data = results.data;
            headers = results.meta.fields;
            populateFilters();
            applyFilters(); // Show initial count
        },
        error: function(error) {
            console.error('Error loading data:', error);
            alert('Error loading data. Please check the console.');
        }
    });
}

function populateFilters() {
    const uniqueValues = {};
    headers.forEach(header => {
        uniqueValues[header] = new Set();
    });

    data.forEach(row => {
        headers.forEach(header => {
            if (row[header]) uniqueValues[header].add(row[header]);
        });
    });

    // Populate selects
    populateSelect('level4', Array.from(uniqueValues['Level 4 Mgr']).sort());
    populateSelect('level5', Array.from(uniqueValues['Level 5 Mgr']).sort());
    populateSelect('level6', Array.from(uniqueValues['Level 6 Mgr']).sort());
    populateSelect('dm', Array.from(uniqueValues['Direct Manager']).sort());
    populateSelect('resource', Array.from(uniqueValues['Resource Name']).sort());
    populateSelect('issueType', Array.from(uniqueValues['Issue Type']).sort());
    populateSelect('month', Array.from(uniqueValues['Month of Worklog']).sort());
    populateSelect('year', Array.from(uniqueValues['Year of Worklog']).sort());
}

function populateSelect(id, options) {
    const select = document.getElementById(id);
    select.innerHTML = '';
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.text = option;
        select.appendChild(opt);
    });
}

function applyFilters() {
    const filters = {
        'Level 4 Mgr': getSelectedValues('level4'),
        'Level 5 Mgr': getSelectedValues('level5'),
        'Level 6 Mgr': getSelectedValues('level6'),
        'Direct Manager': getSelectedValues('dm'),
        'Resource Name': getSelectedValues('resource'),
        'Issue Type': getSelectedValues('issueType'),
        'Month of Worklog': getSelectedValues('month'),
        'Year of Worklog': getSelectedValues('year'),
        minHours: parseFloat(document.getElementById('minHours').value) || 0,
        maxHours: parseFloat(document.getElementById('maxHours').value) || Infinity
    };

    const filtered = data.filter(row => {
        return (
            (filters['Level 4 Mgr'].length === 0 || filters['Level 4 Mgr'].includes(row['Level 4 Mgr'])) &&
            (filters['Level 5 Mgr'].length === 0 || filters['Level 5 Mgr'].includes(row['Level 5 Mgr'])) &&
            (filters['Level 6 Mgr'].length === 0 || filters['Level 6 Mgr'].includes(row['Level 6 Mgr'])) &&
            (filters['Direct Manager'].length === 0 || filters['Direct Manager'].includes(row['Direct Manager'])) &&
            (filters['Resource Name'].length === 0 || filters['Resource Name'].includes(row['Resource Name'])) &&
            (filters['Issue Type'].length === 0 || filters['Issue Type'].includes(row['Issue Type'])) &&
            (filters['Month of Worklog'].length === 0 || filters['Month of Worklog'].includes(row['Month of Worklog'])) &&
            (filters['Year of Worklog'].length === 0 || filters['Year of Worklog'].includes(row['Year of Worklog'])) &&
            parseFloat(row['Worklog Hours']) >= filters.minHours &&
            parseFloat(row['Worklog Hours']) <= filters.maxHours
        );
    });

    document.getElementById('rowCount').textContent = `Total rows: ${filtered.length}`;
    window.filteredData = filtered;
}

function getSelectedValues(id) {
    const select = document.getElementById(id);
    return Array.from(select.selectedOptions).map(option => option.value);
}

function downloadCsv() {
    if (!window.filteredData) {
        alert('Please apply filters first.');
        return;
    }

    const csv = Papa.unparse({
        fields: headers,
        data: window.filteredData
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'filtered_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function generateLink() {
    const params = new URLSearchParams();
    ['level4', 'level5', 'level6', 'dm', 'resource', 'issueType', 'month', 'year'].forEach(id => {
        const values = getSelectedValues(id);
        if (values.length > 0) {
            params.set(id, values.join(','));
        }
    });
    const minHours = document.getElementById('minHours').value;
    const maxHours = document.getElementById('maxHours').value;
    if (minHours) params.set('minHours', minHours);
    if (maxHours) params.set('maxHours', maxHours);

    const url = window.location.origin + window.location.pathname + '?' + params.toString();
    document.getElementById('shareableLink').href = url;
    document.getElementById('shareableLink').textContent = url;
    document.getElementById('linkContainer').style.display = 'block';
}

function showTab(event, tab) {
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.getElementById(tab + '-tab').style.display = 'block';
    event.target.classList.add('active');
}

// Load filters from URL on page load
window.addEventListener('load', function() {
    const params = new URLSearchParams(window.location.search);
    ['level4', 'level5', 'level6', 'dm', 'resource', 'issueType', 'month', 'year'].forEach(id => {
        const values = params.get(id);
        if (values) {
            const select = document.getElementById(id);
            values.split(',').forEach(value => {
                const option = Array.from(select.options).find(opt => opt.value === value);
                if (option) option.selected = true;
            });
        }
    });
    const minHours = params.get('minHours');
    const maxHours = params.get('maxHours');
    if (minHours) document.getElementById('minHours').value = minHours;
    if (maxHours) document.getElementById('maxHours').value = maxHours;
});