/**
 * FRIENDS FOREVER — Main Application Controller & UI Coordinator
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Current application state
    let activeGroupId = null;
    let activeFriendId = null;
    let selectedSearchCourse = null;
    let editingGroupId = null;

    // DOM Elements
    const viewLanding = document.getElementById('viewLanding');
    const viewGroupDetail = document.getElementById('viewGroupDetail');
    const navGroupBreadcrumb = document.getElementById('navGroupBreadcrumb');
    const navGroupName = document.getElementById('navGroupName');
    const navAllGroupsBtn = document.getElementById('navAllGroupsBtn');
    const brandBtn = document.getElementById('brandBtn');
    const apiStatusBadge = document.getElementById('apiStatusBadge');

    // Modals
    const modalGroup = document.getElementById('modalGroup');
    const modalFriend = document.getElementById('modalFriend');
    const modalFriendSchedule = document.getElementById('modalFriendSchedule');
    const modalImport = document.getElementById('modalScreenshotImport');
    const modalCourseSearch = document.getElementById('modalCourseSearch');
    const modalWhosFree = document.getElementById('modalWhosFree');
    const modalCommonFreeTime = document.getElementById('modalCommonFreeTime');

    // Group dropdown menu
    const btnGroupSettings = document.getElementById('btnGroupSettings');
    const groupSettingsMenu = document.getElementById('groupSettingsMenu');

    // Color Swatch Generators
    function renderColorPalette(containerId, colors, selectedHex, radioName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = colors.map((c, i) => {
            const isChecked = (c.hex.toLowerCase() === (selectedHex || '').toLowerCase()) || (i === 0 && !selectedHex);
            return `
                <label class="color-swatch-label ${isChecked ? 'active' : ''}" style="background: ${c.hex}; color: ${c.hex}" title="${c.name}">
                    <input type="radio" name="${radioName}" value="${c.hex}" ${isChecked ? 'checked' : ''}>
                </label>
            `;
        }).join('');

        container.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                container.querySelectorAll('.color-swatch-label').forEach(lbl => lbl.classList.remove('active'));
                radio.closest('.color-swatch-label').classList.add('active');
            });
        });
    }

    // Modal Helpers
    function openModal(modalEl) {
        if (modalEl) modalEl.style.display = 'flex';
    }
    function closeModal(modalEl) {
        if (modalEl) modalEl.style.display = 'none';
    }

    // Close on backdrop click
    [modalGroup, modalFriend, modalFriendSchedule, modalCourseSearch, modalImport, modalWhosFree, modalCommonFreeTime].forEach(m => {
        if (m) {
            m.addEventListener('click', (e) => {
                if (e.target === m) closeModal(m);
            });
        }
    });

    // Close buttons
    document.getElementById('modalGroupClose')?.addEventListener('click', () => closeModal(modalGroup));
    document.getElementById('modalGroupCancel')?.addEventListener('click', () => closeModal(modalGroup));
    document.getElementById('modalFriendClose')?.addEventListener('click', () => closeModal(modalFriend));
    document.getElementById('modalFriendCancel')?.addEventListener('click', () => closeModal(modalFriend));
    document.getElementById('modalFriendScheduleClose')?.addEventListener('click', () => closeModal(modalFriendSchedule));
    document.getElementById('btnDoneFriendSchedule')?.addEventListener('click', () => closeModal(modalFriendSchedule));
    document.getElementById('modalCourseSearchClose')?.addEventListener('click', () => closeModal(modalCourseSearch));
    document.getElementById('modalWhosFreeClose')?.addEventListener('click', () => closeModal(modalWhosFree));
    document.getElementById('modalCommonFreeClose')?.addEventListener('click', () => closeModal(modalCommonFreeTime));

    // Data Source Status Listener
    window.courseDataManager.onStatusChange((status, detail) => {
        if (!apiStatusBadge) return;
        const dot = apiStatusBadge.querySelector('.status-dot');
        const label = apiStatusBadge.querySelector('.status-label');

        if (status === 'loading') {
            dot.className = 'status-dot loading';
            label.textContent = 'Loading course data...';
            document.getElementById('catalogLoadingState')?.setAttribute('style', 'display: flex;');
            document.getElementById('catalogErrorState')?.setAttribute('style', 'display: none;');
        } else if (status === 'ready') {
            dot.className = 'status-dot ready';
            label.textContent = 'Catalog Online';
            apiStatusBadge.title = detail;
            document.getElementById('catalogLoadingState')?.setAttribute('style', 'display: none;');
            document.getElementById('catalogErrorState')?.setAttribute('style', 'display: none;');
            populateDepartmentFilter();
        } else if (status === 'error') {
            dot.className = 'status-dot error';
            label.textContent = 'Data Offline';
            apiStatusBadge.title = detail;
            document.getElementById('catalogLoadingState')?.setAttribute('style', 'display: none;');
            document.getElementById('catalogErrorState')?.setAttribute('style', 'display: block;');
        }
    });

    // Department Filter
    function populateDepartmentFilter() {
        const select = document.getElementById('filterDepartment');
        if (!select) return;
        const depts = Array.from(window.courseDataManager.departments).sort();
        select.innerHTML = '<option value="">All Departments</option>' +
            depts.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    // ----------------------------------------------------
    // NAVIGATION & VIEW SWITCHING
    // ----------------------------------------------------
    // Browser back/forward support (History API)
    let isPopNav = false;
    function pushView(view, id) {
        if (isPopNav) return;
        const hash = view === 'group' ? `#group/${encodeURIComponent(id)}` : '#home';
        if (location.hash === hash) return;
        history.pushState({ view, id }, '', hash);
    }

    function applyRouteFromHash() {
        const m = location.hash.match(/^#group\/(.+)$/);
        if (m) {
            showGroupView(decodeURIComponent(m[1]));
        } else {
            showLandingView();
        }
    }

    window.addEventListener('popstate', () => {
        [modalGroup, modalFriend, modalFriendSchedule, modalCourseSearch, modalImport, modalWhosFree, modalCommonFreeTime].forEach(closeModal);
        isPopNav = true;
        try { applyRouteFromHash(); } finally { isPopNav = false; }
    });

    function showLandingView() {
        pushView('landing');
        viewLanding.style.display = 'block';
        viewGroupDetail.style.display = 'none';
        navGroupBreadcrumb.style.display = 'none';
        navAllGroupsBtn.style.display = 'none';
        activeGroupId = null;
        renderGroupsDashboard();
    }

    function showGroupView(groupId) {
        const group = window.storageManager.getGroup(groupId);
        if (!group) {
            showLandingView();
            return;
        }

        activeGroupId = groupId;
        window.storageManager.setActiveGroup(groupId);
        pushView('group', groupId);

        viewLanding.style.display = 'none';
        viewGroupDetail.style.display = 'block';
        navGroupBreadcrumb.style.display = 'flex';
        navAllGroupsBtn.style.display = 'inline-flex';
        navGroupName.textContent = group.name;

        renderGroupDetailView();
    }

    brandBtn?.addEventListener('click', showLandingView);
    navAllGroupsBtn?.addEventListener('click', showLandingView);

    // ----------------------------------------------------
    // LANDING & DASHBOARD RENDERING
    // ----------------------------------------------------
    function renderGroupsDashboard() {
        const groups = window.storageManager.getAllGroups();
        const grid = document.getElementById('groupsGrid');
        const emptyState = document.getElementById('emptyGroupsState');
        if (!grid) return;

        if (groups.length === 0) {
            grid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        grid.innerHTML = groups.map((g, idx) => {
            const groupNum = `GROUP ${String(idx + 1).padStart(2, '0')}`;
            const friendsCount = (g.friends || []).length;
            const friendsPreview = (g.friends || []).slice(0, 4).map(f => `
                <div class="group-friend-row">
                    <span class="friend-color-dot" style="background:${f.color}; color:${f.color}"></span>
                    <span>${f.name}</span>
                </div>
            `).join('');

            const moreCount = friendsCount > 4 ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">+ ${friendsCount - 4} more</div>` : '';

            return `
                <div class="group-card" data-id="${g.id}" style="--group-accent: ${g.accentColor || '#06b6d4'}">
                    <div>
                        <div class="group-card-header">
                            <span class="group-number-badge">${groupNum}</span>
                        </div>
                        <h3 class="group-card-title">${g.name}</h3>
                        <div class="group-friends-preview">
                            <div class="group-friends-list">
                                ${friendsPreview || '<span style="color:var(--text-muted); font-size:0.85rem;">No friends added yet</span>'}
                            </div>
                            ${moreCount}
                        </div>
                    </div>
                    <div class="group-card-footer">
                        <span class="group-friends-count-text">${friendsCount} Friends</span>
                        <button class="btn btn-outline btn-sm open-group-btn" data-id="${g.id}">OPEN GROUP &rarr;</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click listeners to cards
        grid.querySelectorAll('.group-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const id = card.getAttribute('data-id');
                showGroupView(id);
            });
        });
    }

    // ----------------------------------------------------
    // GROUP DETAIL VIEW RENDERING
    // ----------------------------------------------------
    function renderGroupDetailView() {
        const group = window.storageManager.getGroup(activeGroupId);
        if (!group) return;

        // Group Header Info
        const groupHeroName = document.getElementById('groupDetailName');
        const groupCodeTag = document.getElementById('groupCodeTag');
        const groupAccentBar = document.getElementById('groupAccentBar');
        const groupFriendsCount = document.getElementById('groupFriendsCount');
        const groupTotalCoursesCount = document.getElementById('groupTotalCoursesCount');
        const groupSharedClassesCount = document.getElementById('groupSharedClassesCount');

        const allGroups = window.storageManager.getAllGroups();
        const grpIndex = allGroups.findIndex(g => g.id === group.id);
        const groupCode = `GROUP ${String(grpIndex + 1).padStart(2, '0')}`;

        if (groupHeroName) groupHeroName.textContent = group.name;
        if (groupCodeTag) groupCodeTag.textContent = groupCode;
        if (groupAccentBar) {
            groupAccentBar.style.background = group.accentColor;
            groupAccentBar.style.boxShadow = `0 0 12px ${group.accentColor}`;
        }

        const totalCourses = (group.friends || []).reduce((acc, f) => acc + (f.courses || []).length, 0);
        if (groupFriendsCount) groupFriendsCount.textContent = `${(group.friends || []).length} Friends`;
        if (groupTotalCoursesCount) groupTotalCoursesCount.textContent = `${totalCourses} Enrolled Courses`;

        // Render Friends Cards Strip
        renderFriendsStrip(group);

        // Render Routine Matrix
        window.routineRenderer.render(group);

        // Render Exam Schedule
        window.examScheduleManager.render(group);

        // Update Who's Free & Common Free Time state
        window.whosFreeManager.setGroup(group);
    }

    function renderFriendsStrip(group) {
        const track = document.getElementById('friendsCardsTrack');
        if (!track) return;

        const friends = group.friends || [];
        if (friends.length === 0) {
            track.innerHTML = `
                <div style="color:var(--text-muted); font-size:0.88rem; padding: 10px 0;">
                    No friends added yet. Click <strong>+ Add Friend</strong> to start planning your routine together!
                </div>
            `;
            return;
        }

        track.innerHTML = friends.map(f => {
            const initial = (f.name || 'F').charAt(0).toUpperCase();
            const courseCount = (f.courses || []).length;
            const credits = (f.courses || []).reduce((acc, c) => acc + (c.courseCredit || 0), 0);
            const isVisible = f.visibleInRoutine !== false;

            // Preview of enrolled course codes
            const courseChips = (f.courses || []).slice(0, 3).map(c =>
                `<span class="friend-course-chip" style="border-color:${f.color}33; color:${f.color}">${c.courseCode}</span>`
            ).join('');
            const moreCourses = courseCount > 3 ? `<span class="friend-course-chip" style="color:var(--text-muted)">+${courseCount - 3}</span>` : '';

            return `
                <div class="friend-expanded-card ${!isVisible ? 'disabled' : ''}" data-id="${f.id}" style="--friend-color: ${f.color}">
                    <div class="fec-top-row">
                        <div class="friend-avatar-circle" style="background:${f.color}; color:#000; flex-shrink:0;">${initial}</div>
                        <div class="fec-name-col">
                            <span class="friend-card-name">${f.name}${f.nickname ? ` <span class="fec-nick">"${f.nickname}"</span>` : ''}</span>
                            <span class="friend-card-sub">${courseCount} course${courseCount !== 1 ? 's' : ''} &bull; ${credits} cr</span>
                        </div>
                        <label class="fec-toggle-label" title="Show/hide in routine">
                            <input type="checkbox" class="friend-toggle-cb" data-id="${f.id}" ${isVisible ? 'checked' : ''}>
                            <span class="fec-toggle-text">${isVisible ? 'Shown' : 'Hidden'}</span>
                        </label>
                    </div>
                    <div class="fec-courses-row">
                        ${courseCount === 0
                            ? `<span class="fec-no-courses">No courses added yet</span>`
                            : courseChips + moreCourses
                        }
                    </div>
                    <div class="fec-action-row">
                        <button class="btn btn-primary btn-sm fec-add-course-btn" data-id="${f.id}">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add Course
                        </button>
                        <button class="btn btn-secondary btn-sm fec-manage-btn" data-id="${f.id}">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Manage
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // "Add Course" button -> open friend schedule modal then immediately open course search
        track.querySelectorAll('.fec-add-course-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fId = btn.getAttribute('data-id');
                activeFriendId = fId;
                openFriendScheduleModal(fId);
                setTimeout(() => {
                    document.getElementById('btnOpenCourseSearch')?.click();
                }, 120);
            });
        });

        // "Manage" button -> open friend schedule modal (enrolled list view)
        track.querySelectorAll('.fec-manage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fId = btn.getAttribute('data-id');
                openFriendScheduleModal(fId);
            });
        });

        // Whole card click (not on buttons/label) -> open schedule modal
        track.querySelectorAll('.friend-expanded-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.fec-add-course-btn') || e.target.closest('.fec-manage-btn') || e.target.closest('label')) return;
                const fId = card.getAttribute('data-id');
                openFriendScheduleModal(fId);
            });
        });

        // Visibility checkbox toggle
        track.querySelectorAll('.friend-toggle-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const fId = cb.getAttribute('data-id');
                window.storageManager.toggleFriendVisibility(activeGroupId, fId, cb.checked);
                renderGroupDetailView();
            });
        });
    }

    // ----------------------------------------------------
    // FRIEND SCHEDULE MANAGER MODAL
    // ----------------------------------------------------
    function openFriendScheduleModal(friendId) {
        activeFriendId = friendId;
        const group = window.storageManager.getGroup(activeGroupId);
        if (!group) return;
        const friend = group.friends.find(f => f.id === friendId);
        if (!friend) return;

        const avatar = document.getElementById('friendProfileAvatar');
        const nameEl = document.getElementById('friendProfileName');
        const nickEl = document.getElementById('friendProfileNick');
        const creditsBadge = document.getElementById('friendCreditsBadge');
        const countBadge = document.getElementById('friendCoursesCountBadge');
        const conflictAlert = document.getElementById('friendConflictAlert');

        if (avatar) {
            avatar.textContent = (friend.name || 'F').charAt(0).toUpperCase();
            avatar.style.background = friend.color;
            avatar.style.color = '#000000';
            avatar.style.boxShadow = `0 0 15px ${friend.color}`;
        }
        if (nameEl) nameEl.textContent = friend.name;
        if (nickEl) nickEl.textContent = friend.nickname ? `(${friend.nickname})` : '';

        const totalCredits = (friend.courses || []).reduce((acc, c) => acc + (c.courseCredit || 0), 0);
        if (creditsBadge) creditsBadge.textContent = `${totalCredits} Credits`;
        if (countBadge) countBadge.textContent = `${(friend.courses || []).length} Courses`;
        if (conflictAlert) conflictAlert.style.display = 'none';

        renderFriendEnrolledList(friend);
        openModal(modalFriendSchedule);
    }

    function renderFriendEnrolledList(friend) {
        const list = document.getElementById('friendEnrolledList');
        const emptyState = document.getElementById('emptyEnrolledState');
        if (!list) return;

        const courses = friend.courses || [];
        if (courses.length === 0) {
            list.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        list.innerHTML = courses.map(c => {
            const timingSummary = (c.sessions || []).map(s => `${s.day} ${s.startTime}`).join(', ') || 'Timing TBA';
            const roomSummary = c.roomName || 'TBA';

            return `
                <div class="enrolled-course-item">
                    <div class="enrolled-item-main">
                        <div class="enrolled-item-top">
                            <span class="enrolled-code">${c.courseCode}</span>
                            <span class="enrolled-sec">Sec ${c.sectionName}</span>
                            <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${c.courseCredit} Cr</span>
                        </div>
                        <div class="enrolled-title">${c.courseName}</div>
                        <div class="enrolled-item-meta">
                            <span>📅 ${timingSummary}</span>
                            <span>🏛️ ${roomSummary}</span>
                            <span>👤 ${c.faculties || 'TBA'}</span>
                        </div>
                    </div>
                    <button class="btn btn-ghost btn-sm text-danger remove-course-btn" data-id="${c.id || c.courseCode}" title="Drop this course">
                        &times; Drop
                    </button>
                </div>
            `;
        }).join('');

        // Remove Course listeners
        list.querySelectorAll('.remove-course-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cId = btn.getAttribute('data-id');
                window.storageManager.removeCourseFromFriend(activeGroupId, activeFriendId, cId);
                const updatedGroup = window.storageManager.getGroup(activeGroupId);
                const updatedFriend = updatedGroup.friends.find(f => f.id === activeFriendId);
                openFriendScheduleModal(activeFriendId);
                renderGroupDetailView();
            });
        });
    }

    // Delete Friend
    document.getElementById('btnDeleteFriend')?.addEventListener('click', () => {
        if (confirm("Are you sure you want to remove this friend from the group?")) {
            window.storageManager.deleteFriend(activeGroupId, activeFriendId);
            closeModal(modalFriendSchedule);
            renderGroupDetailView();
        }
    });

    // ----------------------------------------------------
    // COURSE SEARCH & ADD MODAL
    // ----------------------------------------------------
    document.getElementById('btnOpenCourseSearch')?.addEventListener('click', () => {
        openModal(modalCourseSearch);
        document.getElementById('courseSearchInput').value = '';
        document.getElementById('filterDepartment').value = '';
        document.getElementById('filterDay').value = '';
        executeCourseSearch();
        resetCoursePreview();
    });

    const searchInput = document.getElementById('courseSearchInput');
    const filterDept = document.getElementById('filterDepartment');
    const filterDay = document.getElementById('filterDay');
    const btnClearSearch = document.getElementById('btnClearSearch');

    searchInput?.addEventListener('input', () => {
        if (btnClearSearch) btnClearSearch.style.display = searchInput.value ? 'block' : 'none';
        executeCourseSearch();
    });

    btnClearSearch?.addEventListener('click', () => {
        searchInput.value = '';
        btnClearSearch.style.display = 'none';
        executeCourseSearch();
    });

    filterDept?.addEventListener('change', executeCourseSearch);
    filterDay?.addEventListener('change', executeCourseSearch);

    function executeCourseSearch() {
        const q = searchInput?.value || '';
        const dept = filterDept?.value || '';
        const day = filterDay?.value || '';

        const results = window.courseDataManager.searchCourses(q, dept, day);
        renderCourseSearchResults(results.slice(0, 150)); // limit list to 150 for peak performance
    }

    function renderCourseSearchResults(courses) {
        const list = document.getElementById('courseResultsList');
        const countEl = document.getElementById('courseResultsCount');
        const emptyState = document.getElementById('catalogEmptyState');
        if (!list) return;

        if (countEl) countEl.textContent = `Found ${courses.length} sections`;

        if (courses.length === 0) {
            list.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Check clashes against active friend's current courses
        const group = window.storageManager.getGroup(activeGroupId);
        const friend = group ? group.friends.find(f => f.id === activeFriendId) : null;
        const enrolled = friend ? (friend.courses || []) : [];

        list.innerHTML = courses.map(c => {
            const conflict = window.courseDataManager.checkConflict(c, enrolled);
            const hasClash = conflict.hasClash;
            const clashBadge = hasClash ? `<span class="csc-clash-pill">CLASH: ${conflict.type === 'duplicate' ? 'Already Added' : 'Time Conflict'}</span>` : '';
            const timingBrief = (c.sessions || []).map(s => `${s.day.slice(0, 3)} ${s.startTime}`).join(', ');

            return `
                <div class="course-search-card ${hasClash ? 'has-clash' : ''}" data-id="${c.id}">
                    <div class="csc-header">
                        <span class="csc-code">${c.courseCode}</span>
                        <div>
                            ${clashBadge}
                            <span class="csc-sec">Sec ${c.sectionName}</span>
                        </div>
                    </div>
                    <div class="csc-title">${c.courseName}</div>
                    <div class="csc-meta">
                        <span>👤 ${c.faculties || 'TBA'}</span>
                        <span>⏰ ${timingBrief || 'Schedule TBA'}</span>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.course-search-card').forEach(card => {
            card.addEventListener('click', () => {
                list.querySelectorAll('.course-search-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const id = card.getAttribute('data-id');
                const course = window.courseDataManager.normalizedCourses.find(c => String(c.id) === String(id));
                if (course) showCoursePreview(course);
            });
        });
    }

    function resetCoursePreview() {
        selectedSearchCourse = null;
        const emptyState = document.getElementById('previewEmptyState');
        const previewCard = document.getElementById('previewCard');
        if (emptyState) emptyState.style.display = 'block';
        if (previewCard) previewCard.style.display = 'none';
    }

    function showCoursePreview(course) {
        selectedSearchCourse = course;
        const emptyState = document.getElementById('previewEmptyState');
        const previewCard = document.getElementById('previewCard');
        if (emptyState) emptyState.style.display = 'none';
        if (previewCard) previewCard.style.display = 'flex';

        // Basic info
        document.getElementById('prevCode').textContent = course.courseCode;
        document.getElementById('prevSection').textContent = `Sec ${course.sectionName}`;
        document.getElementById('prevCredit').textContent = `${course.courseCredit} Cr`;
        document.getElementById('prevTitle').textContent = course.courseName;
        document.getElementById('prevFaculty').textContent = course.faculties || 'TBA';
        document.getElementById('prevRoom').textContent = course.roomName || 'TBA';

        const remainingSeats = Math.max(0, course.capacity - course.consumedSeat);
        document.getElementById('prevSeats').textContent = `${course.consumedSeat} / ${course.capacity} (${remainingSeats} left)`;

        // Class timings list
        const classList = document.getElementById('prevClassScheduleList');
        const labBlock = document.getElementById('prevLabScheduleBlock');
        const labList = document.getElementById('prevLabScheduleList');

        const theorySessions = (course.sessions || []).filter(s => !s.isLab);
        const labSessions = (course.sessions || []).filter(s => s.isLab);

        if (classList) {
            if (theorySessions.length === 0) {
                classList.innerHTML = '<div style="color:var(--text-muted); font-size:0.75rem;">No theory schedule listed.</div>';
            } else {
                classList.innerHTML = theorySessions.map(s => `
                    <div class="schedule-pill">
                        <strong>${s.day}</strong>
                        <span>${s.startTime} – ${s.endTime}</span>
                        <span style="color:var(--text-muted);">${s.room}</span>
                    </div>
                `).join('');
            }
        }

        if (labBlock && labList) {
            if (labSessions.length > 0) {
                labBlock.style.display = 'block';
                labList.innerHTML = labSessions.map(s => `
                    <div class="schedule-pill">
                        <strong>${s.day} (LAB)</strong>
                        <span>${s.startTime} – ${s.endTime}</span>
                        <span style="color:var(--text-muted);">${s.room}</span>
                    </div>
                `).join('');
            } else {
                labBlock.style.display = 'none';
            }
        }

        // Exam details
        const examDetails = document.getElementById('prevExamDetails');
        if (examDetails) {
            const midText = course.midExamDate ? 
                `Midterm: ${course.midExamDate} (${course.midExamStartTime || ''}–${course.midExamEndTime || ''})` : 'Midterm: N/A';
            const finalText = course.finalExamDate ? 
                `Final: ${course.finalExamDate} (${course.finalExamStartTime || ''}–${course.finalExamEndTime || ''})` : 'Final: N/A';
            examDetails.innerHTML = `<div>📅 ${midText}</div><div>📅 ${finalText}</div>`;
        }

        // Conflict check
        const group = window.storageManager.getGroup(activeGroupId);
        const friend = group ? group.friends.find(f => f.id === activeFriendId) : null;
        const enrolled = friend ? (friend.courses || []) : [];
        const conflict = window.courseDataManager.checkConflict(course, enrolled);

        const conflictBanner = document.getElementById('prevConflictBanner');
        const conflictText = document.getElementById('prevConflictText');
        const addBtn = document.getElementById('btnAddSectionToFriend');

        if (conflict.hasClash) {
            if (conflictBanner) conflictBanner.style.display = 'flex';
            if (conflictText) conflictText.textContent = conflict.reason;
            if (addBtn) {
                addBtn.disabled = true;
                addBtn.classList.remove('btn-primary');
                addBtn.classList.add('btn-secondary');
                addBtn.textContent = 'Conflict Detected — Cannot Add';
            }
        } else {
            if (conflictBanner) conflictBanner.style.display = 'none';
            if (addBtn) {
                addBtn.disabled = false;
                addBtn.classList.remove('btn-secondary');
                addBtn.classList.add('btn-primary');
                addBtn.textContent = 'Add to Schedule';
            }
        }
    }

    // Add Section button handler
    document.getElementById('btnAddSectionToFriend')?.addEventListener('click', () => {
        if (!selectedSearchCourse || !activeGroupId || !activeFriendId) return;

        const res = window.storageManager.addCourseToFriend(activeGroupId, activeFriendId, selectedSearchCourse);
        if (res && res.error) {
            alert("This course is already added to this friend's routine.");
            return;
        }

        // Close search modal, refresh friend schedule modal & group routine
        closeModal(modalCourseSearch);
        openFriendScheduleModal(activeFriendId);
        renderGroupDetailView();
    });

    // ----------------------------------------------------
    // IMPORT COURSES FROM A SCREENSHOT
    // ----------------------------------------------------
    const importInput = document.getElementById('importScreenshotInput');
    const importBtn = document.getElementById('btnImportScreenshot');
    const importStatus = document.getElementById('importOcrStatus');
    const importConfirmBtn = document.getElementById('btnImportConfirm');
    let importItems = []; // [{ course, conflict, checked }]

    function setImportStatus(text) {
        if (!importStatus) return;
        importStatus.textContent = text || '';
        importStatus.style.display = text ? 'block' : 'none';
    }

    function updateImportConfirmButton() {
        const count = importItems.filter(it => it.checked).length;
        if (!importConfirmBtn) return;
        importConfirmBtn.disabled = count === 0;
        importConfirmBtn.textContent = count > 0 ? `Add ${count} selected` : 'Add selected';
    }

    function showImportReview(matched, unmatched) {
        const group = window.storageManager.getGroup(activeGroupId);
        const friend = group ? group.friends.find(f => f.id === activeFriendId) : null;
        const enrolled = friend ? (friend.courses || []) : [];

        importItems = matched.map(m => {
            const conflict = window.courseDataManager.checkConflict(m.course, enrolled);
            return { course: m.course, conflict, checked: !conflict.hasClash };
        });

        const listEl = document.getElementById('importFoundList');
        const missingEl = document.getElementById('importMissing');
        const subtitleEl = document.getElementById('importSubtitle');

        if (subtitleEl) {
            subtitleEl.textContent = `Found ${importItems.length} course${importItems.length === 1 ? '' : 's'} in the screenshot for ${friend ? friend.name : 'this friend'}.`;
        }

        if (listEl) {
            listEl.innerHTML = importItems.length === 0
                ? '<p class="import-empty">No matching sections were found in the course catalog.</p>'
                : importItems.map((it, i) => {
                    const c = it.course;
                    const clash = it.conflict.hasClash;
                    const clashBadge = clash
                        ? `<span class="csc-clash-pill">${it.conflict.type === 'duplicate' ? 'Already Added' : 'Clash'}</span>`
                        : '';
                    const timing = (c.sessions || []).map(s => `${s.day.slice(0, 3)} ${s.startTime}`).join(', ');
                    return `
                        <label class="import-row ${clash ? 'has-clash' : ''}">
                            <input type="checkbox" data-index="${i}" ${it.checked ? 'checked' : ''}>
                            <div class="import-row-main">
                                <div class="import-row-top">
                                    <strong>${c.courseCode}</strong>
                                    <span class="csc-sec">Sec ${c.sectionName}</span>
                                    ${clashBadge}
                                </div>
                                <div class="import-row-sub">${c.courseName} • ${c.faculties || 'TBA'}</div>
                                <div class="import-row-time">${timing || 'Schedule TBA'}</div>
                            </div>
                        </label>
                    `;
                }).join('');
        }

        if (missingEl) {
            if (unmatched.length > 0) {
                missingEl.style.display = 'block';
                missingEl.textContent = 'Not found in the catalog (add manually if needed): ' +
                    unmatched.map(e => `${e.code}${e.suffix || ''} Sec ${String(e.section).padStart(2, '0')}`).join(', ');
            } else {
                missingEl.style.display = 'none';
                missingEl.textContent = '';
            }
        }

        updateImportConfirmButton();
        openModal(modalImport);
    }

    importBtn?.addEventListener('click', () => importInput?.click());

    importInput?.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file || !activeGroupId || !activeFriendId) return;

        const catalog = window.courseDataManager.normalizedCourses || [];
        if (catalog.length === 0) {
            alert('The course catalog has not loaded yet. Wait for it to finish loading (top right) and try again.');
            return;
        }

        if (importBtn) importBtn.disabled = true;
        setImportStatus('Preparing file…');

        try {
            const entries = await window.screenshotImporter.readEntries(file, (label, progress) => {
                setImportStatus(`${label} ${Math.round((progress || 0) * 100)}%`);
            });

            if (entries.length === 0) {
                alert('No course codes were found in that file. Try a sharper screenshot or PDF that shows the full routine table (like "CSE470 -01 -...").');
                return;
            }

            const { matched, unmatched } = window.screenshotImporter.matchCatalog(entries, catalog);
            showImportReview(matched, unmatched);
        } catch (err) {
            console.error('Screenshot import failed:', err);
            alert(`Could not read the screenshot: ${err.message || err}`);
        } finally {
            setImportStatus('');
            if (importBtn) importBtn.disabled = false;
        }
    });

    document.getElementById('importFoundList')?.addEventListener('change', (e) => {
        const cb = e.target.closest('input[type="checkbox"]');
        if (!cb) return;
        const item = importItems[parseInt(cb.dataset.index, 10)];
        if (item) item.checked = cb.checked;
        updateImportConfirmButton();
    });

    document.getElementById('modalImportClose')?.addEventListener('click', () => closeModal(modalImport));
    document.getElementById('btnImportCancel')?.addEventListener('click', () => closeModal(modalImport));

    importConfirmBtn?.addEventListener('click', () => {
        if (!activeGroupId || !activeFriendId) return;
        importItems.forEach(it => {
            if (it.checked) {
                window.storageManager.addCourseToFriend(activeGroupId, activeFriendId, it.course);
            }
        });
        closeModal(modalImport);
        openFriendScheduleModal(activeFriendId);
        renderGroupDetailView();
    });

    // ----------------------------------------------------
    // CREATE / EDIT FRIEND MODAL
    // ----------------------------------------------------
    document.getElementById('btnAddFriendBtn')?.addEventListener('click', () => {
        const group = window.storageManager.getGroup(activeGroupId);
        if (!group) return;

        // Friend colours must never match the group's accent colour
        const groupColor = (group.accentColor || '').toLowerCase();
        const availableColors = FRIEND_COLORS.filter(c => c.hex.toLowerCase() !== groupColor);

        // Find unused color from the remaining palette if possible
        const usedColors = (group.friends || []).map(f => f.color.toLowerCase());
        const unusedColor = availableColors.find(c => !usedColors.includes(c.hex.toLowerCase())) || availableColors[0];

        document.getElementById('modalFriendTitle').textContent = '+ Add Friend';
        document.getElementById('friendNameInput').value = '';
        document.getElementById('friendNicknameInput').value = '';
        renderColorPalette('friendColorPalette', availableColors, unusedColor.hex, 'friendColor');

        openModal(modalFriend);
    });

    document.getElementById('modalFriendSubmit')?.addEventListener('click', () => {
        const nameInput = document.getElementById('friendNameInput');
        const nickInput = document.getElementById('friendNicknameInput');
        const colorRadio = document.querySelector('input[name="friendColor"]:checked');

        const name = (nameInput?.value || '').trim();
        if (!name) {
            alert('Please enter a friend name.');
            nameInput?.focus();
            return;
        }

        const color = colorRadio ? colorRadio.value : '#06b6d4';
        const nickname = (nickInput?.value || '').trim();

        window.storageManager.addFriend(activeGroupId, { name, nickname, color });
        closeModal(modalFriend);
        renderGroupDetailView();
    });

    // ----------------------------------------------------
    // CREATE / EDIT GROUP MODAL
    // ----------------------------------------------------
    function openCreateGroupModal() {
        editingGroupId = null;
        document.getElementById('modalGroupTitle').textContent = 'Create Friend Group';
        document.getElementById('groupNameInput').value = '';
        renderColorPalette('groupColorPalette', GROUP_COLORS, GROUP_COLORS[0].hex, 'groupAccentColor');
        openModal(modalGroup);
    }

    function openEditGroupModal() {
        const group = window.storageManager.getGroup(activeGroupId);
        if (!group) return;
        editingGroupId = group.id;
        document.getElementById('modalGroupTitle').textContent = 'Edit Friend Group';
        document.getElementById('groupNameInput').value = group.name;
        renderColorPalette('groupColorPalette', GROUP_COLORS, group.accentColor, 'groupAccentColor');
        openModal(modalGroup);
    }

    document.getElementById('btnCreateGroup')?.addEventListener('click', openCreateGroupModal);
    document.getElementById('btnHeroCreateGroup')?.addEventListener('click', openCreateGroupModal);
    document.getElementById('btnEmptyCreate')?.addEventListener('click', openCreateGroupModal);

    document.getElementById('modalGroupSubmit')?.addEventListener('click', () => {
        const nameInput = document.getElementById('groupNameInput');
        const colorRadio = document.querySelector('input[name="groupAccentColor"]:checked');
        const name = (nameInput?.value || '').trim();
        if (!name) {
            alert('Please enter a group name.');
            nameInput?.focus();
            return;
        }
        const color = colorRadio ? colorRadio.value : '#06b6d4';

        if (editingGroupId) {
            window.storageManager.updateGroup(editingGroupId, { name, accentColor: color });
            closeModal(modalGroup);
            renderGroupDetailView();
        } else {
            const newGroup = window.storageManager.createGroup(name, color);
            closeModal(modalGroup);
            showGroupView(newGroup.id);
        }
    });

    // Load Demo Group buttons
    function handleLoadDemoGroup() {
        const catalog = window.courseDataManager.normalizedCourses;
        const demoGroup = window.storageManager.loadSampleGroup(catalog);
        showGroupView(demoGroup.id);
    }

    document.getElementById('btnHeroDemoGroup')?.addEventListener('click', handleLoadDemoGroup);
    document.getElementById('btnEmptyDemo')?.addEventListener('click', handleLoadDemoGroup);

    // Group Settings Dropdown
    btnGroupSettings?.addEventListener('click', (e) => {
        e.stopPropagation();
        groupSettingsMenu.style.display = groupSettingsMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
        if (groupSettingsMenu) groupSettingsMenu.style.display = 'none';
    });

    document.getElementById('btnEditGroupInfo')?.addEventListener('click', () => {
        openEditGroupModal();
    });

    document.getElementById('btnDeleteCurrentGroup')?.addEventListener('click', () => {
        const group = window.storageManager.getGroup(activeGroupId);
        if (!group) return;
        if (confirm(`Are you sure you want to delete "${group.name}"? This cannot be undone.`)) {
            window.storageManager.deleteGroup(activeGroupId);
            showLandingView();
        }
    });

    document.getElementById('btnExportGroupData')?.addEventListener('click', () => {
        const group = window.storageManager.getGroup(activeGroupId);
        if (!group) return;
        const json = JSON.stringify(group, null, 2);
        downloadFile(`${group.name.replace(/\s+/g, '_')}_routine.json`, json, 'application/json');
    });

    // ----------------------------------------------------
    // WHO'S FREE MODAL HANDLERS
    // ----------------------------------------------------
    document.getElementById('btnWhoIsFree')?.addEventListener('click', () => {
        openModal(modalWhosFree);
        window.whosFreeManager.renderWhosFree();
    });

    document.getElementById('whosFreeDaySelect')?.addEventListener('change', () => {
        window.whosFreeManager.renderWhosFree();
    });

    document.getElementById('whosFreeTimeSelect')?.addEventListener('change', () => {
        window.whosFreeManager.renderWhosFree();
    });

    // ----------------------------------------------------
    // COMMON FREE TIME MODAL HANDLERS
    // ----------------------------------------------------
    document.getElementById('btnCommonFreeTime')?.addEventListener('click', () => {
        openModal(modalCommonFreeTime);
        window.whosFreeManager.renderCommonFreeTime();
        attachCftCheckboxListeners();
    });

    function attachCftCheckboxListeners() {
        document.querySelectorAll('.cft-friend-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                const fId = cb.getAttribute('data-id');
                if (cb.checked) {
                    window.whosFreeManager.cftSelectedFriendIds.add(fId);
                } else {
                    window.whosFreeManager.cftSelectedFriendIds.delete(fId);
                }
                window.whosFreeManager.renderCommonFreeTime();
                attachCftCheckboxListeners();
            });
        });
    }

    document.querySelectorAll('.cft-day-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.cft-day-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            window.whosFreeManager.cftSelectedDay = chip.getAttribute('data-day');
            window.whosFreeManager.renderCommonFreeTime();
            attachCftCheckboxListeners();
        });
    });

    // ----------------------------------------------------
    // EXPORT ROUTINE AS IMAGE (html2canvas)
    // ----------------------------------------------------
    // Captures one part of the page as a PNG.
    //  - buttonId: the export button that was clicked
    //  - targetEl: element to capture
    //  - hideEls:  elements to hide while capturing (e.g. exams for the routine image)
    //  - suffix:   file name ending
    async function exportAsImage({ buttonId, targetEl, hideEls = [], suffix, padding = '' }) {
        if (!targetEl) return;

        const btn = document.getElementById(buttonId);
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>Exporting...</span>';
        btn.disabled = true;

        const prev = {
            bg: targetEl.style.backgroundColor,
            padding: targetEl.style.padding,
            hidden: hideEls.map(el => el.style.display)
        };

        try {
            if (typeof html2canvas === 'undefined') {
                alert("Image export library is unavailable. You can use your browser's Print (Ctrl+P) to save as PDF.");
                window.print();
                return;
            }

            // Temporarily tweak the page for a clean snapshot
            targetEl.style.backgroundColor = '#0a0e17';
            if (padding) targetEl.style.padding = padding;
            hideEls.forEach(el => { el.style.display = 'none'; });

            const canvas = await html2canvas(targetEl, {
                backgroundColor: '#0a0e17',
                scale: 2, // High resolution
                logging: false,
                useCORS: true
            });

            const group = window.storageManager.getGroup(activeGroupId);
            const groupSlug = (group ? group.name : 'friends_forever').toLowerCase().replace(/\s+/g, '_');

            const link = document.createElement('a');
            link.download = `${groupSlug}_${suffix}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            link.remove();
        } catch (err) {
            console.error("Snapshot export failed:", err);
            alert("Could not export image. Please try again.");
        } finally {
            targetEl.style.backgroundColor = prev.bg;
            targetEl.style.padding = prev.padding;
            hideEls.forEach((el, i) => { el.style.display = prev.hidden[i]; });
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // Routine image: weekly table only (exam schedule is left out)
    document.getElementById('btnDownloadRoutine')?.addEventListener('click', () => {
        const area = document.getElementById('routineExportArea');
        const examSection = area?.querySelector('.exam-schedule-section');
        exportAsImage({
            buttonId: 'btnDownloadRoutine',
            targetEl: area,
            hideEls: examSection ? [examSection] : [],
            suffix: 'routine'
        });
    });

    // Exam image: exam schedule only
    document.getElementById('btnDownloadExams')?.addEventListener('click', () => {
        exportAsImage({
            buttonId: 'btnDownloadExams',
            targetEl: document.querySelector('#routineExportArea .exam-schedule-section'),
            suffix: 'exams',
            padding: '24px'
        });
    });

    function downloadFile(filename, content, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }

    // ----------------------------------------------------
    // APP INITIALIZATION
    // ----------------------------------------------------
    // 1. Initial view render
    const allGroups = window.storageManager.getAllGroups();
    if (allGroups.length > 0) {
        renderGroupsDashboard();
    } else {
        // Pre-create sample group so the user has immediate data to explore
        window.storageManager.loadSampleGroup();
        renderGroupsDashboard();
    }

    // 1b. Restore the view from the URL (e.g. after refresh)
    if (/^#group\//.test(location.hash)) {
        isPopNav = true;
        try { applyRouteFromHash(); } finally { isPopNav = false; }
    }

    // 2. Fetch live data from USIS API
    await window.courseDataManager.init();

    // 3. If sample group was created before catalog arrived, enrich with realistic course data
    const activeGroup = window.storageManager.getActiveGroup();
    if (activeGroup && (activeGroup.friends || []).every(f => (f.courses || []).length === 0)) {
        window.storageManager.populateRealisticCourses(activeGroup, window.courseDataManager.normalizedCourses);
        window.storageManager.saveGroups();
        if (activeGroupId === activeGroup.id) {
            renderGroupDetailView();
        }
    }
});