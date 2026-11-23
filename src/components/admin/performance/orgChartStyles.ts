// Shared by the reporting-tree chart and the Structure view: cards, the lines between them, and the sideways / stacked layouts.
export const ORG_CHART_CSS = `
.orgc { --orgc-line: color-mix(in srgb, var(--color-ink-500) 40%, transparent); }
.orgc ul { list-style: none; margin: 0; padding: 0; }
.orgc li { position: relative; display: flex; flex-direction: column; align-items: center; }

.orgc-card { position: relative; box-sizing: border-box; width: 216px; padding: 10px 12px; text-align: left;
  border: 1px solid var(--color-mist-200); border-radius: 12px; background: var(--color-surface); }
.orgc-card.orgc-lead { border-top: 3px solid var(--color-navy-600); }
.orgc-card.orgc-compact { width: 184px; padding: 8px 10px; }
.orgc-card.orgc-gone { opacity: .6; }

.orgc-toggle { position: absolute; left: 50%; bottom: -12px; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 2px;
  height: 22px; padding: 0 8px; border: 1px solid var(--color-mist-200); border-radius: 9999px; background: var(--color-surface);
  color: var(--color-ink-700); font-size: 11px; font-weight: 600; line-height: 1; cursor: pointer; }
.orgc-toggle:hover { background: var(--color-mist-100); }
.orgc-toggle:focus-visible { outline: 2px solid var(--color-ember-500); outline-offset: 2px; }

/* reports spread sideways */
.orgc .orgc-row { position: relative; display: flex; justify-content: center; padding-top: 20px; }
.orgc .orgc-row::before { content: ""; position: absolute; top: 0; left: 50%; height: 20px; border-left: 2px solid var(--orgc-line); }
.orgc .orgc-row > li { padding: 20px 8px 0; }
.orgc .orgc-row > li::before, .orgc .orgc-row > li::after { content: ""; position: absolute; top: 0; right: 50%; width: 50%; height: 20px; border-top: 2px solid var(--orgc-line); }
.orgc .orgc-row > li::after { right: auto; left: 50%; border-left: 2px solid var(--orgc-line); }
.orgc .orgc-row > li:only-child { padding-top: 0; }
.orgc .orgc-row > li:only-child::before, .orgc .orgc-row > li:only-child::after { display: none; }
.orgc .orgc-row > li:first-child::before, .orgc .orgc-row > li:last-child::after { border: 0 none; }
.orgc .orgc-row > li:last-child::before { border-right: 2px solid var(--orgc-line); border-radius: 0 8px 0 0; }
.orgc .orgc-row > li:first-child::after { border-radius: 8px 0 0 0; }

/* reports stacked in a column under their lead */
.orgc .orgc-stack { align-self: flex-start; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 18px 0 0 14px; padding-left: 16px; }
.orgc .orgc-stack > li { align-items: stretch; width: 184px; }
.orgc .orgc-stack > li::before { content: ""; position: absolute; left: -16px; top: -8px; width: 16px; height: calc(50% + 8px);
  border-left: 2px solid var(--orgc-line); border-bottom: 2px solid var(--orgc-line); border-bottom-left-radius: 8px; }
.orgc .orgc-stack > li:first-child::before { top: -18px; height: calc(50% + 18px); }
.orgc .orgc-stack > li:not(:last-child)::after { content: ""; position: absolute; left: -16px; top: 50%; height: calc(50% + 8px); border-left: 2px solid var(--orgc-line); }

/* group cards: Board, Directors, Head Office, regions, departments, branches */
.orgc-group { position: relative; box-sizing: border-box; width: 240px; text-align: left; border: 1px solid var(--color-navy-800); border-radius: 12px; background: var(--color-surface); }
.orgc-group-head { padding: 8px 12px; border-radius: 11px 11px 0 0; background: var(--color-navy-800); color: #fff; }
.orgc-group-body { padding: 8px 12px 10px; }
.orgc-group.k-bundle { border: 1px dashed var(--color-mist-200); }
.orgc-group.k-bundle .orgc-group-head { background: var(--color-mist-100); color: var(--color-ink-700); }
.orgc-group.k-unplaced { border: 1px dashed var(--color-ember-400); }
.orgc-group.k-unplaced .orgc-group-head { background: var(--color-ember-100); color: var(--color-ink-900); }

/* picking someone lights up their chain of command */
.orgc-pick { cursor: pointer; }
.orgc-pick:hover { border-color: var(--color-ink-500); }
.orgc-pick:focus-visible { outline: 2px solid var(--color-ember-500); outline-offset: 2px; }
.orgc-card.orgc-copy { border-style: dashed; }
.orgc-card.orgs-chain { border-color: var(--color-ember-500); box-shadow: 0 0 0 1px var(--color-ember-500); }
.orgc-card.orgs-selected { border-color: var(--color-ember-500); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-ember-500) 40%, transparent); }
`;
