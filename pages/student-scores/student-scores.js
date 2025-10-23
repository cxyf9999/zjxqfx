// student-scores.js
const storage = require('../../utils/storage')

Page({
  data: {
    studentId: '',
    studentInfo: {},
    scoreOverview: {
      totalAssignments: 0,
      averageScore: 0,
      totalScore: 0,
      maxScore: 0
    },
    assignments: [],
    filteredAssignments: [],
    wrongQuestions: [],
    filterType: 'all', // all, recent, high, low
    currentFilter: 'all', // all, completed, pending
    showShareModal: false,
    loading: true,
    error: '',
    sharePreview: false
  },

  onLoad: function (options) {
    // 支持从分享链接中直接载入数据
    if (options && options.payload) {
      try {
        const parsed = JSON.parse(decodeURIComponent(options.payload));
        let { studentInfo, scoreOverview, assignments, wrongQuestions } = parsed || {};
        
        // 处理新版本压缩数据格式
        if (parsed.v === 2) {
          // 解压缩数据
          if (parsed.compressed) {
            // 处理最小化数据格式
            assignments = (assignments || []).map(a => ({
              id: a.i || a.id || '',
              title: a.t || a.title || '未知作业',
              date: a.d || a.date || '未知日期',
              totalScore: a.ts || a.totalScore || 0,
              maxScore: a.ms || a.maxScore || 0,
              type: a.type || '作业',
              expanded: false,
              wrongQuestions: []
            }));
            
            wrongQuestions = (wrongQuestions || []).map(w => ({
              assignmentTitle: w.at || w.assignmentTitle || '未知作业',
              questionPath: w.qp || w.questionPath || '未知题目',
              lostScore: w.ls || w.lostScore || 0,
              reason: w.r || w.reason || '答案错误',
              level: w.l || w.level || 'level1',
              levelText: w.levelText || this.getLevelText(w.l || w.level)
            }));
          } else {
            // 处理标准压缩格式
            assignments = (assignments || []).map(a => ({
              id: a.i || a.id || '',
              title: a.t || a.title || '未知作业',
              date: a.d || a.date || '未知日期',
              totalScore: a.ts || a.totalScore || 0,
              maxScore: a.ms || a.maxScore || 0,
              type: a.type || '作业',
              expanded: false,
              wrongQuestions: []
            }));
            
            wrongQuestions = (wrongQuestions || []).map(w => ({
              assignmentTitle: w.at || w.assignmentTitle || '未知作业',
              questionPath: w.qp || w.questionPath || '未知题目',
              lostScore: w.ls || w.lostScore || 0,
              reason: w.r || w.reason || '答案错误',
              level: w.l || w.level || 'level1',
              levelText: w.levelText || this.getLevelText(w.l || w.level)
            }));
          }
        } else {
          // 兼容旧版本数据格式
          assignments = (assignments || []).map(a => ({
            ...a,
            expanded: false,
            wrongQuestions: []
          }));
        }
        
        const errorStats = this.computeErrorStatsFromWrongQuestions(wrongQuestions || []);
        const totalErrors = (wrongQuestions || []).length;
        const totalLostScore = (wrongQuestions || []).reduce((sum, item) => sum + (item.lostScore || 0), 0);
        
        this.setData({
          studentId: options.studentId || '',
          studentInfo: studentInfo || {},
          scoreOverview: Object.assign({}, scoreOverview || {}, { totalErrors, totalLostScore }),
          assignments: assignments || [],
          filteredAssignments: assignments || [],
          wrongQuestions: wrongQuestions || [],
          errorStats,
          sharePreview: true,
          loading: false,
          error: '',
          isSharedData: true,
          compressionInfo: parsed.compressed ? '数据已压缩显示' : ''
        });
      } catch (e) {
        console.error('解析分享数据失败:', e);
        this.setData({ error: '分享数据解析失败，请重新获取分享链接', loading: false });
      }
      return;
    }

    // 原有 studentId 分支
    if (options.studentId) {
      this.setData({
        studentId: options.studentId
      });
      this.loadStudentData();
    } else {
      this.setData({
        error: '学生ID参数缺失',
        loading: false
      });
    }
  },

  // 获取层级文本
  getLevelText: function(level) {
    switch(level) {
      case 'level1': return '一级';
      case 'level2': return '二级';
      case 'level3': return '三级';
      default: return '未知';
    }
  },

  // 从错题列表计算层级统计
  computeErrorStatsFromWrongQuestions: function(wrongQuestions) {
    const stats = { level1: 0, level2: 0, level3: 0 };
    if (!wrongQuestions || wrongQuestions.length === 0) return stats;
    wrongQuestions.forEach(w => {
      const level = this.getQuestionLevel(w.questionPath || '');
      if (level.class === 'level1') stats.level1++;
      else if (level.class === 'level2') stats.level2++;
      else stats.level3++;
    });
    return stats;
  },

  // 构建分享载荷，使用多级压缩策略确保完整信息传递
  buildSharePayload: function(maxLength = 3000) {
    const { studentInfo, scoreOverview, assignments, wrongQuestions } = this.data;
    
    // 第一级：完整数据
    let payload = {
      v: 2, // 版本号，用于兼容性
      studentInfo,
      scoreOverview,
      assignments: (assignments || []).map(a => ({
        id: a.id,
        title: a.title,
        date: a.date,
        totalScore: a.totalScore,
        maxScore: a.maxScore,
        type: a.type
      })),
      wrongQuestions: (wrongQuestions || []).map(w => ({
        assignmentTitle: w.assignmentTitle,
        questionPath: w.questionPath,
        lostScore: w.lostScore,
        reason: w.reason,
        level: w.level,
        levelText: w.levelText
      }))
    };

    let encoded = encodeURIComponent(JSON.stringify(payload));
    let compressionLevel = 0;

    // 第二级：移除非关键字段
    if (encoded.length > maxLength) {
      compressionLevel = 1;
      payload.wrongQuestions = (wrongQuestions || []).map(w => ({
        at: w.assignmentTitle, // 缩短字段名
        qp: w.questionPath,
        ls: w.lostScore,
        r: w.reason || '答案错误',
        l: w.level
      }));
      payload.assignments = (assignments || []).map(a => ({
        i: a.id,
        t: a.title,
        d: a.date,
        ts: a.totalScore,
        ms: a.maxScore
      }));
      encoded = encodeURIComponent(JSON.stringify(payload));
    }

    // 第三级：智能截断错题，保留最重要的信息
    if (encoded.length > maxLength) {
      compressionLevel = 2;
      // 按失分排序，保留失分最多的错题
      const sortedErrors = [...(wrongQuestions || [])].sort((a, b) => (b.lostScore || 0) - (a.lostScore || 0));
      let maxErrors = Math.min(sortedErrors.length, 50);
      
      while (maxErrors > 5 && encoded.length > maxLength) {
        payload.wrongQuestions = sortedErrors.slice(0, maxErrors).map(w => ({
          at: w.assignmentTitle,
          qp: w.questionPath,
          ls: w.lostScore,
          l: w.level
        }));
        encoded = encodeURIComponent(JSON.stringify(payload));
        maxErrors = Math.floor(maxErrors * 0.8);
      }
    }

    // 第四级：进一步压缩作业信息
    if (encoded.length > maxLength) {
      compressionLevel = 3;
      // 保留最近的作业和得分最低的作业
      const recentAssignments = [...(assignments || [])].slice(-20);
      const lowScoreAssignments = [...(assignments || [])]
        .filter(a => a.maxScore > 0)
        .sort((a, b) => (a.totalScore / a.maxScore) - (b.totalScore / b.maxScore))
        .slice(0, 10);
      
      const importantAssignments = [...new Set([...recentAssignments, ...lowScoreAssignments])];
      
      payload.assignments = importantAssignments.slice(0, 30).map(a => ({
        i: a.id,
        t: a.title.length > 20 ? a.title.substring(0, 20) + '...' : a.title,
        ts: a.totalScore,
        ms: a.maxScore
      }));
      encoded = encodeURIComponent(JSON.stringify(payload));
    }

    // 第五级：最小化数据
    if (encoded.length > maxLength) {
      compressionLevel = 4;
      payload = {
        v: 2,
        studentInfo: {
          name: studentInfo.name,
          class: studentInfo.class
        },
        scoreOverview: {
          totalAssignments: scoreOverview.totalAssignments,
          averageScore: scoreOverview.averageScore,
          totalErrors: scoreOverview.totalErrors,
          totalLostScore: scoreOverview.totalLostScore
        },
        assignments: (assignments || []).slice(-10).map(a => ({
          t: a.title.substring(0, 15),
          ts: a.totalScore,
          ms: a.maxScore
        })),
        wrongQuestions: (wrongQuestions || []).slice(0, 20).map(w => ({
          at: w.assignmentTitle.substring(0, 10),
          qp: w.questionPath.substring(0, 20),
          ls: w.lostScore
        })),
        compressed: true
      };
      encoded = encodeURIComponent(JSON.stringify(payload));
    }

    this._sharePayloadTruncated = compressionLevel > 0;
    this._compressionLevel = compressionLevel;
    
    return { 
      encoded, 
      truncated: compressionLevel > 0,
      compressionLevel,
      originalLength: (wrongQuestions || []).length,
      compressedLength: payload.wrongQuestions ? payload.wrongQuestions.length : 0
    };
  },

  // 加载学生数据
  loadStudentData: function() {
    this.setData({ loading: true });
    
    try {
      // 获取真实的学生信息
      const student = storage.getStudentById(this.data.studentId);
      if (!student) {
        this.setData({
          error: '未找到该学生信息',
          loading: false
        });
        return;
      }

      // 获取学生的成绩数据
      const scores = storage.getScoresByStudentId(this.data.studentId);
      
      // 获取该学生所在班级的作业
      const assignments = storage.getAssignmentsByClassId(student.classId);
      
      // 生成学生的成绩数据（使用真实作业数据和成绩记录）
      const studentData = this.generateStudentData(student, scores, assignments);
      
      this.setData({
        studentInfo: studentData.studentInfo,
        scoreOverview: studentData.scoreOverview,
        assignments: studentData.assignments,
        filteredAssignments: studentData.assignments,
        wrongQuestions: studentData.wrongQuestions,
        errorStats: studentData.errorStats,
        loading: false
      });
    } catch (error) {
      console.error('加载学生数据失败:', error);
      this.setData({
        error: '加载数据失败',
        loading: false
      });
    }
  },

  // 生成学生数据（使用真实作业数据和成绩记录）
  generateStudentData: function(student, scores, assignments) {
    // 获取学生所在班级信息
    const studentClass = storage.getClassById(student.classId);
    
    const studentInfo = {
      name: student.name,
      class: studentClass ? studentClass.name : '未知班级',
      studentNumber: student.studentNumber || '未设置'
    };

    // 获取该学生的所有成绩记录
    const studentScores = storage.getScoresByStudentId(student.id);
    
    // 处理真实作业数据
    const assignmentsData = assignments.map(assignment => {
      // 查找该学生在这个作业上的成绩记录
      const scoreRecord = studentScores.find(score => score.assignmentId === assignment.id);
      
      // 转换作业数据格式以匹配显示需求
      const assignmentData = {
        id: assignment.id,
        title: assignment.name,
        date: assignment.createdAt ? new Date(assignment.createdAt).toLocaleDateString('zh-CN') : '未知日期',
        type: assignment.type || '作业',
        maxScore: assignment.totalScore || 0, // 使用作业的实际满分，不设置默认值100
        totalScore: 0,
        questions: [],
        expanded: false,
        wrongQuestions: []
      };

      // 如果有成绩记录，使用真实成绩
      if (scoreRecord) {
        assignmentData.totalScore = scoreRecord.totalScore || 0;
        
        // 优先使用 hierarchicalScores 数据（新的分层级评分）
        if (scoreRecord.hierarchicalScores && Array.isArray(scoreRecord.hierarchicalScores) && scoreRecord.hierarchicalScores.length > 0) {
          assignmentData.questions = this.convertHierarchicalScores(scoreRecord.hierarchicalScores);
        } else if (assignment.questionStructure && Array.isArray(assignment.questionStructure)) {
          // 使用作业结构和旧的分数数据
          assignmentData.questions = this.convertQuestionStructure(assignment.questionStructure, scoreRecord);
        } else {
          // 兼容旧版本数据结构
          assignmentData.questions = this.generateCompatibleQuestions(assignment, scoreRecord);
        }
        
        // 提取错题信息
        assignmentData.wrongQuestions = this.extractWrongQuestions(assignmentData.questions);
      } else {
        // 如果没有成绩记录，显示为未完成
        assignmentData.totalScore = 0;
        if (assignment.questionStructure && Array.isArray(assignment.questionStructure)) {
          assignmentData.questions = this.convertQuestionStructure(assignment.questionStructure, {});
        } else {
          assignmentData.questions = this.generateCompatibleQuestions(assignment, null);
        }
      }

      return assignmentData;
    });

    // 收集所有错题
    const wrongQuestions = [];
    assignmentsData.forEach(assignment => {
      if (assignment.wrongQuestions && assignment.wrongQuestions.length > 0) {
        assignment.wrongQuestions.forEach(wrongQ => {
          // 识别题目层级
        const level = this.getQuestionLevel(wrongQ.questionPath);
        wrongQuestions.push({
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          questionPath: wrongQ.questionPath,
          reason: wrongQ.reason || '答案错误',
          lostScore: wrongQ.lostScore, // 直接使用extractWrongQuestions函数计算的lostScore
          level: level.class,
          levelText: level.text
        });
        });
      }
    });

    // 计算错题汇总和层级统计
    const totalErrors = wrongQuestions.length;
    const totalLostScore = wrongQuestions.reduce((sum, item) => sum + item.lostScore, 0);
    
    // 计算各层级错题数量
    const errorStats = {
      level1: wrongQuestions.filter(item => item.level === 'level1').length,
      level2: wrongQuestions.filter(item => item.level === 'level2').length,
      level3: wrongQuestions.filter(item => item.level === 'level3').length
    };

    // 计算统计数据
    const totalAssignments = assignmentsData.length;
    const completedAssignments = assignmentsData.filter(a => a.totalScore > 0).length;
    const totalScore = assignmentsData.reduce((sum, a) => sum + a.totalScore, 0);
    const maxScore = assignmentsData.reduce((sum, a) => sum + a.maxScore, 0);
    const averageScore = totalAssignments > 0 && maxScore > 0 ? Math.round(totalScore / maxScore * 100) : 0;

    const scoreOverview = {
      totalAssignments: totalAssignments,
      completedAssignments: completedAssignments,
      averageScore: averageScore,
      totalScore: totalScore,
      maxScore: maxScore,
      totalErrors: totalErrors,
      totalLostScore: totalLostScore
    };

    return {
      studentInfo,
      assignments: assignmentsData,
      wrongQuestions,
      scoreOverview,
      errorStats
    };
  },

  // 转换 hierarchicalScores 数据为题目结构
  convertHierarchicalScores: function(hierarchicalScores) {
    return hierarchicalScores.map(question => {
      const convertedQuestion = {
        id: question.id || question.title,
        title: question.title,
        maxScore: question.maxScore || 0,
        calculatedScore: question.score || 0,
        score: question.score || 0,
        expanded: false,
        subQuestions: []
      };

      // 处理子题
      if (question.subQuestions && Array.isArray(question.subQuestions) && question.subQuestions.length > 0) {
        convertedQuestion.subQuestions = question.subQuestions.map(subQuestion => {
          const convertedSubQuestion = {
            id: subQuestion.id || subQuestion.title,
            title: subQuestion.title,
            maxScore: subQuestion.maxScore || 0,
            calculatedScore: subQuestion.score || 0,
            score: subQuestion.score || 0,
            expanded: false,
            subQuestions: []
          };

          // 处理三级子题
          if (subQuestion.subQuestions && Array.isArray(subQuestion.subQuestions) && subQuestion.subQuestions.length > 0) {
            convertedSubQuestion.subQuestions = subQuestion.subQuestions.map(subSubQuestion => ({
              id: subSubQuestion.id || subSubQuestion.title,
              title: subSubQuestion.title,
              maxScore: subSubQuestion.maxScore || 0,
              calculatedScore: subSubQuestion.score || 0,
              score: subSubQuestion.score || 0,
              expanded: false,
              subQuestions: []
            }));
          }

          return convertedSubQuestion;
        });
      }

      return convertedQuestion;
    });
  },

  // 转换题目结构并计算分数
  convertQuestionStructure: function(questionStructure, scoreRecord) {
    if (!questionStructure || !Array.isArray(questionStructure)) {
      return [];
    }

    // 获取成绩数据
    const subScores = scoreRecord ? (scoreRecord.subScores || []) : [];
    const questionScores = scoreRecord ? (scoreRecord.questionScores || []) : [];
    
    // 全局子题分数索引，用于跟踪所有子题的分数
    let globalSubScoreIndex = 0;
    
    return questionStructure.map((question, index) => {
      const convertedQuestion = {
        id: index + 1,
        title: question.title || `第${index + 1}题`,
        maxScore: question.score || question.maxScore || 10,
        expanded: false,
        subQuestions: []
      };

      // 如果有子题，则主题分数为所有子题分数之和
      if (question.subQuestions && Array.isArray(question.subQuestions) && question.subQuestions.length > 0) {
        let totalSubScore = 0;
        
        convertedQuestion.subQuestions = question.subQuestions.map((subQ, subIndex) => {
          const convertedSubQuestion = {
            id: `${index + 1}_${subIndex + 1}`,
            title: subQ.title || `第${subIndex + 1}小题`,
            maxScore: subQ.score || subQ.maxScore || 5,
            expanded: false,
            subQuestions: []
          };

          // 如果有三级子题，则二级题分数为所有三级子题分数之和
          if (subQ.subQuestions && Array.isArray(subQ.subQuestions) && subQ.subQuestions.length > 0) {
            let totalSubSubScore = 0;
            
            convertedSubQuestion.subQuestions = subQ.subQuestions.map((subSubQ, subSubIndex) => {
              const subSubQuestionScore = subScores[globalSubScoreIndex] !== undefined ? subScores[globalSubScoreIndex] : 0;
              globalSubScoreIndex++;
              totalSubSubScore += subSubQuestionScore;
              
              return {
                id: `${index + 1}_${subIndex + 1}_${subSubIndex + 1}`,
                title: subSubQ.title || `第${subSubIndex + 1}小小题`,
                maxScore: subSubQ.score || subSubQ.maxScore || 2,
                calculatedScore: subSubQuestionScore,
                score: subSubQuestionScore
              };
            });
            
            // 二级题分数为所有三级子题分数之和
            convertedSubQuestion.calculatedScore = totalSubSubScore;
            convertedSubQuestion.score = totalSubSubScore;
            totalSubScore += totalSubSubScore;
          } else {
            // 没有三级子题，直接使用subScores中的分数
            const subQuestionScore = subScores[globalSubScoreIndex] !== undefined ? subScores[globalSubScoreIndex] : 0;
            globalSubScoreIndex++;
            convertedSubQuestion.calculatedScore = subQuestionScore;
            convertedSubQuestion.score = subQuestionScore;
            totalSubScore += subQuestionScore;
          }

          return convertedSubQuestion;
        });
        
        // 主题分数为所有子题分数之和
        convertedQuestion.calculatedScore = totalSubScore;
        convertedQuestion.score = totalSubScore;
      } else {
        // 没有子题，使用全局子题分数索引
        const questionScore = subScores[globalSubScoreIndex] !== undefined ? subScores[globalSubScoreIndex] : 0;
        globalSubScoreIndex++;
        convertedQuestion.calculatedScore = questionScore;
        convertedQuestion.score = questionScore;
      }

      return convertedQuestion;
    });
  },

  // 生成兼容旧版本的题目结构
  generateCompatibleQuestions: function(assignment, scoreRecord) {
    const questions = [];
    const questionCount = assignment.questionCount || 5; // 默认5题
    
    // 获取成绩数据
    const subScores = scoreRecord ? (scoreRecord.subScores || []) : [];
    const questionScores = scoreRecord ? (scoreRecord.questionScores || []) : [];

    for (let i = 0; i < questionCount; i++) {
      // 对于兼容模式，优先使用questionScores，如果没有则使用subScores
      const questionScore = questionScores[i] !== undefined ? questionScores[i] : 
                           (subScores[i] !== undefined ? subScores[i] : 0);
      
      questions.push({
        id: i + 1,
        title: `第${i + 1}题`,
        maxScore: assignment.scoringOptions?.customScores?.[i] || 10,
        calculatedScore: questionScore,
        score: questionScore,
        expanded: false,
        subQuestions: []
      });
    }

    return questions;
  },

  // 识别题目层级
  getQuestionLevel: function(questionPath) {
    // 统计 " - " 的数量来判断层级
    const separatorCount = (questionPath.match(/ - /g) || []).length;
    
    switch(separatorCount) {
      case 0:
        return { class: 'level1', text: '一级' };
      case 1:
        return { class: 'level2', text: '二级' };
      case 2:
        return { class: 'level3', text: '三级' };
      default:
        return { class: 'level3', text: '三级+' };
    }
  },

  // 提取错题信息
  extractWrongQuestions: function(questions) {
    const wrongQuestions = [];

    questions.forEach(question => {
      // 检查是否有子题
      if (question.subQuestions && question.subQuestions.length > 0) {
        // 有子题的情况，不统计一级题目，检查子题
        question.subQuestions.forEach(subQuestion => {
          // 检查二级题目是否有三级子题
          if (subQuestion.subQuestions && subQuestion.subQuestions.length > 0) {
            // 有三级子题的情况，不统计二级题目，只统计三级题目
            subQuestion.subQuestions.forEach(subSubQuestion => {
              const lostScore = subSubQuestion.maxScore - subSubQuestion.score;
              if (lostScore > 0) {
                const levelInfo = this.getQuestionLevel(`${question.title} - ${subQuestion.title} - ${subSubQuestion.title}`);
                wrongQuestions.push({
                  questionPath: `${question.title} - ${subQuestion.title} - ${subSubQuestion.title}`,
                  reason: subSubQuestion.score === 0 ? '完全错误' : '不完全错误',
                  lostScore: lostScore,
                  level: levelInfo.class,
                  levelText: levelInfo.text
                });
              }
            });
          } else {
            // 没有三级子题的情况，统计二级题目
            const lostScore = subQuestion.maxScore - subQuestion.score;
            if (lostScore > 0) {
              const levelInfo = this.getQuestionLevel(`${question.title} - ${subQuestion.title}`);
              wrongQuestions.push({
                questionPath: `${question.title} - ${subQuestion.title}`,
                reason: subQuestion.score === 0 ? '完全错误' : '不完全错误',
                lostScore: lostScore,
                level: levelInfo.class,
                levelText: levelInfo.text
              });
            }
          }
        });
      } else {
        // 没有子题的情况，统计一级题目
        const lostScore = question.maxScore - question.score;
        if (lostScore > 0) {
          const levelInfo = this.getQuestionLevel(question.title);
          wrongQuestions.push({
            questionPath: question.title,
            reason: question.score === 0 ? '完全错误' : '不完全错误',
            lostScore: lostScore,
            level: levelInfo.class,
            levelText: levelInfo.text
          });
        }
      }
    });

    return wrongQuestions;
  },

  hashCode: function(str) {    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  },

  // 基于种子的随机数生成器
  seededRandom: function(seed) {
    let currentSeed = seed;
    return function() {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
  },

  // 生成单个作业的成绩数据
  generateAssignmentScore: function(template, assignmentId, random) {
    const assignment = {
      id: assignmentId,
      title: template.title,
      date: template.date,
      maxScore: template.maxScore,
      totalScore: 0,
      questions: []
    };

    // 为每个题目生成成绩
    template.questions.forEach(questionTemplate => {
      const question = this.generateQuestionScore(questionTemplate, random);
      assignment.questions.push(question);
      assignment.totalScore += question.calculatedScore || question.score || 0;
    });

    return assignment;
  },

  // 生成单个题目的成绩数据
  generateQuestionScore: function(questionTemplate, random) {
    const question = {
      id: questionTemplate.id,
      level: questionTemplate.level,
      title: questionTemplate.title,
      maxScore: questionTemplate.maxScore
    };

    if (questionTemplate.subQuestions) {
      // 有子题目的情况
      question.subQuestions = [];
      let totalScore = 0;

      questionTemplate.subQuestions.forEach(subTemplate => {
        const subQuestion = this.generateQuestionScore(subTemplate, random);
        question.subQuestions.push(subQuestion);
        totalScore += subQuestion.calculatedScore || subQuestion.score || 0;
      });

      question.calculatedScore = totalScore;
      question.isCorrect = totalScore >= questionTemplate.maxScore * 0.8;
    } else {
      // 没有子题目的情况
      const scoreRatio = 0.6 + random() * 0.4; // 60%-100%的得分率
      question.score = Math.round(questionTemplate.maxScore * scoreRatio);
      question.isCorrect = question.score >= questionTemplate.maxScore * 0.8;
    }

    return question;
  },

  // 生成错题数据
  generateWrongQuestions: function(assignments, random) {
    const wrongQuestions = [];
    
    // 从作业中提取错题
    assignments.forEach(assignment => {
      assignment.questions.forEach(question => {
        if (question.subQuestions) {
          // 检查子题目
          question.subQuestions.forEach(subQuestion => {
            if (!subQuestion.isCorrect && random() < 0.3) { // 30%概率加入错题集
              wrongQuestions.push({
                id: wrongQuestions.length + 1,
                assignmentTitle: assignment.title,
                questionTitle: `${question.title} - ${subQuestion.title}`,
                questionContent: this.generateQuestionContent(assignment.title, subQuestion.title, random),
                studentAnswer: this.generateWrongAnswer(subQuestion, random),
                correctAnswer: this.generateCorrectAnswer(subQuestion, random),
                analysis: this.generateExplanation(subQuestion, random)
              });
            }
            
            // 检查三级子题目
            if (subQuestion.subQuestions) {
              subQuestion.subQuestions.forEach(subSubQuestion => {
                if (!subSubQuestion.isCorrect && random() < 0.3) {
                  wrongQuestions.push({
                    id: wrongQuestions.length + 1,
                    assignmentTitle: assignment.title,
                    questionTitle: `${question.title} - ${subQuestion.title} - ${subSubQuestion.title}`,
                    questionContent: this.generateQuestionContent(assignment.title, subSubQuestion.title, random),
                    studentAnswer: this.generateWrongAnswer(subSubQuestion, random),
                    correctAnswer: this.generateCorrectAnswer(subSubQuestion, random),
                    analysis: this.generateExplanation(subSubQuestion, random)
                  });
                }
              });
            }
          });
        } else if (!question.isCorrect && random() < 0.3) {
          // 检查主题目
          wrongQuestions.push({
            id: wrongQuestions.length + 1,
            assignmentTitle: assignment.title,
            questionTitle: question.title,
            questionContent: this.generateQuestionContent(assignment.title, question.title, random),
            studentAnswer: this.generateWrongAnswer(question, random),
            correctAnswer: this.generateCorrectAnswer(question, random),
            analysis: this.generateExplanation(question, random)
          });
        }
      });
    });

    // 如果错题太少，添加一些默认错题
    if (wrongQuestions.length < 2) {
      wrongQuestions.push({
        id: wrongQuestions.length + 1,
        assignmentTitle: '数学第一单元测试',
        questionTitle: '加法运算',
        questionContent: '计算：125 + 378 = ?',
        studentAnswer: '493',
        correctAnswer: '503',
        analysis: '计算过程中进位错误'
      });
      
      wrongQuestions.push({
        id: wrongQuestions.length + 1,
        assignmentTitle: '语文阅读理解',
        questionTitle: '语法分析',
        questionContent: '请分析句子"春天来了"的句子成分',
        studentAnswer: '主语：春天，谓语：来',
        correctAnswer: '主语：春天，谓语：来了',
        analysis: '"来了"是完整的谓语，不能拆分'
      });
    }

    return wrongQuestions;
  },

  // 生成题目内容
  generateQuestionContent: function(assignmentTitle, questionTitle, random) {
    const mathQuestions = [
      '计算：125 + 378 = ?',
      '小明有15个苹果，吃了3个，还剩多少个？',
      '一个长方形的长是8cm，宽是5cm，求面积',
      '解方程：2x + 5 = 13'
    ];
    
    const chineseQuestions = [
      '请分析句子"春天来了"的句子成分',
      '解释词语"生机勃勃"的含义',
      '这段话表达了作者什么样的情感？',
      '找出文中的比喻句并分析其作用'
    ];
    
    const englishQuestions = [
      'Choose the correct word: I ___ (go/goes) to school every day.',
      'Translate: "我喜欢读书"',
      'What does "beautiful" mean?',
      'Complete the sentence: She is ___ than her sister.'
    ];
    
    if (assignmentTitle.includes('数学')) {
      return mathQuestions[Math.floor(random() * mathQuestions.length)];
    } else if (assignmentTitle.includes('语文')) {
      return chineseQuestions[Math.floor(random() * chineseQuestions.length)];
    } else if (assignmentTitle.includes('英语')) {
      return englishQuestions[Math.floor(random() * englishQuestions.length)];
    }
    
    return '题目内容';
  },

  // 生成错误答案
  generateWrongAnswer: function(question, random) {
    const wrongAnswers = [
      '493', '25公里', '主语：春天，谓语：来', 'go', '我爱书',
      '40', '12个', '很漂亮', 'more beautiful', '计算错误'
    ];
    return wrongAnswers[Math.floor(random() * wrongAnswers.length)];
  },

  // 生成正确答案
  generateCorrectAnswer: function(question, random) {
    const correctAnswers = [
      '503', '30公里', '主语：春天，谓语：来了', 'goes', '我喜欢读书',
      '40cm²', '12个', '充满生命力', 'more beautiful', '按正确步骤计算'
    ];
    return correctAnswers[Math.floor(random() * correctAnswers.length)];
  },

  // 生成解释
  generateExplanation: function(question, random) {
    const explanations = [
      '计算过程中进位错误',
      '应该用速度乘以时间：15 × 2 = 30',
      '"来了"是完整的谓语，不能拆分',
      '主语是第三人称单数时，动词要加s',
      '需要仔细理解词汇含义',
      '面积 = 长 × 宽',
      '需要掌握基础语法规则',
      '要注意比较级的正确用法'
    ];
    return explanations[Math.floor(random() * explanations.length)];
  },

  // 筛选作业
  filterAssignments: function(e) {
    const filterType = e.currentTarget.dataset.filter;
    let filteredAssignments = [...this.data.assignments];

    switch (filterType) {
      case 'recent':
        filteredAssignments = filteredAssignments.slice(0, 3);
        break;
      case 'high':
        filteredAssignments = filteredAssignments.filter(a => (a.totalScore / a.maxScore) >= 0.8);
        break;
      case 'low':
        filteredAssignments = filteredAssignments.filter(a => (a.totalScore / a.maxScore) < 0.6);
        break;
      default:
        // 显示全部
        break;
    }

    this.setData({
      filterType: filterType,
      filteredAssignments: filteredAssignments
    });
  },

  // 切换过滤器
  switchFilter: function(e) {
    const filter = e.currentTarget.dataset.filter;
    let filteredAssignments = [...this.data.assignments];

    switch (filter) {
      case 'completed':
        filteredAssignments = filteredAssignments.filter(a => a.totalScore > 0);
        break;
      case 'pending':
        filteredAssignments = filteredAssignments.filter(a => a.totalScore === 0);
        break;
      default:
        // 显示全部
        break;
    }

    this.setData({
      currentFilter: filter,
      filteredAssignments: filteredAssignments
    });
  },

  // 展开/收起作业详情
  toggleAssignmentDetail: function(e) {
    const assignmentId = e.currentTarget.dataset.id;
    const assignments = this.data.filteredAssignments.map(assignment => {
      if (assignment.id === assignmentId) {
        assignment.expanded = !assignment.expanded;
      }
      return assignment;
    });

    this.setData({
      filteredAssignments: assignments
    });
  },

  // 展开/收起题目详情
  toggleQuestionDetail: function(e) {
    const { assignmentId, questionId } = e.currentTarget.dataset;
    const assignments = this.data.filteredAssignments.map(assignment => {
      if (assignment.id === assignmentId) {
        assignment.questions = assignment.questions.map(question => {
          if (question.id === questionId) {
            question.expanded = !question.expanded;
          }
          return question;
        });
      }
      return assignment;
    });

    this.setData({
      filteredAssignments: assignments
    });
  },

  // 展开/收起子题目详情
  toggleSubQuestionDetail: function(e) {
    const { assignmentId, questionId, subQuestionId } = e.currentTarget.dataset;
    const assignments = this.data.filteredAssignments.map(assignment => {
      if (assignment.id === assignmentId) {
        assignment.questions = assignment.questions.map(question => {
          if (question.id === questionId && question.subQuestions) {
            question.subQuestions = question.subQuestions.map(subQuestion => {
              if (subQuestion.id === subQuestionId && subQuestion.subQuestions) {
                subQuestion.expanded = !subQuestion.expanded;
              }
              return subQuestion;
            });
          }
          return question;
        });
      }
      return assignment;
    });

    this.setData({
      filteredAssignments: assignments
    });
  },

  // 查看作业详情
  viewAssignmentDetail: function(e) {
    const assignmentId = e.currentTarget.dataset.assignmentId;
    wx.navigateTo({
      url: `/pages/assignment-detail/assignment-detail?assignmentId=${assignmentId}&studentId=${this.data.studentId}`
    });
  },

  // 显示分享模态框
  showShare: function() {
    this.setData({
      showShareModal: true
    });
  },

  // 隐藏分享模态框
  hideShare: function() {
    this.setData({
      showShareModal: false
    });
  },

  // 分享到微信
  shareToWeChat: function() {
    // 显示分享菜单
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    // 直接提示用户使用右上角分享按钮
    wx.showToast({
      title: '请点击右上角分享按钮',
      icon: 'none',
      duration: 2000
    });
    
    this.hideShare();
  },

  // 阻止事件冒泡
  stopPropagation: function(e) {
    // 阻止事件冒泡，防止点击模态框内容时关闭模态框
  },

  // 复制文本
  copyText: function() {
    const { studentInfo, scoreOverview, assignments, wrongQuestions, errorStats } = this.data;

    let text = `📊 ${studentInfo.name}的成绩报告\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👨‍🎓 姓名：${studentInfo.name}\n`;
    text += `🏫 班级：${studentInfo.class}\n`;
    text += `🆔 学号：${studentInfo.studentNumber}\n\n`;

    text += `📊 成绩概览\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📝 作业总数：${scoreOverview.totalAssignments}份\n`;
    text += `⭐ 平均分：${scoreOverview.averageScore}分\n`;
    text += `🎯 总得分：${scoreOverview.totalScore}/${scoreOverview.maxScore}分\n`;
    text += `💔 总失分：${scoreOverview.totalLostScore || 0}分\n\n`;

    text += `❌ 错题汇总\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🔢 错题总数：${scoreOverview.totalErrors || 0}道\n`;

    if (errorStats && (errorStats.level1 > 0 || errorStats.level2 > 0 || errorStats.level3 > 0)) {
      text += `📊 层级分布：\n`;
      text += `   🟢 一级错题：${errorStats.level1}道\n`;
      text += `   🟡 二级错题：${errorStats.level2}道\n`;
      text += `   🔴 三级错题：${errorStats.level3}道\n`;
    }

    // 全量错题详情
    if (wrongQuestions && wrongQuestions.length > 0) {
      text += `\n🔍 错题详情：\n`;
      wrongQuestions.forEach((error, idx) => {
        text += `${idx + 1}. ${error.assignmentTitle} - ${error.questionPath}\n`;
        text += `   💰 失分：${error.lostScore}分 | 📝 ${error.reason}\n`;
      });
    }

    text += `\n📝 作业详情\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    assignments.forEach((assignment, i) => {
      const rate = assignment.maxScore > 0 ? Math.round((assignment.totalScore / assignment.maxScore) * 100) : 0;
      text += `${i + 1}. ${assignment.title}\n`;
      text += `   📊 ${assignment.totalScore}/${assignment.maxScore}分 (${rate}%)\n`;
      text += `   📅 ${assignment.date}\n`;
    });

    const payloadObj = this.buildSharePayload(3000);
    const shareUrl = `/pages/student-scores/student-scores?payload=${payloadObj.encoded}`;

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📱 生成时间：${new Date().toLocaleString()}\n`;
    
    // 根据压缩级别提供不同的提示
    let compressionTip = '';
    if (payloadObj.compressionLevel === 0) {
      compressionTip = '（完整数据）';
    } else if (payloadObj.compressionLevel === 1) {
      compressionTip = '（优化格式）';
    } else if (payloadObj.compressionLevel === 2) {
      compressionTip = `（重点错题 ${payloadObj.compressedLength}/${payloadObj.originalLength}）`;
    } else if (payloadObj.compressionLevel === 3) {
      compressionTip = '（核心数据）';
    } else {
      compressionTip = '（精简版）';
    }
    
    text += `🔗 查看详情：${shareUrl}${compressionTip}\n`;
    text += `🏫 作业检查系统`;

    // 长度保护：超长自动压缩摘要
    const MAX_TEXT = 3800;
    if (text.length > MAX_TEXT) {
      let maxErr = Math.min(wrongQuestions.length, 50);
      let maxAssign = Math.min(assignments.length, 20);

      const buildCompressed = () => {
        let t = `📊 ${studentInfo.name}的成绩报告（内容较多，已压缩）\n`;
        t += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        t += `👨‍🎓 姓名：${studentInfo.name}\n`;
        t += `🏫 班级：${studentInfo.class}\n`;
        t += `📝 作业总数：${scoreOverview.totalAssignments}份｜⭐ 平均分：${scoreOverview.averageScore}分\n`;
        t += `🎯 总得分：${scoreOverview.totalScore}/${scoreOverview.maxScore}分｜💔 总失分：${scoreOverview.totalLostScore || 0}分\n\n`;
        t += `❌ 错题（前${maxErr}条）：\n`;
        for (let i = 0; i < Math.min(maxErr, wrongQuestions.length); i++) {
          const e = wrongQuestions[i];
          t += `${i + 1}. ${e.assignmentTitle} - ${e.questionPath}\n`;
          t += `   失分：${e.lostScore}分｜${e.reason}\n`;
        }
        t += `\n📝 作业（前${maxAssign}条）：\n`;
        for (let i = 0; i < Math.min(maxAssign, assignments.length); i++) {
          const a = assignments[i];
          const rate = a.maxScore > 0 ? Math.round((a.totalScore / a.maxScore) * 100) : 0;
          t += `${i + 1}. ${a.title}｜${a.totalScore}/${a.maxScore}分（${rate}%）｜${a.date}\n`;
        }
        t += `\n🔗 查看详情：${shareUrl}${payloadObj.truncated ? '（载荷已部分截断）' : ''}\n`;
        t += `📱 生成时间：${new Date().toLocaleString()}\n`;
        t += `🏫 作业检查系统`;
        return t;
      };

      let compressed = buildCompressed();
      // 若仍超长，逐步减少条数
      let attempts = 0;
      while (compressed.length > MAX_TEXT && attempts < 5) {
        maxErr = Math.max(Math.floor(maxErr * 0.7), 10);
        maxAssign = Math.max(Math.floor(maxAssign * 0.7), 8);
        compressed = buildCompressed();
        attempts++;
      }
      text = compressed;
    }

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
        this.hideShare();
      },
      fail: () => { wx.showToast({ title: '复制失败', icon: 'none' }); }
    });
  },

  // 保存图片，按内容动态拉伸高度
  saveImage: function() {
    wx.showLoading({ title: '生成图片中...' });
    const query = wx.createSelectorQuery();
    query.select('#scoreCanvas').fields({ node: true, size: true }).exec((res) => {
      if (res[0]) {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const width = res[0].width;

        // 动态高度：基础段+错题列表+作业列表+底部
        const base = 380;
        const errorsH = (this.data.wrongQuestions.length) * 40;
        const assignsH = (this.data.assignments.length) * 50;
        const footer = 80;
        const dynamicHeight = Math.min(base + errorsH + assignsH + footer, 3600);
        const isTruncated = dynamicHeight >= 3600 && (base + errorsH + assignsH + footer) > 3600;

        canvas.width = width * dpr;
        canvas.height = dynamicHeight * dpr;
        ctx.scale(dpr, dpr);

        this.drawScoreReport(ctx, width, dynamicHeight, isTruncated);

        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvas,
            success: (result) => {
              wx.saveImageToPhotosAlbum({
                filePath: result.tempFilePath,
                success: () => {
                  wx.hideLoading();
                  wx.showToast({ title: '保存成功', icon: 'success' });
                  this.hideShare();
                },
                fail: () => {
                  wx.hideLoading();
                  wx.showToast({ title: '保存失败', icon: 'none' });
                }
              });
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '生成图片失败', icon: 'none' });
            }
          });
        }, 600);
      } else {
        wx.hideLoading();
        wx.showToast({ title: '获取canvas失败', icon: 'none' });
      }
    });
  },

  // 绘制文本换行辅助
  drawWrappedText: function(ctx, text, x, startY, maxWidth, lineHeight) {
    let y = startY;
    let line = '';
    const chars = (text || '').split('');
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      if (ctx.measureText(testLine).width > maxWidth) {
        ctx.fillText(line, x, y);
        line = chars[i];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, y);
    return y + lineHeight;
  },

  // 绘制成绩报告（完整错题列表）
  drawScoreReport: function(ctx, width, height, truncatedFlag) {
    const { studentInfo, scoreOverview, assignments, wrongQuestions, errorStats } = this.data;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('学生成绩报告', width / 2, 45);

    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 60);
    ctx.lineTo(width - 30, 60);
    ctx.stroke();

    ctx.fillStyle = '#2c3e50';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`姓名：${studentInfo.name}`, 30, 85);
    ctx.fillText(`班级：${studentInfo.class}`, 30, 105);
    ctx.fillText(`学号：${studentInfo.studentNumber}`, 30, 125);

    ctx.fillStyle = '#3498db';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('📊 成绩概览', 30, 155);

    ctx.fillStyle = '#2c3e50';
    ctx.font = '13px sans-serif';
    ctx.fillText(`作业总数：${scoreOverview.totalAssignments}份`, 30, 180);
    ctx.fillText(`平均分：${scoreOverview.averageScore}分`, 30, 200);
    ctx.fillText(`总得分：${scoreOverview.totalScore}/${scoreOverview.maxScore}分`, 30, 220);
    ctx.fillText(`总失分：${scoreOverview.totalLostScore || 0}分`, 30, 240);

    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('❌ 错题汇总', 30, 270);

    ctx.fillStyle = '#2c3e50';
    ctx.font = '13px sans-serif';
    ctx.fillText(`错题总数：${scoreOverview.totalErrors || 0}道`, 30, 295);

    if (errorStats && (errorStats.level1 > 0 || errorStats.level2 > 0 || errorStats.level3 > 0)) {
      ctx.fillText(`一级错题：${errorStats.level1}道`, 30, 315);
      ctx.fillText(`二级错题：${errorStats.level2}道`, 30, 335);
      ctx.fillText(`三级错题：${errorStats.level3}道`, 30, 355);
    }

    let currentY = 380;

    // 完整错题列表（自动换行）
    if (wrongQuestions && wrongQuestions.length > 0) {
      ctx.fillStyle = '#8e44ad';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('🔍 错题详情', 30, currentY);
      currentY += 25;

      for (let i = 0; i < wrongQuestions.length; i++) {
        const error = wrongQuestions[i];
        ctx.fillStyle = '#2c3e50';
        ctx.font = '11px sans-serif';
        const errorText = `${i + 1}. ${error.assignmentTitle} - ${error.questionPath}`;
        currentY = this.drawWrappedText(ctx, errorText, 30, currentY, width - 60, 15);

        ctx.fillStyle = '#7f8c8d';
        const reasonText = `失分：${error.lostScore}分 | ${error.reason}`;
        currentY = this.drawWrappedText(ctx, reasonText, 30, currentY, width - 60, 15);
        currentY += 8;
      }
    }

    // 作业列表（完整显示）
    ctx.fillStyle = '#27ae60';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('📝 作业详情', 30, currentY + 20);
    currentY += 45;

    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      const rate = assignment.maxScore > 0 ? Math.round((assignment.totalScore / assignment.maxScore) * 100) : 0;
      ctx.fillStyle = '#2c3e50';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${i + 1}. ${assignment.title}`, 30, currentY);
      ctx.fillText(`${assignment.totalScore}/${assignment.maxScore}分 (${rate}%)`, 30, currentY + 15);
      ctx.fillText(`日期：${assignment.date}`, 30, currentY + 30);
      currentY += 50;
    }

    // 底部信息
    if (truncatedFlag) {
      ctx.fillStyle = '#e74c3c';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('内容较多，图片已截断显示', width / 2, height - 60);
    }

    ctx.fillStyle = '#95a5a6';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`生成时间：${new Date().toLocaleString()}`, width / 2, height - 40);
    ctx.fillText('作业检查系统', width / 2, height - 20);
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  },

  // 计算得分率
  getScoreRate: function(score, maxScore) {
    return Math.round((score / maxScore) * 100);
  },

  // 获取得分率对应的样式类
  getScoreClass: function(score, maxScore) {
    const rate = this.getScoreRate(score, maxScore);
    if (rate >= 90) return 'excellent';
    if (rate >= 80) return 'good';
    if (rate >= 70) return 'average';
    return 'poor';
  },

  onReady: function () {
    // 页面初次渲染完成
  },

  onShow: function () {
    // 页面显示
  },

  onHide: function () {
    // 页面隐藏
  },

  onUnload: function () {
    // 页面卸载
  },

  onPullDownRefresh: function () {
    // 下拉刷新
    this.loadStudentData();
    wx.stopPullDownRefresh();
  },

  onReachBottom: function () {
    // 上拉触底
  },

  onShareAppMessage: function () {
    const payloadObj = this.buildSharePayload(3000); // 增加最大长度限制
    
    let title = `${this.data.studentInfo.name}的成绩报告`;
    let shareDesc = '';
    
    // 根据压缩级别提供不同的提示信息
    if (payloadObj.compressionLevel === 0) {
      shareDesc = '完整数据';
    } else if (payloadObj.compressionLevel === 1) {
      shareDesc = '优化格式';
    } else if (payloadObj.compressionLevel === 2) {
      shareDesc = `重点错题${payloadObj.compressedLength}/${payloadObj.originalLength}`;
    } else if (payloadObj.compressionLevel === 3) {
      shareDesc = '核心数据';
    } else {
      shareDesc = '精简版';
    }
    
    // 添加成绩概览信息
    const { scoreOverview } = this.data;
    if (scoreOverview) {
      title += ` | 平均${scoreOverview.averageScore}分`;
      if (scoreOverview.totalErrors > 0) {
        title += ` | ${scoreOverview.totalErrors}道错题`;
      }
    }
    
    return {
      title: title,
      path: `/pages/student-scores/student-scores?payload=${payloadObj.encoded}`,
      imageUrl: '', // 可以设置自定义分享图片
      success: function(res) {
        console.log('分享成功', res);
        wx.showToast({
          title: '分享成功',
          icon: 'success',
          duration: 1500
        });
      },
      fail: function(res) {
        console.log('分享失败', res);
        wx.showToast({
          title: '分享失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    };
  }
});