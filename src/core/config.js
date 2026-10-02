const pages = {
  dashboard: 'Overview', tools: 'Functions', courses: 'Courses', messages: 'Messages',
  timetable: 'Classes', examhall: 'Examination Hall', era: 'Results', examcal: 'Exam Calendar',
  neural: 'Neural lab',
  notices: 'Notice Board', study: 'Study Content', practice: 'Practice', settings: 'Settings', 'result-detail': 'Result Detail', leaderboard: 'Leaderboard',
  solutions: 'Solutions'
};

const API_CONFIG = {
  token: sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '',
  classId: Number(sessionStorage.getItem('fy_class_id') || localStorage.getItem('fy_class_id')) || null,
  academicYear: Number(sessionStorage.getItem('fy_academic_year') || localStorage.getItem('fy_academic_year') || new Date().getFullYear())
};

// Mirror persistent values into sessionStorage if tab session was just opened
try {
  if (!sessionStorage.getItem('fy_token') && API_CONFIG.token) {
    sessionStorage.setItem('fy_token', API_CONFIG.token);
  }
  if (!sessionStorage.getItem('fy_academic_year') && API_CONFIG.academicYear) {
    sessionStorage.setItem('fy_academic_year', String(API_CONFIG.academicYear));
  }
  if (!sessionStorage.getItem('fy_class_id') && API_CONFIG.classId) {
    sessionStorage.setItem('fy_class_id', String(API_CONFIG.classId));
  }
  const savedUser = localStorage.getItem('fy_logged_in_user');
  if (!sessionStorage.getItem('fy_logged_in_user') && savedUser) {
    sessionStorage.setItem('fy_logged_in_user', savedUser);
  }
  const savedName = localStorage.getItem('fy_user_name');
  if (!sessionStorage.getItem('fy_user_name') && savedName) {
    sessionStorage.setItem('fy_user_name', savedName);
  }
  const savedImg = localStorage.getItem('fy_user_img');
  if (!sessionStorage.getItem('fy_user_img') && savedImg) {
    sessionStorage.setItem('fy_user_img', savedImg);
  }
} catch (_) {}


const API_ENDPOINTS = {
  login: 'https://ntsc.narayanatalent.com/login-service/api/login',
  studentBatch: year => `https://ntsc.narayanatalent.com/student-service/api/EnrolledCourse/GetStudentBatch?academicYear=${year}`,
  timetable: id => `https://ntsc.narayanatalent.com/classes-service/api/LiveClass/GetStudentClasses/${id}`,
  tests: 'https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetTests',
  attendance: 'https://ntsc.narayanatalent.com/classes-service/api/Attendance/GetStudentAttendance',
  appearedResult: 'https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetAppearedResult',
  resultAnalysis: id => `https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetResultAnalysis/${id}`,
  leaderboardScore: 'https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetLeaderboardScore',
  calendar: 'https://ntsc.narayanatalent.com/exam-service/api/ExamCalendar/GetStudentCalendar',
  courses: 'https://ntsc.narayanatalent.com/course-service/api/MyLibrary/GetMyCourses',
  courseDetail: id => `https://ntsc.narayanatalent.com/course-service/api/Course/CourseDetail/${id}`,
  messageGroups: 'https://ntsc.narayanatalent.com/general-service/api/MessageGroup/GetStudentGroup',
  messages: 'https://ntsc.narayanatalent.com/general-service/api/Message/GetStudentMessage',
  notices: 'https://ntsc.narayanatalent.com/general-service/api/NoticeBoard/GetStudentNotice',
  noticeFile: id => `https://ntsc.narayanatalent.com/general-service/api/NoticeBoard/GetFileUrl/${id}`,
  studyContent: 'https://ntsc.narayanatalent.com/classes-service/api/StudyContent/GetStudentContent',
  studyFile: id => `https://ntsc.narayanatalent.com/classes-service/api/StudyContent/GetFileUrl/${id}`,
  recordingUrl: id => `https://ntsc.narayanatalent.com/classes-service/api/LiveClass/GetRecordingUrl/${id}`
};

const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';
const LOGIN_WORKER_KEY = 'ntsc-123';
const LOGIN_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
  MIIBCgKCAQEA1PKx1sQNhJVUgha5WOGdiRC0i0Td71UEK9enVf71Tw+79R7mdkEWtE4Ybrsr8yiYi0ETB14RjruFwiLk82wcfbcg4gxHDLxaJoEjjNh1YtMsphOaSte+vNpFrVmpqG6/dvxUAgCdK1kQAM530SC+Dui/tjPr8hUoTPgRkQwVZW/ODf7+1+AT9dJjuJSINmC7Llf5ggAQMmxf24wt2S1L9IGBFTJjIdMGFcfNc2eZQMCmbnZsmNdyv/UubCucusesWIhXnqUXfGbwaxFg0cbiqfyiISuE8yywmkPMYEI96pWRuqCBrgympGMC0CNUK2OoJWG/BeFRJ+hccY5Lp6/+6QIDAQAB
  -----END PUBLIC KEY-----`;

const APP_STATE = {
  tests: [],
  eraTests: [],
  resultCache: {},
  calendarEntries: [],
  timetable: [],
  courses: [],
  messageGroups: [],
  notices: [],
  studyContent: [],
  studyTotal: 0,
  studyPage: 1,
  examPage: 1,
  examTotal: 0,
  eraPage: 1,
  eraTotal: 0,
  testPageSize: 10,
  currentResult: null,
  lastResultSource: 'examhall',
  globalSearch: '',
  activeSubTabs: {},
  lastSyncAt: 0,
  isRefreshing: false,
  themePreset: 'default',
  dashboardForcedStats: null,
  loadedSections: {
    dashboard: false,
    courses: false,
    messages: false,
    notices: false,
    study: false
  }
};

let currentGroupId = null;

