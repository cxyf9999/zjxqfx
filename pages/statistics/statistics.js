// statistics.js
const storage = require('../../utils/storage')
const util = require('../../utils/util')

Page({
  data: {
    currentClassId: '',
    currentClassName: '',
    overviewStats: {
      totalAssignments: 0,
      totalStudents: 0,
      totalScores: 0,
      averageScore: '0'
    },
    assignmentStats: [],
    studentRanking: [],
    scoreDistribution: [],
    recentActivities: [],
    rankingOptions: ['平均分排名', '完成作业数排名'],
    rankingType: 0
  },

  onLoad() {
    this.loadData()
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

    this.setData({
      currentClassId,
      currentClassName: currentClass.name
    })

    // 加载各种统计数据
    this.loadOverviewStats()
    this.loadAssignmentStats()
    this.loadStudentRanking()
    this.loadScoreDistribution()
    this.loadRecentActivities()
  },

  // 加载总体统计
  loadOverviewStats() {
    const assignments = storage.getAssignmentsByClassId(this.data.currentClassId)
    const students = storage.getStudentsByClassId(this.data.currentClassId)
    const allScores = storage.getScores()
    
    // 计算该班级的所有成绩
    const classScores = allScores.filter(score => {
      const assignment = assignments.find(a => a.id === score.assignmentId)
      return assignment && assignment.classId === this.data.currentClassId
    })

    let averageScore = '0'
    if (classScores.length > 0) {
      const totalScore = classScores.reduce((sum, score) => sum + (score.totalScore || 0), 0)
      averageScore = Math.round((totalScore / classScores.length) * 100) / 100
    }

    this.setData({
      overviewStats: {
        totalAssignments: assignments.length,
        totalStudents: students.length,
        totalScores: classScores.length,
        averageScore: averageScore || '0'
      }
    })
  },

  // 加载作业统计
  loadAssignmentStats() {
    const assignments = storage.getAssignmentsByClassId(this.data.currentClassId)
    const students = storage.getStudentsByClassId(this.data.currentClassId)
    
    const assignmentStats = assignments.map(assignment => {
      const scores = storage.getScoresByAssignmentId(assignment.id)
      const gradedCount = scores.length
      const totalCount = students.length
      const progressPercent = totalCount > 0 ? Math.round((gradedCount / totalCount) * 100) : 0

      let averageScore = '暂无'
      let minScore = '暂无'
      let maxScore = '暂无'

      if (scores.length > 0) {
        const scoreValues = scores.map(s => s.totalScore || 0)
        const totalScore = scoreValues.reduce((sum, score) => sum + score, 0)
        averageScore = Math.round((totalScore / scores.length) * 100) / 100
        minScore = Math.min(...scoreValues)
        maxScore = Math.max(...scoreValues)
      }

      return {
        id: assignment.id,
        name: assignment.name,
        type: assignment.type,
        gradedCount,
        totalCount,
        progressPercent,
        averageScore,
        minScore,
        maxScore
      }
    })

    // 按进度排序
    assignmentStats.sort((a, b) => b.progressPercent - a.progressPercent)

    this.setData({
      assignmentStats
    })
  },

  // 加载学生排名
  loadStudentRanking() {
    const students = storage.getStudentsByClassId(this.data.currentClassId)
    const assignments = storage.getAssignmentsByClassId(this.data.currentClassId)
    
    const studentStats = students.map(student => {
      const scores = storage.getScoresByStudentId(student.id)
      
      // 只计算本班级的作业成绩
      const classScores = scores.filter(score => {
        const assignment = assignments.find(a => a.id === score.assignmentId)
        return assignment && assignment.classId === this.data.currentClassId
      })

      let averageScore = 0
      if (classScores.length > 0) {
        const totalScore = classScores.reduce((sum, score) => sum + (score.totalScore || 0), 0)
        averageScore = Math.round((totalScore / classScores.length) * 100) / 100
      }

      return {
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        averageScore,
        completedCount: classScores.length
      }
    })

    this.updateStudentRanking(studentStats)
  },

  // 更新学生排名
  updateStudentRanking(studentStats) {
    const rankingType = this.data.rankingType
    let sortedStudents = []
    
    if (rankingType === 0) {
      // 按平均分排名
      sortedStudents = studentStats
        .filter(s => s.averageScore > 0)
        .sort((a, b) => b.averageScore - a.averageScore)
        .map((student, index) => ({
          ...student,
          rank: index + 1,
          displayValue: student.averageScore,
          displayLabel: '平均分'
        }))
    } else {
      // 按完成作业数排名
      sortedStudents = studentStats
        .filter(s => s.completedCount > 0)
        .sort((a, b) => b.completedCount - a.completedCount)
        .map((student, index) => ({
          ...student,
          rank: index + 1,
          displayValue: student.completedCount,
          displayLabel: '完成数'
        }))
    }

    this.setData({
      studentRanking: sortedStudents.slice(0, 10) // 只显示前10名
    })
  },

  // 加载成绩分布
  loadScoreDistribution() {
    const assignments = storage.getAssignmentsByClassId(this.data.currentClassId)
    const allScores = storage.getScores()
    
    // 获取该班级的所有成绩
    const classScores = allScores.filter(score => {
      const assignment = assignments.find(a => a.id === score.assignmentId)
      return assignment && assignment.classId === this.data.currentClassId
    })

    if (classScores.length === 0) {
      this.setData({
        scoreDistribution: []
      })
      return
    }

    // 计算该班级所有作业的最大可能分值
    let maxPossibleScore = 100 // 默认100分
    if (assignments.length > 0) {
      // 找到最高的作业分值作为参考
      const maxAssignmentScore = Math.max(...assignments.map(assignment => {
        if (assignment.scoringOptions && assignment.scoringOptions.mode === 'custom' && assignment.scoringOptions.customScores) {
          return assignment.scoringOptions.customScores.reduce((sum, score) => sum + score, 0)
        } else if (assignment.scoringOptions && assignment.scoringOptions.mode === 'standard') {
          return assignment.questionCount * 10
        }
        return 100 // 默认值
      }))
      maxPossibleScore = maxAssignmentScore
    }

    // 使用动态分数区间
    const ranges = util.calculateScoreRanges(maxPossibleScore)

    const distribution = ranges.map(rangeItem => {
      const count = classScores.filter(score => {
        const totalScore = score.totalScore || 0
        return totalScore >= rangeItem.min && totalScore <= rangeItem.max
      }).length

      const percentage = Math.round((count / classScores.length) * 100)

      return {
        range: rangeItem.range,
        count,
        percentage
      }
    })

    this.setData({
      scoreDistribution: distribution
    })
  },

  // 加载最近活动
  loadRecentActivities() {
    const assignments = storage.getAssignmentsByClassId(this.data.currentClassId)
    const students = storage.getStudentsByClassId(this.data.currentClassId)
    const allScores = storage.getScores()
    
    const activities = []

    // 添加最近创建的作业
    assignments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3)
      .forEach(assignment => {
        activities.push({
          id: `assignment-${assignment.id}`,
          icon: '📝',
          title: `创建了作业"${assignment.name}"`,
          time: util.formatDate(new Date(assignment.createdAt))
        })
      })

    // 添加最近添加的学生
    students
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2)
      .forEach(student => {
        activities.push({
          id: `student-${student.id}`,
          icon: '👤',
          title: `添加了学生"${student.name}"`,
          time: util.formatDate(new Date(student.createdAt))
        })
      })

    // 添加最近的成绩记录
    const classScores = allScores.filter(score => {
      const assignment = assignments.find(a => a.id === score.assignmentId)
      return assignment && assignment.classId === this.data.currentClassId
    })

    classScores
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2)
      .forEach(score => {
        const assignment = assignments.find(a => a.id === score.assignmentId)
        const student = students.find(s => s.id === score.studentId)
        
        if (assignment && student) {
          activities.push({
            id: `score-${score.id}`,
            icon: '✅',
            title: `批改了${student.name}的"${assignment.name}"`,
            time: util.formatDate(new Date(score.createdAt))
          })
        }
      })

    // 按时间排序并限制数量
    activities.sort((a, b) => new Date(b.time) - new Date(a.time))

    this.setData({
      recentActivities: activities.slice(0, 8)
    })
  },

  // 排名类型变化
  onRankingTypeChange(e) {
    const rankingType = parseInt(e.detail.value)
    this.setData({
      rankingType
    })
    
    // 重新计算排名
    this.loadStudentRanking()
  }
})