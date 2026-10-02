// Browser-side fixture, used by tests only. External requests must be blocked.
module.exports = function populateWorkspace() {
  window.ensureDataForPage = async () => {};
  window.scanAndUploadOnlineTests = () => {};
  window.chemLoadVisitorStat = () => {};
  window.chemSyncAll = async () => {};
  window.chemDownloadProgress = async () => {};
  window.chemEnsureSupabase = async () => {};
  window.checkPracticeAccess = async () => true;
  window.initRankPredictor = async () => {};
  window.initPseudoLeaderboardUI = () => {};
  API_CONFIG.token = 'fixture-only';
  document.getElementById('login-screen').style.display = 'none';
  initTopbarEnhancements();
  const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140"><rect width="240" height="140" fill="#20252a"/><text x="20" y="65" fill="#c3f779" font-size="20">Fixture course</text></svg>');
  const solution = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><rect width="600" height="120" fill="white"/><text x="20" y="65" fill="black" font-size="18">Fixture solution: F = ma</text></svg>');
  APP_STATE.courses = [
    { id: 101, courseName: 'STRIKER 12 JEE–REGULAR CLASSROOM COURSE (PH–1A, 07 JAN 26)', goal: 'JEE', startDate: '2026-01-07', expireyDate: '2027-04-15', image },
    { id: 102, courseName: 'Physics / Mechanics and waves', goal: 'JEE', startDate: '2026-01-07', expireyDate: '2027-04-15', isLive: true },
    { id: 103, courseName: 'Chemistry / Revision papers', goal: 'JEE', startDate: '2026-01-07', expireyDate: '2027-04-15', isExamType: true }
  ];
  window.fetchCourseDetail = async () => ({ title: APP_STATE.courses[0].courseName, detailImage: image, courseMedium: 'English', startDate: '07 Jan 2026', expiryDate: '15 Apr 2027', batchName: 'Fixture batch', batchId: 101, registrationNo: 'FIXTURE-001', courseFees: { price: 1000 }, campus: [{ campusName: 'Fixture campus' }], description: '<p>Course units: mechanics, thermodynamics and waves.</p>', scholarshipDescription: '<p>Fixture scholarship information.</p>', videoUrl: 'https://example.invalid/video' });
  const today = getIstDateKey();
  APP_STATE.timetable = ['Physics', 'Mathematics', 'Chemistry'].map((subjects,i)=>({classDate:today,startTime:`${9+i*2}:00`,subjects,classType:'Regular class'}));
  APP_STATE.tests = [{ id: 501, testName: 'JEE Main / Full syllabus assessment — Paper 01', isPublish: true, examDate: '2026-09-28', duration:180,isOffline:true,syllabus:'Physics: Mechanics\nChemistry: Atomic structure\nMathematics: Algebra',appeared:{totalMarks:216,totalSubjectMarks:300,rank:14} }];
  APP_STATE.eraTests = APP_STATE.tests;
  APP_STATE.calendarEntries = [{id:701,name:'JEE Advanced / Practice examination',dateTime:new Date(Date.now()+7*86400000).toISOString(),mode:'Offline',venue:'Campus — Examination hall 2',syllabus:'Physics: Mechanics\nChemistry: Atomic structure\nMathematics: Algebra'}];
  APP_STATE.notices = [{id:1,title:'Schedule update / Weekend assessment',createdDate:'2026-10-01',testDate:'2026-10-05'}];
  APP_STATE.studyContent = [{id:1,title:'Laws of motion / Practice worksheet',subjectName:'Physics',createdDate:'2026-10-01'},{id:2,title:'Organic reactions / Revision notes',subjectName:'Chemistry',createdDate:'2026-10-01'}];
  APP_STATE.messageGroups = [{groupId:'fixture',title:'JEE classroom / announcements',lastMessageTime:'09:30',unreadCount:2}];
  window.fetchMessages = async () => [{createdDate:'2026-10-01',displayTime:'09:30',messageText:'The physics session starts at 10:00. Please bring the mechanics worksheet.',attachment:'https://example.invalid/worksheet.pdf'}];
  window.fetchAttendance = async () => [{classDate:'2026-10-01',isPresent:true},{classDate:'2026-09-30',isPresent:false}];
  const subjectData = ['Physics','Chemistry','Mathematics'].map((subjectName,i)=>({subjectId:i+1,subjectName,totalMarks:72,totalSubjectMarks:100,totalAvgMarks:48,highestMarks:96,rank:14+i,percentile:94,totalCorrect:19,totalIncorrect:4,totalUnattempted:2,totalAttempted:23,totalQuestion:25,totalNotVisited:1}));
  const analysis={testName:APP_STATE.tests[0].testName,testPaperId:501,attemptDate:'28 Sep 2026',rank:14,batchRank:3,cityRank:7,percentile:94,totalStudent:240,isLeaderboard:true,isShowScoreSheet:true,isShowQuestionsCount:true,omrSheetPath:'https://example.invalid/omr.pdf',answerKeyFileUrl:'https://example.invalid/answer.pdf',result:{totalMarks:216,totalSubjectMarks:300,totalAvg:144,totalHighest:288,totalAttempted:69,totalCorrect:57,totalIncorrect:12,totalUnAttempted:6,topScoreTotal:[288,280,272],subjectData,questionData:[{questionNo:1,subjectName:'Physics',isRightAns:true,studentAns:'A',rightAns:'A',marks:4,level:'Easy',timeTaken:32,qaTime:60,solutionImage:solution},{questionNo:2,subjectName:'Chemistry',isRightAns:false,studentAns:'B',rightAns:'C',marks:-1,level:'Moderate',timeTaken:75,qaTime:60,solutionImage:solution},{questionNo:3,subjectName:'Mathematics',isUnAttempted:true,rightAns:'D',marks:0,level:'Hard',solutionImage:solution} ]}};
  const leaderboard={leaderboardScore:[{ranks:1,studentName:'Fixture student A',totalMarks:288,subjectPerformance:subjectData},{ranks:2,studentName:'Fixture student B',totalMarks:280,subjectPerformance:subjectData}]};
  APP_STATE.currentResult={analysis,selected:APP_STATE.tests[0],leaderboard};
  window.fetchAppearedResult = async()=>({examId:'fixture-exam'});
  window.fetchResultAnalysis = async()=>analysis;
  window.fetchLeaderboardScore = async()=>leaderboard;
  renderTodayClasses(APP_STATE.timetable);
  renderTimetable(APP_STATE.timetable);
  renderCourses(APP_STATE.courses);
  renderExamHall(APP_STATE.tests);
  renderEraTests(APP_STATE.eraTests);
  renderExamCalendar(APP_STATE.calendarEntries);
  renderNotices(APP_STATE.notices);
  renderStudyContent(APP_STATE.studyContent,2);
  renderMessageGroups(APP_STATE.messageGroups);
  document.getElementById('result-detail-body').innerHTML=buildResultAnalysisHtml(analysis,APP_STATE.tests[0],{showLeaderboardButton:true});
  updateDashboardWidgets();
  renderSubnav('dashboard');
};
