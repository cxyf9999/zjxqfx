// assignments.js
const storage = require('../../utils/storage')
const util = require('../../utils/util')
const markdownParser = require('../../utils/markdown-parser')

Page({
  data: {
    assignments: [],
    currentClassId: '',
    currentClassName: '',
    showModal: false,
    isEdit: false,
    editingAssignmentId: '',
    assignmentTypes: ['作业', '测验', '考试', '练习', '其他'],
    formData: {
      name: '',
      type: '',
      typeIndex: -1,
      questionStructure: [], // 三级题目结构
      scoringMode: 'auto',
      customScoresText: ''
    },
    totalScore: 0, // 总分计算
    
    // 批量设置分数相关
    showBatchScoreModal: false,
    batchScoreConfig: {
      title: '',
      mode: 'uniform', // 'uniform' 统一分数, 'individual' 分别设置
      level1Index: -1,
      level2Index: -1,
      targetLevel: '', // 'level2' 或 'level3'
      uniformScore: '',
      questions: [],
      totalPreview: 0
    },

    // Markdown导入相关
    importPreview: {
      show: false,
      questionStructure: [],
      totalScore: 0,
      summary: {
        level1Count: 0,
        level2Count: 0,
        level3Count: 0,
        knowledgePointsCount: 0
      }
    }
  },

  onLoad(options) {
    this.loadData()
    
    // 如果从首页跳转过来并且带有action=create参数，自动显示新建模态框
    if (options && options.action === 'create') {
      // 延迟一点时间确保页面加载完成
      setTimeout(() => {
        this.showAddModal()
      }, 100)
    }
  },

  onShow() {
    this.loadData()
  },

  // 加载数据
  loadData() {
    const currentClassId = storage.getCurrentClassId()
    const classes = storage.getClasses()
    const currentClass = classes.find(c => c.id === currentClassId)
    
    if (!currentClass) {
      util.showError('请先选择班级')
      wx.switchTab({
        url: '/pages/classes/classes'
      })
      return
    }

    const assignments = storage.getAssignmentsByClassId(currentClassId)
    const students = storage.getStudentsByClassId(currentClassId)
    
    // 计算每个作业的统计信息
    const assignmentsWithStats = assignments.map(assignment => {
      const scores = storage.getScoresByAssignmentId(assignment.id)
      const gradedCount = scores.length
      const totalCount = students.length
      
      let averageScore = 0
      if (gradedCount > 0) {
        const totalScore = scores.reduce((sum, score) => sum + (score.totalScore || 0), 0)
        averageScore = Math.round((totalScore / gradedCount) * 100) / 100
      }

      return {
        ...assignment,
        createdAt: util.formatDate(new Date(assignment.createdAt)),
        stats: {
          gradedCount,
          totalCount,
          averageScore: averageScore || '暂无'
        }
      }
    })

    // 按创建时间倒序排列
    assignmentsWithStats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    this.setData({
      assignments: assignmentsWithStats,
      currentClassId,
      currentClassName: currentClass.name
    })
  },

  // 显示新建弹窗
  showAddModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      editingAssignmentId: '',
      formData: {
        name: '',
        type: '',
        typeIndex: -1,
        questionCount: '',
        hasSubQuestions: false,
        subQuestionCountsText: '',
        scoringMode: 'standard',
        customScoresText: ''
      }
    })
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showModal: false,
      isEdit: false,
      editingAssignmentId: '',
      formData: {
        name: '',
        type: '',
        typeIndex: -1,
        questionStructure: [],
        scoringMode: 'auto',
        customScoresText: ''
      },
      totalScore: 0
    })
  },

  // 重置表单
  resetForm() {
    this.setData({
      'formData.name': '',
      'formData.type': '',
      'formData.typeIndex': -1,
      'formData.questionStructure': [],
      'formData.scoringMode': 'auto',
      'formData.customScoresText': '',
      totalScore: 0
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止点击模态框内容时关闭弹窗
  },

  // 输入框变化
  onInputChange(e) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 作业类型选择
  onTypeChange(e) {
    const typeIndex = parseInt(e.detail.value)
    const type = this.data.assignmentTypes[typeIndex]
    
    this.setData({
      'formData.typeIndex': typeIndex,
      'formData.type': type
    })
  },

  // 三级题目管理函数
  
  // 添加一级题目（大题）
  addLevel1Question() {
    const currentStructure = this.data.formData.questionStructure || [];
    const questionStructure = [...currentStructure];
    questionStructure.push({
      score: 0,
      calculatedScore: 0,
      subQuestions: []
    });
    this.setData({
      'formData.questionStructure': questionStructure
    });
    this.calculateTotalScore();
  },

  // 删除一级题目
  deleteLevel1Question(e) {
    const level1Index = e.currentTarget.dataset.level1;
    const currentStructure = this.data.formData.questionStructure || [];
    const questionStructure = [...currentStructure];
    questionStructure.splice(level1Index, 1);
    this.setData({
      'formData.questionStructure': questionStructure
    });
    this.calculateTotalScore();
  },

  // 添加二级题目（小题）
  addLevel2Question(e) {
    const level1Index = e.currentTarget.dataset.level1;
    const currentStructure = this.data.formData.questionStructure || [];
    const questionStructure = [...currentStructure];
    if (questionStructure[level1Index]) {
      questionStructure[level1Index].subQuestions.push({
        score: 0,
        calculatedScore: 0,
        subQuestions: []
      });
      this.setData({
        'formData.questionStructure': questionStructure
      });
      this.calculateTotalScore();
    }
  },

  // 删除二级题目
  deleteLevel2Question(e) {
    const { level1, level2 } = e.currentTarget.dataset;
    const currentStructure = this.data.formData.questionStructure || [];
    const questionStructure = [...currentStructure];
    if (questionStructure[level1] && questionStructure[level1].subQuestions) {
      questionStructure[level1].subQuestions.splice(level2, 1);
      this.setData({
        'formData.questionStructure': questionStructure
      });
      this.calculateTotalScore();
    }
  },

  // 添加三级题目（细分题）
  addLevel3Question(e) {
    const { level1, level2 } = e.currentTarget.dataset;
    const currentStructure = this.data.formData.questionStructure || [];
    const questionStructure = [...currentStructure];
    if (questionStructure[level1] && 
        questionStructure[level1].subQuestions && 
        questionStructure[level1].subQuestions[level2]) {
      questionStructure[level1].subQuestions[level2].subQuestions.push({
        score: 0,
        calculatedScore: 0
      });
      this.setData({
        'formData.questionStructure': questionStructure
      });
      this.calculateTotalScore();
    }
  },

  // 删除三级题目
  deleteLevel3Question(e) {
    const { level1, level2, level3 } = e.currentTarget.dataset;
    const currentStructure = this.data.formData.questionStructure || [];
    const questionStructure = [...currentStructure];
    if (questionStructure[level1] && 
        questionStructure[level1].subQuestions && 
        questionStructure[level1].subQuestions[level2] &&
        questionStructure[level1].subQuestions[level2].subQuestions) {
      questionStructure[level1].subQuestions[level2].subQuestions.splice(level3, 1);
      this.setData({
        'formData.questionStructure': questionStructure
      });
      this.calculateTotalScore();
    }
  },

  // 分数变更处理
  onLevel1ScoreChange(e) {
    const level1Index = e.currentTarget.dataset.level1;
    const score = parseFloat(e.detail.value) || 0;
    const currentStructure = this.data.formData.questionStructure || [];
    const questionStructure = [...currentStructure];
    if (questionStructure[level1Index]) {
      questionStructure[level1Index].score = score;
      this.setData({
        'formData.questionStructure': questionStructure
      });
      this.calculateTotalScore();
    }
  },

  onLevel2ScoreChange(e) {
    const { level1, level2 } = e.currentTarget.dataset;
    const score = parseFloat(e.detail.value) || 0;
    const currentStructure = this.data.formData.questionStructure || [];
    const questionStructure = [...currentStructure];
    if (questionStructure[level1] && questionStructure[level1].subQuestions && questionStructure[level1].subQuestions[level2]) {
      questionStructure[level1].subQuestions[level2].score = score;
      this.setData({
        'formData.questionStructure': questionStructure
      });
      this.calculateTotalScore();
    }
  },

  onLevel3ScoreChange(e) {
    const { level1, level2, level3 } = e.currentTarget.dataset;
    const score = parseFloat(e.detail.value) || 0;
    const currentStructure = this.data.formData.questionStructure || [];
    const questionStructure = [...currentStructure];
    if (questionStructure[level1] && 
        questionStructure[level1].subQuestions && 
        questionStructure[level1].subQuestions[level2] &&
        questionStructure[level1].subQuestions[level2].subQuestions &&
        questionStructure[level1].subQuestions[level2].subQuestions[level3]) {
      questionStructure[level1].subQuestions[level2].subQuestions[level3].score = score;
      this.setData({
        'formData.questionStructure': questionStructure
      });
      this.calculateTotalScore();
    }
  },

  // 计算层级分数和总分
  calculateTotalScore() {
    const questionStructure = this.data.formData.questionStructure || [];
    let totalScore = 0;
    
    // 深拷贝题目结构以避免直接修改原数据
    const updatedStructure = JSON.parse(JSON.stringify(questionStructure));
    
    updatedStructure.forEach(level1 => {
      let level1CalculatedScore = 0;
      
      if (level1.subQuestions && Array.isArray(level1.subQuestions) && level1.subQuestions.length > 0) {
        // 一级题目有二级题目，计算二级题目的分数
        level1.subQuestions.forEach(level2 => {
          let level2CalculatedScore = 0;
          
          if (level2.subQuestions && Array.isArray(level2.subQuestions) && level2.subQuestions.length > 0) {
            // 二级题目有三级题目，计算三级题目分数之和
            level2.subQuestions.forEach(level3 => {
              level2CalculatedScore += level3.score || 0;
            });
            level2.calculatedScore = level2CalculatedScore;
          } else {
            // 二级题目没有三级题目，使用手动输入的分数
            level2CalculatedScore = level2.score || 0;
            level2.calculatedScore = level2CalculatedScore;
          }
          
          level1CalculatedScore += level2CalculatedScore;
        });
        level1.calculatedScore = level1CalculatedScore;
      } else {
        // 一级题目没有二级题目，使用手动输入的分数（这种情况很少见）
        level1CalculatedScore = level1.score || 0;
        level1.calculatedScore = level1CalculatedScore;
      }
      
      totalScore += level1CalculatedScore;
    });
    
    // 更新数据
    this.setData({
      'formData.questionStructure': updatedStructure,
      totalScore: totalScore
    });
  },

  // 评分方式变化
  onScoringModeChange(e) {
    const scoringMode = e.detail.value
    
    this.setData({
      'formData.scoringMode': scoringMode
    })
  },

  // 提交表单
  handleSubmit() {
    const { name, type, questionStructure, scoringMode, customScoresText } = this.data.formData
    
    // 验证必填字段
    if (!name.trim()) {
      util.showError('请输入作业名称')
      return
    }

    if (!type) {
      util.showError('请选择作业类型')
      return
    }

    // 题目结构验证
    if (!questionStructure || questionStructure.length === 0) {
      util.showError('请至少添加一个大题')
      return
    }

    // 验证每个题目都有分数
    let hasInvalidScore = false
    let totalQuestions = 0
    
    questionStructure.forEach((level1, i) => {
      totalQuestions++
      // 一级题目使用calculatedScore（自动计算）
      const level1Score = level1.calculatedScore || 0
      if (level1Score <= 0) {
        hasInvalidScore = true
        return
      }
      
      if (level1.subQuestions && level1.subQuestions.length > 0) {
        level1.subQuestions.forEach((level2, j) => {
          totalQuestions++
          // 二级题目：如果有三级题目则使用calculatedScore，否则使用score
          const level2Score = (level2.subQuestions && level2.subQuestions.length > 0) 
            ? (level2.calculatedScore || 0) 
            : (level2.score || 0)
          if (level2Score <= 0) {
            hasInvalidScore = true
            return
          }
          
          if (level2.subQuestions && level2.subQuestions.length > 0) {
            level2.subQuestions.forEach((level3, k) => {
              totalQuestions++
              // 三级题目使用score（手动输入）
              if (!level3.score || level3.score <= 0) {
                hasInvalidScore = true
                return
              }
            })
          }
        })
      }
    })
    
    if (hasInvalidScore) {
      util.showError('请为所有题目设置有效分数')
      return
    }

    // 验证自定义分值
    let customScores = []
    if (scoringMode === 'custom') {
      if (!customScoresText.trim()) {
        util.showError('请输入自定义分值')
        return
      }

      try {
        customScores = customScoresText.split(',').map(score => {
          const num = parseFloat(score.trim())
          if (isNaN(num) || num <= 0) {
            throw new Error('分值必须为正数')
          }
          return num
        })

        if (customScores.length !== totalQuestions) {
          util.showError(`分值配置数量(${customScores.length})与题目数量(${totalQuestions})不匹配`)
          return
        }
      } catch (error) {
        util.showError('分值格式错误，请用逗号分隔的正数')
        return
      }
    }

    if (this.data.isEdit) {
      this.updateAssignment(name.trim(), type, questionStructure, this.data.totalScore, totalQuestions, scoringMode, customScores)
    } else {
      this.createAssignment(name.trim(), type, questionStructure, this.data.totalScore, totalQuestions, scoringMode, customScores)
    }
  },

  // 创建作业
  createAssignment(name, type, questionStructure, totalScore, totalQuestions, scoringMode, customScores) {
    const assignments = storage.getAssignments()
    
    // 检查作业名称是否重复（同班级内）
    if (assignments.some(a => a.name === name && a.classId === this.data.currentClassId)) {
      util.showError('作业名称已存在')
      return
    }

    const newAssignment = {
      id: storage.generateId(),
      classId: this.data.currentClassId,
      name,
      type,
      questionStructure: JSON.parse(JSON.stringify(questionStructure)),
      totalScore,
      totalQuestions,
      scoringOptions: {
        mode: scoringMode,
        customScores: scoringMode === 'custom' ? customScores : []
      },
      createdAt: new Date().toISOString()
    }

    assignments.push(newAssignment)
    
    if (storage.saveAssignments(assignments)) {
      util.showSuccess('作业创建成功')
      this.hideModal()
      this.loadData()
    } else {
      util.showError('创建失败')
    }
  },

  // 更新作业
  updateAssignment(name, type, questionStructure, totalScore, totalQuestions, scoringMode, customScores) {
    const assignments = storage.getAssignments()
    const assignmentIndex = assignments.findIndex(a => a.id === this.data.editingAssignmentId)
    
    if (assignmentIndex === -1) {
      util.showError('作业不存在')
      return
    }

    // 检查作业名称是否重复（排除自己）
    if (assignments.some(a => a.name === name && a.classId === this.data.currentClassId && a.id !== this.data.editingAssignmentId)) {
      util.showError('作业名称已存在')
      return
    }

    assignments[assignmentIndex] = {
      ...assignments[assignmentIndex],
      name,
      type,
      questionStructure: JSON.parse(JSON.stringify(questionStructure)),
      totalScore,
      totalQuestions,
      scoringOptions: {
        mode: scoringMode,
        customScores: scoringMode === 'custom' ? customScores : []
      },
      updatedAt: new Date().toISOString()
    }

    if (storage.saveAssignments(assignments)) {
      util.showSuccess('作业更新成功')
      this.hideModal()
      this.loadData()
    } else {
      util.showError('更新失败')
    }
  },

  // 编辑题目结构
  editQuestions(e) {
    const assignmentId = e.currentTarget.dataset.id
    const assignment = this.data.assignments.find(a => a.id === assignmentId)
    
    if (!assignment) {
      util.showError('作业不存在')
      return
    }

    // 跳转到题目编辑页面
    wx.navigateTo({
      url: `/pages/assignment-edit/assignment-edit?id=${assignmentId}`
    })
  },

  // 编辑作业
  editAssignment(e) {
    const assignmentId = e.currentTarget.dataset.id
    const assignment = this.data.assignments.find(a => a.id === assignmentId)
    
    if (!assignment) {
      util.showError('作业不存在')
      return
    }

    // 处理旧版本数据兼容性
    let questionStructure = assignment.questionStructure || [];
    if (!questionStructure.length && assignment.questionCount) {
      // 兼容旧版本数据，转换为新的三级结构
      questionStructure = [];
      for (let i = 0; i < assignment.questionCount; i++) {
        questionStructure.push({
          score: assignment.scoringOptions?.customScores?.[i] || 10,
          subQuestions: []
        });
      }
    }

    const typeIndex = this.data.assignmentTypes.indexOf(assignment.type)
    const customScoresText = assignment.scoringOptions?.mode === 'custom' ? assignment.scoringOptions.customScores.join(',') : ''

    this.setData({
      showModal: true,
      isEdit: true,
      editingAssignmentId: assignmentId,
      formData: {
        name: assignment.name,
        type: assignment.type,
        typeIndex,
        questionStructure: JSON.parse(JSON.stringify(questionStructure)), // 深拷贝
        scoringMode: assignment.scoringOptions?.mode || 'standard',
        customScoresText
      }
    }, () => {
      // 计算总分
      this.calculateTotalScore();
    })
  },

  // 删除作业
  async deleteAssignment(e) {
    const assignmentId = e.currentTarget.dataset.id
    const assignment = this.data.assignments.find(a => a.id === assignmentId)
    
    if (!assignment) {
      util.showError('作业不存在')
      return
    }

    // 检查是否有成绩记录
    const scores = storage.getScoresByAssignmentId(assignmentId)
    
    if (scores.length > 0) {
      const confirmed = await util.showConfirm(
        `该作业还有${scores.length}条成绩记录，删除后相关数据也会被删除，确定要删除吗？`,
        '确认删除'
      )
      
      if (!confirmed) return
    } else {
      const confirmed = await util.showConfirm(`确定要删除作业"${assignment.name}"吗？`)
      if (!confirmed) return
    }

    // 删除作业及相关成绩
    this.performDelete(assignmentId)
  },

  // 执行删除操作
  performDelete(assignmentId) {
    const assignments = storage.getAssignments()
    const scores = storage.getScores()

    // 删除作业
    const newAssignments = assignments.filter(a => a.id !== assignmentId)
    
    // 删除相关成绩
    const newScores = scores.filter(s => s.assignmentId !== assignmentId)

    // 保存数据
    if (storage.saveAssignments(newAssignments) && storage.saveScores(newScores)) {
      util.showSuccess('删除成功')
      this.loadData()
    } else {
      util.showError('删除失败')
    }
  },

  // 查看作业详情
  viewAssignment(e) {
    const assignmentId = e.currentTarget.dataset.id
    
    wx.navigateTo({
      url: `/pages/score-view/score-view?assignmentId=${assignmentId}`
    })
  },

  // 批改作业
  gradeAssignment(e) {
    const assignmentId = e.currentTarget.dataset.id
    
    wx.navigateTo({
      url: `/pages/score-entry/score-entry?assignmentId=${assignmentId}`
    })
  },

  // 显示二级题目批量设置分数弹窗
  showBatchSetLevel2Score(e) {
    const level1Index = e.currentTarget.dataset.level1
    const level1Question = this.data.formData.questionStructure[level1Index]
    
    if (!level1Question || !level1Question.subQuestions || level1Question.subQuestions.length < 2) {
      util.showError('至少需要2个小题才能批量设置')
      return
    }

    // 过滤出没有三级题目的二级题目（只有这些可以手动设置分数）
    const editableQuestions = level1Question.subQuestions
      .map((q, index) => ({ ...q, originalIndex: index }))
      .filter(q => !q.subQuestions || q.subQuestions.length === 0)

    if (editableQuestions.length < 2) {
      util.showError('至少需要2个可编辑的小题才能批量设置')
      return
    }

    const questions = editableQuestions.map((q, index) => ({
      label: `第${q.originalIndex + 1}小题`,
      score: q.score || 0,
      originalIndex: q.originalIndex
    }))

    this.setData({
      showBatchScoreModal: true,
      'batchScoreConfig.title': `第${level1Index + 1}大题 - 批量设置小题分数`,
      'batchScoreConfig.level1Index': level1Index,
      'batchScoreConfig.level2Index': -1,
      'batchScoreConfig.targetLevel': 'level2',
      'batchScoreConfig.mode': 'uniform',
      'batchScoreConfig.uniformScore': '',
      'batchScoreConfig.questions': questions,
      'batchScoreConfig.totalPreview': 0
    })
  },

  // 显示三级题目批量设置分数弹窗
  showBatchSetLevel3Score(e) {
    const level1Index = e.currentTarget.dataset.level1
    const level2Index = e.currentTarget.dataset.level2
    const level2Question = this.data.formData.questionStructure[level1Index].subQuestions[level2Index]
    
    if (!level2Question || !level2Question.subQuestions || level2Question.subQuestions.length < 2) {
      util.showError('至少需要2个细分题才能批量设置')
      return
    }

    const questions = level2Question.subQuestions.map((q, index) => ({
      label: `第${index + 1}细分题`,
      score: q.score || 0,
      originalIndex: index
    }))

    this.setData({
      showBatchScoreModal: true,
      'batchScoreConfig.title': `第${level1Index + 1}大题第${level2Index + 1}小题 - 批量设置细分题分数`,
      'batchScoreConfig.level1Index': level1Index,
      'batchScoreConfig.level2Index': level2Index,
      'batchScoreConfig.targetLevel': 'level3',
      'batchScoreConfig.mode': 'uniform',
      'batchScoreConfig.uniformScore': '',
      'batchScoreConfig.questions': questions,
      'batchScoreConfig.totalPreview': 0
    })
  },

  // 隐藏批量设置分数弹窗
  hideBatchScoreModal() {
    this.setData({
      showBatchScoreModal: false
    })
  },

  // 批量设置模式改变
  onBatchModeChange(e) {
    const mode = e.detail.value
    this.setData({
      'batchScoreConfig.mode': mode,
      'batchScoreConfig.uniformScore': '',
      'batchScoreConfig.totalPreview': 0
    })
    
    // 如果切换到分别设置模式，重置所有题目分数为当前值
    if (mode === 'individual') {
      this.calculateBatchTotalPreview()
    }
  },

  // 统一分数输入改变
  onBatchScoreInputChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    
    this.setData({
      [`batchScoreConfig.${field}`]: value
    })
    
    if (field === 'uniformScore') {
      this.calculateBatchTotalPreview()
    }
  },

  // 单个题目分数改变
  onIndividualScoreChange(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    const questions = [...this.data.batchScoreConfig.questions]
    
    questions[index].score = parseFloat(value) || 0
    
    this.setData({
      'batchScoreConfig.questions': questions
    })
    
    this.calculateBatchTotalPreview()
  },

  // 计算批量设置的总分预览
  calculateBatchTotalPreview() {
    const config = this.data.batchScoreConfig
    let total = 0
    
    if (config.mode === 'uniform') {
      const uniformScore = parseFloat(config.uniformScore) || 0
      total = uniformScore * config.questions.length
    } else {
      total = config.questions.reduce((sum, q) => sum + (parseFloat(q.score) || 0), 0)
    }
    
    this.setData({
      'batchScoreConfig.totalPreview': total
    })
  },

  // 确认批量设置分数
  confirmBatchSetScore() {
    const config = this.data.batchScoreConfig
    const questionStructure = JSON.parse(JSON.stringify(this.data.formData.questionStructure))
    
    if (config.targetLevel === 'level2') {
      // 批量设置二级题目分数
      const level1Question = questionStructure[config.level1Index]
      
      config.questions.forEach(q => {
        const score = config.mode === 'uniform' 
          ? (parseFloat(config.uniformScore) || 0)
          : (parseFloat(q.score) || 0)
        
        level1Question.subQuestions[q.originalIndex].score = score
      })
      
    } else if (config.targetLevel === 'level3') {
      // 批量设置三级题目分数
      const level2Question = questionStructure[config.level1Index].subQuestions[config.level2Index]
      
      config.questions.forEach(q => {
        const score = config.mode === 'uniform' 
          ? (parseFloat(config.uniformScore) || 0)
          : (parseFloat(q.score) || 0)
        
        level2Question.subQuestions[q.originalIndex].score = score
      })
    }
    
    // 更新数据并重新计算总分
    this.setData({
      'formData.questionStructure': questionStructure,
      showBatchScoreModal: false
    })
    
    this.calculateTotalScore()
    
    const count = config.questions.length
    const mode = config.mode === 'uniform' ? '统一' : '分别'
    util.showSuccess(`已${mode}设置${count}个题目的分数`)
  },

  // Markdown导入相关方法

  // 导入Markdown文件
  importFromMarkdown() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['md', 'markdown'],
      success: (res) => {
        if (res.tempFiles && res.tempFiles.length > 0) {
          const file = res.tempFiles[0]
          
          // 检查文件大小（限制为1MB）
          if (file.size > 1024 * 1024) {
            util.showError('文件大小不能超过1MB')
            return
          }

          // 检查文件类型
          const fileName = file.name.toLowerCase()
          if (!fileName.endsWith('.md') && !fileName.endsWith('.markdown')) {
            util.showError('请选择Markdown文件（.md或.markdown）')
            return
          }

          // 读取文件内容
          this.readMarkdownFile(file)
        }
      },
      fail: (err) => {
        console.error('选择文件失败:', err)
        util.showError('选择文件失败，请重试')
      }
    })
  },

  // 读取Markdown文件内容
  readMarkdownFile(file) {
    const fileSystemManager = wx.getFileSystemManager()
    
    fileSystemManager.readFile({
      filePath: file.path,
      encoding: 'utf8',
      success: (res) => {
        try {
          this.parseMarkdownContent(res.data)
        } catch (error) {
          console.error('解析文件内容失败:', error)
          util.showError('文件内容解析失败')
        }
      },
      fail: (err) => {
        console.error('读取文件失败:', err)
        util.showError('读取文件失败，请重试')
      }
    })
  },

  // 解析Markdown内容
  parseMarkdownContent(content) {
    try {
      // 验证Markdown格式
      const validation = markdownParser.validateMarkdownFormat(content)
      
      if (!validation.isValid) {
        const errorMsg = validation.errors.join('\n')
        util.showError(`Markdown格式错误：\n${errorMsg}`)
        return
      }

      // 显示警告信息（如果有）
      if (validation.warnings.length > 0) {
        const warningMsg = validation.warnings.join('\n')
        console.warn('Markdown格式警告:', warningMsg)
      }

      // 解析Markdown内容
      const parseResult = markdownParser.parseMarkdownToQuestionStructure(content)
      
      // 检查解析是否成功
      if (!parseResult.success || !parseResult.questionStructure || parseResult.questionStructure.length === 0) {
        util.showError('未能解析出有效的题目结构，请检查Markdown格式')
        return
      }

      const questionStructure = parseResult.questionStructure
      
      // 转换为小程序格式
      const assignmentData = markdownParser.convertToAssignmentFormat(questionStructure)
      
      // 使用解析结果中的摘要信息
      const summary = parseResult.summary

      // 显示预览
      this.setData({
        'importPreview.show': true,
        'importPreview.questionStructure': questionStructure,
        'importPreview.totalScore': assignmentData.totalScore,
        'importPreview.summary': summary
      })

      util.showSuccess('Markdown文件解析成功！请查看预览信息')

    } catch (error) {
      console.error('解析Markdown失败:', error)
      util.showError('解析Markdown文件失败：' + error.message)
    }
  },

  // 关闭导入预览
  closeImportPreview() {
    this.setData({
      'importPreview.show': false,
      'importPreview.questionStructure': [],
      'importPreview.totalScore': 0,
      'importPreview.summary': {
        level1Count: 0,
        level2Count: 0,
        level3Count: 0,
        knowledgePointsCount: 0
      }
    })
  },

  // 确认导入
  confirmImport() {
    const importData = this.data.importPreview
    
    if (!importData.questionStructure || importData.questionStructure.length === 0) {
      util.showError('没有可导入的题目结构')
      return
    }

    // 将导入的题目结构设置到表单数据中
    this.setData({
      'formData.questionStructure': JSON.parse(JSON.stringify(importData.questionStructure)),
      totalScore: importData.totalScore
    })

    // 重新计算分数以确保数据一致性
    this.calculateTotalScore()

    // 关闭预览
    this.closeImportPreview()

    const summary = importData.summary
    util.showSuccess(`导入成功！共导入${summary.level1Count}个大题，${summary.level2Count}个小题，${summary.level3Count}个细分题`)
  }
})