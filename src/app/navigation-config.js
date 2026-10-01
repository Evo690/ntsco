/* --- NAVIGATION & UI TOGGLES --- */
const SUBNAV_CONFIG = {
  dashboard: [{
    id: 'overview',
    label: 'Overview'
  }, {
    id: 'schedule',
    label: 'Schedule'
  }],
  courses: [{
    id: 'all',
    label: 'All'
  }, {
    id: 'live',
    label: 'Live'
  }, {
    id: 'exam',
    label: 'Exam'
  }, {
    id: 'classroom',
    label: 'Classroom'
  }],
  messages: [{
    id: 'all',
    label: 'All'
  }, {
    id: 'unread',
    label: 'Unread'
  }],
  examhall: [{
    id: 'all',
    label: 'All'
  }, {
    id: 'published',
    label: 'Published'
  }, {
    id: 'pending',
    label: 'Pending'
  }, {
    id: 'live',
    label: 'Live'
  }],
  era: [{
    id: 'all',
    label: 'All'
  }, {
    id: 'published',
    label: 'Published'
  }, {
    id: 'pending',
    label: 'Pending'
  }],
  notices: [{
    id: 'all',
    label: 'All'
  }, {
    id: 'recent',
    label: 'Recent'
  }, {
    id: 'test',
    label: 'Test Alerts'
  }],
  study: [{
    id: 'all',
    label: 'All'
  }, {
    id: 'physics',
    label: 'Physics'
  }, {
    id: 'chemistry',
    label: 'Chemistry'
  }, {
    id: 'math',
    label: 'Math'
  }],
  neural: [{
    id: 'predictor',
    label: 'Rank Predictor'
  }, {
    id: 'leaderboard',
    label: 'Pseudo Leaderboard'
  }]
};
const THEME_PRESETS = [{
  id: 'default',
  label: 'Lilac',
  colors: ['#7956b2', '#ebe3f6', '#f7e0d6']
}, {
  id: 'ocean',
  label: 'Slate Blue',
  colors: ['#427c9c', '#e3eef6', '#e8e6df']
}, {
  id: 'purple',
  label: 'Violet',
  colors: ['#9a68a6', '#eedbf0', '#ead6da']
}, {
  id: 'emerald',
  label: 'Green',
  colors: ['#417c5e', '#e2ece2', '#f5edce']
}];
const COMMANDS = [{ id: 'go-classes', label: 'Classes — your timetable', meta: 'Navigation', run: () => nav('classes') },{
  id: 'go-dashboard',
  label: 'Go to Dashboard',
  meta: 'Navigation',
  run: () => nav('dashboard', document.querySelector('.nav-item[onclick*=dashboard]'))
}, {
  id: 'go-courses',
  label: 'Go to My Courses',
  meta: 'Navigation',
  run: () => nav('courses', document.querySelector('.nav-item[onclick*=courses]'))
}, {
  id: 'go-messages',
  label: 'Go to Messages',
  meta: 'Navigation',
  run: () => nav('messages', document.querySelector('.nav-item[onclick*=messages]'))
}, {
  id: 'go-timetable',
  label: 'Go to class schedule',
  meta: 'Navigation',
  run: () => nav('timetable', document.querySelector('.nav-item[onclick*=timetable]'))
}, {
  id: 'go-examhall',
  label: 'Go to Examination Hall',
  meta: 'Navigation',
  run: () => nav('examhall', document.querySelector('.nav-item[onclick*=examhall]'))
}, {
  id: 'go-era',
  label: 'Results — direct result lookup',
  meta: 'Navigation',
  run: () => nav('era', document.querySelector('.nav-item[onclick*=era]'))
}, {
  id: 'go-neural',
  label: 'Go to Neural Network',
  meta: 'Navigation',
  run: () => nav('neural', document.querySelector('.nav-item[onclick*=neural]'))
}, {
  id: 'go-settings',
  label: 'Go to Settings',
  meta: 'Navigation',
  run: () => nav('settings', document.querySelector('.nav-item[onclick*=settings]'))
}, {
  id: 'go-notices',
  label: 'Go to Notice Board',
  meta: 'Navigation',
  run: () => nav('notices', document.querySelector('.nav-item[onclick*=notices]'))
}, {
  id: 'go-study',
  label: 'Go to Study Content',
  meta: 'Navigation',
  run: () => nav('study', document.querySelector('.nav-item[onclick*=study]'))
}, {
  id: 'go-practice',
  label: 'Go to Practice',
  meta: 'Navigation',
  run: () => nav('practice', document.querySelector('.nav-item[onclick*=practice]'))
}, {
  id: 'open-attendance',
  label: 'Open Attendance Modal',
  meta: 'Action',
  run: () => openAttendanceModal()
}, {
  id: 'refresh-now',
  label: 'Refresh Data Now',
  meta: 'Sync',
  run: () => refreshPortalDataInBackground()
}, {
  id: 'toggle-theme',
  label: 'Toggle Theme',
  meta: 'Appearance',
  run: () => toggleThemeMode()
}, {
  id: 'logout',
  label: 'Logout',
  meta: 'Session',
  run: () => logout()
}];
