/**
 * FRIENDS FOREVER — Data Source & Course Schedule Utilities
 * Primary JSON API: https://usis-cdn.eniamza.com/connect-migrate.json
 */

const DATA_SOURCE_URL = 'https://usis-cdn.eniamza.com/connect-migrate.json';
const CACHE_KEY = 'friends_forever_courses_cache';
const CACHE_META_KEY = 'friends_forever_courses_meta';

// Standard 7 University Time Slots
const STANDARD_TIME_SLOTS = [
    { id: 1, label: "08:00 AM-09:20 AM", start: "08:00 AM", end: "09:20 AM" },
    { id: 2, label: "09:30 AM-10:50 AM", start: "09:30 AM", end: "10:50 AM" },
    { id: 3, label: "11:00 AM-12:20 PM", start: "11:00 AM", end: "12:20 PM" },
    { id: 4, label: "12:30 PM-01:50 PM", start: "12:30 PM", end: "01:50 PM" },
    { id: 5, label: "02:00 PM-03:20 PM", start: "02:00 PM", end: "03:20 PM" },
    { id: 6, label: "03:30 PM-04:50 PM", start: "03:30 PM", end: "04:50 PM" },
    { id: 7, label: "05:00 PM-06:20 PM", start: "05:00 PM", end: "06:20 PM" }
];

const WEEK_DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
];

// Color palette for friends
const FRIEND_COLORS = [
    { name: "Cyan", hex: "#06b6d4" },
    { name: "Purple", hex: "#a855f7" },
    { name: "Pink", hex: "#ec4899" },
    { name: "Orange", hex: "#f97316" },
    { name: "Green", hex: "#10b981" },
    { name: "Yellow", hex: "#facc15" },
    { name: "Blue", hex: "#3b82f6" },
    { name: "Red", hex: "#ef4444" },
    { name: "Lime", hex: "#84cc16" },
    { name: "Violet", hex: "#8b5cf6" },
    { name: "Emerald", hex: "#059669" },
    { name: "Amber", hex: "#d97706" }
];

// Group accent colors
const GROUP_COLORS = [
    { name: "Cyan", hex: "#06b6d4" },
    { name: "Purple", hex: "#a855f7" },
    { name: "Orange", hex: "#f97316" },
    { name: "Green", hex: "#10b981" },
    { name: "Pink", hex: "#ec4899" },
    { name: "Blue", hex: "#3b82f6" }
];

class CourseDataManager {
    constructor() {
        this.rawCourses = [];
        this.normalizedCourses = [];
        this.departments = new Set();
        this.lastUpdated = null;
        this.status = 'idle'; // idle | loading | ready | error
        this.listeners = [];
    }

    onStatusChange(fn) {
        this.listeners.push(fn);
    }

    notifyStatus(status, detail) {
        this.status = status;
        this.listeners.forEach(fn => fn(status, detail));
    }

    // Convert "02:00 PM" -> minutes from midnight
    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const cleaned = timeStr.trim();
        const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return 0;
        let [_, h, m, mer] = match;
        let hours = parseInt(h, 10);
        let minutes = parseInt(m, 10);
        mer = mer.toUpperCase();
        if (mer === 'PM' && hours !== 12) hours += 12;
        if (mer === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }

    // Convert 24-hour "14:00:00" -> "02:00 PM"
    formatTime12(time24) {
        if (!time24) return '';
        let parts = time24.split(':');
        let hour = parseInt(parts[0], 10);
        let min = parts[1] || '00';
        let meridian = hour >= 12 ? 'PM' : 'AM';
        if (hour > 12) hour -= 12;
        else if (hour === 0) hour = 12;
        return `${hour.toString().padStart(2, '0')}:${min} ${meridian}`;
    }

    // "2026-07-25" -> "SATURDAY"
    getWeekdayName(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    }

    // "2026-07-25" -> "25-07-2026"
    formatDateDMY(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
    }

    // Normalizes schedule string: "Sunday(09:30 AM-10:50 AM-UB0901)"
    parseScheduleEntry(str, defaultRoom = '') {
        const re = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\((\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))(?:-([^\)]+))?\)/i;
        const match = str.match(re);
        if (!match) return null;

        const dayRaw = match[1];
        const day = dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1).toLowerCase();
        const startStr = match[2].trim().toUpperCase();
        const endStr = match[3].trim().toUpperCase();
        const room = (match[4] ? match[4].trim() : defaultRoom) || 'TBA';
        const isLab = str.includes('-L)') || str.toLowerCase().includes('lab');

        return {
            day,
            startTime: startStr,
            endTime: endStr,
            startMinutes: this.timeToMinutes(startStr),
            endMinutes: this.timeToMinutes(endStr),
            room,
            isLab,
            raw: str
        };
    }

    // Extract all sessions (theory + lab) for a raw course object
    extractSessions(item) {
        const sessions = [];
        const defaultRoom = item.roomName || 'TBA';
        const defaultLabRoom = item.labRoomName || defaultRoom;

        const scheduleRe = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\(\d{1,2}:\d{2}\s*(?:AM|PM)-\d{1,2}:\d{2}\s*(?:AM|PM)(?:-[^\)]+)?\)/gi;

        // Parse preRegSchedule
        if (item.preRegSchedule) {
            const matches = item.preRegSchedule.match(scheduleRe) || [];
            matches.forEach(m => {
                const parsed = this.parseScheduleEntry(m, defaultRoom);
                if (parsed) sessions.push(parsed);
            });
        }

        // Parse preRegLabSchedule
        if (item.preRegLabSchedule) {
            const matches = item.preRegLabSchedule.match(scheduleRe) || [];
            matches.forEach(m => {
                const parsed = this.parseScheduleEntry(m, defaultLabRoom);
                if (parsed) {
                    parsed.isLab = true;
                    sessions.push(parsed);
                }
            });
        }

        // Also check labSchedules structured array if present
        if (item.labSchedules && Array.isArray(item.labSchedules)) {
            item.labSchedules.forEach(lab => {
                if (lab.day && lab.startTime && lab.endTime) {
                    const day = lab.day.charAt(0).toUpperCase() + lab.day.slice(1).toLowerCase();
                    const start12 = this.formatTime12(lab.startTime);
                    const end12 = this.formatTime12(lab.endTime);
                    const alreadyHas = sessions.some(s => s.day === day && s.startTime === start12);
                    if (!alreadyHas) {
                        sessions.push({
                            day,
                            startTime: start12,
                            endTime: end12,
                            startMinutes: this.timeToMinutes(start12),
                            endMinutes: this.timeToMinutes(end12),
                            room: item.labRoomName || lab.roomName || defaultRoom,
                            isLab: true,
                            raw: `${day}(${start12}-${end12})`
                        });
                    }
                }
            });
        }

        return sessions;
    }

    // Find all standard time slots overlapping with [startMinutes, endMinutes]
    getOverlappingStandardSlots(startMinutes, endMinutes) {
        return STANDARD_TIME_SLOTS.filter(slot => {
            const slotStartMin = this.timeToMinutes(slot.start);
            const slotEndMin = this.timeToMinutes(slot.end);
            // Overlap if (start1 < end2 && end1 > start2)
            return (startMinutes < slotEndMin && endMinutes > slotStartMin);
        });
    }

    // Normalizes course list into easily searchable format
    processCourses(courses) {
        const processed = [];
        const deptSet = new Set();

        courses.forEach((c, idx) => {
            if (!c || !c.courseCode) return;

            // Extract department code (e.g. CSE from CSE330)
            const deptMatch = c.courseCode.match(/^[A-Za-z]+/);
            if (deptMatch) {
                deptSet.add(deptMatch[0].toUpperCase());
            }

            const sessions = this.extractSessions(c);
            const sched = c.sectionSchedule || {};

            const normalized = {
                id: c.sectionId || `${c.courseCode}-${c.sectionName}-${idx}`,
                index: idx,
                courseCode: (c.courseCode || '').trim().toUpperCase(),
                courseName: (c.courseName || '').trim(),
                sectionName: (c.sectionName || '').toString().trim(),
                faculties: (c.faculties || 'TBA').trim(),
                courseCredit: parseFloat(c.courseCredit) || 3.0,
                capacity: parseInt(c.capacity, 10) || 0,
                consumedSeat: parseInt(c.consumedSeat, 10) || 0,
                roomName: c.roomName || 'TBA',
                labRoomName: c.labRoomName || c.roomName || 'TBA',
                sessions: sessions,
                midExamDate: sched.midExamDate || null,
                midExamStartTime: sched.midExamStartTime || null,
                midExamEndTime: sched.midExamEndTime || null,
                finalExamDate: sched.finalExamDate || null,
                finalExamStartTime: sched.finalExamStartTime || null,
                finalExamEndTime: sched.finalExamEndTime || null,
                finalExamDetail: sched.finalExamDetail || 'N/A',
                rawDesc: c
            };

            processed.push(normalized);
        });

        // Sort by course code then section
        processed.sort((a, b) => {
            const cmp = a.courseCode.localeCompare(b.courseCode);
            if (cmp !== 0) return cmp;
            return a.sectionName.localeCompare(b.sectionName, undefined, { numeric: true });
        });

        this.rawCourses = courses;
        this.normalizedCourses = processed;
        this.departments = deptSet;
    }

    // Fetch data with caching & fallback
    async init() {
        this.notifyStatus('loading', 'Loading course data...');

        // 1. Try local cache first for instant responsiveness
        const cached = localStorage.getItem(CACHE_KEY);
        const cachedMeta = localStorage.getItem(CACHE_META_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.processCourses(parsed);
                    if (cachedMeta) {
                        this.lastUpdated = JSON.parse(cachedMeta).lastUpdated;
                    }
                    this.notifyStatus('ready', `Loaded ${this.normalizedCourses.length} courses from cache`);
                }
            } catch (e) {
                console.warn("Cached data parse error, fetching fresh...", e);
            }
        }

        // 2. Fetch fresh JSON from primary API
        try {
            const response = await fetch(DATA_SOURCE_URL, { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const coursesList = data.courses || [];

            this.processCourses(coursesList);
            this.lastUpdated = data.metadata?.lastUpdated || new Date().toISOString();

            // Cache in localStorage
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(coursesList));
                localStorage.setItem(CACHE_META_KEY, JSON.stringify({ lastUpdated: this.lastUpdated }));
            } catch (storageErr) {
                console.warn("Could not save course cache to localStorage:", storageErr);
            }

            this.notifyStatus('ready', `Catalog updated (${this.normalizedCourses.length} courses)`);
        } catch (err) {
            console.error("Failed to fetch fresh course data:", err);
            // If we didn't have cached data, notify error or load minimal fallback
            if (this.normalizedCourses.length === 0) {
                this.notifyStatus('error', 'Unable to load course data. Please try again.');
            } else {
                this.notifyStatus('ready', `Using cached courses (${this.normalizedCourses.length} courses)`);
            }
        }
    }

    // Check conflict between a proposed course and a friend's currently selected courses
    checkConflict(proposedCourse, enrolledCourses) {
        if (!proposedCourse || !enrolledCourses || enrolledCourses.length === 0) {
            return { hasClash: false };
        }

        // 1. Duplicate course code check
        const sameCourse = enrolledCourses.find(c => c.courseCode === proposedCourse.courseCode);
        if (sameCourse) {
            return {
                hasClash: true,
                type: 'duplicate',
                reason: `Already enrolled in ${proposedCourse.courseCode} (Section ${sameCourse.sectionName}).`,
                clashingCourse: sameCourse
            };
        }

        // 2. Schedule interval clash check
        for (const enrolled of enrolledCourses) {
            for (const propSession of proposedCourse.sessions) {
                for (const enrollSession of enrolled.sessions) {
                    if (propSession.day === enrollSession.day) {
                        // Check interval intersection: startA < endB && endA > startB
                        if (propSession.startMinutes < enrollSession.endMinutes && 
                            propSession.endMinutes > enrollSession.startMinutes) {
                            return {
                                hasClash: true,
                                type: 'routine_clash',
                                reason: `Schedule clash on ${propSession.day} with ${enrolled.courseCode} (Sec ${enrolled.sectionName}) at ${enrollSession.startTime}–${enrollSession.endTime}.`,
                                clashingCourse: enrolled,
                                clashDetail: {
                                    day: propSession.day,
                                    time: `${propSession.startTime}–${propSession.endTime}`
                                }
                            };
                        }
                    }
                }
            }

            // 3. Exam Date & Time clash check
            if (proposedCourse.finalExamDate && enrolled.finalExamDate) {
                if (proposedCourse.finalExamDate === enrolled.finalExamDate) {
                    if (proposedCourse.finalExamStartTime && enrolled.finalExamStartTime && 
                        proposedCourse.finalExamStartTime === enrolled.finalExamStartTime) {
                        return {
                            hasClash: true,
                            type: 'exam_clash',
                            reason: `Final Exam conflict on ${proposedCourse.finalExamDate} at ${proposedCourse.finalExamStartTime} with ${enrolled.courseCode}.`,
                            clashingCourse: enrolled
                        };
                    }
                }
            }
        }

        return { hasClash: false };
    }

    // Fast search across courseCode, courseName, faculties, sectionName
    searchCourses(query, department = '', day = '') {
        let results = this.normalizedCourses;

        if (department) {
            results = results.filter(c => c.courseCode.startsWith(department));
        }

        if (day) {
            results = results.filter(c => c.sessions.some(s => s.day === day));
        }

        if (query && query.trim()) {
            const q = query.trim().toUpperCase();
            results = results.filter(c => {
                return c.courseCode.includes(q) ||
                       c.courseName.toUpperCase().includes(q) ||
                       c.faculties.toUpperCase().includes(q) ||
                       `SEC-${c.sectionName}`.toUpperCase().includes(q) ||
                       `SECTION ${c.sectionName}`.toUpperCase().includes(q);
            });
        }

        return results;
    }
}

// Global Course Data Instance
window.courseDataManager = new CourseDataManager();
