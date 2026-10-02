# FRIENDS FOREVER — Multi-Friend University Routine Planner

> **Your classes. Your friends. One routine.**

Friends Forever is a dynamic, client-side university routine planner built for groups of university friends to coordinate their schedules, find shared lectures, discover when everyone is free, and keep track of exam dates.

---

## 🌟 Key Features

### 1. Dynamic Live Course Catalog
- Fetches real-time university course data directly from:
  `https://usis-cdn.eniamza.com/connect-migrate.json`
- Supports live search across **Course Codes**, **Course Names**, **Section Numbers**, and **Faculty Initials**.
- Automatic localStorage caching with update metadata so the catalog remains instantly responsive on repeat visits and offline.
- Detailed section previews: Theory timing, Lab timing, Room numbers, Faculty initials, Midterm and Final exam dates, and live Seat Availability (`consumedSeat / capacity`).

### 2. Multi-Level Architecture
- **Friend Groups**: Create, rename, delete, and customize multiple squads (e.g. *The Sleep Deprived*, *Final Year Survivors*, *Research Crew*).
- **Group Accent Colors**: Distinct accent color per group (Cyan, Purple, Orange, Green, Pink, Blue).
- **Friends in Group**: Add up to 10+ friends per group with unique colors, names, and optional nicknames.
- **Friend Toggles**: Easily toggle friends on/off in the routine view with quick checkboxes.

### 3. Visual Routine Matrix
- 7 University Days: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday.
- 7 Dynamic University Time Periods:
  1. `08:00 AM - 09:20 AM`
  2. `09:30 AM - 10:50 AM`
  3. `11:00 AM - 12:20 PM`
  4. `12:30 PM - 01:50 PM`
  5. `02:00 PM - 03:20 PM`
  6. `03:30 PM - 04:50 PM`
  7. `05:00 PM - 06:20 PM`
  *(Extended labs spanning 3 hours are automatically mapped across overlapping standard periods).*

### 4. Shared Class & Simultaneous Class Detection
- **Shared Class**: Automatically detects when multiple friends are enrolled in the exact same course and section:
  - Highlights with `🎉 Shared Class` badge.
  - Lists friend color chips and names together.
- **Same Time, Different Classes**:
  - Automatically groups different courses occurring at the same time into a sleek `⚡ SAME TIME` card.
  - Shows each friend with their distinct color dot, course code, section, and classroom room number.

### 5. Conflict & Clash Detection
- When adding a course to any friend, the system validates both:
  1. **Routine Clashes**: Day and time interval overlaps with any already enrolled course.
  2. **Exam Clashes**: Same-day or same-time midterm or final exam conflicts.
  3. **Duplicate Courses**: Prevents enrolling into the same course code twice.
- If a clash is detected, the `Add to Schedule` button is blocked and a warning alert is displayed.

### 6. "Who's Free?"
- Interactive selector for Day of the Week and Time Period.
- Instantly splits the friend group into:
  - **FREE**: Friends who have no class during this slot.
  - **BUSY IN CLASS**: Friends currently in lecture/lab, along with their course code, section, room, and faculty.

### 7. "Find Common Free Time"
- Scans all 49 weekly slots across friends.
- Ranks slots from 100% free (`10 / 10 friends free`) downward.
- Filter by specific friends using checkboxes or filter by specific days of the week.
- Perfect for scheduling group study sessions, project meetings, lunch hangouts, or gym breaks.

### 8. Group Exam Schedule
- Dual-column chronological layout:
  - **Midterms** (Amber/Yellow header)
  - **Finals** (Coral/Red header)
- Day-grouped cards with Weekday and Date (`DD-MM-YYYY`), course badges, times, and friend tags.
- Automatic exam clash alerts if any friend has multiple exams at the same time.

### 9. Export & Data Management
- **Export Image**: One-click high-resolution PNG export of the Routine Table and Exam Schedule.
- **JSON Backup & Restore**: Download or upload full group configurations.
- **Preloaded Sample Group**: One-click demo group (*The Sleep Deprived* with Younus, Rahim, Fahim, Sami) to test all features immediately.

---

## 🚀 How to Run

Because Friends Forever is built using vanilla HTML5, CSS3, and modern ES6 JavaScript, **no build step or npm install is required**.

1. **Directly in Browser**:
   - Double-click `index.html` to open it in your browser (Chrome, Edge, Firefox, Safari).
2. **With a local web server (Recommended)**:
   - Using Python: `python -m http.server 8000`
   - Using Node: `npx serve .`
   - Or with VS Code / Antigravity "Live Server" extension.
