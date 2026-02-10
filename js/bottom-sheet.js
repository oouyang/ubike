'use strict';

/**
 * BottomSheet - Google Maps-style draggable bottom sheet for mobile
 * Only activates on mobile (≤768px). Desktop keeps traditional side panel.
 *
 * The sheet is positioned at bottom:0 and uses translateY to move up/down.
 * translateY(0) = fully visible, translateY(positive) = pushed down/hidden
 */
class BottomSheet {
  constructor(el, options = {}) {
    this.el = el;
    this.snapPoints = ['collapsed', 'half', 'full'];
    this.currentSnap = options.initialSnap || 'collapsed';
    this.onSnapChange = options.onSnapChange || (() => {});
    this.isDragging = false;
    this.startY = 0;
    this.startTranslateY = 0;
    this.dragStartTime = 0;
    this.enabled = false;
    this.lastDragDelta = 0;

    // Only enable on mobile
    this.checkMobile();
    window.addEventListener('resize', () => this.checkMobile());
  }

  checkMobile() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile && !this.enabled) {
      this.enable();
    } else if (!isMobile && this.enabled) {
      this.disable();
    }
  }

  enable() {
    this.enabled = true;
    this.el.classList.add('bottom-sheet');

    const handle = this.el.querySelector('.sheet-handle');
    if (!handle) {
      console.warn('[BottomSheet] No .sheet-handle found');
      return;
    }

    // Touch events
    this._onTouchStart = e => this.onStart(e);
    this._onTouchMove = e => this.onMove(e);
    this._onTouchEnd = e => this.onEnd(e);

    handle.addEventListener('touchstart', this._onTouchStart, { passive: false });
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd);

    // Mouse events (for testing in dev tools)
    this._onMouseDown = e => this.onStart(e);
    this._onMouseMove = e => this.onMove(e);
    this._onMouseUp = e => this.onEnd(e);

    handle.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);

    this.snapTo(this.currentSnap, false);
  }

  disable() {
    this.enabled = false;
    this.el.classList.remove('bottom-sheet', 'snap-collapsed', 'snap-half', 'snap-full', 'dragging');
    this.el.style.transform = '';

    const handle = this.el.querySelector('.sheet-handle');
    if (handle) {
      handle.removeEventListener('touchstart', this._onTouchStart);
      handle.removeEventListener('mousedown', this._onMouseDown);
    }
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  /**
   * Get the panel height (needed for transform calculations)
   * Panel has max-height: 90vh, so use that as reference
   */
  getPanelHeight() {
    return window.innerHeight * 0.9;
  }

  /**
   * Get translateY value for each snap point.
   * translateY pushes the panel DOWN from its natural position (bottom:0).
   * Higher translateY = more hidden, lower translateY = more visible.
   */
  getSnapTranslateY(snap) {
    const panelHeight = this.getPanelHeight();
    const viewportHeight = window.innerHeight;

    switch (snap) {
      case 'collapsed':
        // Only show 56px (handle), hide the rest
        return panelHeight - 56;
      case 'half':
        // Show half of viewport height
        return panelHeight - (viewportHeight * 0.5);
      case 'full':
        // Show 90% of viewport (leave 10% at top for map interaction)
        return panelHeight - (viewportHeight * 0.9);
      default:
        return panelHeight - 56;
    }
  }

  onStart(e) {
    console.log('[BottomSheet] onStart triggered', e.type);
    // Prevent text selection during drag
    e.preventDefault();

    const y = e.touches ? e.touches[0].clientY : e.clientY;
    this.isDragging = true;
    this.startY = y;
    this.dragStartTime = Date.now();
    this.startTranslateY = this.getSnapTranslateY(this.currentSnap);
    this.lastDragDelta = 0;
    this.el.classList.add('dragging');

    // Set initial transform to pixel value for smooth dragging
    this.el.style.transform = `translateY(${this.startTranslateY}px)`;
  }

  onMove(e) {
    if (!this.isDragging) {
      return;
    }
    console.log('[BottomSheet] onMove', e.clientY);
    e.preventDefault();

    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = y - this.startY;
    this.lastDragDelta = delta;

    // Calculate bounds
    const minTranslateY = this.getSnapTranslateY('full');   // Most expanded
    const maxTranslateY = this.getSnapTranslateY('collapsed'); // Most collapsed

    // New position = start position + drag delta
    // Dragging down (positive delta) increases translateY (hides more)
    // Dragging up (negative delta) decreases translateY (shows more)
    const newTranslateY = Math.max(
      minTranslateY,
      Math.min(maxTranslateY, this.startTranslateY + delta)
    );

    this.el.style.transform = `translateY(${newTranslateY}px)`;
  }

  onEnd(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.el.classList.remove('dragging');

    const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const delta = y - this.startY;
    const duration = Date.now() - this.dragStartTime;
    const velocity = duration > 0 ? delta / duration : 0;

    console.log('[BottomSheet] onEnd:', { startY: this.startY, y, delta, duration, velocity });

    // Determine next snap based on velocity and position
    let nextSnap = this.currentSnap;
    const idx = this.snapPoints.indexOf(this.currentSnap);

    // Velocity threshold for fast swipe
    const VELOCITY_THRESHOLD = 0.3;
    // Distance threshold for slow drag
    const DISTANCE_THRESHOLD = 50;

    // snapPoints order: ['collapsed', 'half', 'full']
    // collapsed = most hidden (idx 0), full = most visible (idx 2)
    // Swipe UP (negative delta) = expand = increase index
    // Swipe DOWN (positive delta) = collapse = decrease index

    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      // Fast swipe - use velocity direction
      if (velocity < 0) {
        // Swipe up - expand (increase index toward 'full')
        nextSnap = this.snapPoints[Math.min(idx + 1, 2)];
      } else {
        // Swipe down - collapse (decrease index toward 'collapsed')
        nextSnap = this.snapPoints[Math.max(idx - 1, 0)];
      }
    } else if (Math.abs(delta) > DISTANCE_THRESHOLD) {
      // Slow drag - use distance
      if (delta < 0) {
        // Drag up - expand
        nextSnap = this.snapPoints[Math.min(idx + 1, 2)];
      } else {
        // Drag down - collapse
        nextSnap = this.snapPoints[Math.max(idx - 1, 0)];
      }
    }
    // If neither condition met, stay at current snap

    console.log('[BottomSheet] Snap decision:', { currentSnap: this.currentSnap, idx, nextSnap });
    this.snapTo(nextSnap);
  }

  snapTo(snap, animate = true) {
    this.currentSnap = snap;

    // Clear inline transform - let CSS class handle it
    this.el.style.transform = '';

    // Remove all snap classes and add current
    this.snapPoints.forEach(s => this.el.classList.remove('snap-' + s));
    this.el.classList.add('snap-' + snap);

    if (!animate) {
      this.el.classList.add('no-transition');
      // Use double RAF to ensure the class is applied before removing no-transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.el.classList.remove('no-transition');
        });
      });
    }

    this.onSnapChange(snap);
  }

  // Public API
  expand() {
    this.snapTo('full');
  }

  collapse() {
    this.snapTo('collapsed');
  }

  setHalf() {
    this.snapTo('half');
  }

  getState() {
    return this.currentSnap;
  }
}

// Export for use in other scripts
window.BottomSheet = BottomSheet;
