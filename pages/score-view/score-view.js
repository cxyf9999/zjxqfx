// score-view.js
const storage = require('../../utils/storage')
const util = require('../../utils/util')

Page({
  data: {
    assignmentId: '',
    assignmentInfo: {},
    allScores: [],
    filteredScores: [],
    statistics: {
      gradedCount: 0,
      totalCount: 0,
      averageScore: '0'
    },
    scoreDistribution: [],
    topStudents: [],
    filterType: 'all',
    sortType: 0,
    sortOptions: ['按姓名排序', '按学号排序', '按分数排序', '按批改时间排序'],
    showDetails: false,
    emptyText: '暂无学生数据'
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

  onShow() {
    this.loadData()
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

    // 构建完整的成绩数据
    const allScores = students.map(student => {
      const score = scores.find(s => s.studentId === student.id)
      
      if (score) {
        return {
          id: score.id,
          studentId: student.id,
          studentName: student.name,
          studentNumber: student.studentNumber,
          isGraded: true,
          totalScore: score.totalScore || 0,
          subScores: score.subScores || [],
          questionScores: score.questionScores || [],
          comment: score.comment || '',
          gradedTime: util.formatDate(new Date(score.updatedAt || score.createdAt))
        }
      } else {
        return {
          id: '',
          studentId: student.id,
          studentName: student.name,
          studentNumber: student.studentNumber,
          isGraded: false,
          totalScore: 0,
          subScores: [],
          questionScores: [],
          comment: '',
          gradedTime: ''
        }
      }
    })

    this.setData({
      assignmentInfo: {
        ...assignment,
        createdAt: util.formatDate(new Date(assignment.createdAt))
      },
      allScores
    })

    this.calculateStatistics()
    this.filterAndSortScores()
    this.calculateDistribution()
    this.calculateTopStudents()
  },

  // 计算统计数据
  calculateStatistics() {
    const { allScores } = this.data
    const gradedScores = allScores.filter(s => s.isGraded)
    
    let averageScore = '0'
    if (gradedScores.length > 0) {
      const totalScore = gradedScores.reduce((sum, score) => sum + score.totalScore, 0)
      averageScore = Math.round((totalScore / gradedScores.length) * 100) / 100
    }

    this.setData({
      statistics: {
        gradedCount: gradedScores.length,
        totalCount: allScores.length,
        averageScore: averageScore.toString()
      }
    })
  },

  // 筛选和排序成绩
  filterAndSortScores() {
    let filtered = [...this.data.allScores]

    // 筛选
    switch (this.data.filterType) {
      case 'graded':
        filtered = filtered.filter(s => s.isGraded)
        break
      case 'ungraded':
        filtered = filtered.filter(s => !s.isGraded)
        break
      case 'all':
      default:
        // 不筛选
        break
    }

    // 排序
    switch (this.data.sortType) {
      case 0: // 按姓名排序
        filtered.sort((a, b) => a.studentName.localeCompare(b.studentName))
        break
      case 1: // 按学号排序
        filtered.sort((a, b) => a.studentNumber.localeCompare(b.studentNumber))
        break
      case 2: // 按分数排序
        filtered.sort((a, b) => {
          if (a.isGraded && b.isGraded) {
            return b.totalScore - a.totalScore
          } else if (a.isGraded) {
            return -1
          } else if (b.isGraded) {
            return 1
          } else {
            return 0
          }
        })
        break
      case 3: // 按批改时间排序
        filtered.sort((a, b) => {
          if (a.isGraded && b.isGraded) {
            return new Date(b.gradedTime) - new Date(a.gradedTime)
          } else if (a.isGraded) {
            return -1
          } else if (b.isGraded) {
            return 1
          } else {
            return 0
          }
        })
        break
    }

    this.setData({
      filteredScores: filtered
    })
  },

  // 计算分数分布
  calculateDistribution() {
    const gradedScores = this.data.allScores.filter(s => s.isGraded)
    
    if (gradedScores.length === 0) {
      this.setData({
        scoreDistribution: []
      })
      return
    }

    // 根据当前作业的最大分值计算动态区间
    const assignment = this.data.assignmentInfo
    let maxScore = 100 // 默认100分

    if (assignment.scoringOptions && assignment.scoringOptions.mode === 'custom' && assignment.scoringOptions.customScores) {
      maxScore = assignment.scoringOptions.customScores.reduce((sum, score) => sum + score, 0)
    } else if (assignment.scoringOptions && assignment.scoringOptions.mode === 'standard') {
      maxScore = assignment.questionCount * 10
    }

    // 使用动态分数区间
    const ranges = util.calculateScoreRanges(maxScore)

    const distribution = ranges.map(rangeItem => {
      const count = gradedScores.filter(score => {
        return score.totalScore >= rangeItem.min && score.totalScore <= rangeItem.max
      }).length

      const percentage = Math.round((count / gradedScores.length) * 100)

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

  // 计算排名前列
  calculateTopStudents() {
    const gradedScores = this.data.allScores
      .filter(s => s.isGraded)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10)

    this.setData({
      topStudents: gradedScores
    })
  },

  // 筛选类型改变
  onFilterChange(e) {
    const filterType = e.currentTarget.dataset.type
    this.setData({ 
      filterType,
      emptyText: this.getEmptyText(filterType)
    })
    this.filterAndSortScores()
  },

  // 排序类型变化
  onSortChange(e) {
    const sortType = parseInt(e.detail.value)
    this.setData({
      sortType
    })
    this.filterAndSortScores()
  },

  // 切换详情显示
  onToggleDetails() {
    this.setData({
      showDetails: !this.data.showDetails
    })
  },

  // 查看成绩详情
  onScoreDetail(e) {
    const score = e.currentTarget.dataset.score
    if (!score.isGraded) return

    // 显示成绩详情弹窗或跳转到详情页
    this.showScoreDetail(score)
  },

  // 显示成绩详情
  showScoreDetail(score) {
    const { assignmentInfo } = this.data
    let detailText = `学生：${score.studentName}\n学号：${score.studentNumber}\n总分：${score.totalScore}分\n`

    if (assignmentInfo.scoringMode === 'standard' && assignmentInfo.hasSubQuestions) {
      detailText += '\n分题得分：\n'
      score.subScores.forEach((subScore, index) => {
        detailText += `第${index + 1}题：${subScore}分\n`
      })
    } else if (assignmentInfo.scoringMode === 'custom') {
      detailText += '\n分题得分：\n'
      score.questionScores.forEach((qScore, index) => {
        detailText += `第${index + 1}题：${qScore}分\n`
      })
    }

    if (score.comment) {
      detailText += `\n评语：${score.comment}\n`
    }

    detailText += `\n批改时间：${score.gradedTime}`

    wx.showModal({
      title: '成绩详情',
      content: detailText,
      showCancel: false,
      confirmText: '确定'
    })
  },

  // 批改学生
  onGradeStudent(e) {
    const student = e.currentTarget.dataset.student
    wx.navigateTo({
      url: `/pages/score-entry/score-entry?assignmentId=${this.data.assignmentId}`
    })
  },

  // 开始批改
  onStartGrading() {
    wx.navigateTo({
      url: `/pages/score-entry/score-entry?assignmentId=${this.data.assignmentId}`
    })
  },

  // 导出成绩
  onExportScores() {
    const { assignmentInfo, allScores } = this.data
    const gradedScores = allScores.filter(s => s.isGraded)

    if (gradedScores.length === 0) {
      util.showError('暂无成绩可导出')
      return
    }

    // 生成Excel数据
    this.generateExcelFile(assignmentInfo, gradedScores)
  },

  // 生成Excel文件
  generateExcelFile(assignmentInfo, gradedScores) {
    try {
      // 构建CSV格式数据（Excel兼容）
      let csvContent = '\uFEFF' // BOM for UTF-8
      
      // 添加作业信息
      csvContent += `作业名称,${assignmentInfo.name}\n`
      csvContent += `作业类型,${assignmentInfo.type}\n`
      csvContent += `题目数量,${assignmentInfo.questionCount}\n`
      csvContent += `导出时间,${util.formatDate(new Date())}\n`
      csvContent += `已批改,${this.data.statistics.gradedCount}/${this.data.statistics.totalCount}\n`
      csvContent += `平均分,${this.data.statistics.averageScore}\n`
      csvContent += '\n'
      
      // 添加表头
      csvContent += '序号,姓名,学号,总分,评语,批改时间\n'
      
      // 添加成绩数据
      gradedScores.forEach((score, index) => {
        const comment = (score.comment || '无').replace(/,/g, '，') // 替换逗号避免CSV格式问题
        csvContent += `${index + 1},${score.studentName},${score.studentNumber},${score.totalScore},"${comment}",${score.gradedTime}\n`
      })

      // 生成文件名的日期格式
      const now = new Date()
      const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`
      const fileName = `${assignmentInfo.name}_成绩单_${dateStr}.csv`
      
      // 检测运行环境
      if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
        // 微信小程序环境
        this.exportInWechat(csvContent, fileName)
      } else if (typeof window !== 'undefined' && window.document) {
        // 浏览器环境
        this.exportInBrowser(csvContent, fileName)
      } else {
        // 其他环境，使用降级方案
        this.fallbackExport(csvContent, fileName)
      }
    } catch (error) {
      console.error('导出Excel失败:', error)
      util.showError('导出失败，请重试')
    }
  },

  // 微信小程序环境导出
  exportInWechat(csvContent, fileName) {
    const fs = wx.getFileSystemManager()
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
    
    fs.writeFile({
      filePath: filePath,
      data: csvContent,
      encoding: 'utf8',
      success: () => {
        
        // 尝试使用文档分享
        if (wx.openDocument) {
          wx.openDocument({
            filePath: filePath,
            fileType: 'csv',
            success: () => {
              util.showSuccess('CSV文件已打开，可通过系统分享功能保存')
            },
            fail: (err) => {
              console.error('打开文档失败:', err)
              this.tryShareFile(filePath, fileName, csvContent)
            }
          })
        } else {
          this.tryShareFile(filePath, fileName, csvContent)
        }
      },
      fail: (err) => {
        console.error('写入文件失败:', err)
        util.showError('文件写入失败: ' + (err.errMsg || '未知错误'))
        this.fallbackExport(csvContent, fileName)
      }
    })
  },

  // 尝试分享文件
  tryShareFile(filePath, fileName, csvContent) {
    // 检查是否支持文件分享
    if (wx.shareFileMessage) {
      wx.shareFileMessage({
        filePath: filePath,
        fileName: fileName,
        success: () => {
          util.showSuccess('CSV文件分享成功')
        },
        fail: (err) => {
          console.error('分享文件失败:', err)
          this.tryShowActionSheet(filePath, fileName, csvContent)
        }
      })
    } else {
      this.tryShowActionSheet(filePath, fileName, csvContent)
    }
  },

  // 显示操作选项
  tryShowActionSheet(filePath, fileName, csvContent) {
    wx.showActionSheet({
      itemList: ['复制到剪贴板', '保存到相册(如支持)', '查看文件路径'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.fallbackExport(csvContent, fileName)
            break
          case 1:
            this.trySaveToAlbum(filePath, csvContent, fileName)
            break
          case 2:
            wx.showModal({
              title: '文件已保存',
              content: `文件路径: ${filePath}\n\n请通过文件管理器查找该文件`,
              showCancel: false
            })
            break
        }
      },
      fail: () => {
        this.fallbackExport(csvContent, fileName)
      }
    })
  },

  // 尝试保存到相册（作为备选方案）
  trySaveToAlbum(filePath, csvContent, fileName) {
    // 由于CSV不是图片，这里提供文件路径信息
    wx.showModal({
      title: '文件已创建',
      content: `CSV文件已保存到:\n${filePath}\n\n您可以通过文件管理器访问该文件，或选择复制到剪贴板`,
      confirmText: '复制到剪贴板',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          this.fallbackExport(csvContent, fileName)
        }
      }
    })
  },

  // 浏览器环境导出
  exportInBrowser(csvContent, fileName) {
    try {
      // 创建Blob对象
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      
      // 创建下载链接
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      link.style.visibility = 'hidden'
      
      // 添加到页面并触发下载
      document.body.appendChild(link)
      link.click()
      
      // 清理
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      util.showSuccess('CSV文件下载成功，请查看浏览器下载文件夹')
    } catch (error) {
      console.error('浏览器下载失败:', error)
      this.fallbackExport(csvContent, fileName)
    }
  },

  // 降级导出方案
  fallbackExport(csvContent, fileName) {
    // 复制到剪贴板作为降级方案
    if (typeof wx !== 'undefined' && wx.setClipboardData) {
      // 微信小程序环境
      wx.setClipboardData({
        data: csvContent,
        success: () => {
          util.showSuccess('CSV数据已复制到剪贴板，可粘贴到Excel中')
        },
        fail: () => {
          util.showError('导出失败')
        }
      })
    } else if (navigator.clipboard) {
      // 现代浏览器环境
      navigator.clipboard.writeText(csvContent).then(() => {
        util.showSuccess('CSV数据已复制到剪贴板，可粘贴到Excel中')
      }).catch(() => {
        util.showError('导出失败')
      })
    } else {
      // 传统浏览器环境
      try {
        const textArea = document.createElement('textarea')
        textArea.value = csvContent
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        util.showSuccess('CSV数据已复制到剪贴板，可粘贴到Excel中')
      } catch (err) {
        util.showError('导出失败')
      }
    }
  },

  // 获取空状态文本
  getEmptyText(filterType = this.data.filterType) {
    switch (filterType) {
      case 'graded':
        return '暂无已批改的成绩'
      case 'ungraded':
        return '所有学生都已批改完成'
      default:
        return '暂无学生数据'
    }
  }
})