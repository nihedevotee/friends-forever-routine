/**
 * FRIENDS FOREVER — "Who's Free?" and "Common Free Time" Algorithms
 */

class WhosFreeManager {
    constructor() {
        this.currentGroup = null;
        this.selectedDay = 'Wednesday';
        this.selectedSlotId = 5; // Default: 02:00 PM-03:20 PM
        this.cftSelectedDay = 'ALL';
        this.cftSelectedFriendIds = new Set();
    }

    setGroup(group) {
        this.currentGroup = group;
        if (group && group.friends) {
            this.cftSelectedFriendIds = new Set(group.friends.map(f => f.id));
        }
    }

    /**
     * Given a day and a standard slot, calculate who is free vs who is busy
     */
    evaluateSlot(day, slot) {
        if (!this.currentGroup || !this.currentGroup.friends) {
            return { free: [], busy: [] };
        }

        const slotStartMin = window.courseDataManager.timeToMinutes(slot.start);
        const slotEndMin = window.courseDataManager.timeToMinutes(slot.end);

        const freeFriends = [];
        const busyFriends = [];

        this.currentGroup.friends.forEach(friend => {
            let busyCourse = null;
            let busySession = null;

            for (const course of (friend.courses || [])) {
                for (const session of (course.sessions || [])) {
                    if (session.day === day) {
                        // Check time interval intersection
                        if (session.startMinutes < slotEndMin && session.endMinutes > slotStartMin) {
                            busyCourse = course;
                            busySession = session;
                            break;
                        }
                    }
                }
                if (busyCourse) break;
            }

            if (busyCourse) {
                busyFriends.push({
                    friend,
                    course: busyCourse,
                    session: busySession
                });
            } else {
                freeFriends.push(friend);
            }
        });

        return { free: freeFriends, busy: busyFriends };
    }

    /**
     * Render the "Who's Free?" modal UI
     */
    renderWhosFree() {
        const daySelect = document.getElementById('whosFreeDaySelect');
        const timeSelect = document.getElementById('whosFreeTimeSelect');
        const freeList = document.getElementById('whosFreeList');
        const busyList = document.getElementById('whosBusyList');
        const freeCount = document.getElementById('whosFreeCount');
        const busyCount = document.getElementById('whosBusyCount');

        if (!daySelect || !timeSelect || !freeList || !busyList) return;

        // Populate time slots dropdown if empty
        if (timeSelect.children.length === 0) {
            timeSelect.innerHTML = STANDARD_TIME_SLOTS.map(s => `
                <option value="${s.id}">${s.label}</option>
            `).join('');
            timeSelect.value = this.selectedSlotId;
        }

        const currentDay = daySelect.value;
        const currentSlotId = parseInt(timeSelect.value, 10);
        const slot = STANDARD_TIME_SLOTS.find(s => s.id === currentSlotId) || STANDARD_TIME_SLOTS[0];

        const result = this.evaluateSlot(currentDay, slot);

        freeCount.textContent = result.free.length;
        busyCount.textContent = result.busy.length;

        // Render FREE list
        if (result.free.length === 0) {
            freeList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No friends are free at this time.</div>`;
        } else {
            freeList.innerHTML = result.free.map(f => `
                <div class="whos-free-card" style="--friend-color: ${f.color}">
                    <span class="friend-color-dot" style="background:${f.color}; color:${f.color}"></span>
                    <div>
                        <div class="whos-free-friend-name">${f.name}</div>
                        ${f.nickname ? `<div style="font-size:0.75rem; color:var(--text-muted)">"${f.nickname}"</div>` : ''}
                    </div>
                </div>
            `).join('');
        }

        // Render BUSY list
        if (result.busy.length === 0) {
            busyList.innerHTML = `<div style="text-align: center; color: #34d399; padding: 20px; font-weight:600;">Everyone is free! 🎉</div>`;
        } else {
            busyList.innerHTML = result.busy.map(item => `
                <div class="whos-free-card busy-card" style="--friend-color: ${item.friend.color}">
                    <span class="friend-color-dot" style="background:${item.friend.color}; color:${item.friend.color}"></span>
                    <div>
                        <div class="whos-free-friend-name">${item.friend.name}</div>
                        <div class="whos-free-course-detail">
                            ${item.course.courseCode} — Sec ${item.course.sectionName}
                        </div>
                        <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                            ${item.session.room || item.course.roomName || 'TBA'} • ${item.course.faculties || ''}
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    /**
     * Compute Common Free Time across all days and slots for selected friends
     */
    calculateCommonFreeTime() {
        if (!this.currentGroup || !this.currentGroup.friends) return [];

        const targetFriends = this.currentGroup.friends.filter(f => this.cftSelectedFriendIds.has(f.id));
        if (targetFriends.length === 0) return [];

        const results = [];

        WEEK_DAYS.forEach(day => {
            if (this.cftSelectedDay !== 'ALL' && this.cftSelectedDay !== day) return;

            STANDARD_TIME_SLOTS.forEach(slot => {
                const slotStartMin = window.courseDataManager.timeToMinutes(slot.start);
                const slotEndMin = window.courseDataManager.timeToMinutes(slot.end);

                const freeFriends = [];
                const busyFriends = [];

                targetFriends.forEach(friend => {
                    let isBusy = false;
                    for (const course of (friend.courses || [])) {
                        for (const session of (course.sessions || [])) {
                            if (session.day === day) {
                                if (session.startMinutes < slotEndMin && session.endMinutes > slotStartMin) {
                                    isBusy = true;
                                    break;
                                }
                            }
                        }
                        if (isBusy) break;
                    }

                    if (isBusy) busyFriends.push(friend);
                    else freeFriends.push(friend);
                });

                results.push({
                    day,
                    slot,
                    freeFriends,
                    busyFriends,
                    totalTarget: targetFriends.length,
                    freeCount: freeFriends.length,
                    ratio: freeFriends.length / targetFriends.length
                });
            });
        });

        // Sort descending by ratio (highest number of free friends first)
        results.sort((a, b) => {
            if (b.ratio !== a.ratio) return b.ratio - a.ratio;
            // secondary sort by day of week index
            return WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day);
        });

        return results;
    }

    /**
     * Render the Common Free Time modal UI
     */
    renderCommonFreeTime() {
        const container = document.getElementById('cftResultsContainer');
        const checkboxesContainer = document.getElementById('cftFriendsCheckboxes');
        if (!container || !checkboxesContainer) return;

        if (!this.currentGroup || !this.currentGroup.friends || this.currentGroup.friends.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px;">No friends in this group.</div>`;
            checkboxesContainer.innerHTML = '';
            return;
        }

        // Render friend selector checkboxes
        checkboxesContainer.innerHTML = this.currentGroup.friends.map(f => {
            const isChecked = this.cftSelectedFriendIds.has(f.id) ? 'checked' : '';
            return `
                <label class="cft-friend-label">
                    <input type="checkbox" class="cft-friend-cb" data-id="${f.id}" ${isChecked}>
                    <span class="friend-color-dot" style="background:${f.color}; color:${f.color}"></span>
                    <span>${f.name}</span>
                </label>
            `;
        }).join('');

        const slots = this.calculateCommonFreeTime();

        if (slots.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px;">Please select at least one friend.</div>`;
            return;
        }

        container.innerHTML = slots.map(item => {
            const isPerfect = item.freeCount === item.totalTarget;
            const freeChips = item.freeFriends.map(f => `
                <span class="friend-color-dot" title="${f.name} is free" style="background:${f.color}; color:${f.color}"></span>
            `).join('');

            return `
                <div class="cft-result-card ${isPerfect ? 'perfect' : ''}">
                    <div class="cft-time-info">
                        <span class="cft-slot-day">${item.day} ${isPerfect ? '✨ (100% Free)' : ''}</span>
                        <span class="cft-slot-time">${item.slot.label}</span>
                    </div>
                    <div class="cft-score-info">
                        <div class="cft-score-badge" style="color: ${isPerfect ? '#34d399' : (item.ratio >= 0.7 ? '#38bdf8' : '#cbd5e1')}">
                            ${item.freeCount} / ${item.totalTarget} friends free
                        </div>
                        <div class="cft-free-friends-chips">
                            ${freeChips}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

window.whosFreeManager = new WhosFreeManager();
