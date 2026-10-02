/**
 * FRIENDS FOREVER — Exam Schedule Aggregator & Clash Detector
 * Renders two columns: Midterms (amber/yellow) and Finals (coral/red)
 */

class ExamScheduleManager {
    constructor() {
        this.midListEl = null;
        this.finalListEl = null;
        this.emptyMsgEl = null;
        this.clashBoxEl = null;
        this.midCountEl = null;
        this.finalCountEl = null;
    }

    init() {
        this.midListEl = document.getElementById('examScheduleMidList');
        this.finalListEl = document.getElementById('examScheduleFinalList');
        this.emptyMsgEl = document.getElementById('examScheduleEmpty');
        this.clashBoxEl = document.getElementById('examClashWarningBox');
        this.midCountEl = document.getElementById('midExamsCount');
        this.finalCountEl = document.getElementById('finalExamsCount');
    }

    /**
     * Aggregate exams across all friends in the group
     */
    extractGroupExams(group) {
        if (!group || !group.friends) return { midRows: [], finalRows: [], clashes: [] };

        const midMap = {}; // key: `${date}_${courseCode}`
        const finalMap = {};
        const friendExamTimeline = {}; // friendId -> array of { date, start, courseCode }

        group.friends.forEach(friend => {
            friendExamTimeline[friend.id] = [];

            (friend.courses || []).forEach(course => {
                // 1. Midterms
                if (course.midExamDate) {
                    const key = `${course.midExamDate}_${course.courseCode}`;
                    if (!midMap[key]) {
                        midMap[key] = {
                            date: course.midExamDate,
                            start: course.midExamStartTime,
                            end: course.midExamEndTime,
                            course: course.courseCode,
                            type: 'MID',
                            friends: []
                        };
                    }
                    if (!midMap[key].friends.some(f => f.id === friend.id)) {
                        midMap[key].friends.push(friend);
                    }

                    friendExamTimeline[friend.id].push({
                        date: course.midExamDate,
                        start: course.midExamStartTime,
                        courseCode: course.courseCode,
                        type: 'MID',
                        friendName: friend.name
                    });
                }

                // 2. Finals
                if (course.finalExamDate) {
                    const key = `${course.finalExamDate}_${course.courseCode}`;
                    if (!finalMap[key]) {
                        finalMap[key] = {
                            date: course.finalExamDate,
                            start: course.finalExamStartTime,
                            end: course.finalExamEndTime,
                            course: course.courseCode,
                            type: 'FINAL',
                            friends: []
                        };
                    }
                    if (!finalMap[key].friends.some(f => f.id === friend.id)) {
                        finalMap[key].friends.push(friend);
                    }

                    friendExamTimeline[friend.id].push({
                        date: course.finalExamDate,
                        start: course.finalExamStartTime,
                        courseCode: course.courseCode,
                        type: 'FINAL',
                        friendName: friend.name
                    });
                }
            });
        });

        // Detect clashes per friend
        const clashes = [];
        Object.entries(friendExamTimeline).forEach(([fId, exams]) => {
            const dateGroups = {};
            exams.forEach(e => {
                if (!e.date) return;
                const dtKey = `${e.date} ${e.start || ''}`;
                if (!dateGroups[dtKey]) dateGroups[dtKey] = [];
                dateGroups[dtKey].push(e);
            });

            Object.entries(dateGroups).forEach(([dt, list]) => {
                if (list.length > 1) {
                    clashes.push({
                        friendName: list[0].friendName,
                        dateTime: dt,
                        courses: list.map(x => x.courseCode)
                    });
                }
            });
        });

        const sortExams = (a, b) => {
            const dateCmp = a.date.localeCompare(b.date);
            if (dateCmp !== 0) return dateCmp;
            return (a.start || '').localeCompare(b.start || '');
        };

        const midRows = Object.values(midMap).sort(sortExams);
        const finalRows = Object.values(finalMap).sort(sortExams);

        return { midRows, finalRows, clashes };
    }

    /**
     * Render a single exam column with day-grouped cards
     */
    renderColumn(containerEl, rows, typeClass) {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        if (rows.length === 0) {
            containerEl.innerHTML = '<p class="exam-column-empty">No exams scheduled</p>';
            return;
        }

        let i = 0;
        while (i < rows.length) {
            let j = i;
            while (j + 1 < rows.length && rows[j + 1].date === rows[i].date) {
                j++;
            }

            const card = document.createElement('div');
            card.classList.add('exam-day-card', typeClass);

            const header = document.createElement('div');
            header.classList.add('exam-day-header');
            header.innerHTML = `
                <span class="exam-day-weekday">${window.courseDataManager.getWeekdayName(rows[i].date)}</span>
                <span class="exam-day-date">${window.courseDataManager.formatDateDMY(rows[i].date)}</span>
            `;
            card.appendChild(header);

            for (let k = i; k <= j; k++) {
                const row = rows[k];
                const entry = document.createElement('div');
                entry.classList.add('exam-entry');

                const friendPills = (row.friends || []).map(f => `
                    <span class="exam-friend-pill" title="${f.name}">
                        <span class="friend-color-dot" style="background:${f.color}; color:${f.color}"></span>
                        <span>${f.name}</span>
                    </span>
                `).join('');

                const startTimeFormatted = window.courseDataManager.formatTime12(row.start);
                const endTimeFormatted = window.courseDataManager.formatTime12(row.end);
                const timeText = startTimeFormatted && endTimeFormatted ? 
                                 `${startTimeFormatted} – ${endTimeFormatted}` : (row.start || 'Time TBA');

                entry.innerHTML = `
                    <div class="exam-entry-left">
                        <span class="exam-course-badge">${row.course}</span>
                        <div style="display:flex; flex-wrap:wrap; gap:4px;">
                            ${friendPills}
                        </div>
                    </div>
                    <span class="exam-time">${timeText}</span>
                `;
                card.appendChild(entry);
            }

            containerEl.appendChild(card);
            i = j + 1;
        }
    }

    /**
     * Main Render method
     */
    render(group) {
        if (!this.midListEl) this.init();
        if (!this.midListEl) return;

        const { midRows, finalRows, clashes } = this.extractGroupExams(group);

        if (this.midCountEl) this.midCountEl.textContent = midRows.length;
        if (this.finalCountEl) this.finalCountEl.textContent = finalRows.length;

        // Render clash warnings if any
        if (this.clashBoxEl) {
            if (clashes.length > 0) {
                this.clashBoxEl.style.display = 'block';
                this.clashBoxEl.innerHTML = `
                    <strong>⚠️ Exam Clash Detected:</strong>
                    ${clashes.map(c => `
                        <div>${c.friendName} has simultaneous exams for <strong>${c.courses.join(' & ')}</strong> on ${c.dateTime}</div>
                    `).join('')}
                `;
            } else {
                this.clashBoxEl.style.display = 'none';
                this.clashBoxEl.innerHTML = '';
            }
        }

        const totalExams = midRows.length + finalRows.length;
        if (totalExams === 0) {
            if (this.emptyMsgEl) this.emptyMsgEl.style.display = 'block';
            if (this.midListEl) this.midListEl.innerHTML = '<p class="exam-column-empty">No midterms</p>';
            if (this.finalListEl) this.finalListEl.innerHTML = '<p class="exam-column-empty">No finals</p>';
            return;
        }

        if (this.emptyMsgEl) this.emptyMsgEl.style.display = 'none';

        this.renderColumn(this.midListEl, midRows, 'mid');
        this.renderColumn(this.finalListEl, finalRows, 'final');
    }
}

window.examScheduleManager = new ExamScheduleManager();
