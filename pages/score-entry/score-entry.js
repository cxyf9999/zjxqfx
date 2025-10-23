// score-entry.js
const storage = require('../../utils/storage')
const util = require('../../utils/util')

Page({
  data: {
    assignmentId: '',
    assignmentInfo: {},
    students: [],
    filteredStudents: [],
    currentStudent: null,
    currentStudentId: '',
    currentScore: {
      totalScore: '',
      subScores: [],
      questionScores: [],
      comment: '',
      hierarchicalScores: [] // 新增：分层级分数结构
    },
    commentLength: 0,
    filterType: 'ungraded',
    gradedCount: 0,
    totalStudents: 0,
    isEditing: false,
    canSave: false,
    hasNextStudent: false,
    // 新增：评分配置
    scoreButtons: [0, 1, 2, 3, 4, 5, 6, 7, 8], // 默认分数按钮
    customScoreButtons: [], // 自定义分数按钮
    showCustomScoreInput: false, // 是否显示自定义分数输入
    customScoreValue: '', // 自定义分数值
    currentCustomTarget: null // 当前自定义分数输入的目标题目
  },

  onLoad(options) {
    if (options.assignmentId) {
      this.setData({
        assignmentId: options.assignmentId
      })
      this.loadData()
    } else {
      util.showError('缺少作业信息')
      wx.navigateBack()
    }
  },

  // 加载数据
  loadData() {
    const assignment = storage.getAssignmentById(this.data.assignmentId)
    if (!assignment) {
      util.showError('作业不存在')
      wx.navigateBack()
      return
    }

    const students = storage.getStudentsByClassId(assignment.classId)
    const scores = storage.getScoresByAssignmentId(this.data.assignmentId)

    // 为学生添加批改状态
    const studentsWithStatus = students.map(student => {
      const score = scores.find(s => s.studentId === student.id)
      return {
        ...student,
        isGraded: !!score,
        totalScore: score ? score.totalScore : 0
      }
    })

    // 计算总分
    let totalMaxScore = 0
    if (assignment.scoringOptions && assignment.scoringOptions.mode === 'custom' && assignment.scoringOptions.customScores) {
      totalMaxScore = assignment.scoringOptions.customScores.reduce((sum, score) => sum + score, 0)
    } else if (assignment.scoringOptions && assignment.scoringOptions.mode === 'standard') {
      totalMaxScore = assignment.questionCount * 10
    }

    this.setData({
      assignmentInfo: {
        ...assignment,
        totalMaxScore: totalMaxScore
      },
      students: studentsWithStatus,
      totalStudents: students.length,
      gradedCount: scores.length
    })

    this.filterStudents()
    this.initScoreData()
  },

  // 初始化分数数据结构
  initScoreData() {
    const assignment = this.data.assignmentInfo
    let subScores = []
    let questionScores = []

    if (assignment.scoringOptions && assignment.scoringOptions.mode === 'standard') {
      if (assignment.hasSubQuestions && assignment.subQuestionCounts) {
        subScores = new Array(assignment.subQuestionCounts.length).fill('')
      }
    } else if (assignment.scoringOptions && assignment.scoringOptions.mode === 'custom') {
      if (assignment.scoringOptions.customScores) {
        questionScores = new Array(assignment.scoringOptions.customScores.length).fill('')
      }
    }

    // 初始化分层级评分数据
    this.initHierarchicalScores()

    this.setData({
      'currentScore.subScores': subScores,
      'currentScore.questionScores': questionScores
    })
  },

  // 生成评分按钮数组
  generateScoreButtons(maxScore) {
    const buttons = []
    for (let i = 0; i <= maxScore; i++) {
      buttons.push(i)
    }
    return buttons
  },

  // 初始化分层级评分数据
  initHierarchicalScores() {
    const assignment = this.data.assignmentInfo
    const hierarchicalScores = []

    // 如果作业有questionStructure（三级题目结构）
    if (assignment.questionStructure && Array.isArray(assignment.questionStructure)) {
      assignment.questionStructure.forEach((level1, level1Index) => {
        // 计算一级题目的最大分数
        let level1MaxScore = 0
        if (level1.subQuestions && Array.isArray(level1.subQuestions) && level1.subQuestions.length > 0) {
          // 如果有子题目，计算子题目分数总和
          level1.subQuestions.forEach(level2 => {
            if (level2.subQuestions && Array.isArray(level2.subQuestions) && level2.subQuestions.length > 0) {
              // 二级题目有三级题目，累加三级题目分数
              level2.subQuestions.forEach(level3 => {
                // 修复：正确处理分数，包括0分的情况，避免使用默认值
                level1MaxScore += level3.score !== undefined ? level3.score : 2
              })
            } else {
              // 二级题目没有三级题目，使用二级题目分数
              level1MaxScore += level2.score !== undefined ? level2.score : 5
            }
          })
        } else {
          // 没有子题目，使用设定的分数或默认值
          level1MaxScore = level1.score !== undefined ? level1.score : 10
        }

        const level1Score = {
          id: `level1_${level1Index}`,
          title: level1.title || `第${level1Index + 1}大题`,
          level: 1,
          score: 0,
          maxScore: level1MaxScore,
          scoreButtons: this.generateScoreButtons(level1MaxScore),
          subQuestions: []
        }

        // 处理二级题目
        if (level1.subQuestions && Array.isArray(level1.subQuestions)) {
          level1.subQuestions.forEach((level2, level2Index) => {
            // 计算二级题目的最大分数
            let level2MaxScore = 0
            if (level2.subQuestions && Array.isArray(level2.subQuestions) && level2.subQuestions.length > 0) {
              // 如果有三级题目，计算三级题目分数总和
              level2.subQuestions.forEach(level3 => {
                // 修复：正确处理分数，包括0分的情况，避免使用默认值
                level2MaxScore += level3.score !== undefined ? level3.score : 2
              })
            } else {
              // 没有三级题目，使用设定的分数或默认值
              level2MaxScore = level2.score !== undefined ? level2.score : 5
            }

            const level2Score = {
              id: `level2_${level1Index}_${level2Index}`,
              title: level2.title || `第${level2Index + 1}小题`,
              level: 2,
              score: 0,
              maxScore: level2MaxScore,
              scoreButtons: this.generateScoreButtons(level2MaxScore),
              subQuestions: []
            }

            // 处理三级题目
            if (level2.subQuestions && Array.isArray(level2.subQuestions)) {
              level2.subQuestions.forEach((level3, level3Index) => {
                // 修复：正确处理分数，包括0分的情况，避免使用默认值
                const level3MaxScore = level3.score !== undefined ? level3.score : 2
                const level3Score = {
                  id: `level3_${level1Index}_${level2Index}_${level3Index}`,
                  title: level3.title || `第${level3Index + 1}细分题`,
                  level: 3,
                  score: 0,
                  maxScore: level3MaxScore,
                  scoreButtons: this.generateScoreButtons(level3MaxScore)
                }
                level2Score.subQuestions.push(level3Score)
              })
            }

            level1Score.subQuestions.push(level2Score)
          })
        }

        hierarchicalScores.push(level1Score)
      })
    }

    this.setData({
      'currentScore.hierarchicalScores': hierarchicalScores
    })
  },

  // 筛选学生
  filterStudents() {
    const { students, filterType } = this.data
    let filtered = []

    switch (filterType) {
      case 'all':
        filtered = students
        break
      case 'graded':
        filtered = students.filter(s => s.isGraded)
        break
      case 'ungraded':
        filtered = students.filter(s => !s.isGraded)
        break
    }
    this.setData({
      filteredStudents: filtered
    })

    // 如果当前选中的学生不在筛选结果中，清空选择
    if (this.data.currentStudentId && !filtered.find(s => s.id === this.data.currentStudentId)) {
      this.clearCurrentStudent()
    }
  },

  // 筛选类型变化
  onFilterChange(e) {
    const filterType = e.currentTarget.dataset.type
    this.setData({
      filterType
    })
    this.filterStudents()
  },

  // 选择学生
  onStudentSelect(e) {
    const student = e.currentTarget.dataset.student
    this.setData({
      currentStudent: student,
      currentStudentId: student.id,
      isEditing: student.isGraded
    })

    this.loadStudentScore(student)
    this.updateNavigationState()
  },

  // 加载学生成绩
  loadStudentScore(student) {
    const scores = storage.getScoresByAssignmentId(this.data.assignmentId)
    const existingScore = scores.find(s => s.studentId === student.id)

    if (existingScore) {
      // 编辑模式，加载现有成绩
      const comment = existingScore.comment || '';
      this.setData({
        currentScore: {
          totalScore: existingScore.totalScore ? existingScore.totalScore.toString() : '',
          subScores: existingScore.subScores ? existingScore.subScores.map(s => s.toString()) : this.data.currentScore.subScores,
          questionScores: existingScore.questionScores ? existingScore.questionScores.map(s => s.toString()) : this.data.currentScore.questionScores,
          comment: comment,
          hierarchicalScores: this.data.currentScore.hierarchicalScores
        },
        commentLength: comment.length
      })

      // 恢复分层级评分数据
      if (existingScore.hierarchicalScores) {
        this.setData({
          'currentScore.hierarchicalScores': existingScore.hierarchicalScores
        })
      } else {
        // 如果没有分层级数据，重新初始化
        this.initHierarchicalScores()
      }
    } else {
      // 新建模式，重置成绩
      this.setData({
        'currentScore.totalScore': '',
        'currentScore.comment': '',
        commentLength: 0
      })
      
      // 重置子分数
      const assignment = this.data.assignmentInfo
      if (assignment.scoringOptions && assignment.scoringOptions.mode === 'standard' && assignment.hasSubQuestions && assignment.subQuestionCounts) {
        this.setData({
          'currentScore.subScores': new Array(assignment.subQuestionCounts.length).fill('')
        })
      } else if (assignment.scoringOptions && assignment.scoringOptions.mode === 'custom' && assignment.scoringOptions.customScores) {
        this.setData({
          'currentScore.questionScores': new Array(assignment.scoringOptions.customScores.length).fill('')
        })
      }

      // 重新初始化分层级评分数据
      this.initHierarchicalScores()
    }

    this.validateScore()
  },

  // 更新导航状态
  updateNavigationState() {
    const { filteredStudents, currentStudentId } = this.data
    const currentIndex = filteredStudents.findIndex(s => s.id === currentStudentId)
    const hasNext = currentIndex >= 0 && currentIndex < filteredStudents.length - 1

    this.setData({
      hasNextStudent: hasNext
    })
  },

  // 清空当前学生
  clearCurrentStudent() {
    this.setData({
      currentStudent: null,
      currentStudentId: '',
      isEditing: false,
      hasNextStudent: false
    })
  },

  // 总分输入
  onTotalScoreInput(e) {
    const value = e.detail.value
    this.setData({
      'currentScore.totalScore': value
    })
    this.validateScore()
  },

  // 子题分数输入
  onSubScoreInput(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    const subScores = [...this.data.currentScore.subScores]
    subScores[index] = value

    this.setData({
      'currentScore.subScores': subScores
    })

    // 自动计算总分
    this.calculateTotalFromSub()
    this.validateScore()
  },

  // 题目分数输入
  onQuestionScoreInput(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    const questionScores = [...this.data.currentScore.questionScores]
    questionScores[index] = value

    this.setData({
      'currentScore.questionScores': questionScores
    })

    // 自动计算总分
    this.calculateTotalFromQuestions()
    this.validateScore()
  },

  // 从子题分数计算总分
  calculateTotalFromSub() {
    const { subScores } = this.data.currentScore
    const total = subScores.reduce((sum, score) => {
      const num = parseFloat(score) || 0
      return sum + num
    }, 0)

    this.setData({
      'currentScore.totalScore': total > 0 ? total.toString() : ''
    })
  },

  // 从题目分数计算总分
  calculateTotalFromQuestions() {
    const { questionScores } = this.data.currentScore
    const total = questionScores.reduce((sum, score) => {
      const num = parseFloat(score) || 0
      return sum + num
    }, 0)

    this.setData({
      'currentScore.totalScore': total > 0 ? total.toString() : ''
    })
  },

  // 按钮样式评分：选择分数
  onScoreButtonTap(e) {
    const { questionId, score } = e.currentTarget.dataset
    this.updateHierarchicalScore(questionId, score)
  },

  // 更新分层级分数
  updateHierarchicalScore(questionId, score) {
    const hierarchicalScores = JSON.parse(JSON.stringify(this.data.currentScore.hierarchicalScores))
    
    // 递归更新分数
    const updateScore = (questions) => {
      for (let question of questions) {
        if (question.id === questionId) {
          question.score = score
          return true
        }
        if (question.subQuestions && question.subQuestions.length > 0) {
          if (updateScore(question.subQuestions)) {
            return true
          }
        }
      }
      return false
    }

    updateScore(hierarchicalScores)
    
    // 重新计算所有层级的分数
    this.calculateHierarchicalScores(hierarchicalScores)
    
    this.setData({
      'currentScore.hierarchicalScores': hierarchicalScores
    })

    // 更新总分
    this.calculateTotalFromHierarchical()
    this.validateScore()
  },

  // 计算分层级分数（自动汇总）
  calculateHierarchicalScores(hierarchicalScores) {
    const calculateLevel = (questions) => {
      questions.forEach(question => {
        if (question.subQuestions && question.subQuestions.length > 0) {
          // 先计算子题目
          calculateLevel(question.subQuestions)
          
          // 然后计算当前题目的分数（子题目分数之和）
          question.score = question.subQuestions.reduce((sum, subQ) => sum + (subQ.score || 0), 0)
        }
      })
    }

    calculateLevel(hierarchicalScores)
  },

  // 从分层级分数计算总分
  calculateTotalFromHierarchical() {
    const { hierarchicalScores } = this.data.currentScore
    const total = hierarchicalScores.reduce((sum, question) => sum + (question.score || 0), 0)

    this.setData({
      'currentScore.totalScore': total > 0 ? total.toString() : ''
    })
  },

  // 显示自定义分数输入
  showCustomScoreInput(e) {
    const { questionId, maxScore } = e.currentTarget.dataset
    this.setData({
      showCustomScoreInput: true,
      customScoreValue: '',
      currentCustomTarget: {
        questionId: questionId,
        maxScore: parseInt(maxScore) || 100
      }
    })
  },

  // 隐藏自定义分数输入
  hideCustomScoreInput() {
    this.setData({
      showCustomScoreInput: false,
      customScoreValue: '',
      currentCustomTarget: null
    })
  },

  // 自定义分数输入
  onCustomScoreInput(e) {
    this.setData({
      customScoreValue: e.detail.value
    })
  },

  // 确认自定义分数
  confirmCustomScore() {
    const { currentCustomTarget } = this.data
    if (!currentCustomTarget) {
      util.showError('无效的操作')
      return
    }

    const score = parseFloat(this.data.customScoreValue)
    const maxScore = currentCustomTarget.maxScore
    
    if (isNaN(score) || score < 0) {
      util.showError('请输入有效的分数')
      return
    }

    if (score > maxScore) {
      util.showError(`分数不能超过满分 ${maxScore}`)
      return
    }

    // 更新分数
    this.updateHierarchicalScore(currentCustomTarget.questionId, score)
    this.hideCustomScoreInput()
  },

  // 评语输入
  onCommentInput(e) {
    const comment = e.detail.value
    this.setData({
      'currentScore.comment': comment,
      commentLength: comment.length
    })
  },

  // 验证分数
  validateScore() {
    const { totalScore } = this.data.currentScore
    const canSave = totalScore !== '' && !isNaN(parseFloat(totalScore))

    this.setData({
      canSave
    })
  },

  // 保存成绩
  onSaveScore() {
    if (!this.data.canSave) {
      util.showError('请输入有效的分数')
      return
    }

    const { currentStudent, currentScore, assignmentId, isEditing } = this.data
    
    // 验证总分
    const totalScore = parseFloat(currentScore.totalScore)
    if (isNaN(totalScore) || totalScore < 0) {
      util.showError('请输入有效的总分')
      return
    }
    
    const scoreData = {
      id: isEditing ? this.getExistingScoreId() : storage.generateId(),
      assignmentId,
      studentId: currentStudent.id,
      totalScore: totalScore,
      subScores: currentScore.subScores.map(s => parseFloat(s) || 0),
      questionScores: currentScore.questionScores.map(s => parseFloat(s) || 0),
      hierarchicalScores: currentScore.hierarchicalScores || [], // 保存分层级评分数据
      comment: currentScore.comment || '',
      createdAt: isEditing ? this.getExistingCreatedAt() : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    try {
      if (isEditing) {
        // 更新现有成绩
        const scores = storage.getScores()
        const index = scores.findIndex(s => s.id === scoreData.id)
        if (index >= 0) {
          scores[index] = scoreData
          storage.saveScores(scores)
        }
      } else {
        // 添加新成绩
        const scores = storage.getScores()
        scores.push(scoreData)
        storage.saveScores(scores)
      }

      util.showSuccess(isEditing ? '成绩更新成功' : '成绩保存成功')
      
      // 刷新数据
      this.loadData()
      
      // 如果是新建模式，自动跳到下一个学生
      if (!isEditing) {
        this.onNextStudent()
      }
    } catch (error) {
      util.showError('保存失败，请重试')
    }
  },

  // 获取现有成绩ID
  getExistingScoreId() {
    const scores = storage.getScoresByAssignmentId(this.data.assignmentId)
    const existingScore = scores.find(s => s.studentId === this.data.currentStudent.id)
    return existingScore ? existingScore.id : storage.generateId()
  },

  // 获取现有创建时间
  getExistingCreatedAt() {
    const scores = storage.getScoresByAssignmentId(this.data.assignmentId)
    const existingScore = scores.find(s => s.studentId === this.data.currentStudent.id)
    return existingScore ? existingScore.createdAt : new Date().toISOString()
  },

  // 下一个学生
  onNextStudent() {
    const { filteredStudents, currentStudentId } = this.data
    const currentIndex = filteredStudents.findIndex(s => s.id === currentStudentId)
    
    if (currentIndex >= 0 && currentIndex < filteredStudents.length - 1) {
      const nextStudent = filteredStudents[currentIndex + 1]
      this.onStudentSelect({
        currentTarget: {
          dataset: {
            student: nextStudent
          }
        }
      })
    }
  }
})