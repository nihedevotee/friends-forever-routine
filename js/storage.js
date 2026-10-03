/**
 * FRIENDS FOREVER — LocalStorage Persistence & Group/Friend State
 */

const STORAGE_GROUPS_KEY = 'friends_forever_groups';
const STORAGE_ACTIVE_GROUP_KEY = 'friends_forever_active_group_id';

class StorageManager {
    constructor() {
        this.groups = this.loadGroups();
        this.activeGroupId = localStorage.getItem(STORAGE_ACTIVE_GROUP_KEY) || null;
    }

    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    loadGroups() {
        try {
            const raw = localStorage.getItem(STORAGE_GROUPS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error("Failed to load groups from localStorage:", e);
            return [];
        }
    }

    saveGroups() {
        try {
            localStorage.setItem(STORAGE_GROUPS_KEY, JSON.stringify(this.groups));
        } catch (e) {
            console.error("Failed to save groups to localStorage:", e);
        }
    }

    getAllGroups() {
        return this.groups;
    }

    getGroup(groupId) {
        return this.groups.find(g => g.id === groupId) || null;
    }

    getActiveGroup() {
        if (!this.activeGroupId && this.groups.length > 0) {
            this.activeGroupId = this.groups[0].id;
        }
        return this.getGroup(this.activeGroupId);
    }

    setActiveGroup(groupId) {
        this.activeGroupId = groupId;
        if (groupId) {
            localStorage.setItem(STORAGE_ACTIVE_GROUP_KEY, groupId);
        } else {
            localStorage.removeItem(STORAGE_ACTIVE_GROUP_KEY);
        }
    }

    createGroup(name, accentColor = '#06b6d4') {
        const newGroup = {
            id: this.generateId('grp'),
            name: name.trim() || 'New Friend Group',
            accentColor: accentColor || '#06b6d4',
            createdAt: new Date().toISOString(),
            friends: []
        };
        this.groups.push(newGroup);
        this.saveGroups();
        return newGroup;
    }

    updateGroup(groupId, updates) {
        const group = this.getGroup(groupId);
        if (!group) return null;
        Object.assign(group, updates);
        this.saveGroups();
        return group;
    }

    deleteGroup(groupId) {
        this.groups = this.groups.filter(g => g.id !== groupId);
        if (this.activeGroupId === groupId) {
            this.activeGroupId = this.groups.length > 0 ? this.groups[0].id : null;
            if (this.activeGroupId) {
                localStorage.setItem(STORAGE_ACTIVE_GROUP_KEY, this.activeGroupId);
            } else {
                localStorage.removeItem(STORAGE_ACTIVE_GROUP_KEY);
            }
        }
        this.saveGroups();
    }

    addFriend(groupId, friendData) {
        const group = this.getGroup(groupId);
        if (!group) return null;

        const newFriend = {
            id: this.generateId('frd'),
            name: (friendData.name || '').trim(),
            nickname: (friendData.nickname || '').trim(),
            color: friendData.color || '#06b6d4',
            courses: [],
            visibleInRoutine: true
        };

        group.friends.push(newFriend);
        this.saveGroups();
        return newFriend;
    }

    updateFriend(groupId, friendId, updates) {
        const group = this.getGroup(groupId);
        if (!group) return null;
        const friend = group.friends.find(f => f.id === friendId);
        if (!friend) return null;
        Object.assign(friend, updates);
        this.saveGroups();
        return friend;
    }

    deleteFriend(groupId, friendId) {
        const group = this.getGroup(groupId);
        if (!group) return;
        group.friends = group.friends.filter(f => f.id !== friendId);
        this.saveGroups();
    }

    addCourseToFriend(groupId, friendId, course) {
        const group = this.getGroup(groupId);
        if (!group) return null;
        const friend = group.friends.find(f => f.id === friendId);
        if (!friend) return null;

        // Ensure courses array exists
        if (!friend.courses) friend.courses = [];

        // Check duplicate
        if (friend.courses.some(c => c.courseCode === course.courseCode)) {
            return { error: 'DUPLICATE_COURSE' };
        }

        friend.courses.push(course);
        this.saveGroups();
        return { success: true, friend };
    }

    removeCourseFromFriend(groupId, friendId, courseId) {
        const group = this.getGroup(groupId);
        if (!group) return;
        const friend = group.friends.find(f => f.id === friendId);
        if (!friend || !friend.courses) return;
        // data-id from the DOM is always a string, but sectionId can be a number — compare as strings
        friend.courses = friend.courses.filter(c => String(c.id ?? c.courseCode) !== String(courseId));
        this.saveGroups();
    }

    // Toggle friend routine visibility
    toggleFriendVisibility(groupId, friendId, isVisible) {
        const group = this.getGroup(groupId);
        if (!group) return;
        const friend = group.friends.find(f => f.id === friendId);
        if (friend) {
            friend.visibleInRoutine = isVisible !== undefined ? isVisible : !friend.visibleInRoutine;
            this.saveGroups();
        }
    }

    // Preloaded Demo Group: "The Sleep Deprived"
    loadSampleGroup(coursesCatalog = []) {
        // If sample group already exists, switch to it
        const existing = this.groups.find(g => g.name === 'The Sleep Deprived');
        if (existing) {
            this.setActiveGroup(existing.id);
            return existing;
        }

        const sampleGroup = {
            id: this.generateId('grp'),
            name: 'The Sleep Deprived',
            accentColor: '#06b6d4',
            createdAt: new Date().toISOString(),
            friends: [
                {
                    id: this.generateId('frd'),
                    name: 'Younus',
                    nickname: 'Captain',
                    color: '#06b6d4', // Cyan
                    courses: [],
                    visibleInRoutine: true
                },
                {
                    id: this.generateId('frd'),
                    name: 'Rahim',
                    nickname: 'Bug Hunter',
                    color: '#a855f7', // Purple
                    courses: [],
                    visibleInRoutine: true
                },
                {
                    id: this.generateId('frd'),
                    name: 'Fahim',
                    nickname: 'Night Owl',
                    color: '#f97316', // Orange
                    courses: [],
                    visibleInRoutine: true
                },
                {
                    id: this.generateId('frd'),
                    name: 'Sami',
                    nickname: 'Speedrunner',
                    color: '#10b981', // Green
                    courses: [],
                    visibleInRoutine: true
                }
            ]
        };

        // If we have courses catalog available, intelligently pick sections
        // so that there are both shared classes (e.g. CSE330) and same-time different classes (e.g. Sun 09:30 AM)!
        if (coursesCatalog && coursesCatalog.length > 0) {
            this.populateRealisticCourses(sampleGroup, coursesCatalog);
        }

        this.groups.push(sampleGroup);
        this.saveGroups();
        this.setActiveGroup(sampleGroup.id);
        return sampleGroup;
    }

    populateRealisticCourses(group, catalog) {
        const findCourse = (code, sec) => {
            return catalog.find(c => c.courseCode === code && (sec ? c.sectionName == sec : true)) ||
                   catalog.find(c => c.courseCode === code);
        };

        // Try popular BRACU courses
        const cse330 = findCourse('CSE330');
        const cse422 = findCourse('CSE422');
        const cse470 = findCourse('CSE470');
        const cse340 = findCourse('CSE340');
        const mat110 = findCourse('MAT110');
        const phy111 = findCourse('PHY111');
        const eng101 = findCourse('ENG101');

        const [younus, rahim, fahim, sami] = group.friends;

        if (younus) {
            if (cse330) younus.courses.push(cse330);
            if (cse422) younus.courses.push(cse422);
            if (cse470) younus.courses.push(cse470);
        }
        if (rahim) {
            // Shared CSE330 with Younus!
            if (cse330) rahim.courses.push(cse330);
            // Different course
            if (cse340) rahim.courses.push(cse340);
            if (mat110) rahim.courses.push(mat110);
        }
        if (fahim) {
            if (cse422) fahim.courses.push(cse422); // Shared with Younus
            if (phy111) fahim.courses.push(phy111);
            if (eng101) fahim.courses.push(eng101);
        }
        if (sami) {
            if (cse330) sami.courses.push(cse330); // 3 friends together!
            if (cse470) sami.courses.push(cse470);
            if (mat110) sami.courses.push(mat110);
        }
    }

    exportData() {
        return JSON.stringify({
            app: 'Friends Forever',
            version: '2.0',
            exportedAt: new Date().toISOString(),
            groups: this.groups
        }, null, 2);
    }

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.groups || !Array.isArray(data.groups)) {
                throw new Error("Invalid file format: 'groups' array not found.");
            }
            this.groups = data.groups;
            this.saveGroups();
            if (this.groups.length > 0) {
                this.setActiveGroup(this.groups[0].id);
            }
            return { success: true, count: this.groups.length };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    resetAll(catalog) {
        this.groups = [];
        localStorage.removeItem(STORAGE_GROUPS_KEY);
        localStorage.removeItem(STORAGE_ACTIVE_GROUP_KEY);
        this.activeGroupId = null;
        return this.loadSampleGroup(catalog);
    }
}

window.storageManager = new StorageManager();