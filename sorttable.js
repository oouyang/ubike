/*
  SortTable
  version 3 (modernized)
  Original by Stuart Langridge, http://www.kryogenix.org/code/browser/sorttable/
  Modernized with ES6+ features

  Instructions:
  Add <script src="sorttable.js"></script> to your HTML
  Add class="sortable" to any table you'd like to make sortable
  Click on the headers to sort

  Licenced as X11: http://www.kryogenix.org/code/browser/licence.html
*/

'use strict';

const sorttable = {
  DATE_RE: /^(\d\d?)[\/\.\-](\d\d?)[\/\.\-]((\d\d)?\d\d)$/,
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[SortTable] Initializing...');

    const tables = document.getElementsByTagName('table');
    let count = 0;
    for (const table of tables) {
      if (table.className.includes('sortable')) {
        this.makeSortable(table);
        count++;
      }
    }
    console.log(`[SortTable] Made ${count} tables sortable`);
  },

  makeSortable(table) {
    // Ensure table has thead
    if (table.getElementsByTagName('thead').length === 0) {
      const thead = document.createElement('thead');
      thead.appendChild(table.rows[0]);
      table.insertBefore(thead, table.firstChild);
    }

    const tHead = table.tHead || table.getElementsByTagName('thead')[0];
    if (!tHead || tHead.rows.length !== 1) return;

    // Move sortbottom rows to tfoot for backwards compatibility
    const sortbottomRows = [];
    for (const row of table.rows) {
      if (row.className.includes('sortbottom')) {
        sortbottomRows.push(row);
      }
    }

    if (sortbottomRows.length > 0) {
      let tfoot = table.tFoot;
      if (!tfoot) {
        tfoot = document.createElement('tfoot');
        table.appendChild(tfoot);
      }
      sortbottomRows.forEach(row => tfoot.appendChild(row));
    }

    // Setup header cells
    const headCells = tHead.rows[0].cells;
    for (let i = 0; i < headCells.length; i++) {
      const cell = headCells[i];
      if (cell.className.includes('sorttable_nosort')) continue;

      // Check for manual type override
      const typeMatch = cell.className.match(/\bsorttable_([a-z0-9]+)\b/);
      if (typeMatch && typeof this[`sort_${typeMatch[1]}`] === 'function') {
        cell.sorttable_sortfunction = this[`sort_${typeMatch[1]}`];
      } else {
        cell.sorttable_sortfunction = this.guessType(table, i);
      }

      cell.sorttable_columnindex = i;
      cell.sorttable_tbody = table.tBodies[0];
      cell.style.cursor = 'pointer';

      cell.addEventListener('click', (e) => this.handleHeaderClick(e, cell));
    }
  },

  handleHeaderClick(e, cell) {
    const tbody = cell.sorttable_tbody;
    const colIndex = cell.sorttable_columnindex;
    const sortFn = cell.sorttable_sortfunction;

    // Already sorted by this column - just reverse
    if (cell.className.includes('sorttable_sorted')) {
      this.reverse(tbody);
      cell.className = cell.className.replace('sorttable_sorted', 'sorttable_sorted_reverse');
      this.updateSortIndicator(cell, 'desc');
      console.log(`[SortTable] Reversed column ${colIndex}`);
      return;
    }

    // Already reverse sorted - reverse again
    if (cell.className.includes('sorttable_sorted_reverse')) {
      this.reverse(tbody);
      cell.className = cell.className.replace('sorttable_sorted_reverse', 'sorttable_sorted');
      this.updateSortIndicator(cell, 'asc');
      console.log(`[SortTable] Reversed column ${colIndex}`);
      return;
    }

    // New sort - clear other headers
    const headerRow = cell.parentNode;
    for (const headerCell of headerRow.cells) {
      headerCell.className = headerCell.className
        .replace('sorttable_sorted_reverse', '')
        .replace('sorttable_sorted', '');
      const indicator = headerCell.querySelector('.sorttable_indicator');
      if (indicator) indicator.remove();
    }

    // Build sort array using Schwartzian transform
    const rows = [];
    for (const row of tbody.rows) {
      rows.push([this.getInnerText(row.cells[colIndex]), row]);
    }

    console.log(`[SortTable] Sorting column ${colIndex} (${rows.length} rows)`);
    rows.sort(sortFn);

    // Reorder rows
    for (const [, row] of rows) {
      tbody.appendChild(row);
    }

    cell.className += ' sorttable_sorted';
    this.updateSortIndicator(cell, 'asc');
  },

  updateSortIndicator(cell, direction) {
    let indicator = cell.querySelector('.sorttable_indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'sorttable_indicator';
      indicator.style.marginLeft = '4px';
      cell.appendChild(indicator);
    }
    indicator.innerHTML = direction === 'asc' ? '&#x25BE;' : '&#x25B4;';
  },

  guessType(table, column) {
    const rows = table.tBodies[0]?.rows || [];
    for (const row of rows) {
      const text = this.getInnerText(row.cells[column]);
      if (text === '') continue;

      // Check for numeric
      if (text.match(/^-?[$£¤€]?[\d,.]+%?$/)) {
        return this.sort_numeric;
      }

      // Check for date
      const dateMatch = text.match(this.DATE_RE);
      if (dateMatch) {
        const first = parseInt(dateMatch[1], 10);
        const second = parseInt(dateMatch[2], 10);
        if (first > 12) return this.sort_ddmm;
        if (second > 12) return this.sort_mmdd;
        return this.sort_ddmm; // Default to dd/mm
      }
    }
    return this.sort_alpha;
  },

  getInnerText(node) {
    if (!node) return '';

    // Custom sort key override
    const customKey = node.getAttribute('sorttable_customkey');
    if (customKey !== null) return customKey;

    // Handle input fields
    const inputs = node.getElementsByTagName('input');
    if (inputs.length > 0) {
      return inputs[0].value.trim();
    }

    // Get text content
    const text = node.textContent || node.innerText || '';
    return text.trim();
  },

  reverse(tbody) {
    const rows = Array.from(tbody.rows);
    for (let i = rows.length - 1; i >= 0; i--) {
      tbody.appendChild(rows[i]);
    }
  },

  // Sort functions - compare a[0] and b[0]
  sort_numeric(a, b) {
    const aa = parseFloat(a[0].replace(/[^0-9.\-]/g, '')) || 0;
    const bb = parseFloat(b[0].replace(/[^0-9.\-]/g, '')) || 0;
    return aa - bb;
  },

  sort_alpha(a, b) {
    return a[0].localeCompare(b[0]);
  },

  sort_ddmm(a, b) {
    const parseDate = (str) => {
      const match = str.match(sorttable.DATE_RE);
      if (!match) return 0;
      const [, d, m, y] = match;
      return `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
    };
    return parseDate(a[0]).localeCompare(parseDate(b[0]));
  },

  sort_mmdd(a, b) {
    const parseDate = (str) => {
      const match = str.match(sorttable.DATE_RE);
      if (!match) return 0;
      const [, m, d, y] = match;
      return `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
    };
    return parseDate(a[0]).localeCompare(parseDate(b[0]));
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => sorttable.init());
} else {
  sorttable.init();
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = sorttable;
}
