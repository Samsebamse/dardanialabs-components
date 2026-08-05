/**
 * Generic Spinner Web Component
 * One honest, endless ring — no fake progress, no percent theatre. If a
 * number can be trusted some day (real upload progress), a determinate
 * variant can join it; until then the ring just spins while work happens.
 *
 * Usage:
 *   <dardanialabs-spinner></dardanialabs-spinner>
 *   <dardanialabs-spinner size="48" label="Creating mailbox…"></dardanialabs-spinner>
 *   <dardanialabs-spinner inline></dardanialabs-spinner>   (sits in a line of text/button)
 *
 * Attributes:
 *   size    ring diameter in px               (default 36)
 *   label   text under the ring               (default none)
 *   inline  no block layout, no label — a small ring for buttons
 *
 * Theming (CSS custom properties on the host):
 *   --dardanialabs-accent         ring color            (default #D42B2B)
 *   --dardanialabs-spinner-track  faint full circle     (default rgba(128,128,128,.18))
 *   --dardanialabs-spinner-text   label color           (default inherit)
 */

class DardaniaLabsSpinner extends HTMLElement {
  static get observedAttributes() {
    return ['size', 'label', 'inline'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(oldValue, newValue) {
    if (oldValue === newValue) return;
    this.render();
  }

  render() {
    const size = Math.max(12, parseInt(this.getAttribute('size'), 10) || 36);
    const label = this.getAttribute('label') || '';
    const inline = this.hasAttribute('inline');
    const stroke = Math.max(2, Math.round(size / 12));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: ${inline ? 'inline-flex' : 'flex'};
          flex-direction: ${inline ? 'row' : 'column'};
          align-items: center;
          justify-content: center;
          gap: 0.6em;
          vertical-align: ${inline ? 'middle' : 'baseline'};
        }
        svg { display: block; }
        .ring {
          animation: turn 0.9s linear infinite;
          transform-origin: 50% 50%;
        }
        .track { stroke: var(--dardanialabs-spinner-track, rgba(128, 128, 128, 0.18)); }
        .arc {
          stroke: var(--dardanialabs-accent, #D42B2B);
          stroke-linecap: round;
          /* A quarter of the circle spins; the gap IS the motion. */
          stroke-dasharray: ${(c * 0.25).toFixed(2)} ${(c * 0.75).toFixed(2)};
        }
        .label {
          color: var(--dardanialabs-spinner-text, inherit);
          font: inherit;
          font-size: 0.85em;
        }
        @media (prefers-reduced-motion: reduce) {
          .ring { animation-duration: 2.4s; }
        }
        @keyframes turn { to { transform: rotate(360deg); } }
      </style>
      <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
           role="progressbar" aria-label="${label || 'Loading'}">
        <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
        <circle class="arc"   cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      </svg>
      ${label && !inline ? `<span class="label"></span>` : ''}
    `;
    // Label goes in via textContent — attribute text must never become markup.
    const el = this.shadowRoot.querySelector('.label');
    if (el) el.textContent = label;
  }
}

if (!customElements.get('dardanialabs-spinner')) {
  customElements.define('dardanialabs-spinner', DardaniaLabsSpinner);
}
