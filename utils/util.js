// util.js - 通用工具函数

/**
 * 格式化时间
 */
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

/**
 * 格式化日期（只显示日期）
 */
const formatDate = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return `${[year, month, day].map(formatNumber).join('-')}`
}

/**
 * 格式化简短日期（月-日）
 */
const formatShortDate = date => {
  const month = date.getMonth() + 1
  const day = date.getDate()

  return `${[month, day].map(formatNumber).join('-')}`
}

/**
 * 补零
 */
const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 显示加载提示
 */
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title,
    mask: true
  })
}

/**
 * 隐藏加载提示
 */
const hideLoading = () => {
  wx.hideLoading()
}

/**
 * 显示成功提示
 */
const showSuccess = (title = '操作成功') => {
  wx.showToast({
    title,
    icon: 'success',
    duration: 2000
  })
}

/**
 * 显示错误提示
 */
const showError = (title = '操作失败') => {
  wx.showToast({
    title,
    icon: 'error',
    duration: 2000
  })
}

/**
 * 显示确认对话框
 */
const showConfirm = (content, title = '确认') => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm)
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

/**
 * 显示输入框
 */
const showPrompt = (content, placeholder = '') => {
  return new Promise((resolve) => {
    wx.showModal({
      title: '输入',
      content,
      editable: true,
      placeholderText: placeholder,
      success: (res) => {
        if (res.confirm) {
          resolve(res.content)
        } else {
          resolve(null)
        }
      },
      fail: () => {
        resolve(null)
      }
    })
  })
}

/**
 * 防抖函数
 */
const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 */
const throttle = (func, limit) => {
  let inThrottle
  return function() {
    const args = arguments
    const context = this
    if (!inThrottle) {
      func.apply(context, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 深拷贝
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (typeof obj === 'object') {
    const clonedObj = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
}

/**
 * 验证手机号
 */
const validatePhone = (phone) => {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * 验证邮箱
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 计算分数统计
 */
const calculateScoreStats = (scores) => {
  if (!scores || scores.length === 0) {
    return {
      total: 0,
      average: 0,
      highest: 0,
      lowest: 0,
      passRate: 0
    }
  }

  const validScores = scores.filter(score => score !== null && score !== undefined && !isNaN(score))
  
  if (validScores.length === 0) {
    return {
      total: scores.length,
      average: 0,
      highest: 0,
      lowest: 0,
      passRate: 0
    }
  }

  const total = validScores.length
  const sum = validScores.reduce((acc, score) => acc + score, 0)
  const average = sum / total
  const highest = Math.max(...validScores)
  const lowest = Math.min(...validScores)
  const passCount = validScores.filter(score => score >= 60).length
  const passRate = (passCount / total) * 100

  return {
    total,
    average: Math.round(average * 100) / 100,
    highest,
    lowest,
    passRate: Math.round(passRate * 100) / 100
  }
}

/**
 * 根据最大分值动态计算分数区间
 * @param {number} maxScore - 最大分值
 * @returns {Array} 分数区间数组
 */
const calculateScoreRanges = (maxScore) => {
  if (!maxScore || maxScore <= 0) {
    return []
  }

  // 根据最大分值确定区间策略
  let ranges = []
  
  if (maxScore <= 100) {
    // 传统100分制
    ranges = [
      { range: `${Math.round(maxScore * 0.9)}-${maxScore}`, min: Math.round(maxScore * 0.9), max: maxScore },
      { range: `${Math.round(maxScore * 0.8)}-${Math.round(maxScore * 0.9) - 1}`, min: Math.round(maxScore * 0.8), max: Math.round(maxScore * 0.9) - 1 },
      { range: `${Math.round(maxScore * 0.7)}-${Math.round(maxScore * 0.8) - 1}`, min: Math.round(maxScore * 0.7), max: Math.round(maxScore * 0.8) - 1 },
      { range: `${Math.round(maxScore * 0.6)}-${Math.round(maxScore * 0.7) - 1}`, min: Math.round(maxScore * 0.6), max: Math.round(maxScore * 0.7) - 1 },
      { range: `0-${Math.round(maxScore * 0.6) - 1}`, min: 0, max: Math.round(maxScore * 0.6) - 1 }
    ]
  } else {
    // 高分值制（120分、150分等）
    const step = Math.ceil(maxScore / 5) // 分为5个区间
    ranges = [
      { range: `${maxScore - step + 1}-${maxScore}`, min: maxScore - step + 1, max: maxScore },
      { range: `${maxScore - 2 * step + 1}-${maxScore - step}`, min: maxScore - 2 * step + 1, max: maxScore - step },
      { range: `${maxScore - 3 * step + 1}-${maxScore - 2 * step}`, min: maxScore - 3 * step + 1, max: maxScore - 2 * step },
      { range: `${maxScore - 4 * step + 1}-${maxScore - 3 * step}`, min: maxScore - 4 * step + 1, max: maxScore - 3 * step },
      { range: `0-${maxScore - 4 * step}`, min: 0, max: maxScore - 4 * step }
    ]
  }

  return ranges
}

module.exports = {
  formatTime,
  formatDate,
  formatShortDate,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showConfirm,
  showPrompt,
  debounce,
  throttle,
  deepClone,
  validatePhone,
  validateEmail,
  calculateScoreStats,
  calculateScoreRanges
}