/**
 * FRIENDS FOREVER — Routine Matrix Visualizer & Shared/Collision Detection
 */

class RoutineRenderer {
    constructor() {
        this.tableBody = null;
    }

    init() {
        this.tableBody = document.getElementById('routineTableBody');
    }

    /**
     * Map all active friends' courses into a (day, slotId) -> Array of class occurrences
     */
    buildScheduleMatrix(friends) {
        // key: `${day}_${slot.id}` -> Array of { friend, course, session }
        const matrix = {};

        WEEK_DAYS.forEach(day => {
            STANDARD_TIME_SLOTS.forEach(slot => {
                matrix[`${day}_${slot.id}`] = [];
            });
        });

        // Loop over each friend (if visible)
        friends.forEach(friend => {
            if (friend.visibleInRoutine === false) return;

            (friend.courses || []).forEach(course => {
                (course.sessions || []).forEach(session => {
                    const day = session.day;
                    // Find which standard slots this session intersects
                    const overlappingSlots = window.courseDataManager.getOverlappingStandardSlots(
                        session.startMinutes,
                        session.endMinutes
                    );

                    overlappingSlots.forEach(slot => {
                        const key = `${day}_${slot.id}`;
                        if (matrix[key]) {
                            // Avoid duplicate entry for the same friend in the same slot
                            const alreadyIn = matrix[key].some(
                                item => item.friend.id === friend.id && item.course.courseCode === course.courseCode
                            );
                            if (!alreadyIn) {
                                matrix[key].push({
                                    friend,
                                    course,
                                    session
                                });
                            }
                        }
                    });
                });
            });
        });

        return matrix;
    }

    /**
     * Group items in a slot by course+section to detect shared classes
     */
    analyzeSlotItems(items) {
        if (!items || items.length === 0) return { type: 'EMPTY' };

        // Group by `${courseCode}_${sectionName}`
        const courseGroups = {};
        items.forEach(item => {
            const key = `${item.course.courseCode}_SEC_${item.course.sectionName}`;
            if (!courseGroups[key]) {
                courseGroups[key] = {
                    course: item.course,
                    session: item.session,
                    friends: []
                };
            }
            if (!courseGroups[key].friends.some(f => f.id === item.friend.id)) {
                courseGroups[key].friends.push(item.friend);
            }
        });

        const groupKeys = Object.keys(courseGroups);

        // Case 1: Exactly 1 course group
        if (groupKeys.length === 1) {
            const grp = courseGroups[groupKeys[0]];
            if (grp.friends.length === 1) {
                // Single friend single class
                return {
                    type: 'SINGLE',
                    friend: grp.friends[0],
                    course: grp.course,
                    session: grp.session
                };
            } else {
                // Multiple friends in EXACT SAME class & section: SHARED CLASS!
                return {
                    type: 'SHARED',
                    course: grp.course,
                    session: grp.session,
                    friends: grp.friends
                };
            }
        }

        // Case 2: Multiple different courses at the SAME TIME!
        // This is the core USP specified in the prompt!
        return {
            type: 'SAME_TIME',
            courseGroups: Object.values(courseGroups),
            totalFriends: items.length
        };
    }

    /**
     * Render the visual HTML inside each table cell
     */
    renderCellContent(analysis) {
        if (analysis.type === 'EMPTY') {
            return '';
        }

        // 1. Single Friend Class
        if (analysis.type === 'SINGLE') {
            const f = analysis.friend;
            const c = analysis.course;
            const s = analysis.session;
            const labTag = s.isLab ? '<span class="line-lab">LAB</span>' : '';

            return `
                <div class="routine-class-card routine-oneline" style="--friend-color: ${f.color}">
                    <span class="friend-color-dot" style="background:${f.color}; color:${f.color}"></span>
                    <span class="line-name">${f.name}</span>
                    <span class="line-course">${c.courseCode}</span>
                    <span class="line-sec">sec${c.sectionName}</span>
                    ${labTag}
                </div>
            `;
        }

        // 2. Shared Class (Multiple friends taking the exact same course and section!)
        if (analysis.type === 'SHARED') {
            const c = analysis.course;
            const s = analysis.session;
            const friendsHtml = analysis.friends.map(f => `
                <span class="shared-friend-chip" title="${f.name}">
                    <span class="friend-color-dot" style="background:${f.color}; color:${f.color}"></span>
                    <span>${f.name}</span>
                </span>
            `).join('');

            return `
                <div class="routine-shared-class-card">
                    <div class="shared-class-tag">
                        <span>🎉 Shared Class</span>
                        <span style="opacity: 0.8">(${analysis.friends.length} Friends)</span>
                    </div>
                    <div class="routine-card-header">
                        <span class="routine-course-code" style="color: #34d399">${c.courseCode}</span>
                        <span class="routine-sec-pill">Sec ${c.sectionName}</span>
                    </div>
                    <div class="shared-friends-row">
                        ${friendsHtml}
                    </div>
                </div>
            `;
        }

        // 3. SAME TIME (Different courses at the same time slot — as requested in user prompt!)
        if (analysis.type === 'SAME_TIME') {
            let entriesHtml = '';

            analysis.courseGroups.forEach(grp => {
                const c = grp.course;
                const s = grp.session;

                grp.friends.forEach(f => {
                    const labTag = s.isLab ? '<span class="line-lab">LAB</span>' : '';
                    entriesHtml += `
                        <div class="sametime-entry routine-oneline" style="--friend-color: ${f.color}">
                            <span class="friend-color-dot" style="background:${f.color}; color:${f.color}"></span>
                            <span class="line-name">${f.name}</span>
                            <span class="line-course">${c.courseCode}</span>
                            <span class="line-sec">sec${c.sectionName}</span>
                            ${labTag}
                        </div>
                    `;
                });
            });

            return `
                <div class="routine-sametime-card">
                    <div class="sametime-entries-list">
                        ${entriesHtml}
                    </div>
                </div>
            `;
        }

        return '';
    }

    /**
     * Shrink the header of days that have no classes (e.g. Friday -> "Fri")
     */
    updateHeader(dayHasClass, anyClass) {
        const headers = document.querySelectorAll('#routineTable thead th');
        WEEK_DAYS.forEach((day, i) => {
            const th = headers[i + 1]; // index 0 is the time column
            if (!th) return;
            if (!th.dataset.full) th.dataset.full = th.textContent.trim();
            const isEmpty = anyClass && !dayHasClass[day];
            th.classList.toggle('day-empty', isEmpty);
            th.textContent = isEmpty ? th.dataset.full.slice(0, 3) : th.dataset.full;
            th.title = isEmpty ? `${th.dataset.full} — no classes` : '';
        });
    }

    /**
     * Render the whole routine table for the active group
     */
    render(group) {
        if (!this.tableBody) this.init();
        if (!this.tableBody) return;

        if (!group || !group.friends || group.friends.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        No friends in this group yet. Add friends using <strong>+ Add Friend</strong> above to view their routine.
                    </td>
                </tr>
            `;
            return;
        }

        const matrix = this.buildScheduleMatrix(group.friends);

        // ---- Smart layout: trim empty periods at the top/bottom, shrink empty days ----
        const cellHasClass = (day, slot) => (matrix[`${day}_${slot.id}`] || []).length > 0;
        const dayHasClass = {};
        WEEK_DAYS.forEach(day => {
            dayHasClass[day] = STANDARD_TIME_SLOTS.some(slot => cellHasClass(day, slot));
        });
        const anyClass = WEEK_DAYS.some(day => dayHasClass[day]);

        let visibleSlots = STANDARD_TIME_SLOTS;
        if (anyClass) {
            const slotHasClass = slot => WEEK_DAYS.some(day => cellHasClass(day, slot));
            let first = 0;
            let last = STANDARD_TIME_SLOTS.length - 1;
            while (first < last && !slotHasClass(STANDARD_TIME_SLOTS[first])) first++;
            while (last > first && !slotHasClass(STANDARD_TIME_SLOTS[last])) last--;
            visibleSlots = STANDARD_TIME_SLOTS.slice(first, last + 1);
        }

        this.updateHeader(dayHasClass, anyClass);

        let rowsHtml = '';

        visibleSlots.forEach(slot => {
            let cellsHtml = '';

            WEEK_DAYS.forEach(day => {
                const items = matrix[`${day}_${slot.id}`] || [];
                const analysis = this.analyzeSlotItems(items);
                const content = this.renderCellContent(analysis);
                const emptyDayClass = (anyClass && !dayHasClass[day]) ? ' day-empty' : '';

                cellsHtml += `
                    <td class="routine-cell${emptyDayClass}" data-day="${day}" data-slot="${slot.id}">
                        ${content}
                    </td>
                `;
            });

            rowsHtml += `
                <tr id="routineRow_${slot.id}">
                   <td class="time-slot-label">
    <span class="time-start">${slot.label.split('-')[0]}</span>
    <span class="time-end">${slot.label.split('-')[1]}</span>
</td>
                    ${cellsHtml}
                </tr>
            `;
        });

        this.tableBody.innerHTML = rowsHtml;
    }

    /**
     * Export the FULL routine (all columns, no cut-off) as a PNG.
     *
     * Why the previous approach failed:
     *   html2canvas internally clones the element but still respects the
     *   browser's computed layout — so even if we set overflow:visible on the
     *   live element, the cloned document still lays out at the window width
     *   and clips the overflowing columns.
     *
     * Fix: deep-clone the export area into a hidden, position:fixed,
     *   width:max-content wrapper that lives OUTSIDE the normal document flow.
     *   html2canvas captures that wrapper, sees every column fully rendered,
     *   then we discard the clone.
     *
     * @param {string} filename
     * @param {number} scale  – 2 = retina quality
     */
    async exportAsImage(filename = 'routine.png', scale = 2) {
        const group = window.appState?.currentGroup;
        if (!group) {
            console.error('exportAsImage: no currentGroup found');
            return;
        }

        // ── 1. Build schedule matrix & determine visible slots ───────────────────
        const matrix = this.buildScheduleMatrix(group.friends);

        const cellHasClass = (day, slot) => (matrix[`${day}_${slot.id}`] || []).length > 0;
        const dayHasClass  = {};
        WEEK_DAYS.forEach(day => {
            dayHasClass[day] = STANDARD_TIME_SLOTS.some(slot => cellHasClass(day, slot));
        });
        const anyClass = WEEK_DAYS.some(day => dayHasClass[day]);

        // Trim empty leading/trailing time slots, keep ALL days (including Sunday)
        let visibleSlots = STANDARD_TIME_SLOTS;
        if (anyClass) {
            const slotHasClass = slot => WEEK_DAYS.some(day => cellHasClass(day, slot));
            let first = 0, last = STANDARD_TIME_SLOTS.length - 1;
            while (first < last && !slotHasClass(STANDARD_TIME_SLOTS[first])) first++;
            while (last > first  && !slotHasClass(STANDARD_TIME_SLOTS[last]))  last--;
            visibleSlots = STANDARD_TIME_SLOTS.slice(first, last + 1);
        }

        // ── 2. Build full table HTML ─────────────────────────────────────────────
        const thStyle = `
            padding:10px 14px;
            font-size:12px;
            font-weight:700;
            letter-spacing:.08em;
            color:#a3a3a3;
            text-transform:uppercase;
            border-bottom:1px solid rgba(255,255,255,.1);
            border-right:1px solid rgba(255,255,255,.07);
            white-space:nowrap;
            background:#111111;
        `;

        const headerCells = WEEK_DAYS.map(day =>
            `<th style="${thStyle}">${day}</th>`
        ).join('');

        let rowsHtml = '';
        visibleSlots.forEach(slot => {
            const parts = slot.label.split('-');
            const start = parts[0] || '';
            const end   = parts[1] || '';

            const cellsHtml = WEEK_DAYS.map(day => {
                const items    = matrix[`${day}_${slot.id}`] || [];
                const analysis = this.analyzeSlotItems(items);
                const content  = this.renderCellContent(analysis);
                return `<td style="
                    padding:6px 8px;
                    vertical-align:top;
                    border-right:1px solid rgba(255,255,255,.07);
                    border-bottom:1px solid rgba(255,255,255,.05);
                    min-width:150px;
                    background:#0d0d0f;
                ">${content}</td>`;
            }).join('');

            rowsHtml += `<tr>
                <td style="
                    padding:8px 16px;
                    white-space:nowrap;
                    border-right:1px solid rgba(255,255,255,.1);
                    border-bottom:1px solid rgba(255,255,255,.05);
                    font-size:12px;
                    color:#737373;
                    font-family:monospace;
                    vertical-align:middle;
                    min-width:130px;
                    width:130px;
                    background:#111111;
                ">
                    <div style="font-weight:700;color:#a3a3a3;font-size:12px;">${start}</div>
                    <div style="font-size:11px;opacity:.7;margin-top:2px;">${end}</div>
                </td>${cellsHtml}
            </tr>`;
        });

        const tableHtml = `
            <table style="border-collapse:collapse;width:max-content;table-layout:auto;">
                <thead><tr>
                    <th style="${thStyle}min-width:130px;width:130px;color:#737373;">Time / Day</th>
                    ${headerCells}
                </tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        // ── 3. Copy all stylesheets into the iframe srcdoc ───────────────────────
        const styleLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
            .map(l => `<link rel="stylesheet" href="${l.href}">`)
            .join('\n');
        const inlineStyles = [...document.querySelectorAll('style')]
            .map(s => `<style>${s.textContent}</style>`)
            .join('\n');

        const srcdoc = `<!DOCTYPE html><html><head>
            <meta charset="UTF-8">
            ${styleLinks}
            ${inlineStyles}
            <style>
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    background: #0d0d0f;
                    padding: 28px 32px;
                    width: max-content;
                    min-width: max-content;
                    font-family: 'Nunito', sans-serif;
                }
                .export-title {
                    color: #fafafa;
                    font-size: 22px;
                    font-weight: 800;
                    margin-bottom: 4px;
                    font-family: 'Nunito', sans-serif;
                }
                .export-subtitle {
                    color: #737373;
                    font-size: 13px;
                    margin-bottom: 20px;
                    font-family: 'Nunito', sans-serif;
                }
            </style>
        </head><body>
            <div class="export-title">Weekly Class Routine</div>
            <div class="export-subtitle">Unified schedule with automatic shared-class detection &amp; simultaneous time matching</div>
            ${tableHtml}
        </body></html>`;

        // ── 4. Render inside a hidden, oversized iframe ──────────────────────────
        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, {
            position:   'fixed',
            top:        '0',
            left:       '-99999px',
            width:      '5000px',   // wide enough that no column ever wraps
            height:     '4000px',
            border:     'none',
            visibility: 'hidden',
        });
        iframe.srcdoc = srcdoc;
        document.body.appendChild(iframe);

        // Wait for iframe load, then two rAFs for fonts/styles to settle
        await new Promise(resolve => { iframe.onload = resolve; });
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));

        const iframeBody = iframe.contentDocument.body;
        const fullWidth  = iframeBody.scrollWidth;
        const fullHeight = iframeBody.scrollHeight;

        // ── 5. Capture & download ────────────────────────────────────────────────
        try {
            const canvas = await html2canvas(iframeBody, {
                useCORS:      true,
                scale,
                scrollX:      0,
                scrollY:      0,
                x:            0,
                y:            0,
                width:        fullWidth,
                height:       fullHeight,
                windowWidth:  fullWidth,
                windowHeight: fullHeight,
            });

            const link     = document.createElement('a');
            link.download  = filename;
            link.href      = canvas.toDataURL('image/png');
            link.click();
        } finally {
            document.body.removeChild(iframe);
        }
    }
}

window.routineRenderer = new RoutineRenderer();