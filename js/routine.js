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
            const isLabBadge = s.isLab ? '<span class="routine-sec-pill" style="color:#facc15">LAB</span>' : '';

            return `
                <div class="routine-class-card" style="--friend-color: ${f.color}">
                    <div class="routine-card-header">
                        <span class="routine-course-code">${c.courseCode}</span>
                        <div>
                            ${isLabBadge}
                            <span class="routine-sec-pill">Sec ${c.sectionName}</span>
                        </div>
                    </div>
                    <div class="routine-friend-pill" style="--friend-color: ${f.color}">
                        <span class="friend-color-dot" style="background:${f.color}; color:${f.color}"></span>
                        <span>${f.name}</span>
                    </div>
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
                    entriesHtml += `
                        <div class="sametime-entry" style="--friend-color: ${f.color}">
                            <div class="sametime-friend-header">
                                <span class="friend-color-dot" style="background:${f.color}; color:${f.color}"></span>
                                <span>${f.name}</span>
                            </div>
                            <div class="sametime-course-line">
                                <strong>${c.courseCode}</strong> — Sec ${c.sectionName}
                            </div>
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
                        <strong>${slot.label.split('-')[0]}</strong><br>
                        <span style="opacity: 0.7; font-size: 0.7rem;">${slot.label.split('-')[1]}</span>
                    </td>
                    ${cellsHtml}
                </tr>
            `;
        });

        this.tableBody.innerHTML = rowsHtml;
    }
}

window.routineRenderer = new RoutineRenderer();